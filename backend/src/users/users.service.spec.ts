import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

function createHarness() {
  const tx = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  } as unknown as PrismaService;

  return { service: new UsersService(prisma), prisma, tx };
}

describe("UsersService administrator account safety", () => {
  it("does not allow an administrator to change their own role", async () => {
    const { service, tx } = createHarness();
    tx.user.findUnique.mockResolvedValue({
      id: "admin-1",
      role: Role.ADMIN,
      isActive: true,
    });

    await expect(
      service.update("admin-1", { role: Role.MANAGER }, "admin-1")
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.count).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("does not allow an administrator to deactivate their own account", async () => {
    const { service, tx } = createHarness();
    tx.user.findUnique.mockResolvedValue({
      id: "admin-1",
      role: Role.ADMIN,
      isActive: true,
    });

    await expect(
      service.update("admin-1", { isActive: false }, "admin-1")
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("prevents deactivating the last active administrator", async () => {
    const { service, tx } = createHarness();
    tx.user.findUnique.mockResolvedValue({
      id: "admin-2",
      role: Role.ADMIN,
      isActive: true,
    });
    tx.user.count.mockResolvedValue(1);

    await expect(
      service.update("admin-2", { isActive: false }, "admin-1")
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.user.count).toHaveBeenCalledWith({
      where: { role: Role.ADMIN, isActive: true },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("prevents demoting the last active administrator", async () => {
    const { service, tx } = createHarness();
    tx.user.findUnique.mockResolvedValue({
      id: "admin-2",
      role: Role.ADMIN,
      isActive: true,
    });
    tx.user.count.mockResolvedValue(1);

    await expect(
      service.update("admin-2", { role: Role.USER }, "admin-1")
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("allows an administrator to be demoted when another active administrator remains", async () => {
    const { service, prisma, tx } = createHarness();
    const updated = {
      id: "admin-2",
      name: "Second Admin",
      email: "second@example.test",
      role: Role.MANAGER,
      isActive: true,
    };
    tx.user.findUnique.mockResolvedValue({
      id: "admin-2",
      role: Role.ADMIN,
      isActive: true,
    });
    tx.user.count.mockResolvedValue(2);
    tx.user.update.mockResolvedValue(updated);

    await expect(
      service.update("admin-2", { role: Role.MANAGER }, "admin-1")
    ).resolves.toEqual(updated);

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "admin-2" },
        data: { role: Role.MANAGER },
      })
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  });

  it("allows ordinary user updates without administrator-count queries", async () => {
    const { service, tx } = createHarness();
    const updated = {
      id: "user-1",
      name: "Updated User",
      email: "user@example.test",
      role: Role.USER,
      isActive: true,
    };
    tx.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: Role.USER,
      isActive: true,
    });
    tx.user.update.mockResolvedValue(updated);

    await expect(
      service.update("user-1", { name: "Updated User" }, "admin-1")
    ).resolves.toEqual(updated);

    expect(tx.user.count).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalled();
  });

  it("returns not found for an unknown user", async () => {
    const { service, tx } = createHarness();
    tx.user.findUnique.mockResolvedValue(null);

    await expect(
      service.update("missing-user", { name: "Updated User" }, "admin-1")
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
