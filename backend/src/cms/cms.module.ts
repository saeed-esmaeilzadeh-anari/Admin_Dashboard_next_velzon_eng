import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { CmsController } from "./cms.controller";
import { CmsManagementController } from "./cms-management.controller";
import { CmsAuditInterceptor } from "./cms-audit.interceptor";
import { CmsPublicManagementController } from "./cms-public-management.controller";
import { CmsManagementService } from "./cms-management.service";
import { CmsMediaController } from "./cms-media.controller";
import { CmsMediaService } from "./cms-media.service";
import { CmsMediaStorageService } from "./cms-media-storage.service";
import { CmsPermissionsGuard } from "./cms-permissions.guard";
import { CmsScheduler } from "./cms.scheduler";
import { CmsService } from "./cms.service";
import { CmsWebhookService, CmsWebhookWorker } from "./cms-webhook.service";
import { PublicCmsController } from "./public-cms.controller";
@Module({
  imports: [AuthModule, PrismaModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
  controllers: [CmsController, PublicCmsController, CmsManagementController, CmsPublicManagementController, CmsMediaController],
  providers: [CmsService, CmsScheduler, RolesGuard, CmsManagementService, CmsMediaService, CmsMediaStorageService, CmsPermissionsGuard, CmsWebhookService, CmsWebhookWorker, CmsAuditInterceptor],
  exports: [CmsService],
})
export class CmsModule {}
