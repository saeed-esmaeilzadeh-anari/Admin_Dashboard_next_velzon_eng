import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CmsFormSubmissionStatus, Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CmsPermissions } from "./cms-permissions.decorator";
import { CmsPermissionsGuard } from "./cms-permissions.guard";
import { CmsAuditInterceptor } from "./cms-audit.interceptor";
import { CmsManagementService } from "./cms-management.service";
import {
  AssignTermsDto, CreateCmsFormDto, CreateCmsWebhookDto, CreateMenuDto, CreateMenuItemDto,
  CreateRedirectDto, CreateTaxonomyDto, CreateTaxonomyTermDto, CreateTermTranslationDto,
  UpdateCmsFormDto, UpdateCmsWebhookDto, UpdateFormSubmissionDto, UpdateMenuDto, UpdateMenuItemDto,
  UpdateRedirectDto, UpdateTaxonomyDto, UpdateTaxonomyTermDto, UpdateRolePermissionsDto,
} from "./cms-management.dto";

@ApiTags("cms-management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CmsPermissionsGuard)
@UseInterceptors(CmsAuditInterceptor)
@Controller("cms")
export class CmsManagementController {
  constructor(private readonly cms: CmsManagementService) {}

  @Get("taxonomies") @CmsPermissions("cms.taxonomy.manage")
  listTaxonomies() { return this.cms.listTaxonomies(true); }
  @Post("taxonomies") @CmsPermissions("cms.taxonomy.manage")
  createTaxonomy(@Body() dto: CreateTaxonomyDto) { return this.cms.createTaxonomy(dto); }
  @Patch("taxonomies/:id") @CmsPermissions("cms.taxonomy.manage")
  updateTaxonomy(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateTaxonomyDto) { return this.cms.updateTaxonomy(id, dto); }

  @Get("taxonomies/:id/terms") @CmsPermissions("cms.taxonomy.manage")
  listTerms(@Param("id", new ParseUUIDPipe()) id: string) { return this.cms.listTaxonomyTerms(id, true); }
  @Post("taxonomies/:id/terms") @CmsPermissions("cms.taxonomy.manage")
  createTerm(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CreateTaxonomyTermDto) { return this.cms.createTaxonomyTerm(id, dto); }
  @Patch("taxonomies/:taxonomyId/terms/:termId") @CmsPermissions("cms.taxonomy.manage")
  updateTerm(@Param("taxonomyId", new ParseUUIDPipe()) taxonomyId: string, @Param("termId", new ParseUUIDPipe()) termId: string, @Body() dto: UpdateTaxonomyTermDto) {
    return this.cms.updateTaxonomyTerm(taxonomyId, termId, dto);
  }
  @Post("taxonomy-terms/:termId/translations") @CmsPermissions("cms.taxonomy.manage")
  translateTerm(@Param("termId", new ParseUUIDPipe()) termId: string, @Body() dto: CreateTermTranslationDto) { return this.cms.createTermTranslation(termId, dto); }
  @Put("contents/:id/terms") @CmsPermissions("cms.content.edit")
  assignTerms(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: AssignTermsDto) { return this.cms.assignContentTerms(id, dto); }

  @Get("menus") @CmsPermissions("cms.menus.manage")
  listMenus() { return this.cms.listMenus(true); }
  @Post("menus") @CmsPermissions("cms.menus.manage")
  createMenu(@Body() dto: CreateMenuDto) { return this.cms.createMenu(dto); }
  @Patch("menus/:id") @CmsPermissions("cms.menus.manage")
  updateMenu(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateMenuDto) { return this.cms.updateMenu(id, dto); }
  @Get("menus/:id/items") @CmsPermissions("cms.menus.manage")
  listMenuItems(@Param("id", new ParseUUIDPipe()) id: string) { return this.cms.listMenuItems(id); }
  @Post("menus/:id/items") @CmsPermissions("cms.menus.manage")
  createMenuItem(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CreateMenuItemDto) { return this.cms.createMenuItem(id, dto); }
  @Patch("menus/:id/items/:itemId") @CmsPermissions("cms.menus.manage")
  updateMenuItem(@Param("id", new ParseUUIDPipe()) id: string, @Param("itemId", new ParseUUIDPipe()) itemId: string, @Body() dto: UpdateMenuItemDto) {
    return this.cms.updateMenuItem(id, itemId, dto);
  }
  @Delete("menus/:id/items/:itemId") @CmsPermissions("cms.menus.manage")
  deleteMenuItem(@Param("id", new ParseUUIDPipe()) id: string, @Param("itemId", new ParseUUIDPipe()) itemId: string) { return this.cms.deleteMenuItem(id, itemId); }

  @Get("redirects") @CmsPermissions("cms.redirects.manage")
  listRedirects() { return this.cms.listRedirects(true); }
  @Post("redirects") @CmsPermissions("cms.redirects.manage")
  createRedirect(@Body() dto: CreateRedirectDto) { return this.cms.createRedirect(dto); }
  @Patch("redirects/:id") @CmsPermissions("cms.redirects.manage")
  updateRedirect(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateRedirectDto) { return this.cms.updateRedirect(id, dto); }

  @Get("forms") @CmsPermissions("cms.forms.manage")
  listForms() { return this.cms.listForms(true); }
  @Post("forms") @CmsPermissions("cms.forms.manage")
  createForm(@Body() dto: CreateCmsFormDto) { return this.cms.createForm(dto); }
  @Patch("forms/:id") @CmsPermissions("cms.forms.manage")
  updateForm(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateCmsFormDto) { return this.cms.updateForm(id, dto); }
  @Get("forms/:formId/submissions") @CmsPermissions("cms.forms.submissions.read")
  listSubmissions(@Param("formId", new ParseUUIDPipe()) formId: string, @Query("page") pageRaw?: string, @Query("limit") limitRaw?: string, @Query("status") statusRaw?: string) {
    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw) || 30));
    const status = statusRaw ? Object.values(CmsFormSubmissionStatus).find(value => value === statusRaw) : undefined;
    if (statusRaw && !status) throw new BadRequestException("Invalid form submission status.");
    return this.cms.listFormSubmissions(formId, page, limit, status);
  }
  @Patch("forms/:formId/submissions/:submissionId") @CmsPermissions("cms.forms.submissions.manage")
  updateSubmission(@Param("formId", new ParseUUIDPipe()) formId: string, @Param("submissionId", new ParseUUIDPipe()) submissionId: string, @Body() dto: UpdateFormSubmissionDto) {
    return this.cms.updateFormSubmission(formId, submissionId, dto);
  }

  @Get("webhooks") @CmsPermissions("cms.webhooks.manage")
  listWebhooks() { return this.cms.listWebhooks(); }
  @Post("webhooks") @CmsPermissions("cms.webhooks.manage")
  createWebhook(@Body() dto: CreateCmsWebhookDto) { return this.cms.createWebhook(dto); }
  @Patch("webhooks/:id") @CmsPermissions("cms.webhooks.manage")
  updateWebhook(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateCmsWebhookDto) { return this.cms.updateWebhook(id, dto); }
  @Delete("webhooks/:id") @CmsPermissions("cms.webhooks.manage")
  deleteWebhook(@Param("id", new ParseUUIDPipe()) id: string) { return this.cms.deleteWebhook(id); }
  @Post("webhooks/:id/deliveries/:deliveryId/retry") @CmsPermissions("cms.webhooks.manage")
  retryWebhookDelivery(@Param("id", new ParseUUIDPipe()) id: string, @Param("deliveryId", new ParseUUIDPipe()) deliveryId: string) { return this.cms.retryWebhookDelivery(id, deliveryId); }

  @Get("webhooks/:id/deliveries") @CmsPermissions("cms.webhooks.manage")
  listWebhookDeliveries(@Param("id", new ParseUUIDPipe()) id: string, @Query("page") pageRaw?: string, @Query("limit") limitRaw?: string) {
    return this.cms.listWebhookDeliveries(id, Math.max(1, Number(pageRaw) || 1), Math.min(100, Math.max(1, Number(limitRaw) || 30)));
  }

  @Get("audit-logs") @Roles(Role.ADMIN) @CmsPermissions("cms.audit.read")
  listAuditLogs(@Query("page") pageRaw?: string, @Query("limit") limitRaw?: string, @Query("action") action?: string, @Query("entity") entity?: string, @Query("search") search?: string) {
    return this.cms.listAuditLogs({
      page: Math.max(1, Number(pageRaw) || 1),
      limit: Math.min(100, Math.max(1, Number(limitRaw) || 30)),
      action, entity, search,
    });
  }

  @Get("permissions") @Roles(Role.ADMIN) @CmsPermissions("cms.permissions.manage")
  listPermissions() { return this.cms.listPermissions(); }
  @Put("permissions/roles") @Roles(Role.ADMIN) @CmsPermissions("cms.permissions.manage")
  updateRolePermissions(@Body() dto: UpdateRolePermissionsDto) { return this.cms.updateRolePermissions(dto); }
}
