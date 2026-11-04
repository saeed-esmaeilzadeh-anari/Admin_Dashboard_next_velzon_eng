import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const privilegedAdminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, search?: string) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async update(
    id: string,
    patch: { role?: Role; isActive?: boolean; name?: string },
    actorId: string
  ) {
    if (!Object.keys(patch).length) {
      throw new ConflictException("At least one user field must be provided.");
    }

    return this.prisma.$transaction(
      async tx => {
        const current = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true, isActive: true },
        });
        if (!current) throw new NotFoundException("User not found.");

        const remainsPrivilegedAdmin =
          patch.role === undefined || privilegedAdminRoles.includes(patch.role);
        const removesAdminAccess =
          current.isActive &&
          privilegedAdminRoles.includes(current.role) &&
          (patch.isActive === false || !remainsPrivilegedAdmin);

        if (removesAdminAccess) {
          if (id === actorId) {
            throw new ForbiddenException(
              "You cannot deactivate or demote your own administrator account."
            );
          }

          const activeAdminCount = await tx.user.count({
            where: {
              isActive: true,
              role: { in: privilegedAdminRoles },
            },
          });
          if (activeAdminCount <= 1) {
            throw new ConflictException(
              "The last active administrator account cannot be deactivated or demoted."
            );
          }
        }

        return tx.user.update({
          where: { id },
          data: patch,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            updatedAt: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
