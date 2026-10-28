import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RolesGuard } from "../common/guards/roles.guard";
import { BusinessController } from "./business.controller";
import { BusinessService } from "./business.service";

@Module({
  imports: [AuthModule],
  controllers: [BusinessController],
  providers: [BusinessService, RolesGuard],
})
export class BusinessModule {}
