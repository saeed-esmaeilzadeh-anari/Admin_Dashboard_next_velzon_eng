import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const tx = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const service = new UsersService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)
    );
  });

  it("does not allow an administrator to demote their own account", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "admin-1",
      role: Role.ADMIN,
      isActive: true,
    });

    await expect(
      service.update("admin-1", { role: Role.EDITOR }, { id: "admin-1", role: Role.ADMIN })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.user.count).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("does not allow the last active administrator to be demoted", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "admin-1",
      role: Role.ADMIN,
      isActive: true,
    });
    tx.user.count.mockResolvedValue(1);

    await expect(
      service.update("admin-1", { role: Role.EDITOR }, { id: "admin-2", role: Role.ADMIN })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("allows demotion when another active administrator remains", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "admin-1",
      role: Role.ADMIN,
      isActive: true,
    });
    tx.user.count.mockResolvedValue(2);
    tx.user.update.mockResolvedValue({
      id: "admin-1",
      role: Role.EDITOR,
      isActive: true,
    });

    await expect(
      service.update("admin-1", { role: Role.EDITOR }, { id: "admin-2", role: Role.ADMIN })
    ).resolves.toMatchObject({ id: "admin-1", role: Role.EDITOR });

    expect(tx.user.count).toHaveBeenCalledWith({
      where: { isActive: true, role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } },
    });
  });

  it("rejects an empty update", async () => {
    await expect(service.update("user-1", {}, { id: "admin-1", role: Role.ADMIN })).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns not found for unknown users", async () => {
    tx.user.findUnique.mockResolvedValue(null);

    await expect(
      service.update("missing", { name: "Renamed User" }, { id: "admin-1", role: Role.ADMIN })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("does not allow an ADMIN to change a SUPER_ADMIN account", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "root-admin",
      role: Role.SUPER_ADMIN,
      isActive: true,
    });

    await expect(
      service.update(
        "root-admin",
        { isActive: false },
        { id: "admin-1", role: Role.ADMIN }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("does not allow the last active administrator to be deactivated", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "admin-1",
      role: Role.ADMIN,
      isActive: true,
    });
    tx.user.count.mockResolvedValue(1);

    await expect(
      service.update(
        "admin-1",
        { isActive: false },
        { id: "admin-2", role: Role.SUPER_ADMIN }
      )
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("uses a serializable transaction for administrator changes", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "user-1",
      role: Role.USER,
      isActive: true,
    });
    tx.user.update.mockResolvedValue({ id: "user-1" });

    await service.update("user-1", { name: "Renamed User" }, { id: "admin-1", role: Role.ADMIN });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  });
});
