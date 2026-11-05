import { ConflictException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

function createHarness(values: Record<string, string | undefined>) {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    authSession: {
      create: jest.fn().mockResolvedValue({ id: "session-1" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
  const jwt = {
    signAsync: jest.fn().mockResolvedValue("signed-test-token"),
  } as unknown as JwtService;
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;

  return { service: new AuthService(prisma, jwt, config), prisma, jwt, config };
}

describe("AuthService public registration policy", () => {
  afterEach(() => jest.restoreAllMocks());

  it("disables public registration by default in production", async () => {
    const { service, prisma } = createHarness({ NODE_ENV: "production" });

    await expect(
      service.register({
        name: "Portfolio User",
        email: "user@example.test",
        password: "strong-password-123",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates an account without silently establishing an authenticated session", async () => {
    const { service, prisma, jwt } = createHarness({
      NODE_ENV: "production",
      PUBLIC_REGISTRATION_ENABLED: "true",
    });
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    prisma.user.create = jest.fn().mockResolvedValue({
      id: "user-1",
      email: "user@example.test",
      name: "Portfolio User",
      role: Role.USER,
      createdAt,
    });

    const result = await service.register({
      name: " Portfolio User ",
      email: " USER@Example.Test ",
      password: "strong-password-123",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "user@example.test" },
      select: { id: true },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Portfolio User",
          email: "user@example.test",
          role: Role.USER,
        }),
      })
    );
    const createInput = (prisma.user.create as jest.Mock).mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    await expect(
      bcrypt.compare("strong-password-123", createInput.data.passwordHash)
    ).resolves.toBe(true);

    expect(result).toEqual({
      user: {
        id: "user-1",
        email: "user@example.test",
        name: "Portfolio User",
        role: Role.USER,
        createdAt,
      },
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it("keeps local development registration enabled when no override is set", async () => {
    const { service, prisma } = createHarness({ NODE_ENV: "development" });
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: "existing-user" });

    await expect(
      service.register({
        name: "Existing User",
        email: "existing@example.test",
        password: "strong-password-123",
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("allows an explicit opt-out in development", async () => {
    const { service, prisma } = createHarness({
      NODE_ENV: "development",
      PUBLIC_REGISTRATION_ENABLED: "false",
    });

    await expect(
      service.register({
        name: "Portfolio User",
        email: "user@example.test",
        password: "strong-password-123",
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("AuthService persisted access sessions", () => {
  it("creates a database session and binds its ID into the JWT", async () => {
    const { service, prisma, jwt } = createHarness({ NODE_ENV: "production" });
    const passwordHash = await bcrypt.hash("strong-password-123", 4);
    prisma.user.findUnique = jest.fn().mockResolvedValue({
      id: "user-1",
      email: "user@example.test",
      name: "Portfolio User",
      role: Role.ADMIN,
      isActive: true,
      passwordHash,
    });

    const result = await service.login({
      email: " USER@example.test ",
      password: "strong-password-123",
    });

    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        OR: [
          { expiresAt: { lte: expect.any(Date) } },
          { revokedAt: { not: null } },
        ],
      },
    });
    const sessionInput = (prisma.authSession.create as jest.Mock).mock.calls[0][0] as {
      data: { userId: string; expiresAt: Date };
    };
    expect(sessionInput.data.userId).toBe("user-1");
    expect(sessionInput.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(sessionInput.data.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 15 * 60 * 1000 + 1000
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: "user-1",
      email: "user@example.test",
      role: Role.ADMIN,
      sid: "session-1",
    });
    expect(result).toMatchObject({
      accessToken: "signed-test-token",
      expiresIn: 900,
      user: { id: "user-1", email: "user@example.test", role: Role.ADMIN },
    });
  });

  it("revokes only the current user's matching session", async () => {
    const { service, prisma } = createHarness({ NODE_ENV: "production" });

    await expect(service.logout("user-1", "session-1")).resolves.toEqual({
      success: true,
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: "session-1", userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
