import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from "@nestjs/common";
import {
  CmsFormSubmissionStatus, CmsWebhookDeliveryStatus, Prisma, Role,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  AssignTermsDto, CreateCmsFormDto, CreateCmsWebhookDto, CreateMenuDto, CreateMenuItemDto,
  CreateRedirectDto, CreateTaxonomyDto, CreateTaxonomyTermDto, CreateTermTranslationDto,
  ListMediaQueryDto, SubmitCmsFormDto, UpdateCmsFormDto, UpdateCmsWebhookDto,
  UpdateFormSubmissionDto, UpdateMenuDto, UpdateMenuItemDto, UpdateRedirectDto,
  UpdateTaxonomyDto, UpdateTaxonomyTermDto, UpdateRolePermissionsDto,
} from "./cms-management.dto";

const permissionCatalog = [
  ["cms.content.read", "Read CMS content", "Read content and translations."],
  ["cms.content.create", "Create CMS content", "Create content records and language versions."],
  ["cms.content.edit", "Edit CMS content", "Edit draft content and shared fields."],
  ["cms.content.submit", "Submit for review", "Submit content to editorial review."],
  ["cms.content.review", "Review content", "Reject or return submitted content."],
  ["cms.content.publish", "Publish content", "Publish and schedule content."],
  ["cms.content.archive", "Archive content", "Archive or restore archived content."],
  ["cms.locales.manage", "Manage locales", "Create and configure content languages."],
  ["cms.content-types.manage", "Manage content types", "Create content schemas and their fields."],
  ["cms.media.read", "Read media library", "View media assets."],
  ["cms.media.upload", "Upload media", "Upload new assets and edit metadata."],
  ["cms.media.delete", "Delete media", "Remove media assets from storage."],
  ["cms.taxonomy.manage", "Manage taxonomies", "Create and organize categories and terms."],
  ["cms.menus.manage", "Manage menus", "Manage localized navigation menus."],
  ["cms.redirects.manage", "Manage redirects", "Manage and resolve site redirects."],
  ["cms.forms.manage", "Manage forms", "Create and configure public forms."],
  ["cms.forms.submissions.read", "Read form submissions", "Review public form submissions."],
  ["cms.forms.submissions.manage", "Manage form submissions", "Mark submissions reviewed, resolved or spam."],
  ["cms.webhooks.manage", "Manage webhooks", "Configure trusted outbound webhook endpoints."],
  ["cms.permissions.manage", "Manage CMS permissions", "Change role permission grants."],
  ["cms.audit.read", "Read audit log", "View CMS activity history."],
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
function safePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !/[\r\n\\]/.test(path);
}
function validDestination(path: string): boolean {
  if (safePath(path)) return true;
  try { const url = new URL(path); return url.protocol === "https:"; } catch { return false; }
}

