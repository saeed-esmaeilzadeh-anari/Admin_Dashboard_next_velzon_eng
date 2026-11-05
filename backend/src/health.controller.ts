import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  @ApiOperation({ summary: "Check whether the API process is alive" })
  liveness() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  @ApiOperation({ summary: "Check whether the API can access PostgreSQL" })
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  }

  // Backward-compatible readiness endpoint used by existing deployments.
  @Get()
  @ApiOperation({ summary: "Backward-compatible API and database health check" })
  check() {
    return this.readiness();
  }
}
