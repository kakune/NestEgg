"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../../prisma/prisma.service");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    configService;
    prismaService;
    constructor(configService, prismaService) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET'),
        });
        this.configService = configService;
        this.prismaService = prismaService;
    }
    async validate(payload) {
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
            throw new common_1.UnauthorizedException('User not found or deleted');
        }
        if (payload.tokenType === 'access' && payload.sessionId) {
            const session = await this.prismaService.prisma.session.findUnique({
                where: { id: payload.sessionId },
            });
            if (!session || session.revokedAt || session.expiresAt < new Date()) {
                throw new common_1.UnauthorizedException('Session invalid or expired');
            }
            await this.prismaService.prisma.session.update({
                where: { id: payload.sessionId },
                data: { lastActiveAt: new Date() },
            });
        }
        if (payload.tokenType === 'pat') {
            const pat = await this.prismaService.prisma.personalAccessToken.findFirst({
                where: {
                    userId: payload.sub,
                    revokedAt: null,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
            });
            if (!pat) {
                throw new common_1.UnauthorizedException('Personal access token invalid or expired');
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
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map