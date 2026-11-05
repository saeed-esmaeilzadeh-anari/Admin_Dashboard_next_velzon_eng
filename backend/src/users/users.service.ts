import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, search?: string) {
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    id: string,
    patch: { role?: Role; isActive?: boolean; name?: string },
    actorId: string
  ) {
    // Serialize administrator changes so concurrent demotions/deactivations
    // cannot leave the installation without an active administrator.
    return this.prisma.$transaction(
      async tx => {
        const current = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true, isActive: true },
        });
        if (!current) throw new NotFoundException("User not found.");

        const changesOwnPrivileges =
          patch.isActive === false ||
          (patch.role !== undefined && patch.role !== current.role);
        if (id === actorId && changesOwnPrivileges) {
          throw new BadRequestException(
            "You cannot deactivate your own account or change your own role."
          );
        }

        const removesActiveAdministrator =
          current.role === Role.ADMIN &&
          current.isActive &&
          (patch.isActive === false ||
            (patch.role !== undefined && patch.role !== Role.ADMIN));

        if (removesActiveAdministrator) {
          const activeAdministrators = await tx.user.count({
            where: { role: Role.ADMIN, isActive: true },
          });
          if (activeAdministrators <= 1) {
            throw new ConflictException(
              "At least one active administrator must remain."
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
