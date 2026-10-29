import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CmsPermissionsGuard } from "./cms-permissions.guard";
import { CmsPermissions } from "./cms-permissions.decorator";
import { CmsAuditInterceptor } from "./cms-audit.interceptor";
import { CmsService } from "./cms.service";
import {
  CreateContentDto, CreateTranslationDto, CreateContentTypeDto, CreateContentTypeFieldDto, CreateLocaleDto,
  ListCmsContentsQuery, RejectContentDto, ScheduleContentDto, UpdateContentTranslationDto,
  UpdateContentTypeDto, UpdateContentTypeFieldDto, UpdateLocaleDto, UpdateSharedFieldsDto,
} from "./dto/cms.dto";

@ApiTags("cms-admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CmsPermissionsGuard)
@UseInterceptors(CmsAuditInterceptor)
@Controller("cms")
export class CmsController {
  constructor(private readonly cms: CmsService) {}
  @Get("locales") @CmsPermissions("cms.content.read") listLocales() { return this.cms.listLocales(true); }
  @Post("locales") @Roles(Role.ADMIN) @CmsPermissions("cms.locales.manage") createLocale(@Body() dto: CreateLocaleDto) { return this.cms.createLocale(dto); }
  @Patch("locales/:id") @Roles(Role.ADMIN) @CmsPermissions("cms.locales.manage") updateLocale(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateLocaleDto) { return this.cms.updateLocale(id, dto); }

  @Get("content-types") @CmsPermissions("cms.content.read") listTypes() { return this.cms.listContentTypes(true); }
  @Post("content-types") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content-types.manage") createType(@Body() dto: CreateContentTypeDto) { return this.cms.createContentType(dto); }
  @Patch("content-types/:id") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content-types.manage") updateType(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateContentTypeDto) { return this.cms.updateContentType(id, dto); }
  @Post("content-types/:id/fields") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content-types.manage") addField(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CreateContentTypeFieldDto) { return this.cms.addContentTypeField(id, dto); }
  @Patch("content-types/:id/fields/:fieldId") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content-types.manage") updateField(@Param("id", new ParseUUIDPipe()) id: string, @Param("fieldId", new ParseUUIDPipe()) fieldId: string, @Body() dto: UpdateContentTypeFieldDto) { return this.cms.updateContentTypeField(id, fieldId, dto); }

  @Get("contents") @CmsPermissions("cms.content.read") list(@Query() q: ListCmsContentsQuery) { return this.cms.listContents(q); }
  @Get("contents/:id") @CmsPermissions("cms.content.read") get(@Param("id", new ParseUUIDPipe()) id: string) { return this.cms.getContent(id); }
  @Post("contents") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.create") create(@Body() dto: CreateContentDto, @CurrentUser() user: AuthenticatedUser) { return this.cms.createContent(dto, user); }
  @Post("contents/:id/translations") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.create") createTranslation(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CreateTranslationDto, @CurrentUser() user: AuthenticatedUser) { return this.cms.createTranslation(id, dto, user); }
  @Patch("contents/:id/translations/:localeCode") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.edit") updateTranslation(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @Body() dto: UpdateContentTranslationDto, @CurrentUser() user: AuthenticatedUser) { return this.cms.updateTranslation(id, locale, dto, user); }
  @Patch("contents/:id/shared-fields") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.edit") updateShared(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateSharedFieldsDto, @CurrentUser() user: AuthenticatedUser) { return this.cms.updateSharedFields(id, dto, user); }

  @Post("contents/:id/translations/:localeCode/submit") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.submit") submit(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @CurrentUser() user: AuthenticatedUser) { return this.cms.submitForReview(id, locale, user); }
  @Post("contents/:id/translations/:localeCode/publish") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.publish") publish(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @CurrentUser() user: AuthenticatedUser) { return this.cms.publish(id, locale, user); }
  @Post("contents/:id/translations/:localeCode/reject") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.review") reject(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @Body() dto: RejectContentDto, @CurrentUser() user: AuthenticatedUser) { return this.cms.reject(id, locale, dto, user); }
  @Post("contents/:id/translations/:localeCode/schedule") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.publish") schedule(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @Body() dto: ScheduleContentDto, @CurrentUser() user: AuthenticatedUser) { return this.cms.schedule(id, locale, dto, user); }
  @Post("contents/:id/translations/:localeCode/unpublish") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.publish") unpublish(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @CurrentUser() user: AuthenticatedUser) { return this.cms.unpublish(id, locale, user); }
  @Post("contents/:id/translations/:localeCode/archive") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.archive") archive(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @CurrentUser() user: AuthenticatedUser) { return this.cms.archive(id, locale, user); }
  @Post("contents/:id/translations/:localeCode/restore-to-draft") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.archive") restore(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @CurrentUser() user: AuthenticatedUser) { return this.cms.restoreToDraft(id, locale, user); }
  @Get("contents/:id/translations/:localeCode/revisions") @CmsPermissions("cms.content.read") revisions(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string) { return this.cms.listRevisions(id, locale); }
  @Post("contents/:id/translations/:localeCode/revisions/:revisionId/restore") @Roles(Role.ADMIN, Role.MANAGER) @CmsPermissions("cms.content.edit") restoreRevision(@Param("id", new ParseUUIDPipe()) id: string, @Param("localeCode") locale: string, @Param("revisionId", new ParseUUIDPipe()) revisionId: string, @CurrentUser() user: AuthenticatedUser) { return this.cms.restoreRevision(id, locale, revisionId, user); }
}
