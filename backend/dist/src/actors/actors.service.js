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
exports.ActorsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let ActorsService = class ActorsService {
    prismaService;
    constructor(prismaService) {
        this.prismaService = prismaService;
    }
    async findAll(authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.actor.findMany({
                where: {
                    householdId: authContext.householdId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: [
                    { kind: 'asc' },
                    { name: 'asc' },
                ],
            });
        });
    }
    async findOne(id, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const actor = await prisma.actor.findFirst({
                where: {
                    id,
                    householdId: authContext.householdId,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    transactions: {
                        select: {
                            id: true,
                            amount: true,
                            description: true,
                            date: true,
                        },
                        take: 10,
                        orderBy: { date: 'desc' },
                    },
                },
            });
            if (!actor) {
                throw new common_1.NotFoundException('Actor not found');
            }
            return actor;
        });
    }
    async findByUserId(userId, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.actor.findMany({
                where: {
                    userId,
                    householdId: authContext.householdId,
                },
            });
        });
    }
    async create(createActorDto, authContext) {
        const targetUserId = createActorDto.userId || authContext.userId;
        if (createActorDto.userId && authContext.role !== client_1.UserRole.admin) {
            throw new common_1.ForbiddenException('Only administrators can create actors for other users');
        }
        const targetUser = await this.prismaService.prisma.user.findFirst({
            where: {
                id: targetUserId,
                householdId: authContext.householdId,
                deletedAt: null,
            },
        });
        if (!targetUser) {
            throw new common_1.BadRequestException('Target user not found or not in same household');
        }
        const existingActor = await this.prismaService.prisma.actor.findFirst({
            where: {
                name: createActorDto.name,
                householdId: authContext.householdId,
                deletedAt: null,
            },
        });
        if (existingActor) {
            throw new common_1.BadRequestException('Actor with this name already exists');
        }
        return this.prismaService.withContext(authContext, (prisma) => {
            const actorData = {
                name: createActorDto.name,
                kind: createActorDto.kind,
                description: createActorDto.description,
                householdId: authContext.householdId,
                userId: targetUserId,
            };
            return prisma.actor.create({
                data: actorData,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
        });
    }
    async update(id, updateActorDto, authContext) {
        const existingActor = await this.findOne(id, authContext);
        if (authContext.role !== client_1.UserRole.admin &&
            existingActor.userId !== authContext.userId) {
            throw new common_1.ForbiddenException('You can only update your own actors');
        }
        if (updateActorDto.name && updateActorDto.name !== existingActor.name) {
            const existingNameActor = await this.prismaService.prisma.actor.findFirst({
                where: {
                    name: updateActorDto.name,
                    householdId: authContext.householdId,
                    id: { not: id },
                    deletedAt: null,
                },
            });
            if (existingNameActor) {
                throw new common_1.BadRequestException('Actor with this name already exists');
            }
        }
        return this.prismaService.withContext(authContext, async (prisma) => {
            const updateData = {};
            if (updateActorDto.name)
                updateData.name = updateActorDto.name;
            if (updateActorDto.kind)
                updateData.kind = updateActorDto.kind;
            if (updateActorDto.description !== undefined)
                updateData.description = updateActorDto.description;
            return prisma.actor.update({
                where: { id },
                data: updateData,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
        });
    }
    async remove(id, authContext) {
        const existingActor = await this.findOne(id, authContext);
        if (authContext.role !== client_1.UserRole.admin &&
            existingActor.userId !== authContext.userId) {
            throw new common_1.ForbiddenException('You can only delete your own actors');
        }
        const transactionCount = await this.prismaService.prisma.transaction.count({
            where: { actorId: id },
        });
        if (transactionCount > 0) {
            throw new common_1.BadRequestException('Cannot delete actor with existing transactions');
        }
        await this.prismaService.withContext(authContext, async (prisma) => {
            await prisma.actor.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
        });
    }
    async getActorStats(id, authContext) {
        const actor = await this.findOne(id, authContext);
        return this.prismaService.withContext(authContext, async (prisma) => {
            const [transactionCount, totalIncome, totalExpenses, recentTransactions] = await Promise.all([
                prisma.transaction.count({
                    where: { actorId: id },
                }),
                prisma.transaction.aggregate({
                    where: {
                        actorId: id,
                        amount: { gt: 0 },
                    },
                    _sum: { amount: true },
                    _count: true,
                }),
                prisma.transaction.aggregate({
                    where: {
                        actorId: id,
                        amount: { lt: 0 },
                    },
                    _sum: { amount: true },
                    _count: true,
                }),
                prisma.transaction.count({
                    where: {
                        actorId: id,
                        date: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                        },
                    },
                }),
            ]);
            const actorInfo = {
                id: actor.id,
                name: actor.name,
                kind: actor.kind,
            };
            return {
                actor: actorInfo,
                statistics: {
                    totalTransactions: transactionCount,
                    totalIncome: (totalIncome._sum.amount ?? 0),
                    totalExpenses: Math.abs((totalExpenses._sum.amount ?? 0)),
                    netAmount: (totalIncome._sum.amount ?? 0) +
                        (totalExpenses._sum.amount ?? 0),
                    incomeTransactionCount: totalIncome._count,
                    expenseTransactionCount: totalExpenses._count,
                    recentTransactions: recentTransactions,
                },
            };
        });
    }
};
exports.ActorsService = ActorsService;
exports.ActorsService = ActorsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ActorsService);
//# sourceMappingURL=actors.service.js.map