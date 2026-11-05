import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  sid: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters.");
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub || !payload.email || !payload.sid) {
      throw new UnauthorizedException("The access token is incomplete.");
    }

    const now = new Date();
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      }),
      this.prisma.authSession.findUnique({
        where: { id: payload.sid },
        select: { id: true, userId: true, expiresAt: true, revokedAt: true },
      }),
    ]);

    if (!user || !user.isActive || user.email !== payload.email) {
      throw new UnauthorizedException("User is inactive or no longer exists.");
    }
    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt !== null ||
      session.expiresAt <= now
    ) {
      throw new UnauthorizedException("The session is expired or revoked.");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId: session.id,
    };
  }
}
