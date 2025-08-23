import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Verify user still exists and is not deleted
    const user = await this.prismaService.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        householdId: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found or deleted');
    }

    // For session-based tokens, validate session
    if (payload.tokenType === 'access' && payload.sessionId) {
      const session = await this.prismaService.prisma.session.findUnique({
        where: { id: payload.sessionId },
      });

      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session invalid or expired');
      }

      // Update last active time
      await this.prismaService.prisma.session.update({
        where: { id: payload.sessionId },
        data: { lastActiveAt: new Date() },
      });
    }

    // For personal access tokens, validate token
    if (payload.tokenType === 'pat') {
      const pat = await this.prismaService.prisma.personalAccessToken.findFirst({
        where: {
          userId: payload.sub,
          revokedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (!pat) {
        throw new UnauthorizedException('Personal access token invalid or expired');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      householdId: payload.householdId,
      role: payload.role,
      sessionId: payload.sessionId,
      tokenType: payload.tokenType,
    };
  }
}