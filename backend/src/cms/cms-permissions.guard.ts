import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CMS_PERMISSIONS_KEY } from "./cms-permissions.decorator";
import { AuthenticatedUser } from "./decorators/current-user.decorator";

@Injectable()
export class CmsPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(CMS_PERMISSIONS_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) return false;
    if (user.role === Role.ADMIN) return true;
    const grants = await this.prisma.cmsRolePermission.findMany({
      where: { role: user.role, permission: { is: { code: { in: required } } } },
      select: { permission: { select: { code: true } } },
    });
    const granted = new Set(grants.map(grant => grant.permission.code));
    return required.every(code => granted.has(code));
  }
}
