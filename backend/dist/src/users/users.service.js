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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const config_1 = require("@nestjs/config");
let UsersService = class UsersService {
    prismaService;
    configService;
    constructor(prismaService, configService) {
        this.prismaService = prismaService;
        this.configService = configService;
    }
    async findAll(authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.user.findMany({
                where: {
                    householdId: authContext.householdId,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    householdId: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
            });
        });
    }
    async findOne(id, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const user = await prisma.user.findFirst({
                where: {
                    id,
                    householdId: authContext.householdId,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    householdId: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
            });
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            return user;
        });
    }
    async findByEmail(email) {
        return this.prismaService.prisma.user.findFirst({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                householdId: true,
                passwordHash: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
            },
        });
    }
    async create(createUserDto, authContext) {
        if (authContext.role !== client_1.UserRole.admin) {
            throw new common_1.ForbiddenException('Only administrators can create users');
        }
        const existingUser = await this.findByEmail(createUserDto.email);
        if (existingUser && !existingUser.deletedAt) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        return this.prismaService.withContext(authContext, async (prisma) => {
            const tempPassword = this.generateTemporaryPassword();
            const saltRounds = this.configService.get('BCRYPT_ROUNDS', 12);
            const passwordHash = await bcrypt.hash(tempPassword, saltRounds);
            const user = await prisma.user.create({
                data: {
                    email: createUserDto.email.toLowerCase(),
                    name: createUserDto.name,
                    role: createUserDto.role || client_1.UserRole.member,
                    householdId: createUserDto.householdId,
                    passwordHash,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    householdId: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
            });
            console.log(`Temporary password for ${user.email}: ${tempPassword}`);
            return user;
        });
    }
    async update(id, updateUserDto, authContext) {
        await this.findOne(id, authContext);
        if (authContext.role !== client_1.UserRole.admin && authContext.userId !== id) {
            throw new common_1.ForbiddenException('You can only update your own profile');
        }
        if (updateUserDto.role && authContext.role !== client_1.UserRole.admin) {
            throw new common_1.ForbiddenException('Only administrators can change user roles');
        }
        if (updateUserDto.role &&
            updateUserDto.role !== client_1.UserRole.admin &&
            authContext.userId === id) {
            const adminCount = await this.prismaService.prisma.user.count({
                where: {
                    householdId: authContext.householdId,
                    role: client_1.UserRole.admin,
                    deletedAt: null,
                },
            });
            if (adminCount <= 1) {
                throw new common_1.BadRequestException('Cannot remove admin role - at least one admin must remain');
            }
        }
        if (updateUserDto.email) {
            const existingEmailUser = await this.findByEmail(updateUserDto.email);
            if (existingEmailUser &&
                existingEmailUser.id !== id &&
                !existingEmailUser.deletedAt) {
                throw new common_1.ConflictException('User with this email already exists');
            }
        }
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.user.update({
                where: { id },
                data: {
                    ...(updateUserDto.name && { name: updateUserDto.name }),
                    ...(updateUserDto.role && { role: updateUserDto.role }),
                    ...(updateUserDto.email && {
                        email: updateUserDto.email.toLowerCase(),
                    }),
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    householdId: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
            });
        });
    }
    async changePassword(id, changePasswordDto, authContext) {
        if (authContext.role !== client_1.UserRole.admin && authContext.userId !== id) {
            throw new common_1.ForbiddenException('You can only change your own password');
        }
        const user = await this.prismaService.prisma.user.findUnique({
            where: { id },
            select: { passwordHash: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (authContext.userId === id) {
            const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.passwordHash);
            if (!isCurrentPasswordValid) {
                throw new common_1.BadRequestException('Current password is incorrect');
            }
        }
        const saltRounds = this.configService.get('BCRYPT_ROUNDS', 12);
        const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);
        await this.prismaService.withContext(authContext, async (prisma) => {
            await prisma.user.update({
                where: { id },
                data: { passwordHash: newPasswordHash },
            });
            await prisma.session.updateMany({
                where: { userId: id },
                data: { revokedAt: new Date() },
            });
        });
    }
    async remove(id, authContext) {
        if (authContext.role !== client_1.UserRole.admin) {
            throw new common_1.ForbiddenException('Only administrators can delete users');
        }
        const user = await this.findOne(id, authContext);
        if (user.role === client_1.UserRole.admin) {
            const adminCount = await this.prismaService.prisma.user.count({
                where: {
                    householdId: authContext.householdId,
                    role: client_1.UserRole.admin,
                    deletedAt: null,
                },
            });
            if (adminCount <= 1) {
                throw new common_1.BadRequestException('Cannot delete the last administrator');
            }
        }
        await this.prismaService.withContext(authContext, async (prisma) => {
            await prisma.user.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
            await prisma.session.updateMany({
                where: { userId: id },
                data: { revokedAt: new Date() },
            });
            await prisma.personalAccessToken.updateMany({
                where: { userId: id },
                data: { revokedAt: new Date() },
            });
        });
    }
    generateTemporaryPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], UsersService);
//# sourceMappingURL=users.service.js.map