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

  it("honors an explicit production opt-in", async () => {
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
    jest.spyOn(bcrypt, "hash").mockResolvedValue("test-password-hash");

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
          passwordHash: "test-password-hash",
          role: Role.USER,
        }),
      })
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: "user-1",
      email: "user@example.test",
      role: Role.USER,
    });
    expect(result).toMatchObject({
      accessToken: "signed-test-token",
      user: { id: "user-1", email: "user@example.test", role: Role.USER },
    });
  });

  it("keeps local development registration enabled when no override is set", async () => {
    const { service, prisma } = createHarness({ NODE_ENV: "development" });
    prisma.user.findUnique = jest.fn().mockResolvedValue({
      id: "existing-user",
    });

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
