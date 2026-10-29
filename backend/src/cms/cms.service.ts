import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { CmsContentStatus, CmsFieldType, CmsMediaKind, LocaleDirection, Prisma } from "@prisma/client";
import { AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { CmsWebhookService } from "./cms-webhook.service";
import {
  CmsImportPackageDto, CreateContentDto, CreateContentTypeDto, CreateContentTypeFieldDto, CreateLocaleDto, CreateTranslationDto,
  ListCmsContentsQuery, ListPublicContentQuery, RejectContentDto, ScheduleContentDto,
  UpdateContentTranslationDto, UpdateContentTypeDto, UpdateContentTypeFieldDto,
  UpdateLocaleDto, UpdateSharedFieldsDto,
} from "./dto/cms.dto";

type FieldDefinition = {
  key: string; type: CmsFieldType; isRequired: boolean; isLocalized: boolean; isActive: boolean;
  config: Prisma.JsonValue | null;
};
type TranslationRecord = {
  id: string; contentId: string; localeId: string; title: string; slug: string; excerpt: string | null;
  data: Prisma.JsonValue; seoTitle: string | null; seoDescription: string | null;
  status: CmsContentStatus; version: number; publishedAt: Date | null; scheduledAt: Date | null;
  publishedSlug: string | null; publishedSnapshot: Prisma.JsonValue | null;
  content: { id: string; data: Prisma.JsonValue; updatedAt: Date; contentType: { key: string; name: string; isActive: boolean; fields: FieldDefinition[] } };
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asRecord(value: unknown): Record<string, unknown> { return isRecord(value) ? value : {}; }
function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}
function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);
  constructor(private readonly prisma: PrismaService, @Optional() private readonly webhooks?: CmsWebhookService) {}

  async dashboardSummary() {
    const [contentCount, translationCount, groupedStatuses, activeLocaleCount, activeContentTypeCount, recentlyUpdated] = await Promise.all([
      this.prisma.content.count(),
      this.prisma.contentTranslation.count(),
      this.prisma.contentTranslation.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.locale.count({ where: { isActive: true } }),
      this.prisma.contentType.count({ where: { isActive: true } }),
      this.prisma.contentTranslation.findMany({
        take: 8,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        include: {
          locale: { select: { code: true, nativeName: true, direction: true } },
          content: { select: { contentType: { select: { key: true, name: true } } } },
        },
      }),
    ]);
    const statusCounts: Record<CmsContentStatus, number> = {
      [CmsContentStatus.DRAFT]: 0,
      [CmsContentStatus.IN_REVIEW]: 0,
      [CmsContentStatus.SCHEDULED]: 0,
      [CmsContentStatus.PUBLISHED]: 0,
      [CmsContentStatus.ARCHIVED]: 0,
    };
    for (const row of groupedStatuses) statusCounts[row.status] = row._count._all;
    return {
      contentCount,
      translationCount,
      activeLocaleCount,
      activeContentTypeCount,
      statusCounts,
      recentlyUpdated: recentlyUpdated.map(item => ({
        id: item.id,
        contentId: item.contentId,
        title: item.title,
        slug: item.slug,
        status: item.status,
        version: item.version,
        updatedAt: item.updatedAt,
        locale: item.locale,
        contentType: item.content.contentType,
      })),
    };
  }

  async listLocales(includeInactive = false) {
    return this.prisma.locale.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { fallbackLocale: { select: { id: true, code: true, name: true } } },
    });
  }

  async createLocale(dto: CreateLocaleDto) {
    if (dto.fallbackLocaleId && !await this.prisma.locale.findUnique({ where: { id: dto.fallbackLocaleId } })) {
      throw new BadRequestException("Fallback locale was not found.");
    }
    return this.prisma.$transaction(async tx => {
      const currentDefault = await tx.locale.findFirst({ where: { isDefault: true } });
      const makeDefault = dto.isDefault === true || !currentDefault;
      if (makeDefault) await tx.locale.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.locale.create({
        data: {
          code: dto.code, name: dto.name, nativeName: dto.nativeName,
          direction: dto.direction ?? LocaleDirection.LTR, isDefault: makeDefault,
          fallbackLocaleId: dto.fallbackLocaleId,
        },
        include: { fallbackLocale: { select: { id: true, code: true, name: true } } },
      });
    });
  }

  async updateLocale(id: string, dto: UpdateLocaleDto) {
    const locale = await this.prisma.locale.findUnique({ where: { id } });
    if (!locale) throw new NotFoundException("Locale not found.");
    if (dto.fallbackLocaleId === id) throw new BadRequestException("A locale cannot fall back to itself.");
    if (dto.fallbackLocaleId && !await this.prisma.locale.findUnique({ where: { id: dto.fallbackLocaleId } })) {
      throw new BadRequestException("Fallback locale was not found.");
    }
    if (locale.isDefault && dto.isDefault === false) throw new BadRequestException("Set another locale as default first.");
    if (locale.isDefault && dto.isActive === false) throw new BadRequestException("The default locale cannot be disabled.");
    const data: Prisma.LocaleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.nativeName !== undefined) data.nativeName = dto.nativeName;
    if (dto.direction !== undefined) data.direction = dto.direction;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.fallbackLocaleId !== undefined) {
      data.fallbackLocale = dto.fallbackLocaleId === null ? { disconnect: true } : { connect: { id: dto.fallbackLocaleId } };
    }
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault === true) {
        await tx.locale.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
        data.isDefault = true;
      }
      return tx.locale.update({
        where: { id }, data,
        include: { fallbackLocale: { select: { id: true, code: true, name: true } } },
      });
    });
  }

  async listContentTypes(includeInactive = false) {
    return this.prisma.contentType.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      include: {
        fields: { where: includeInactive ? undefined : { isActive: true }, orderBy: { sortOrder: "asc" } },
        _count: { select: { contents: true } },
      },
    });
  }

  async createContentType(dto: CreateContentTypeDto) {
    return this.prisma.contentType.create({
      data: {
        key: dto.key, name: dto.name, description: dto.description, isActive: dto.isActive ?? true,
        fields: { create: dto.fields.map(field => ({
          key: field.key, label: field.label, type: field.type,
          isRequired: field.isRequired ?? false, isLocalized: field.isLocalized ?? true,
          sortOrder: field.sortOrder ?? 0, ...(field.config ? { config: asJson(field.config) } : {}),
        })) },
      },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async updateContentType(id: string, dto: UpdateContentTypeDto) {
    if (!await this.prisma.contentType.findUnique({ where: { id } })) throw new NotFoundException("Content type not found.");
    const data: Prisma.ContentTypeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.contentType.update({
      where: { id }, data,
      include: { fields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
    });
  }

  async addContentTypeField(contentTypeId: string, dto: CreateContentTypeFieldDto) {
    if (!await this.prisma.contentType.findUnique({ where: { id: contentTypeId } })) throw new NotFoundException("Content type not found.");
    return this.prisma.contentTypeField.create({
      data: {
        contentTypeId, key: dto.key, label: dto.label, type: dto.type,
        isRequired: dto.isRequired ?? false, isLocalized: dto.isLocalized ?? true,
        sortOrder: dto.sortOrder ?? 0, ...(dto.config ? { config: asJson(dto.config) } : {}),
      },
    });
  }

  async updateContentTypeField(contentTypeId: string, fieldId: string, dto: UpdateContentTypeFieldDto) {
    const field = await this.prisma.contentTypeField.findFirst({ where: { id: fieldId, contentTypeId } });
    if (!field) throw new NotFoundException("Content type field not found.");
    const data: Prisma.ContentTypeFieldUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.config !== undefined) data.config = asJson(dto.config);
    if (dto.isLocalized !== undefined && dto.isLocalized !== field.isLocalized) {
      const rows = await this.prisma.content.findMany({
        where: { contentTypeId },
        select: { data: true, translations: { select: { data: true } } },
      });
      const hasData = rows.some(row =>
        Object.prototype.hasOwnProperty.call(asRecord(row.data), field.key) ||
        row.translations.some(translation => Object.prototype.hasOwnProperty.call(asRecord(translation.data), field.key)),
      );
      if (hasData) throw new BadRequestException("Field localization cannot change after values exist; migrate values to a replacement field.");
      data.isLocalized = dto.isLocalized;
    }
    return this.prisma.contentTypeField.update({ where: { id: fieldId }, data });
  }

  async listContents(query: ListCmsContentsQuery) {
    const page = Number(query.page) || 1;
    const limit = Math.min(100, Number(query.limit) || 20);
    const translationWhere: Prisma.ContentTranslationWhereInput = {};
    if (query.localeCode) translationWhere.locale = { is: { code: query.localeCode } };
    if (query.status) translationWhere.status = query.status;
    if (query.search?.trim()) {
      translationWhere.OR = [
        { title: { contains: query.search.trim(), mode: "insensitive" } },
        { slug: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }
    const where: Prisma.ContentWhereInput = {};
    if (query.typeKey) where.contentType = { is: { key: query.typeKey } };
    if (Object.keys(translationWhere).length) where.translations = { some: translationWhere };
    const [data, total] = await Promise.all([
      this.prisma.content.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: "desc" },
        include: {
          contentType: { select: { id: true, key: true, name: true } },
          translations: {
            where: Object.keys(translationWhere).length ? translationWhere : undefined,
            include: { locale: { select: { code: true, name: true, direction: true } } },
            orderBy: { updatedAt: "desc" },
          },
        },
      }),
      this.prisma.content.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getContent(id: string) {
    const item = await this.prisma.content.findUnique({
      where: { id },
      include: {
        contentType: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
        taxonomyTerms: { include: { term: { include: { taxonomy: true, translations: { include: { locale: true } } } } } },
        createdBy: { select: { id: true, name: true, email: true } },
        translations: {
          include: {
            locale: { select: { id: true, code: true, name: true, nativeName: true, direction: true } },
            revisions: { orderBy: { version: "desc" }, take: 20 },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    if (!item) throw new NotFoundException("Content not found.");
    return item;
  }

  async createContent(dto: CreateContentDto, user: AuthenticatedUser) {
    const [type, locale] = await Promise.all([
      this.prisma.contentType.findUnique({
        where: { key: dto.typeKey }, include: { fields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      }),
      this.prisma.locale.findUnique({ where: { code: dto.localeCode } }),
    ]);
    if (!type || !type.isActive) throw new BadRequestException("Active content type was not found.");
    if (!locale || !locale.isActive) throw new BadRequestException("Active locale was not found.");
    const split = this.validateAndSplitFields(dto.fields ?? {}, type.fields, true);
    await this.assertMediaReferences(split.localizedData, type.fields.filter(field => field.isLocalized));
    await this.assertMediaReferences(split.sharedData, type.fields.filter(field => !field.isLocalized));
    const created = await this.prisma.$transaction(async tx => {
      const item = await tx.content.create({
        data: { contentTypeId: type.id, createdById: user.id, data: asJson(split.sharedData) },
      });
      const translation = await tx.contentTranslation.create({
        data: {
          contentId: item.id, localeId: locale.id, title: dto.title, slug: dto.slug,
          excerpt: dto.excerpt, seoTitle: dto.seoTitle, seoDescription: dto.seoDescription,
          data: asJson(split.localizedData),
        },
      });
      await tx.contentRevision.create({
        data: {
          translationId: translation.id, version: 1, createdById: user.id,
          changeNote: "Initial draft", snapshot: this.snapshot(translation, split.sharedData),
        },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: "cms.content.created", entity: "Content", entityId: item.id,
          metadata: asJson({ typeKey: type.key, localeCode: locale.code }) },
      });
      return item;
    });
    await this.notifyCmsEvent("content.created", { contentId: created.id, typeKey: type.key, localeCode: locale.code, title: dto.title });
    return this.getContent(created.id);
  }

  async createTranslation(contentId: string, dto: CreateTranslationDto, user: AuthenticatedUser) {
    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: {
        contentType: { include: { fields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } },
        translations: { include: { locale: true } },
      },
    });
    if (!content) throw new NotFoundException("Content not found.");
    if (content.translations.some(item => item.locale.code === dto.localeCode)) {
      throw new BadRequestException("A translation already exists for this locale.");
    }
    const locale = await this.prisma.locale.findUnique({ where: { code: dto.localeCode } });
    if (!locale || !locale.isActive) throw new BadRequestException("Active locale was not found.");
    const localizedDefinitions = content.contentType.fields.filter(field => field.isLocalized && field.isActive);
    const split = this.validateAndSplitFields(dto.fields ?? {}, localizedDefinitions, true);
    await this.assertMediaReferences(split.localizedData, localizedDefinitions);
    const shared = asRecord(content.data);
    const created = await this.prisma.$transaction(async tx => {
      const translation = await tx.contentTranslation.create({
        data: {
          contentId, localeId: locale.id, title: dto.title, slug: dto.slug,
          excerpt: dto.excerpt, seoTitle: dto.seoTitle, seoDescription: dto.seoDescription,
          data: asJson(split.localizedData),
        },
      });
      await tx.contentRevision.create({
        data: { translationId: translation.id, version: 1, createdById: user.id,
          changeNote: "Translation created", snapshot: this.snapshot(translation, shared) },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: "cms.translation.created", entity: "ContentTranslation",
          entityId: translation.id, metadata: asJson({ contentId, localeCode: locale.code }) },
      });
      return translation;
    });
    await this.notifyCmsEvent("content.translation.created", { contentId, translationId: created.id, localeCode: locale.code, title: dto.title });
    return this.getContent(created.contentId);
  }

  async updateTranslation(contentId: string, localeCode: string, dto: UpdateContentTranslationDto, user: AuthenticatedUser) {
    const tr = await this.findTranslation(contentId, localeCode);
    if (tr.status === CmsContentStatus.ARCHIVED) throw new BadRequestException("Restore the archived translation before editing.");
    if (![dto.title, dto.slug, dto.excerpt, dto.seoTitle, dto.seoDescription, dto.fields].some(value => value !== undefined)) {
      throw new BadRequestException("No changes were provided.");
    }
    const currentData = asRecord(tr.data);
    const nextData = dto.fields === undefined ? currentData
      : this.mergeFieldPatch(currentData, dto.fields, tr.content.contentType.fields.filter(field => field.isLocalized && field.isActive));
    await this.assertMediaReferences(nextData, tr.content.contentType.fields.filter(field => field.isLocalized));
    const next = {
      ...tr, title: dto.title ?? tr.title, slug: dto.slug ?? tr.slug,
      excerpt: dto.excerpt !== undefined ? dto.excerpt : tr.excerpt,
      seoTitle: dto.seoTitle !== undefined ? dto.seoTitle : tr.seoTitle,
      seoDescription: dto.seoDescription !== undefined ? dto.seoDescription : tr.seoDescription,
      data: asJson(nextData),
    };
    const version = tr.version + 1;
    await this.prisma.$transaction(async tx => {
      const claim = await tx.contentTranslation.updateMany({
        where: { id: tr.id, version: tr.version, status: tr.status },
        data: {
          title: next.title, slug: next.slug, excerpt: next.excerpt,
          seoTitle: next.seoTitle, seoDescription: next.seoDescription,
          data: asJson(nextData), version,
          ...(tr.status === CmsContentStatus.PUBLISHED || tr.status === CmsContentStatus.IN_REVIEW || tr.status === CmsContentStatus.SCHEDULED
            ? { status: CmsContentStatus.DRAFT, scheduledAt: null } : {}),
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException("This translation was changed by another editor. Reload the latest version and retry.");
      }
      const updated = await tx.contentTranslation.findUniqueOrThrow({ where: { id: tr.id } });
      await tx.contentRevision.create({
        data: { translationId: tr.id, version, createdById: user.id, changeNote: "Content edited",
          snapshot: this.snapshot(updated, tr.content.data) },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: "cms.content.updated", entity: "ContentTranslation", entityId: tr.id,
          metadata: asJson({ contentId, localeCode, version }) },
      });
    });
    await this.notifyCmsEvent("content.updated", { contentId, localeCode, translationId: tr.id, version });
    return this.getContent(contentId);
  }

  async updateSharedFields(contentId: string, dto: UpdateSharedFieldsDto, user: AuthenticatedUser) {
    const item = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { contentType: { include: { fields: { where: { isActive: true } } } }, translations: true },
    });
    if (!item) throw new NotFoundException("Content not found.");
    const defs = item.contentType.fields.filter(field => !field.isLocalized);
    const patch = this.validateAndSplitFields(dto.fields, defs, false).sharedData;
    if (!Object.keys(patch).length) throw new BadRequestException("No shared fields were provided.");
    const nextData = { ...asRecord(item.data), ...patch };
    this.assertRequiredFields(nextData, defs);
    await this.assertMediaReferences(nextData, defs);
    await this.prisma.$transaction(async tx => {
      const contentClaim = await tx.content.updateMany({
        where: { id: contentId, updatedAt: item.updatedAt },
        data: { data: asJson(nextData) },
      });
      if (contentClaim.count !== 1) {
        throw new ConflictException("Shared content was changed by another editor. Reload the latest version and retry.");
      }
      for (const translation of item.translations) {
        const version = translation.version + 1;
        const translationClaim = await tx.contentTranslation.updateMany({
          where: { id: translation.id, version: translation.version, status: translation.status },
          data: {
            version,
            ...(translation.status === CmsContentStatus.PUBLISHED ||
                translation.status === CmsContentStatus.IN_REVIEW ||
                translation.status === CmsContentStatus.SCHEDULED
              ? { status: CmsContentStatus.DRAFT, scheduledAt: null }
              : {}),
          },
        });
        if (translationClaim.count !== 1) {
          throw new ConflictException("A language version changed while shared fields were being saved. Reload and retry.");
        }
        const updated = await tx.contentTranslation.findUniqueOrThrow({ where: { id: translation.id } });
        await tx.contentRevision.create({
          data: { translationId: translation.id, version, createdById: user.id,
            changeNote: "Shared fields updated", snapshot: this.snapshot(updated, nextData) },
        });
      }
      await tx.auditLog.create({
        data: { userId: user.id, action: "cms.content.shared_fields_updated", entity: "Content", entityId: contentId,
          metadata: asJson({ changedKeys: Object.keys(patch) }) },
      });
    });
    await this.notifyCmsEvent("content.shared_fields.updated", { contentId, changedKeys: Object.keys(patch) });
    return this.getContent(contentId);
  }

  async submitForReview(id: string, locale: string, user: AuthenticatedUser) {
    return this.transition(id, locale, CmsContentStatus.IN_REVIEW, [CmsContentStatus.DRAFT], user, "Submitted for review");
  }
  async publish(id: string, locale: string, user: AuthenticatedUser) {
    return this.transition(id, locale, CmsContentStatus.PUBLISHED, [CmsContentStatus.IN_REVIEW, CmsContentStatus.SCHEDULED], user, "Published");
  }
  async reject(id: string, locale: string, dto: RejectContentDto, user: AuthenticatedUser) {
    return this.transition(id, locale, CmsContentStatus.DRAFT, [CmsContentStatus.IN_REVIEW], user, "Rejected: " + dto.reason, dto.reason);
  }
  async schedule(id: string, locale: string, dto: ScheduleContentDto, user: AuthenticatedUser) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException("scheduledAt must be a future date and time.");
    }
    return this.transition(id, locale, CmsContentStatus.SCHEDULED, [CmsContentStatus.IN_REVIEW], user, "Publication scheduled", undefined, scheduledAt);
  }
  async unpublish(id: string, locale: string, user: AuthenticatedUser) {
    const tr = await this.findTranslation(id, locale);
    if (!tr.publishedSnapshot && tr.status !== CmsContentStatus.SCHEDULED) throw new BadRequestException("This translation has no published version.");
    return this.transition(id, locale, CmsContentStatus.DRAFT,
      [CmsContentStatus.PUBLISHED, CmsContentStatus.DRAFT, CmsContentStatus.IN_REVIEW, CmsContentStatus.SCHEDULED],
      user, "Unpublished", undefined, undefined, true);
  }
  async archive(id: string, locale: string, user: AuthenticatedUser) {
    return this.transition(id, locale, CmsContentStatus.ARCHIVED,
      [CmsContentStatus.DRAFT, CmsContentStatus.IN_REVIEW, CmsContentStatus.SCHEDULED, CmsContentStatus.PUBLISHED],
      user, "Archived", undefined, undefined, true);
  }
  async restoreToDraft(id: string, locale: string, user: AuthenticatedUser) {
    return this.transition(id, locale, CmsContentStatus.DRAFT, [CmsContentStatus.ARCHIVED], user, "Restored to draft", undefined, undefined, true);
  }

  async listRevisions(contentId: string, localeCode: string) {
    const tr = await this.findTranslation(contentId, localeCode);
    return this.prisma.contentRevision.findMany({ where: { translationId: tr.id }, orderBy: { version: "desc" } });
  }

  async restoreRevision(contentId: string, localeCode: string, revisionId: string, user: AuthenticatedUser) {
    const tr = await this.findTranslation(contentId, localeCode);
    const revision = await this.prisma.contentRevision.findFirst({ where: { id: revisionId, translationId: tr.id } });
    if (!revision) throw new NotFoundException("Revision not found for this translation.");
    const snapshot = asRecord(revision.snapshot);
    if (typeof snapshot.title !== "string" || typeof snapshot.slug !== "string" ||
        !isRecord(snapshot.data) || !isRecord(snapshot.sharedData)) {
      throw new BadRequestException("Revision snapshot is incompatible with the current content model.");
    }

    const localizedDefinitions = tr.content.contentType.fields.filter(field => field.isLocalized);
    const sharedDefinitions = tr.content.contentType.fields.filter(field => !field.isLocalized);
    await this.assertMediaReferences(snapshot.data, localizedDefinitions);
    await this.assertMediaReferences(snapshot.sharedData, sharedDefinitions);

    const currentContent = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: { translations: true },
    });
    if (!currentContent) throw new NotFoundException("Content not found.");
    const currentTarget = currentContent.translations.find(translation => translation.id === tr.id);
    if (!currentTarget) throw new NotFoundException("Translation not found.");
    if (currentTarget.version !== tr.version || currentTarget.status !== tr.status ||
        currentContent.updatedAt.getTime() !== tr.content.updatedAt.getTime()) {
      throw new ConflictException("The content changed while the revision was being selected. Reload and retry.");
    }

    await this.prisma.$transaction(async tx => {
      const contentClaim = await tx.content.updateMany({
        where: { id: contentId, updatedAt: currentContent.updatedAt },
        data: { data: asJson(snapshot.sharedData) },
      });
      if (contentClaim.count !== 1) {
        throw new ConflictException("Shared content changed while the revision was being restored. Reload and retry.");
      }

      for (const translation of currentContent.translations) {
        const nextVersion = translation.version + 1;
        const isTarget = translation.id === tr.id;
        const updateData: Prisma.ContentTranslationUpdateManyMutationInput = isTarget
          ? {
              title: snapshot.title as string,
              slug: snapshot.slug as string,
              excerpt: typeof snapshot.excerpt === "string" ? snapshot.excerpt : null,
              seoTitle: typeof snapshot.seoTitle === "string" ? snapshot.seoTitle : null,
              seoDescription: typeof snapshot.seoDescription === "string" ? snapshot.seoDescription : null,
              data: asJson(snapshot.data),
              status: CmsContentStatus.DRAFT,
              scheduledAt: null,
              version: nextVersion,
            }
          : {
              version: nextVersion,
              ...(translation.status === CmsContentStatus.PUBLISHED ||
                  translation.status === CmsContentStatus.IN_REVIEW ||
                  translation.status === CmsContentStatus.SCHEDULED
                ? { status: CmsContentStatus.DRAFT, scheduledAt: null }
                : {}),
            };
        const translationClaim = await tx.contentTranslation.updateMany({
          where: { id: translation.id, version: translation.version, status: translation.status },
          data: updateData,
        });
        if (translationClaim.count !== 1) {
          throw new ConflictException("A language version changed while the revision was being restored. Reload and retry.");
        }

        const updated = await tx.contentTranslation.findUniqueOrThrow({ where: { id: translation.id } });
        await tx.contentRevision.create({
          data: {
            translationId: translation.id,
            version: nextVersion,
            createdById: user.id,
            changeNote: isTarget
              ? "Restored revision " + revision.version
              : "Shared fields restored from revision " + revision.version,
            snapshot: this.snapshot(updated, snapshot.sharedData),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "cms.content.revision_restored",
          entity: "ContentTranslation",
          entityId: tr.id,
          metadata: asJson({
            contentId,
            localeCode,
            sourceVersion: revision.version,
            affectedTranslations: currentContent.translations.length,
          }),
        },
      });
    });
    await this.notifyCmsEvent("content.revision_restored", {
      contentId,
      localeCode,
      translationId: tr.id,
      sourceVersion: revision.version,
    });
    return this.getContent(contentId);
  }

  async exportContents(requestedLimit = 5000) {
    const limit = Math.min(5000, Math.max(1, Number(requestedLimit) || 5000));
    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          contentType: { select: { key: true, name: true } },
          translations: { include: { locale: { select: { code: true, name: true } } }, orderBy: { updatedAt: "desc" } },
        },
      }),
      this.prisma.content.count(),
    ]);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      totalRecords: total,
      exportedRecords: items.length,
      truncated: total > items.length,
      records: items.map(item => ({
        typeKey: item.contentType.key,
        sharedFields: asRecord(item.data),
        translations: item.translations.map(translation => ({
          localeCode: translation.locale.code,
          title: translation.title,
          slug: translation.slug,
          excerpt: translation.excerpt,
          seoTitle: translation.seoTitle,
          seoDescription: translation.seoDescription,
          fields: asRecord(translation.data),
          sourceStatus: translation.status,
          sourceVersion: translation.version,
          sourcePublishedAt: translation.publishedAt?.toISOString() ?? null,
        })),
      })),
    };
  }

  async importContents(dto: CmsImportPackageDto, user: AuthenticatedUser) {
    const results: Array<{ index: number; typeKey: string; contentId: string | null; status: "IMPORTED" | "PARTIAL" | "FAILED"; translationsImported: number; error?: string }> = [];
    for (const [index, item] of dto.records.entries()) {
      let contentId: string | null = null;
      let translationsImported = 0;
      try {
        const [first, ...remaining] = item.translations;
        if (!first) throw new BadRequestException("Each imported record must include at least one translation.");
        const content = await this.createContent({
          typeKey: item.typeKey,
          localeCode: first.localeCode,
          title: first.title,
          slug: first.slug,
          excerpt: first.excerpt,
          seoTitle: first.seoTitle,
          seoDescription: first.seoDescription,
          fields: { ...asRecord(item.sharedFields), ...asRecord(first.fields) },
        }, user);
        contentId = content.id;
        translationsImported = 1;
        for (const translation of remaining) {
          await this.createTranslation(content.id, {
            localeCode: translation.localeCode,
            title: translation.title,
            slug: translation.slug,
            excerpt: translation.excerpt,
            seoTitle: translation.seoTitle,
            seoDescription: translation.seoDescription,
            fields: translation.fields ?? {},
          }, user);
          translationsImported += 1;
        }
        results.push({ index, typeKey: item.typeKey, contentId, status: "IMPORTED", translationsImported });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          index, typeKey: item.typeKey, contentId,
          status: contentId ? "PARTIAL" : "FAILED",
          translationsImported,
          error: message.slice(0, 1000),
        });
      }
    }
    return {
      summary: {
        requested: results.length,
        imported: results.filter(result => result.status === "IMPORTED").length,
        partial: results.filter(result => result.status === "PARTIAL").length,
        failed: results.filter(result => result.status === "FAILED").length,
      },
      results,
    };
  }

  async publicSitemap() {
    const rows = await this.prisma.contentTranslation.findMany({
      where: {
        publishedSlug: { not: null },
        publishedAt: { not: null },
        locale: { is: { isActive: true } },
        content: { is: { contentType: { is: { isActive: true } } } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      include: {
        locale: { select: { code: true, name: true } },
        content: {
          select: {
            contentType: { select: { key: true } },
            translations: {
              where: {
                publishedSlug: { not: null },
                publishedAt: { not: null },
                locale: { is: { isActive: true } },
              },
              include: { locale: { select: { code: true, name: true } } },
            },
          },
        },
      },
    });
    return rows.map(item => ({
      typeKey: item.content.contentType.key,
      localeCode: item.locale.code,
      slug: item.publishedSlug,
      lastModified: item.publishedAt?.toISOString() ?? item.updatedAt.toISOString(),
      alternates: item.content.translations.map(translation => ({
        localeCode: translation.locale.code,
        slug: translation.publishedSlug,
        href: "/content/" + item.content.contentType.key + "/" + translation.locale.code + "/" + translation.publishedSlug,
      })),
      href: "/content/" + item.content.contentType.key + "/" + item.locale.code + "/" + item.publishedSlug,
    }));
  }

  async listPublicContent(typeKey: string, localeCode: string, query: ListPublicContentQuery) {
    const [contentType, locale] = await Promise.all([
      this.prisma.contentType.findUnique({ where: { key: typeKey }, select: { id: true, isActive: true } }),
      this.prisma.locale.findUnique({ where: { code: localeCode }, select: { id: true, isActive: true } }),
    ]);
    if (!contentType || !contentType.isActive) throw new NotFoundException("Published content type was not found.");
    if (!locale || !locale.isActive) throw new NotFoundException("Active locale was not found.");
    const page = Number(query.page) || 1;
    const limit = Math.min(100, Number(query.limit) || 20);
    const where: Prisma.ContentTranslationWhereInput = {
      locale: { is: { code: localeCode, isActive: true } },
      content: { is: { contentType: { is: { key: typeKey, isActive: true } } } },
      publishedSlug: { not: null },
    };
    const [items, total] = await Promise.all([
      this.prisma.contentTranslation.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { publishedAt: "desc" },
        include: {
          locale: { select: { code: true, name: true, direction: true } },
          content: {
            select: {
              data: true,
              contentType: { select: { key: true, name: true, fields: { select: { key: true, type: true } } } },
              translations: {
                where: { publishedSlug: { not: null }, locale: { is: { isActive: true } } },
                select: { publishedSlug: true, locale: { select: { code: true } } },
              },
              taxonomyTerms: {
                where: { term: { is: { isActive: true, taxonomy: { is: { isActive: true } } } } },
                include: { term: { include: {
                  taxonomy: { select: { key: true, name: true } },
                  translations: { where: { locale: { is: { code: localeCode } } }, include: { locale: { select: { code: true, name: true } } } },
                } } },
              },
            },
          },
        },
      }),
      this.prisma.contentTranslation.count({ where }),
    ]);
    return { data: await Promise.all(items.map(item => this.toPublicView(item))), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getPublicContent(typeKey: string, localeCode: string, slug: string) {
    const item = await this.prisma.contentTranslation.findFirst({
      where: {
        publishedSlug: slug, locale: { is: { code: localeCode, isActive: true } },
        content: { is: { contentType: { is: { key: typeKey, isActive: true } } } },
      },
      include: {
        locale: { select: { code: true, name: true, direction: true } },
        content: {
          select: {
            data: true,
            contentType: { select: { key: true, name: true, fields: { select: { key: true, type: true } } } },
            translations: {
              where: { publishedSlug: { not: null }, locale: { is: { isActive: true } } },
              select: { publishedSlug: true, locale: { select: { code: true } } },
            },
            taxonomyTerms: {
              where: { term: { is: { isActive: true, taxonomy: { is: { isActive: true } } } } },
              include: { term: { include: {
                taxonomy: { select: { key: true, name: true } },
                translations: { where: { locale: { is: { code: localeCode } } }, include: { locale: { select: { code: true, name: true } } } },
              } } },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException("Published content was not found.");
    return this.toPublicView(item);
  }


  async publicSitemapXml(): Promise<string> {
    const configuredBase = process.env.PUBLIC_SITE_URL ?? "http://localhost:3000";
    let base: string;
    try {
      const parsed = new URL(configuredBase);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error("PUBLIC_SITE_URL must be an HTTP(S) URL without credentials.");
      }
      base = parsed.origin + parsed.pathname.replace(/\/+$/, "");
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "PUBLIC_SITE_URL is invalid.");
    }
    const published = await this.prisma.contentTranslation.findMany({
      where: {
        publishedSlug: { not: null },
        locale: { is: { isActive: true } },
        content: { is: { contentType: { is: { isActive: true } } } },
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        publishedSlug: true, updatedAt: true,
        locale: { select: { code: true } },
        content: {
          select: {
            contentType: { select: { key: true } },
            translations: {
              where: { publishedSlug: { not: null }, locale: { is: { isActive: true } } },
              select: { publishedSlug: true, locale: { select: { code: true } } },
            },
          },
        },
      },
    });
    const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    const urlEntries = published.filter(item => item.publishedSlug).map(item => {
      const typeKey = item.content.contentType.key;
      const loc = base + "/content/" + encodeURIComponent(typeKey) + "/" + encodeURIComponent(item.locale.code) + "/" + encodeURIComponent(item.publishedSlug!);
      const links = item.content.translations.filter(translation => translation.publishedSlug).map(translation => {
        const href = base + "/content/" + encodeURIComponent(typeKey) + "/" + encodeURIComponent(translation.locale.code) + "/" + encodeURIComponent(translation.publishedSlug!);
        return '<xhtml:link rel="alternate" hreflang="' + xmlEscape(translation.locale.code) + '" href="' + xmlEscape(href) + '"/>';
      }).join("");
      return "<url><loc>" + xmlEscape(loc) + "</loc><lastmod>" + item.updatedAt.toISOString() + "</lastmod>" + links + "</url>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
      urlEntries + "</urlset>";
  }

  async publishDueContents(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.contentTranslation.findMany({
      where: { status: CmsContentStatus.SCHEDULED, scheduledAt: { lte: now } },
      take: 100, orderBy: { scheduledAt: "asc" }, include: { content: true, locale: { select: { code: true } } },
    });
    let count = 0;
    for (const item of due) {
      try {
        const didPublish = await this.prisma.$transaction(async tx => {
          const claimed = await tx.contentTranslation.updateMany({
            where: { id: item.id, status: CmsContentStatus.SCHEDULED, scheduledAt: { lte: now } },
            data: { status: CmsContentStatus.PUBLISHED, publishedAt: now, publishedSlug: item.slug, scheduledAt: null, version: { increment: 1 } },
          });
          if (claimed.count !== 1) return false;
          const updated = await tx.contentTranslation.findUniqueOrThrow({ where: { id: item.id } });
          const snapshot = this.snapshot(updated, item.content.data);
          await tx.contentTranslation.update({ where: { id: item.id }, data: { publishedSnapshot: snapshot } });
          await tx.contentRevision.create({
            data: { translationId: item.id, version: updated.version, changeNote: "Automatically published on schedule", snapshot },
          });
          await tx.auditLog.create({
            data: { action: "cms.content.auto_published", entity: "ContentTranslation", entityId: item.id,
              metadata: asJson({ scheduledAt: item.scheduledAt?.toISOString() }) },
          });
          return true;
        });
        if (didPublish) {
          count++;
          await this.notifyCmsEvent("content.published", { contentId: item.contentId, translationId: item.id, localeCode: item.locale.code, scheduledAt: item.scheduledAt?.toISOString() });
        }
      } catch (error) {
        this.logger.error("Scheduled publishing failed for " + item.id, error instanceof Error ? error.stack : String(error));
      }
    }
    return count;
  }

  private async transition(
    contentId: string, localeCode: string, target: CmsContentStatus, allowed: CmsContentStatus[],
    user: AuthenticatedUser, note: string, reason?: string, scheduledAt?: Date, clearPublication = false,
  ) {
    const tr = await this.findTranslation(contentId, localeCode);
    if (!allowed.includes(tr.status)) throw new BadRequestException("Invalid workflow transition from " + tr.status + " to " + target + ".");
    if (target === CmsContentStatus.PUBLISHED && !tr.content.contentType.isActive) {
      throw new BadRequestException("Content under an inactive content type cannot be published.");
    }
    const version = tr.version + 1;
    await this.prisma.$transaction(async tx => {
      const update: Prisma.ContentTranslationUpdateInput = { status: target, version };
      if (target === CmsContentStatus.PUBLISHED) {
        update.publishedAt = new Date(); update.scheduledAt = null; update.publishedSlug = tr.slug;
        update.publishedSnapshot = this.snapshot(tr, tr.content.data);
      } else if (target === CmsContentStatus.SCHEDULED) {
        update.scheduledAt = scheduledAt ?? null;
      } else {
        update.scheduledAt = null;
        if (target !== CmsContentStatus.DRAFT || clearPublication) update.publishedAt = null;
      }
      if (clearPublication) { update.publishedSlug = null; update.publishedSnapshot = Prisma.DbNull; }
      const claim = await tx.contentTranslation.updateMany({
        where: { id: tr.id, version: tr.version, status: tr.status },
        data: update as Prisma.ContentTranslationUpdateManyMutationInput,
      });
      if (claim.count !== 1) {
        throw new ConflictException("This translation changed while the workflow action was running. Reload and retry.");
      }
      const updated = await tx.contentTranslation.findUniqueOrThrow({ where: { id: tr.id } });
      await tx.contentRevision.create({ data: {
        translationId: tr.id, version, createdById: user.id, changeNote: note,
        snapshot: this.snapshot(updated, tr.content.data),
      } });
      await tx.auditLog.create({ data: {
        userId: user.id, action: "cms.workflow." + target.toLowerCase(),
        entity: "ContentTranslation", entityId: tr.id,
        metadata: asJson({ contentId, localeCode, from: tr.status, to: target, reason }),
      } });
    });
    const eventKey = target === CmsContentStatus.PUBLISHED ? "content.published"
      : target === CmsContentStatus.SCHEDULED ? "content.scheduled"
      : clearPublication ? "content.unpublished"
      : target === CmsContentStatus.ARCHIVED ? "content.archived"
      : target === CmsContentStatus.IN_REVIEW ? "content.submitted_for_review"
      : "content.updated";
    await this.notifyCmsEvent(eventKey, { contentId, translationId: tr.id, localeCode, status: target, version });
    return this.getContent(contentId);
  }

  private async notifyCmsEvent(eventKey: string, payload: Record<string, unknown>) {
    try { await this.webhooks?.queueEvent(eventKey, payload); }
    catch (error) { this.logger.error("Could not enqueue CMS event " + eventKey, error instanceof Error ? error.stack : String(error)); }
  }

  private async findTranslation(contentId: string, localeCode: string): Promise<TranslationRecord> {
    const tr = await this.prisma.contentTranslation.findFirst({
      where: { contentId, locale: { is: { code: localeCode } } },
      include: { content: { include: { contentType: { include: { fields: true } } } } },
    });
    if (!tr) throw new NotFoundException("Translation was not found for this content and locale.");
    return tr as unknown as TranslationRecord;
  }

  private snapshot(source: {
    title: string; slug: string; excerpt: string | null; seoTitle: string | null;
    seoDescription: string | null; data: unknown;
  }, sharedData: unknown): Prisma.InputJsonValue {
    return asJson({
      title: source.title, slug: source.slug, excerpt: source.excerpt,
      seoTitle: source.seoTitle, seoDescription: source.seoDescription,
      data: asRecord(source.data), sharedData: asRecord(sharedData),
    });
  }

  private async toPublicView(item: {
    id: string; locale: { code: string; name: string; direction: LocaleDirection };
    publishedSlug: string | null; publishedAt: Date | null; publishedSnapshot: Prisma.JsonValue | null;
    content: {
      data: Prisma.JsonValue;
      contentType: { key: string; name: string; fields: Array<{ key: string; type: CmsFieldType }> };
      translations?: Array<{ publishedSlug: string | null; locale: { code: string } }>;
      taxonomyTerms?: Array<{ term: {
        id: string; name: string; slug: string; description: string | null;
        taxonomy: { key: string; name: string };
        translations: Array<{ name: string; slug: string; description: string | null; locale: { code: string; name: string } }>;
      } }>;
    };
  }) {
    const snapshot = asRecord(item.publishedSnapshot);
    const fields: Record<string, unknown> = { ...asRecord(snapshot.sharedData), ...asRecord(snapshot.data) };
    const mediaIds = new Set<string>();
    for (const definition of item.content.contentType.fields) {
      const value = fields[definition.key];
      if (definition.type === CmsFieldType.MEDIA && typeof value === "string") mediaIds.add(value);
      if (definition.type === CmsFieldType.MEDIA_MULTIPLE && Array.isArray(value)) {
        for (const mediaId of value) if (typeof mediaId === "string") mediaIds.add(mediaId);
      }
    }
    const blocks = Array.isArray(fields.blocks) ? fields.blocks.filter(isRecord) : [];
    for (const block of blocks) {
      if (typeof block.mediaId === "string") mediaIds.add(block.mediaId);
      if (Array.isArray(block.mediaIds)) for (const mediaId of block.mediaIds) if (typeof mediaId === "string") mediaIds.add(mediaId);
    }
    const assets = mediaIds.size ? await this.prisma.mediaAsset.findMany({
      where: { id: { in: [...mediaIds] } },
      select: { id: true, url: true, mimeType: true, kind: true, sizeBytes: true, altText: true, caption: true },
    }) : [];
    const assetsById = new Map(assets.map(asset => [asset.id, asset]));
    const publicAsset = (id: string) => {
      const asset = assetsById.get(id);
      return asset ? { ...asset } : null;
    };
    for (const definition of item.content.contentType.fields) {
      const value = fields[definition.key];
      if (definition.type === CmsFieldType.MEDIA && typeof value === "string") fields[definition.key] = publicAsset(value);
      if (definition.type === CmsFieldType.MEDIA_MULTIPLE && Array.isArray(value)) {
        fields[definition.key] = value.filter((mediaId): mediaId is string => typeof mediaId === "string").map(publicAsset).filter(Boolean);
      }
    }
    if (blocks.length) {
      fields.blocks = blocks.map(block => {
        if (typeof block.mediaId === "string") return { ...block, media: publicAsset(block.mediaId) };
        if (Array.isArray(block.mediaIds)) {
          const ids = block.mediaIds.filter((id): id is string => typeof id === "string");
          return { ...block, mediaItems: ids.map(publicAsset).filter(Boolean) };
        }
        return block;
      });
    }
    const terms = (item.content.taxonomyTerms ?? []).map(link => {
      const term = link.term;
      const translation = term.translations.find(value => value.locale.code === item.locale.code);
      return {
        id: term.id, taxonomy: term.taxonomy,
        name: translation?.name ?? term.name, slug: translation?.slug ?? term.slug,
        description: translation?.description ?? term.description,
      };
    });
    return {
      id: item.id, type: { key: item.content.contentType.key, name: item.content.contentType.name },
      locale: item.locale, title: snapshot.title, slug: item.publishedSlug,
      excerpt: snapshot.excerpt ?? null, seoTitle: snapshot.seoTitle ?? null,
      seoDescription: snapshot.seoDescription ?? null, fields, terms, publishedAt: item.publishedAt,
      alternates: (item.content.translations ?? []).filter(value => Boolean(value.publishedSlug)).map(value => ({
        localeCode: value.locale.code, slug: value.publishedSlug,
      })),
    };
  }

  private mergeFieldPatch(current: Record<string, unknown>, patch: Record<string, unknown>, definitions: FieldDefinition[]) {
    const validated = this.validateAndSplitFields(patch, definitions, false).localizedData;
    const merged = { ...current, ...validated };
    this.assertRequiredFields(merged, definitions);
    return merged;
  }

  private validateAndSplitFields(input: Record<string, unknown>, definitions: FieldDefinition[], requireComplete: boolean) {
    if (!isRecord(input)) throw new BadRequestException("fields must be a JSON object.");
    const active = definitions.filter(field => field.isActive);
    const allowed = new Map(active.map(field => [field.key, field]));
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) throw new BadRequestException("Unknown or inactive content field: " + key);
    }
    this.assertRequiredFields(input, active, requireComplete);
    const localizedData: Record<string, unknown> = {};
    const sharedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const field = allowed.get(key);
      if (!field) continue;
      if (value !== null && value !== undefined && value !== "") this.validateFieldValue(field, value);
      if (field.isLocalized) localizedData[key] = value;
      else sharedData[key] = value;
    }
    return { localizedData, sharedData };
  }

  private assertRequiredFields(values: Record<string, unknown>, definitions: FieldDefinition[], enforce = true) {
    if (!enforce) return;
    for (const field of definitions) {
      if (field.isActive && field.isRequired && isMissing(values[field.key])) {
        throw new BadRequestException("Required field is missing: " + field.key);
      }
    }
  }

  private async assertMediaReferences(values: Record<string, unknown>, definitions: FieldDefinition[]) {
    const mediaIds = new Set<string>();
    const imageBlockIds = new Set<string>();
    for (const field of definitions) {
      const value = values[field.key];
      if (field.type === CmsFieldType.MEDIA && typeof value === "string" && value) mediaIds.add(value);
      if (field.type === CmsFieldType.MEDIA_MULTIPLE && Array.isArray(value)) {
        for (const id of value) if (typeof id === "string" && id) mediaIds.add(id);
      }
    }

    const blocksField = definitions.find(field => field.key === "blocks" && field.type === CmsFieldType.JSON);
    if (blocksField && values.blocks !== undefined) {
      const blocks = values.blocks;
      if (!Array.isArray(blocks) || blocks.length > 100) {
        throw new BadRequestException("Page builder blocks must be an array containing at most 100 blocks.");
      }
      for (const [index, entry] of blocks.entries()) {
        if (!isRecord(entry)) throw new BadRequestException("Page builder block " + (index + 1) + " must be an object.");
        if (entry.type === "image") {
          if (typeof entry.mediaId === "string" && entry.mediaId) {
            if (!this.isUuid(entry.mediaId)) throw new BadRequestException("Image blocks must reference a valid media asset ID.");
            mediaIds.add(entry.mediaId); imageBlockIds.add(entry.mediaId);
          }
        } else if (entry.type === "gallery") {
          if (entry.mediaIds !== undefined && (!Array.isArray(entry.mediaIds) || entry.mediaIds.length > 100)) {
            throw new BadRequestException("Gallery blocks can contain at most 100 media assets.");
          }
          if (Array.isArray(entry.mediaIds)) {
            for (const id of entry.mediaIds) {
              if (typeof id !== "string" || !this.isUuid(id)) throw new BadRequestException("Gallery blocks must reference valid media asset IDs.");
              mediaIds.add(id); imageBlockIds.add(id);
            }
          }
        }
      }
    }

    if (!mediaIds.size) return;
    const existing = await this.prisma.mediaAsset.findMany({
      where: { id: { in: [...mediaIds] } },
      select: { id: true, kind: true },
    });
    const existingIds = new Set(existing.map(asset => asset.id));
    if (existingIds.size !== mediaIds.size) throw new BadRequestException("One or more selected media assets no longer exist.");
    if (existing.some(asset => imageBlockIds.has(asset.id) && asset.kind !== CmsMediaKind.IMAGE)) {
      throw new BadRequestException("Image and gallery blocks may reference image assets only.");
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private validateFieldValue(field: FieldDefinition, value: unknown) {
    const config = asRecord(field.config);
    const wrong = (): never => { throw new BadRequestException("Invalid value for field " + field.key + " (" + field.type + ")."); };
    const stringTypes: CmsFieldType[] = [CmsFieldType.TEXT, CmsFieldType.TEXTAREA, CmsFieldType.RICH_TEXT, CmsFieldType.MARKDOWN, CmsFieldType.EMAIL, CmsFieldType.URL];
    if (stringTypes.includes(field.type)) {
      if (typeof value !== "string") return wrong();
      if (typeof config.maxLength === "number" && value.length > config.maxLength) return wrong();
      if (field.type === CmsFieldType.EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return wrong();
      if (field.type === CmsFieldType.URL) {
        try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol)) return wrong(); }
        catch { return wrong(); }
      }
      return;
    }
    if (field.type === CmsFieldType.INTEGER) { if (typeof value !== "number" || !Number.isInteger(value)) return wrong(); return; }
    if (field.type === CmsFieldType.DECIMAL) { if (typeof value !== "number" || !Number.isFinite(value)) return wrong(); return; }
    if (field.type === CmsFieldType.BOOLEAN) { if (typeof value !== "boolean") return wrong(); return; }
    if (field.type === CmsFieldType.DATE || field.type === CmsFieldType.DATETIME) {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return wrong();
      if (field.type === CmsFieldType.DATE && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return wrong();
      return;
    }
    if (field.type === CmsFieldType.SELECT || field.type === CmsFieldType.MULTISELECT) {
      const options = Array.isArray(config.options) ? config.options.map(option =>
        typeof option === "string" ? option : (isRecord(option) && typeof option.value === "string" ? option.value : ""),
      ).filter(Boolean) : [];
      if (field.type === CmsFieldType.SELECT && typeof value !== "string") return wrong();
      if (field.type === CmsFieldType.MULTISELECT && (!Array.isArray(value) || !value.every(item => typeof item === "string"))) return wrong();
      const selected = field.type === CmsFieldType.SELECT ? [value] : value as unknown[];
      if (options.length && selected.some(item => !options.includes(String(item)))) return wrong();
      return;
    }
    if (field.type === CmsFieldType.MEDIA) {
      if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return wrong();
      return;
    }
    if (field.type === CmsFieldType.MEDIA_MULTIPLE) {
      if (!Array.isArray(value) || value.length > 100 || !value.every(item => typeof item === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item))) return wrong();
      return;
    }
    if (field.type === CmsFieldType.JSON) {
      if (field.key === "blocks") {
        if (!Array.isArray(value) || value.length > 100) return wrong();
        const supported = new Set(["hero", "richText", "image", "gallery", "cta", "faq", "cardGrid"]);
        for (const block of value) {
          if (!isRecord(block) || typeof block.type !== "string" || !supported.has(block.type)) return wrong();
          const textKeys = ["eyebrow", "title", "heading", "body", "bodyMarkdown", "buttonLabel", "buttonUrl", "altText", "caption", "url"];
          for (const key of textKeys) {
            if (block[key] !== undefined && (typeof block[key] !== "string" || block[key].length > 10000)) return wrong();
          }
          for (const key of ["buttonUrl", "url"]) {
            const href = block[key];
            if (typeof href !== "string" || !href) continue;
            const safePath = href.startsWith("/") && !href.startsWith("//") && !href.includes(String.fromCharCode(92)) && !href.includes(String.fromCharCode(13)) && !href.includes(String.fromCharCode(10));
            let safeExternal = false;
            try { safeExternal = new URL(href).protocol === "https:"; } catch { /* local paths are handled above */ }
            if (!safePath && !safeExternal) return wrong();
          }
          if ((block.type === "faq" || block.type === "cardGrid")) {
            const collection = block.type === "faq" ? block.items : block.cards;
            if (collection !== undefined && (!Array.isArray(collection) || collection.length > 100 ||
              collection.some(item => !isRecord(item) || Object.values(item).some(entry => typeof entry !== "string" || entry.length > 10000)))) return wrong();
          }
          if (block.type === "image" && block.mediaId !== undefined && block.mediaId !== "" && (typeof block.mediaId !== "string" || !this.isUuid(block.mediaId))) return wrong();
          if (block.type === "gallery" && block.mediaIds !== undefined &&
            (!Array.isArray(block.mediaIds) || block.mediaIds.length > 100 || block.mediaIds.some(id => typeof id !== "string" || !this.isUuid(id)))) return wrong();
        }
        return;
      }
      if (isRecord(value) || Array.isArray(value)) return;
      return wrong();
    }
    return wrong();
  }
}
