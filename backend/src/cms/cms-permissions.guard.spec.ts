import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CMS_PERMISSIONS_KEY } from "./cms-permissions.decorator";
import { CmsPermissionsGuard } from "./cms-permissions.guard";

describe("CmsPermissionsGuard", () => {
  const getAllAndOverride = jest.fn();
  const findMany = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const prisma = { cmsRolePermission: { findMany } } as unknown as PrismaService;
  const guard = new CmsPermissionsGuard(reflector, prisma);

  const contextFor = (user?: { id: string; role: Role }) => ({
    getHandler: () => "handler",
    getClass: () => "controller",
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    getAllAndOverride.mockReset();
    findMany.mockReset();
  });

  it("allows routes without CMS permission metadata", async () => {
    getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(contextFor({ id: "u1", role: Role.MANAGER }))).resolves.toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("allows ADMIN without querying role grants", async () => {
    getAllAndOverride.mockReturnValue(["cms.content.publish"]);
    await expect(guard.canActivate(contextFor({ id: "admin1", role: Role.ADMIN }))).resolves.toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("allows a role only when every required permission is granted", async () => {
    getAllAndOverride.mockReturnValue(["cms.content.read", "cms.content.edit"]);
    findMany.mockResolvedValue([
      { permission: { code: "cms.content.read" } },
      { permission: { code: "cms.content.edit" } },
    ]);
    await expect(guard.canActivate(contextFor({ id: "manager1", role: Role.MANAGER }))).resolves.toBe(true);
    expect(findMany).toHaveBeenCalledWith({
      where: { role: Role.MANAGER, permission: { is: { code: { in: ["cms.content.read", "cms.content.edit"] } } } },
      select: { permission: { select: { code: true } } },
    });
  });

  it("denies a role when one required permission is missing", async () => {
    getAllAndOverride.mockReturnValue(["cms.content.read", "cms.content.publish"]);
    findMany.mockResolvedValue([{ permission: { code: "cms.content.read" } }]);
    await expect(guard.canActivate(contextFor({ id: "manager1", role: Role.MANAGER }))).resolves.toBe(false);
  });

  it("denies requests without an authenticated user", async () => {
    getAllAndOverride.mockReturnValue(["cms.content.read"]);
    await expect(guard.canActivate(contextFor())).resolves.toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });
});
