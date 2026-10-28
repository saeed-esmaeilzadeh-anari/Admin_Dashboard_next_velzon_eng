import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { CmsController } from "./cms.controller";
import { CmsScheduler } from "./cms.scheduler";
import { CmsService } from "./cms.service";
import { PublicCmsController } from "./public-cms.controller";
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CmsController, PublicCmsController],
  providers: [CmsService, CmsScheduler, RolesGuard],
  exports: [CmsService],
})
export class CmsModule {}
