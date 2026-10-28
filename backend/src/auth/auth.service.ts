import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException("An account with this email already exists.");
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(), email,
        passwordHash: await bcrypt.hash(dto.password, 12), role: Role.USER,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    return this.issueToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  }

  private async issueToken(user: { id: string; email: string; name: string; role: Role }) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return {
      accessToken, tokenType: "Bearer", expiresIn: 900,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