@Injectable()
export class CmsManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async listTaxonomies(includeInactive = false) {
    return this.prisma.taxonomy.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { terms: true } } },
    });
  }

  async createTaxonomy(dto: CreateTaxonomyDto) {
    return this.prisma.taxonomy.create({
      data: {
        key: dto.key, name: dto.name, description: dto.description,
        isHierarchical: dto.isHierarchical ?? true, isActive: dto.isActive ?? true,
      },
    });
  }

  async updateTaxonomy(id: string, dto: UpdateTaxonomyDto) {
    const taxonomy = await this.prisma.taxonomy.findUnique({ where: { id }, include: { terms: { where: { parentId: { not: null } }, take: 1 } });
    if (!taxonomy) throw new NotFoundException("Taxonomy not found.");
    if (dto.isHierarchical === false && taxonomy.terms.length) {
      throw new BadRequestException("A taxonomy with child terms cannot be made flat until its hierarchy is removed.");
    }
    const data: Prisma.TaxonomyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isHierarchical !== undefined) data.isHierarchical = dto.isHierarchical;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.taxonomy.update({ where: { id }, data });
  }

  async listTaxonomyTerms(taxonomyId: string, includeInactive = false) {
    if (!await this.prisma.taxonomy.findUnique({ where: { id: taxonomyId } })) throw new NotFoundException("Taxonomy not found.");
    return this.prisma.taxonomyTerm.findMany({
      where: { taxonomyId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        translations: { include: { locale: { select: { code: true, name: true, direction: true } } } },
        _count: { select: { contents: true, children: true } },
      },
    });
  }

  async createTaxonomyTerm(taxonomyId: string, dto: CreateTaxonomyTermDto) {
    const taxonomy = await this.prisma.taxonomy.findUnique({ where: { id: taxonomyId } });
    if (!taxonomy) throw new NotFoundException("Taxonomy not found.");
    await this.validateTermParent(taxonomyId, dto.parentId ?? null, taxonomy.isHierarchical);
    return this.prisma.taxonomyTerm.create({
      data: {
        taxonomyId, name: dto.name, slug: dto.slug, description: dto.description,
        parentId: dto.parentId ?? null, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
      },
      include: { translations: true },
    });
  }

  async updateTaxonomyTerm(taxonomyId: string, termId: string, dto: UpdateTaxonomyTermDto) {
    const term = await this.prisma.taxonomyTerm.findFirst({ where: { id: termId, taxonomyId } });
    if (!term) throw new NotFoundException("Taxonomy term not found.");
    const taxonomy = await this.prisma.taxonomy.findUnique({ where: { id: taxonomyId } });
    if (!taxonomy) throw new NotFoundException("Taxonomy not found.");
    if (dto.parentId !== undefined) {
      if (dto.parentId === termId) throw new BadRequestException("A term cannot be its own parent.");
      await this.validateTermParent(taxonomyId, dto.parentId, taxonomy.isHierarchical, termId);
    }
    const data: Prisma.TaxonomyTermUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.parentId !== undefined) data.parent = dto.parentId === null ? { disconnect: true } : { connect: { id: dto.parentId } };
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.taxonomyTerm.update({ where: { id: termId }, data, include: { translations: true } });
  }

  async createTermTranslation(termId: string, dto: CreateTermTranslationDto) {
    const term = await this.prisma.taxonomyTerm.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException("Taxonomy term not found.");
    const locale = await this.prisma.locale.findUnique({ where: { code: dto.localeCode } });
    if (!locale || !locale.isActive) throw new BadRequestException("Active locale was not found.");
    return this.prisma.cmsTaxonomyTermTranslation.upsert({
      where: { termId_localeId: { termId, localeId: locale.id } },
      create: { termId, localeId: locale.id, name: dto.name, slug: dto.slug, description: dto.description },
      update: { name: dto.name, slug: dto.slug, description: dto.description },
      include: { locale: { select: { code: true, name: true } } },
    });
  }

  async assignContentTerms(contentId: string, dto: AssignTermsDto) {
    const content = await this.prisma.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundException("Content not found.");
    const uniqueIds = [...new Set(dto.termIds)];
    if (uniqueIds.length !== dto.termIds.length) throw new BadRequestException("Duplicate term IDs are not allowed.");
    if (uniqueIds.length) {
      const terms = await this.prisma.taxonomyTerm.findMany({ where: { id: { in: uniqueIds }, isActive: true }, select: { id: true } });
      if (terms.length !== uniqueIds.length) throw new BadRequestException("One or more terms do not exist or are inactive.");
    }
    await this.prisma.$transaction(async tx => {
      await tx.contentTaxonomyTerm.deleteMany({ where: { contentId } });
      if (uniqueIds.length) await tx.contentTaxonomyTerm.createMany({ data: uniqueIds.map(termId => ({ contentId, termId })) });
    });
    return this.prisma.contentTaxonomyTerm.findMany({
      where: { contentId }, include: { term: { include: { taxonomy: true, translations: { include: { locale: true } } } } },
    });
  }

  async createMenu(dto: CreateMenuDto) {
    const locale = await this.prisma.locale.findUnique({ where: { code: dto.localeCode } });
    if (!locale || !locale.isActive) throw new BadRequestException("Active locale was not found.");
    return this.prisma.cmsMenu.create({ data: { key: dto.key, name: dto.name, localeId: locale.id, isActive: dto.isActive ?? true },
      include: { locale: { select: { code: true, name: true, nativeName: true, direction: true } }, _count: { select: { items: true } } } });
  }

  async listMenus(includeInactive = false) {
    return this.prisma.cmsMenu.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ key: "asc" }, { locale: { code: "asc" } }],
      include: { locale: { select: { code: true, name: true, nativeName: true, direction: true } }, _count: { select: { items: true } } },
    });
  }

  async updateMenu(id: string, dto: UpdateMenuDto) {
    if (!await this.prisma.cmsMenu.findUnique({ where: { id } })) throw new NotFoundException("Menu not found.");
    const data: Prisma.CmsMenuUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.cmsMenu.update({ where: { id }, data, include: { locale: true } });
  }

  async listMenuItems(menuId: string) {
    if (!await this.prisma.cmsMenu.findUnique({ where: { id: menuId } })) throw new NotFoundException("Menu not found.");
    return this.prisma.cmsMenuItem.findMany({ where: { menuId }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      include: { parent: { select: { id: true, label: true } }, content: { select: { id: true } } } });
  }

  async createMenuItem(menuId: string, dto: CreateMenuItemDto) {
    if (!await this.prisma.cmsMenu.findUnique({ where: { id: menuId } })) throw new NotFoundException("Menu not found.");
    await this.validateMenuItem(menuId, dto);
    return this.prisma.cmsMenuItem.create({ data: {
      menuId, label: dto.label, url: dto.url ?? null, contentId: dto.contentId ?? null,
      parentId: dto.parentId ?? null, targetBlank: dto.targetBlank ?? false, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
    } });
  }

  async updateMenuItem(menuId: string, itemId: string, dto: UpdateMenuItemDto) {
    const item = await this.prisma.cmsMenuItem.findFirst({ where: { id: itemId, menuId } });
    if (!item) throw new NotFoundException("Menu item not found.");
    await this.validateMenuItem(menuId, dto, itemId, item);
    const data: Prisma.CmsMenuItemUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.url !== undefined) data.url = dto.url;
    if (dto.contentId !== undefined) data.content = dto.contentId === null ? { disconnect: true } : { connect: { id: dto.contentId } };
    if (dto.parentId !== undefined) data.parent = dto.parentId === null ? { disconnect: true } : { connect: { id: dto.parentId } };
    if (dto.targetBlank !== undefined) data.targetBlank = dto.targetBlank;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.cmsMenuItem.update({ where: { id: itemId }, data });
  }

  async deleteMenuItem(menuId: string, itemId: string) {
    const item = await this.prisma.cmsMenuItem.findFirst({ where: { id: itemId, menuId } });
    if (!item) throw new NotFoundException("Menu item not found.");
    await this.prisma.cmsMenuItem.delete({ where: { id: itemId } });
    return { id: itemId, deleted: true };
  }

  async getPublicMenu(key: string, localeCode: string) {
    const menu = await this.prisma.cmsMenu.findFirst({
      where: { key, isActive: true, locale: { is: { code: localeCode, isActive: true } } },
      include: { locale: { select: { code: true, name: true, nativeName: true, direction: true } } },
    });
    if (!menu) throw new NotFoundException("Published menu was not found.");
    const all = await this.prisma.cmsMenuItem.findMany({
      where: { menuId: menu.id, isActive: true }, orderBy: { sortOrder: "asc" },
      include: { content: { include: { translations: { where: { locale: { is: { code: localeCode } }, publishedSlug: { not: null } }, take: 1 } } } },
    });
    const byParent = new Map<string | null, Array<Record<string, unknown>>>();
    for (const item of all) {
      const linkedTranslation = item.content?.translations[0];
      const href = item.url ?? (linkedTranslation ? "/" + localeCode + "/" + linkedTranslation.publishedSlug : null);
      const row = { id: item.id, label: item.label, href, targetBlank: item.targetBlank, sortOrder: item.sortOrder, parentId: item.parentId, children: [] as Array<Record<string, unknown>> };
      const siblings = byParent.get(item.parentId) ?? [];
      siblings.push(row); byParent.set(item.parentId, siblings);
    }
    const attach = (items: Array<Record<string, unknown>>): Array<Record<string, unknown>> => items.map(item => ({
      ...item,
      children: attach(byParent.get(String(item.id)) ?? []),
    }));
    return { id: menu.id, key: menu.key, name: menu.name, locale: menu.locale, items: attach(byParent.get(null) ?? []) };
  }

  async listRedirects(includeInactive = false) {
    return this.prisma.cmsRedirect.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { sourcePath: "asc" },
      include: { locale: { select: { code: true, name: true } } },
    });
  }

  async createRedirect(dto: CreateRedirectDto) {
    this.assertRedirectPaths(dto.sourcePath, dto.destinationPath);
    const localeId = await this.getOptionalLocaleId(dto.localeCode);
    const duplicate = await this.prisma.cmsRedirect.findFirst({ where: { sourcePath: dto.sourcePath, localeId } });
    if (duplicate) throw new ConflictException("A redirect for this source path and locale already exists.");
    return this.prisma.cmsRedirect.create({
      data: { sourcePath: dto.sourcePath, destinationPath: dto.destinationPath, statusCode: dto.statusCode ?? 301,
        localeId, isActive: dto.isActive ?? true },
      include: { locale: { select: { code: true, name: true } } },
    });
  }

  async updateRedirect(id: string, dto: UpdateRedirectDto) {
    const current = await this.prisma.cmsRedirect.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Redirect not found.");
    const sourcePath = dto.sourcePath ?? current.sourcePath;
    const destinationPath = dto.destinationPath ?? current.destinationPath;
    this.assertRedirectPaths(sourcePath, destinationPath);
    const localeId = dto.localeCode === undefined ? current.localeId : await this.getOptionalLocaleId(dto.localeCode);
    const duplicate = await this.prisma.cmsRedirect.findFirst({ where: { sourcePath, localeId, id: { not: id } } });
    if (duplicate) throw new ConflictException("A redirect for this source path and locale already exists.");
    const data: Prisma.CmsRedirectUpdateInput = { sourcePath, destinationPath };
    if (dto.statusCode !== undefined) data.statusCode = dto.statusCode;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.localeCode !== undefined) data.locale = localeId === null ? { disconnect: true } : { connect: { id: localeId } };
    return this.prisma.cmsRedirect.update({ where: { id }, data, include: { locale: { select: { code: true, name: true } } } });
  }

  async resolveRedirect(path: string, localeCode?: string) {
    if (!safePath(path)) throw new BadRequestException("Only local paths may be resolved.");
    const locale = localeCode ? await this.prisma.locale.findUnique({ where: { code: localeCode } }) : null;
    const candidate = await this.prisma.cmsRedirect.findFirst({
      where: { sourcePath: path, isActive: true, ...(locale ? { localeId: locale.id } : { localeId: null }) },
      orderBy: { updatedAt: "desc" },
    });
    const selected = candidate ?? (locale ? await this.prisma.cmsRedirect.findFirst({ where: { sourcePath: path, isActive: true, localeId: null } }) : null);
    if (!selected) throw new NotFoundException("Redirect not found.");
    await this.prisma.cmsRedirect.update({ where: { id: selected.id }, data: { hitCount: { increment: 1 } } });
    return { destinationPath: selected.destinationPath, statusCode: selected.statusCode };
  }

  async listForms(includeInactive = false) {
    return this.prisma.cmsForm.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { submissions: true } } },
    });
  }
  async createForm(dto: CreateCmsFormDto) {
    this.validateFormSchema(dto.schema);
    return this.prisma.cmsForm.create({ data: {
      key: dto.key, name: dto.name, description: dto.description, schema: asJson(dto.schema),
      successMessage: dto.successMessage, isActive: dto.isActive ?? true,
    } });
  }
  async updateForm(id: string, dto: UpdateCmsFormDto) {
    const current = await this.prisma.cmsForm.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Form not found.");
    if (dto.schema !== undefined) this.validateFormSchema(dto.schema);
    const data: Prisma.CmsFormUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.schema !== undefined) data.schema = asJson(dto.schema);
    if (dto.successMessage !== undefined) data.successMessage = dto.successMessage;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.cmsForm.update({ where: { id }, data });
  }
  async publicForm(key: string) {
    const form = await this.prisma.cmsForm.findFirst({ where: { key, isActive: true } });
    if (!form) throw new NotFoundException("Form not found.");
    return { key: form.key, name: form.name, description: form.description, schema: form.schema, successMessage: form.successMessage };
  }
  async submitForm(key: string, dto: SubmitCmsFormDto) {
    const form = await this.prisma.cmsForm.findFirst({ where: { key, isActive: true } });
    if (!form) throw new NotFoundException("Form not found.");
    this.validateSubmission(form.schema, dto.data);
    const submission = await this.prisma.cmsFormSubmission.create({ data: { formId: form.id, data: asJson(dto.data) } });
    return { id: submission.id, status: submission.status, createdAt: submission.createdAt, message: form.successMessage ?? "Submission received." };
  }
  async listFormSubmissions(formId: string, page = 1, limit = 30, status?: CmsFormSubmissionStatus) {
    if (!await this.prisma.cmsForm.findUnique({ where: { id: formId } })) throw new NotFoundException("Form not found.");
    const [data, total] = await Promise.all([
      this.prisma.cmsFormSubmission.findMany({ where: { formId, ...(status ? { status } : {}) }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.cmsFormSubmission.count({ where: { formId, ...(status ? { status } : {}) } }),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
  async updateFormSubmission(formId: string, submissionId: string, dto: UpdateFormSubmissionDto) {
    const submission = await this.prisma.cmsFormSubmission.findFirst({ where: { id: submissionId, formId } });
    if (!submission) throw new NotFoundException("Form submission not found.");
    const processedAt = dto.status === CmsFormSubmissionStatus.NEW ? null : new Date();
    return this.prisma.cmsFormSubmission.update({ where: { id: submissionId }, data: {
      status: dto.status, processedAt, ...(dto.internalNote !== undefined ? { internalNote: dto.internalNote } : {}),
    } });
  }

  async listWebhooks() {
    return this.prisma.cmsWebhook.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, endpointUrl: true, events: true, isActive: true, createdAt: true, updatedAt: true,
        _count: { select: { deliveries: true } } },
    });
  }
  async createWebhook(dto: CreateCmsWebhookDto) {
    const endpointUrl = this.validateWebhookUrl(dto.endpointUrl);
    const events = [...new Set(dto.events.map(event => event.trim()).filter(Boolean))];
    if (!events.length) throw new BadRequestException("At least one event is required.");
    return this.prisma.cmsWebhook.create({
      data: { name: dto.name, endpointUrl, secret: dto.secret, events, isActive: dto.isActive ?? true },
      select: { id: true, name: true, endpointUrl: true, events: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }
  async updateWebhook(id: string, dto: UpdateCmsWebhookDto) {
    const current = await this.prisma.cmsWebhook.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Webhook not found.");
    const data: Prisma.CmsWebhookUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.endpointUrl !== undefined) data.endpointUrl = this.validateWebhookUrl(dto.endpointUrl);
    if (dto.secret !== undefined) data.secret = dto.secret;
    if (dto.events !== undefined) {
      const events = [...new Set(dto.events.map(event => event.trim()).filter(Boolean))];
      if (!events.length) throw new BadRequestException("At least one event is required.");
      data.events = events;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.cmsWebhook.update({ where: { id }, data,
      select: { id: true, name: true, endpointUrl: true, events: true, isActive: true, createdAt: true, updatedAt: true } });
  }
  async deleteWebhook(id: string) {
    if (!await this.prisma.cmsWebhook.findUnique({ where: { id } })) throw new NotFoundException("Webhook not found.");
    await this.prisma.cmsWebhook.delete({ where: { id } });
    return { id, deleted: true };
  }
  async listWebhookDeliveries(webhookId: string, page = 1, limit = 30) {
    if (!await this.prisma.cmsWebhook.findUnique({ where: { id: webhookId } })) throw new NotFoundException("Webhook not found.");
    const [data,total] = await Promise.all([
      this.prisma.cmsWebhookDelivery.findMany({ where: { webhookId }, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" }, select: { id: true, eventKey: true, status: true, attempts: true, responseStatus: true, lastError: true, nextAttemptAt: true, deliveredAt: true, createdAt: true } }),
      this.prisma.cmsWebhookDelivery.count({ where: { webhookId } }),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async retryWebhookDelivery(webhookId: string, deliveryId: string) {
    const delivery = await this.prisma.cmsWebhookDelivery.findFirst({ where: { id: deliveryId, webhookId } });
    if (!delivery) throw new NotFoundException("Webhook delivery not found.");
    const webhook = await this.prisma.cmsWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.isActive) throw new BadRequestException("Enable the webhook before retrying a delivery.");
    return this.prisma.cmsWebhookDelivery.update({
      where: { id: deliveryId },
      data: { status: CmsWebhookDeliveryStatus.PENDING, attempts: 0, lastError: null, responseStatus: null, deliveredAt: null, nextAttemptAt: new Date() },
      select: { id: true, eventKey: true, status: true, attempts: true, responseStatus: true, lastError: true, nextAttemptAt: true, createdAt: true },
    });
  }

  async listAuditLogs(query: { page?: number; limit?: number; action?: string; entity?: string; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action?.trim()) where.action = { contains: query.action.trim(), mode: "insensitive" };
    if (query.entity?.trim()) where.entity = { contains: query.entity.trim(), mode: "insensitive" };
    if (query.search?.trim()) {
      where.OR = [
        { action: { contains: query.search.trim(), mode: "insensitive" } },
        { entity: { contains: query.search.trim(), mode: "insensitive" } },
        { entityId: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }
    const [data,total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async listPermissions() {
    const [permissions, grants] = await Promise.all([
      this.prisma.cmsPermission.findMany({ orderBy: { code: "asc" } }),
      this.prisma.cmsRolePermission.findMany({ include: { permission: { select: { code: true } } } }),
    ]);
    return {
      catalog: permissionCatalog.map(([code,name,description]) => ({
        code, name, description,
        grantedRoles: grants.filter(grant => grant.permission.code === code).map(grant => grant.role),
      })),
      roles: Object.values(Role).map(role => ({
        role,
        permissionCodes: grants.filter(grant => grant.role === role).map(grant => grant.permission.code),
      })),
      permissions,
    };
  }
  async updateRolePermissions(dto: UpdateRolePermissionsDto) {
    if (dto.role === Role.ADMIN) throw new BadRequestException("ADMIN always retains all CMS permissions.");
    const requested = [...new Set(dto.permissionCodes)];
    const valid = await this.prisma.cmsPermission.findMany({ where: { code: { in: requested } }, select: { id: true, code: true } });
    if (valid.length !== requested.length) throw new BadRequestException("One or more permission codes are not recognized.");
    await this.prisma.$transaction(async tx => {
      await tx.cmsRolePermission.deleteMany({ where: { role: dto.role } });
      if (valid.length) await tx.cmsRolePermission.createMany({ data: valid.map(permission => ({ role: dto.role, permissionId: permission.id })) });
    });
    return { role: dto.role, permissionCodes: valid.map(permission => permission.code) };
  }

  async ensureDefaultPermissions() {
    for (const [code, name, description] of permissionCatalog) {
      await this.prisma.cmsPermission.upsert({
        where: { code }, update: { name, description },
        create: { code, name, description },
      });
    }
    const permissions = await this.prisma.cmsPermission.findMany({ select: { id: true, code: true } });
    const managerCodes = new Set([
      "cms.content.read", "cms.content.create", "cms.content.edit", "cms.content.submit",
      "cms.content.review", "cms.media.read", "cms.media.upload", "cms.taxonomy.manage",
      "cms.menus.manage", "cms.redirects.manage", "cms.forms.manage", "cms.forms.submissions.read",
      "cms.forms.submissions.manage",
    ]);
    await this.prisma.$transaction(async tx => {
      for (const permission of permissions) {
        await tx.cmsRolePermission.upsert({
          where: { role_permissionId: { role: Role.ADMIN, permissionId: permission.id } },
          update: {},
          create: { role: Role.ADMIN, permissionId: permission.id },
        });
        const managerWhere = { role_permissionId: { role: Role.MANAGER, permissionId: permission.id } };
        if (managerCodes.has(permission.code)) {
          await tx.cmsRolePermission.upsert({ where: managerWhere, update: {}, create: { role: Role.MANAGER, permissionId: permission.id } });
        }
      }
    });
  }

  private async validateTermParent(taxonomyId: string, parentId: string | null, hierarchical: boolean, currentTermId?: string) {
    if (!parentId) return;
    if (!hierarchical) throw new BadRequestException("This taxonomy does not allow child terms.");
    if (parentId === currentTermId) throw new BadRequestException("A term cannot be its own parent.");
    const parent = await this.prisma.taxonomyTerm.findFirst({ where: { id: parentId, taxonomyId } });
    if (!parent) throw new BadRequestException("Parent term must belong to the same taxonomy.");
    let cursor: string | null = parentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === currentTermId) throw new BadRequestException("A term hierarchy cannot contain a cycle.");
      if (seen.has(cursor)) throw new BadRequestException("Existing term hierarchy contains a cycle; repair it before editing.");
      seen.add(cursor);
      const node: { parentId: string | null } | null = await this.prisma.taxonomyTerm.findUnique({ where: { id: cursor }, select: { parentId: true } });
      cursor = node?.parentId ?? null;
    }
  }

  private async validateMenuItem(menuId: string, dto: CreateMenuItemDto | UpdateMenuItemDto, currentId?: string, existing?: { url: string | null; contentId: string | null }) {
    const url = dto.url;
    const contentId = dto.contentId;
    const parentId = dto.parentId;
    if (url !== undefined && url !== null && url !== "" && !validDestination(url)) {
      throw new BadRequestException("Menu URLs must be local absolute paths or HTTPS URLs.");
    }
    if (contentId !== undefined && contentId !== null && !await this.prisma.content.findUnique({ where: { id: contentId } })) {
      throw new BadRequestException("Linked content was not found.");
    }
    const effectiveUrl = url !== undefined ? url : existing?.url;
    const effectiveContentId = contentId !== undefined ? contentId : existing?.contentId;
    if ((!effectiveUrl || !effectiveUrl.trim()) && !effectiveContentId) throw new BadRequestException("Menu item needs a URL or linked content.");
    if (parentId !== undefined && parentId !== null) {
      if (parentId === currentId) throw new BadRequestException("A menu item cannot be its own parent.");
      const parent = await this.prisma.cmsMenuItem.findFirst({ where: { id: parentId, menuId } });
      if (!parent) throw new BadRequestException("Parent item must belong to the same menu.");
      let cursor: string | null = parentId;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === currentId) throw new BadRequestException("Menu hierarchy cannot contain a cycle.");
        if (seen.has(cursor)) throw new BadRequestException("Menu hierarchy contains an existing cycle.");
        seen.add(cursor);
        const node: { parentId: string | null } | null = await this.prisma.cmsMenuItem.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = node?.parentId ?? null;
      }
    }
  }

  private async getOptionalLocaleId(localeCode?: string | null): Promise<string | null> {
    if (!localeCode) return null;
    const locale = await this.prisma.locale.findUnique({ where: { code: localeCode } });
    if (!locale || !locale.isActive) throw new BadRequestException("Active locale was not found.");
    return locale.id;
  }

  private assertRedirectPaths(sourcePath: string, destinationPath: string) {
    if (!safePath(sourcePath)) throw new BadRequestException("Redirect source must be a local absolute path.");
    if (!validDestination(destinationPath)) throw new BadRequestException("Redirect destination must be a local absolute path or HTTPS URL.");
    if (sourcePath === destinationPath) throw new BadRequestException("Redirect source and destination must be different.");
  }

  private validateFormSchema(schema: Record<string, unknown>) {
    const fields = schema.fields;
    if (!Array.isArray(fields) || fields.length < 1 || fields.length > 100) {
      throw new BadRequestException("Form schema must contain between 1 and 100 fields.");
    }
    const seen = new Set<string>();
    const allowedTypes = new Set(["text","textarea","email","phone","number","checkbox","select","multiselect","date","url"]);
    for (const item of fields) {
      const field = asRecord(item);
      if (typeof field.key !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(field.key)) throw new BadRequestException("Every form field needs a valid key.");
      if (seen.has(field.key)) throw new BadRequestException("Form field keys must be unique.");
      seen.add(field.key);
      if (typeof field.label !== "string" || !field.label.trim() || field.label.length > 160) throw new BadRequestException("Every form field needs a short label.");
      if (typeof field.type !== "string" || !allowedTypes.has(field.type)) throw new BadRequestException("Unsupported form field type: " + String(field.type));
      if (field.required !== undefined && typeof field.required !== "boolean") throw new BadRequestException("Field required flags must be boolean.");
      if ((field.type === "select" || field.type === "multiselect") && (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100 || !field.options.every(option => typeof option === "string"))) {
        throw new BadRequestException("Select fields need 1 to 100 string options.");
      }
      if (field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || Number(field.maxLength) < 1 || Number(field.maxLength) > 20000)) {
        throw new BadRequestException("maxLength must be an integer between 1 and 20000.");
      }
    }
  }

  private validateSubmission(schema: Prisma.JsonValue, input: Record<string, unknown>) {
    const definitions = (asRecord(schema).fields as unknown[] | undefined) ?? [];
    const allowed = new Map(definitions.map(value => {
      const field = asRecord(value);
      return [String(field.key), field] as const;
    }));
    for (const key of Object.keys(input)) if (!allowed.has(key)) throw new BadRequestException("Unexpected form field: " + key);
    for (const [key, definition] of allowed) {
      const field = definition;
      const value = input[key];
      const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
      if (field.required === true && empty) throw new BadRequestException("Required field is missing: " + key);
      if (empty) continue;
      if (typeof value === "string" && value.length > (typeof field.maxLength === "number" ? field.maxLength : 20000)) {
        throw new BadRequestException("Field exceeds the allowed length: " + key);
      }
      if (field.type === "checkbox" && typeof value !== "boolean") throw new BadRequestException("Invalid checkbox value: " + key);
      if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) throw new BadRequestException("Invalid numeric value: " + key);
      if (field.type === "multiselect" && (!Array.isArray(value) || !value.every(item => typeof item === "string"))) throw new BadRequestException("Invalid multi-select value: " + key);
      if ((field.type === "select" || field.type === "multiselect") && Array.isArray(field.options)) {
        const values = field.type === "select" ? [value] : value as unknown[];
        if (values.some(item => !field.options.includes(item))) throw new BadRequestException("Invalid option for field: " + key);
      }
      if (field.type === "email" && (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new BadRequestException("Invalid email value: " + key);
      if (field.type === "url") {
        try { const url = new URL(String(value)); if (!["http:","https:"].includes(url.protocol)) throw new Error("bad protocol"); }
        catch { throw new BadRequestException("Invalid URL value: " + key); }
      }
      if (field.type === "text" || field.type === "textarea" || field.type === "email" || field.type === "phone" || field.type === "date" || field.type === "url") {
        if (typeof value !== "string") throw new BadRequestException("Invalid text value: " + key);
      }
    }
  }

  private validateWebhookUrl(endpoint: string) {
    let url: URL;
    try { url = new URL(endpoint); } catch { throw new BadRequestException("Webhook endpoint URL is invalid."); }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      throw new BadRequestException("Webhook endpoints must be HTTPS URLs without embedded credentials.");
    }
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
      throw new BadRequestException("Webhook endpoints must use a public DNS hostname.");
    }
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host) || host === "::1" || host.startsWith("fc") || host.startsWith("fe80:")) {
      throw new BadRequestException("Private network webhook endpoints are not allowed.");
    }
    return url.toString();
  }
}
