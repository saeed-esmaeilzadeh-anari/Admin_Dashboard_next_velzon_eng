import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthSessionCleanupService {
  private readonly logger = new Logger(AuthSessionCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Keep the persisted session table bounded even for users who never sign in again.
  // Runs at 03:00 UTC once per day; deletion is idempotent across API instances.
  @Cron("0 3 * * *", { timeZone: "UTC" })
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.authSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { revokedAt: { not: null } },
        ],
      },
    });

    if (result.count > 0) {
      this.logger.log(`Pruned ${result.count} expired or revoked authentication sessions.`);
    }
    return result.count;
  }
}
