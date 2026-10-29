import {
  Body, Controller, Delete, Get, MaxFileSizeValidator, Param, ParseFilePipe, Patch, Post,
  Query, UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { CmsPermissions } from "../common/cms-permissions.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CmsPermissionsGuard } from "../common/cms-permissions.guard";
import { CmsMediaService } from "./cms-media.service";
import { ListMediaQueryDto, UpdateMediaAssetDto } from "./cms-management.dto";

@ApiTags("cms-media")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, CmsPermissionsGuard)
@Controller("cms/media")
export class CmsMediaController {
  constructor(private readonly media: CmsMediaService) {}

  @Get()
  @CmsPermissions("cms.media.read")
  list(@Query() query: ListMediaQueryDto) { return this.media.list(query); }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @CmsPermissions("cms.media.upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: Number(process.env.CMS_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024) } }))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload an image, video, audio or document into local media storage" })
  upload(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: Number(process.env.CMS_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024) })] })) file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Body("altText") altText?: string,
    @Body("caption") caption?: string,
  ) { return this.media.upload(file, user.id, altText, caption); }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.MANAGER)
  @CmsPermissions("cms.media.upload")
  update(@Param("id") id: string, @Body() dto: UpdateMediaAssetDto) { return this.media.update(id, dto); }

  @Delete(":id")
  @Roles(Role.ADMIN)
  @CmsPermissions("cms.media.delete")
  delete(@Param("id") id: string) { return this.media.delete(id); }
}
