import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthSessionCleanupService } from "./auth-session-cleanup.service";

describe("AuthSessionCleanupService", () => {
  const deleteMany = jest.fn();
  const prisma = {
    authSession: { deleteMany },
  } as unknown as PrismaService;

  beforeEach(() => {
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 0 });
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deletes expired and revoked sessions using a single bounded cleanup query", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-05T03:00:00.000Z"));
    const service = new AuthSessionCleanupService(prisma);

    await expect(service.cleanupExpiredSessions()).resolves.toBe(4);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lte: new Date("2026-11-05T03:00:00.000Z") } },
          { revokedAt: { not: null } },
        ],
      },
    });
    jest.useRealTimers();
  });

  it("does not log when there are no stale sessions", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const service = new AuthSessionCleanupService(prisma);

    await expect(service.cleanupExpiredSessions()).resolves.toBe(0);
    expect(log).not.toHaveBeenCalled();
  });
});
