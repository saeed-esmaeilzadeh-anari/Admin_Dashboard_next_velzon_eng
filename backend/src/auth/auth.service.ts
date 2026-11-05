import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

const SESSION_TTL_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  async register(dto: RegisterDto) {
    if (!this.isPublicRegistrationEnabled()) {
      throw new ForbiddenException(
        "Public registration is disabled for this installation."
      );
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("An account with this email already exists.");
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: Role.USER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Registration creates an account; sign-in creates an authenticated session.
    return { user };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.issueToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private isPublicRegistrationEnabled(): boolean {
    const configured = this.config.get<string>("PUBLIC_REGISTRATION_ENABLED");
    if (configured !== undefined && configured.trim() !== "") {
      return configured.trim().toLowerCase() === "true";
    }
    return this.config.get<string>("NODE_ENV") !== "production";
  }

  private async issueToken(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  }) {
    const now = new Date();
    await this.prisma.authSession.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lte: now } },
          { revokedAt: { not: null } },
        ],
      },
    });

    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const session = await this.prisma.authSession.create({
      data: { userId: user.id, expiresAt },
      select: { id: true },
    });
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: SESSION_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
