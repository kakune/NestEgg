"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const client_1 = require("@prisma/client");
let AuthService = class AuthService {
    prismaService;
    usersService;
    jwtService;
    configService;
    constructor(prismaService, usersService, jwtService, configService) {
        this.prismaService = prismaService;
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async validateUser(email, password) {
        const user = (await this.prismaService.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                householdId: true,
                passwordHash: true,
                deletedAt: true,
            },
        }));
        if (!user || user.deletedAt) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const { passwordHash, ...result } = user;
        void passwordHash;
        return result;
    }
    async login(loginDto) {
        const user = await this.validateUser(loginDto.email, loginDto.password);
        const session = await this.prismaService.prisma.session.create({
            data: {
                userId: user.id,
                ipAddress: loginDto.ipAddress,
                userAgent: loginDto.userAgent,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        const payload = {
            sub: user.id,
            email: user.email,
            householdId: user.householdId,
            role: user.role,
            sessionId: session.id,
            tokenType: 'access',
        };
        const accessToken = this.jwtService.sign(payload);
        const expiresIn = this.getTokenExpirationTime();
        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                householdId: user.householdId,
                role: user.role,
            },
            expiresIn,
        };
    }
    async register(registerDto) {
        const existingUser = await this.prismaService.prisma.user.findUnique({
            where: { email: registerDto.email.toLowerCase() },
        });
        if (existingUser) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        const saltRounds = this.configService.get('BCRYPT_ROUNDS', 12);
        const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);
        let householdId = registerDto.householdId;
        if (!householdId) {
            const household = await this.prismaService.prisma.household.create({
                data: {
                    name: `${registerDto.name}'s Household`,
                },
            });
            householdId = household.id;
        }
        const user = (await this.prismaService.prisma.user.create({
            data: {
                email: registerDto.email.toLowerCase(),
                name: registerDto.name,
                passwordHash,
                householdId,
                role: householdId === registerDto.householdId
                    ? client_1.UserRole.member
                    : client_1.UserRole.admin,
            },
            select: {
                id: true,
                email: true,
                name: true,
                householdId: true,
                role: true,
            },
        }));
        const session = await this.prismaService.prisma.session.create({
            data: {
                userId: user.id,
                ipAddress: registerDto.ipAddress,
                userAgent: registerDto.userAgent,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        const payload = {
            sub: user.id,
            email: user.email,
            householdId: user.householdId,
            role: user.role,
            sessionId: session.id,
            tokenType: 'access',
        };
        const accessToken = this.jwtService.sign(payload);
        const expiresIn = this.getTokenExpirationTime();
        return {
            accessToken,
            user,
            expiresIn,
        };
    }
    async logout(sessionId) {
        await this.prismaService.prisma.session.update({
            where: { id: sessionId },
            data: { revokedAt: new Date() },
        });
    }
    async createPersonalAccessToken(userId, createPatDto) {
        const user = (await this.prismaService.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                householdId: true,
                role: true,
            },
        }));
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        const expiresAt = createPatDto.expiresInDays
            ? new Date(Date.now() + createPatDto.expiresInDays * 24 * 60 * 60 * 1000)
            : null;
        const pat = await this.prismaService.prisma.personalAccessToken.create({
            data: {
                name: createPatDto.name,
                userId: user.id,
                scopes: createPatDto.scopes || ['read'],
                expiresAt,
            },
        });
        const payload = {
            sub: user.id,
            email: user.email,
            householdId: user.householdId,
            role: user.role,
            tokenType: 'pat',
        };
        const token = this.jwtService.sign(payload, {
            expiresIn: expiresAt ? undefined : '365d',
        });
        return {
            token,
            id: pat.id,
        };
    }
    async revokePersonalAccessToken(userId, tokenId) {
        await this.prismaService.prisma.personalAccessToken.update({
            where: {
                id: tokenId,
                userId: userId,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }
    async validateSession(sessionId) {
        const session = await this.prismaService.prisma.session.findUnique({
            where: { id: sessionId },
        });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
            return false;
        }
        await this.prismaService.prisma.session.update({
            where: { id: sessionId },
            data: { lastActiveAt: new Date() },
        });
        return true;
    }
    async hashPassword(password) {
        const saltRounds = this.configService.get('BCRYPT_ROUNDS', 12);
        return bcrypt.hash(password, saltRounds);
    }
    async comparePasswords(plaintext, hash) {
        return bcrypt.compare(plaintext, hash);
    }
    getTokenExpirationTime() {
        const expiresIn = this.configService.get('JWT_EXPIRES_IN', '24h');
        if (expiresIn.endsWith('h')) {
            return parseInt(expiresIn.slice(0, -1)) * 3600;
        }
        else if (expiresIn.endsWith('d')) {
            return parseInt(expiresIn.slice(0, -1)) * 86400;
        }
        return 86400;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map