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
exports.TransactionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const actors_service_1 = require("../actors/actors.service");
const categories_service_1 = require("../categories/categories.service");
const crypto = __importStar(require("crypto"));
let TransactionsService = class TransactionsService {
    prismaService;
    actorsService;
    categoriesService;
    constructor(prismaService, actorsService, categoriesService) {
        this.prismaService = prismaService;
        this.actorsService = actorsService;
        this.categoriesService = categoriesService;
    }
    async findAll(filters, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const where = {
                householdId: authContext.householdId,
            };
            if (filters.dateFrom || filters.dateTo) {
                where.date = {};
                if (filters.dateFrom) {
                    where.date.gte = filters.dateFrom;
                }
                if (filters.dateTo) {
                    where.date.lte = filters.dateTo;
                }
            }
            if (filters.categoryIds && filters.categoryIds.length > 0) {
                where.categoryId = {
                    in: filters.categoryIds,
                };
            }
            if (filters.actorIds && filters.actorIds.length > 0) {
                where.actorId = {
                    in: filters.actorIds,
                };
            }
            if (filters.types && filters.types.length > 0) {
                where.type = {
                    in: filters.types,
                };
            }
            if (filters.amountFrom !== undefined || filters.amountTo !== undefined) {
                where.amount = {};
                if (filters.amountFrom !== undefined) {
                    where.amount.gte = filters.amountFrom;
                }
                if (filters.amountTo !== undefined) {
                    where.amount.lte = filters.amountTo;
                }
            }
            if (filters.shouldPay !== undefined) {
                where.shouldPay = filters.shouldPay;
            }
            if (filters.tags && filters.tags.length > 0) {
                where.tags = {
                    hasSome: filters.tags,
                };
            }
            if (filters.search) {
                where.OR = [
                    {
                        description: {
                            contains: filters.search,
                            mode: 'insensitive',
                        },
                    },
                    {
                        notes: {
                            contains: filters.search,
                            mode: 'insensitive',
                        },
                    },
                ];
            }
            const orderBy = {};
            const sortBy = filters.sortBy || 'date';
            const sortOrder = filters.sortOrder || 'desc';
            orderBy[sortBy] = sortOrder;
            return prisma.transaction.findMany({
                where,
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            parent: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    actor: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                        },
                    },
                },
                orderBy,
                take: filters.limit || 100,
                skip: filters.offset || 0,
            });
        });
    }
    async findOne(id, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const transaction = await prisma.transaction.findFirst({
                where: {
                    id,
                    householdId: authContext.householdId,
                },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            parent: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    actor: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                        },
                    },
                },
            });
            if (!transaction) {
                throw new common_1.NotFoundException('Transaction not found');
            }
            return transaction;
        });
    }
    async create(createTransactionDto, authContext) {
        await this.validateTransaction(createTransactionDto, authContext);
        if (createTransactionDto.sourceHash) {
            const existingTransaction = await this.prismaService.prisma.transaction.findFirst({
                where: {
                    sourceHash: createTransactionDto.sourceHash,
                    householdId: authContext.householdId,
                },
            });
            if (existingTransaction) {
                throw new common_1.BadRequestException('Duplicate transaction detected');
            }
        }
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.transaction.create({
                data: {
                    amount: createTransactionDto.amount,
                    type: createTransactionDto.type,
                    description: createTransactionDto.description,
                    date: createTransactionDto.date,
                    categoryId: createTransactionDto.categoryId,
                    actorId: createTransactionDto.actorId,
                    tags: createTransactionDto.tags || [],
                    notes: createTransactionDto.notes,
                    shouldPay: createTransactionDto.shouldPay ??
                        this.calculateShouldPay(createTransactionDto),
                    sourceHash: createTransactionDto.sourceHash ||
                        this.generateSourceHash(createTransactionDto),
                    householdId: authContext.householdId,
                },
                include: {
                    category: true,
                    actor: true,
                },
            });
        });
    }
    async update(id, updateTransactionDto, authContext) {
        const existingTransaction = await this.findOne(id, authContext);
        const mergedDto = {
            ...existingTransaction,
            ...updateTransactionDto,
        };
        await this.validateTransaction(mergedDto, authContext);
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.transaction.update({
                where: { id },
                data: {
                    ...(updateTransactionDto.amount !== undefined && {
                        amount: updateTransactionDto.amount,
                    }),
                    ...(updateTransactionDto.type && { type: updateTransactionDto.type }),
                    ...(updateTransactionDto.description && {
                        description: updateTransactionDto.description,
                    }),
                    ...(updateTransactionDto.date && { date: updateTransactionDto.date }),
                    ...(updateTransactionDto.categoryId && {
                        categoryId: updateTransactionDto.categoryId,
                    }),
                    ...(updateTransactionDto.actorId && {
                        actorId: updateTransactionDto.actorId,
                    }),
                    ...(updateTransactionDto.tags !== undefined && {
                        tags: updateTransactionDto.tags,
                    }),
                    ...(updateTransactionDto.notes !== undefined && {
                        notes: updateTransactionDto.notes,
                    }),
                    ...(updateTransactionDto.shouldPay !== undefined && {
                        shouldPay: updateTransactionDto.shouldPay,
                    }),
                },
                include: {
                    category: true,
                    actor: true,
                },
            });
        });
    }
    async remove(id, authContext) {
        await this.findOne(id, authContext);
        await this.prismaService.withContext(authContext, async (prisma) => {
            await prisma.transaction.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
        });
    }
    async getTransactionSummary(filters, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const where = {
                householdId: authContext.householdId,
            };
            this.applyFiltersToWhere(where, filters);
            const [totalCount, totalIncome, totalExpenses, avgTransaction] = await Promise.all([
                prisma.transaction.count({ where }),
                prisma.transaction.aggregate({
                    where: { ...where, amount: { gt: 0 } },
                    _sum: { amount: true },
                    _count: true,
                }),
                prisma.transaction.aggregate({
                    where: { ...where, amount: { lt: 0 } },
                    _sum: { amount: true },
                    _count: true,
                }),
                prisma.transaction.aggregate({
                    where,
                    _avg: { amount: true },
                }),
            ]);
            return {
                totalTransactions: totalCount,
                totalIncome: Number(totalIncome._sum.amount) || 0,
                totalExpenses: Math.abs(Number(totalExpenses._sum.amount) || 0),
                netAmount: (Number(totalIncome._sum.amount) || 0) +
                    (Number(totalExpenses._sum.amount) || 0),
                averageTransaction: Number(avgTransaction._avg.amount) || 0,
                incomeCount: totalIncome._count,
                expenseCount: totalExpenses._count,
            };
        });
    }
    async validateTransaction(dto, authContext) {
        const errors = [];
        if (!Number.isInteger(dto.amount) || dto.amount === 0) {
            errors.push('Amount must be a non-zero integer');
        }
        if (!dto.description || dto.description.trim().length === 0) {
            errors.push('Description is required');
        }
        else if (dto.description.length > 500) {
            errors.push('Description cannot exceed 500 characters');
        }
        if (!dto.date || isNaN(dto.date.getTime())) {
            errors.push('Valid date is required');
        }
        else if (dto.date > new Date()) {
            errors.push('Transaction date cannot be in the future');
        }
        try {
            const category = await this.categoriesService.findOne(dto.categoryId, authContext);
            if (!category) {
                errors.push('Category not found');
            }
        }
        catch {
            errors.push('Invalid category');
        }
        try {
            const actor = await this.actorsService.findOne(dto.actorId, authContext);
            if (!actor) {
                errors.push('Actor not found');
            }
        }
        catch {
            errors.push('Invalid actor');
        }
        if (dto.type === client_1.TransactionType.INCOME && dto.amount < 0) {
            errors.push('Income transactions must have positive amounts');
        }
        else if (dto.type === client_1.TransactionType.EXPENSE && dto.amount > 0) {
            errors.push('Expense transactions must have negative amounts');
        }
        if (dto.tags) {
            if (dto.tags.length > 10) {
                errors.push('Cannot have more than 10 tags');
            }
            for (const tag of dto.tags) {
                if (typeof tag !== 'string' || tag.length > 50) {
                    errors.push('Tags must be strings with maximum 50 characters');
                    break;
                }
            }
        }
        if (dto.notes && dto.notes.length > 1000) {
            errors.push('Notes cannot exceed 1000 characters');
        }
        if (errors.length > 0) {
            throw new common_1.BadRequestException(`Validation failed: ${errors.join(', ')}`);
        }
    }
    calculateShouldPay(dto) {
        return dto.type === client_1.TransactionType.EXPENSE;
    }
    generateSourceHash(dto) {
        const hashInput = `${dto.amount}-${dto.date.toISOString()}-${dto.description}-${dto.actorId}-${dto.categoryId}`;
        return crypto.createHash('sha256').update(hashInput).digest('hex');
    }
    applyFiltersToWhere(where, filters) {
        if (filters.dateFrom || filters.dateTo) {
            where.date = {};
            if (filters.dateFrom) {
                where.date.gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                where.date.lte = filters.dateTo;
            }
        }
        if (filters.categoryIds?.length) {
            where.categoryId = { in: filters.categoryIds };
        }
        if (filters.actorIds?.length) {
            where.actorId = { in: filters.actorIds };
        }
        if (filters.types?.length) {
            where.type = { in: filters.types };
        }
        if (filters.shouldPay !== undefined) {
            where.shouldPay = filters.shouldPay;
        }
        if (filters.tags?.length) {
            where.tags = { hasSome: filters.tags };
        }
        if (filters.search) {
            where.OR = [
                { description: { contains: filters.search, mode: 'insensitive' } },
                { notes: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
    }
};
exports.TransactionsService = TransactionsService;
exports.TransactionsService = TransactionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        actors_service_1.ActorsService,
        categories_service_1.CategoriesService])
], TransactionsService);
//# sourceMappingURL=transactions.service.js.map