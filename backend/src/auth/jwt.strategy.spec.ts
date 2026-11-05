import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JwtStrategy } from "./jwt.strategy";

describe("JwtStrategy persisted session validation", () => {
  const now = new Date("2026-11-05T10:00:00.000Z");
  const user = {
    id: "user-1",
    email: "user@example.test",
    name: "Portfolio User",
    role: Role.ADMIN,
    isActive: true,
  };
  const session = {
    id: "session-1",
    userId: "user-1",
    expiresAt: new Date("2026-11-05T10:15:00.000Z"),
    revokedAt: null,
  };

  function createStrategy() {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      authSession: { findUnique: jest.fn().mockResolvedValue(session) },
    } as unknown as PrismaService;
    const config = {
      get: jest.fn().mockReturnValue("test-jwt-secret-with-at-least-32-characters"),
    } as unknown as ConfigService;
    return { strategy: new JwtStrategy(config, prisma), prisma };
  }

  const payload = { sub: "user-1", email: "user@example.test", sid: "session-1" };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("accepts a valid active user and matching unrevoked session", async () => {
    const { strategy } = createStrategy();

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: "user-1",
      email: "user@example.test",
      name: "Portfolio User",
      role: Role.ADMIN,
      sessionId: "session-1",
    });
  });

  it("rejects tokens without a session identifier before querying the database", async () => {
    const { strategy, prisma } = createStrategy();

    await expect(
      strategy.validate({ sub: "user-1", email: "user@example.test" } as never)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
  });

  it("rejects revoked sessions", async () => {
    const { strategy, prisma } = createStrategy();
    (prisma.authSession.findUnique as jest.Mock).mockResolvedValue({
      ...session,
      revokedAt: new Date("2026-11-05T09:59:00.000Z"),
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects expired sessions", async () => {
    const { strategy, prisma } = createStrategy();
    (prisma.authSession.findUnique as jest.Mock).mockResolvedValue({
      ...session,
      expiresAt: new Date("2026-11-05T09:59:59.999Z"),
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects a session owned by another user", async () => {
    const { strategy, prisma } = createStrategy();
    (prisma.authSession.findUnique as jest.Mock).mockResolvedValue({
      ...session,
      userId: "another-user",
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects inactive users even when their session is still valid", async () => {
    const { strategy, prisma } = createStrategy();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...user,
      isActive: false,
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
