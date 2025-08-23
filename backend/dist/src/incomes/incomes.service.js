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
exports.IncomesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let IncomesService = class IncomesService {
    prismaService;
    constructor(prismaService) {
        this.prismaService = prismaService;
    }
    async findAll(filters, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const where = {
                householdId: authContext.householdId,
            };
            if (filters.userId) {
                where.userId = filters.userId;
            }
            if (filters.year !== undefined) {
                where.year = filters.year;
            }
            if (filters.month !== undefined) {
                where.month = filters.month;
            }
            if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
                where.year = {};
                if (filters.yearFrom !== undefined) {
                    where.year.gte = filters.yearFrom;
                }
                if (filters.yearTo !== undefined) {
                    where.year.lte = filters.yearTo;
                }
            }
            if (filters.minAllocatable !== undefined ||
                filters.maxAllocatable !== undefined) {
                where.allocatableYen = {};
                if (filters.minAllocatable !== undefined) {
                    where.allocatableYen.gte = filters.minAllocatable;
                }
                if (filters.maxAllocatable !== undefined) {
                    where.allocatableYen.lte = filters.maxAllocatable;
                }
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
                        sourceDocument: {
                            contains: filters.search,
                            mode: 'insensitive',
                        },
                    },
                ];
            }
            const orderBy = {};
            const sortBy = filters.sortBy || 'year';
            const sortOrder = filters.sortOrder || 'desc';
            if (sortBy === 'year' || sortBy === 'month') {
                orderBy.year = sortOrder;
                orderBy.month = sortOrder;
            }
            else {
                orderBy[sortBy] = sortOrder;
            }
            return prisma.income.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: Array.isArray(orderBy) ? orderBy : [orderBy],
                take: filters.limit || 100,
                skip: filters.offset || 0,
            });
        });
    }
    async findOne(id, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const income = await prisma.income.findFirst({
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
                },
            });
            if (!income) {
                throw new common_1.NotFoundException('Income not found');
            }
            return income;
        });
    }
    async findByUserAndMonth(userId, year, month, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.income.findFirst({
                where: {
                    userId,
                    year,
                    month,
                    householdId: authContext.householdId,
                    deletedAt: null,
                },
            });
        });
    }
    async create(createIncomeDto, authContext) {
        await this.validateIncome(createIncomeDto, authContext);
        const existingIncome = await this.findByUserAndMonth(createIncomeDto.userId, createIncomeDto.year, createIncomeDto.month, authContext);
        if (existingIncome) {
            throw new common_1.ConflictException(`Income for user ${createIncomeDto.userId} already exists for ${createIncomeDto.year}-${createIncomeDto.month.toString().padStart(2, '0')}`);
        }
        const allocatableYen = this.calculateAllocatableYen(createIncomeDto.grossIncomeYen, createIncomeDto.deductionYen);
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.income.create({
                data: {
                    userId: createIncomeDto.userId,
                    grossIncomeYen: createIncomeDto.grossIncomeYen,
                    deductionYen: createIncomeDto.deductionYen,
                    allocatableYen,
                    year: createIncomeDto.year,
                    month: createIncomeDto.month,
                    description: createIncomeDto.description,
                    sourceDocument: createIncomeDto.sourceDocument,
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
            });
        });
    }
    async update(id, updateIncomeDto, authContext) {
        const existingIncome = await this.findOne(id, authContext);
        const mergedDto = {
            ...existingIncome,
            ...updateIncomeDto,
        };
        this.validateIncomeUpdate(mergedDto);
        let allocatableYen = existingIncome.allocatableYen;
        if (updateIncomeDto.grossIncomeYen !== undefined ||
            updateIncomeDto.deductionYen !== undefined) {
            const grossIncome = updateIncomeDto.grossIncomeYen ?? Number(existingIncome.grossIncomeYen);
            const deduction = updateIncomeDto.deductionYen ?? Number(existingIncome.deductionYen);
            allocatableYen = this.calculateAllocatableYen(grossIncome, deduction);
        }
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.income.update({
                where: { id },
                data: {
                    ...(updateIncomeDto.grossIncomeYen !== undefined && {
                        grossIncomeYen: updateIncomeDto.grossIncomeYen,
                    }),
                    ...(updateIncomeDto.deductionYen !== undefined && {
                        deductionYen: updateIncomeDto.deductionYen,
                    }),
                    ...(updateIncomeDto.description !== undefined && {
                        description: updateIncomeDto.description,
                    }),
                    ...(updateIncomeDto.sourceDocument !== undefined && {
                        sourceDocument: updateIncomeDto.sourceDocument,
                    }),
                    allocatableYen,
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
            });
        });
    }
    async remove(id, authContext) {
        await this.findOne(id, authContext);
        await this.prismaService.withContext(authContext, async (prisma) => {
            await prisma.income.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
        });
    }
    async getIncomeStatistics(filters, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const where = {
                householdId: authContext.householdId,
                deletedAt: null,
            };
            if (filters.userId) {
                where.userId = filters.userId;
            }
            if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
                where.year = {};
                if (filters.yearFrom !== undefined) {
                    where.year.gte = filters.yearFrom;
                }
                if (filters.yearTo !== undefined) {
                    where.year.lte = filters.yearTo;
                }
            }
            const [aggregates, monthlyData] = await Promise.all([
                prisma.income.aggregate({
                    where,
                    _sum: {
                        grossIncomeYen: true,
                        deductionYen: true,
                        allocatableYen: true,
                    },
                    _avg: {
                        allocatableYen: true,
                    },
                    _count: true,
                }),
                prisma.income.findMany({
                    where,
                    select: {
                        year: true,
                        month: true,
                        grossIncomeYen: true,
                        deductionYen: true,
                        allocatableYen: true,
                    },
                    orderBy: [{ year: 'desc' }, { month: 'desc' }],
                }),
            ]);
            return {
                totalGrossIncome: Number(aggregates._sum.grossIncomeYen) || 0,
                totalDeductions: Number(aggregates._sum.deductionYen) || 0,
                totalAllocatable: Number(aggregates._sum.allocatableYen) || 0,
                averageMonthlyIncome: Number(aggregates._avg.allocatableYen) || 0,
                monthlyIncomes: monthlyData.map((item) => ({
                    year: Number(item.year),
                    month: Number(item.month),
                    grossIncome: Number(item.grossIncomeYen),
                    deductions: Number(item.deductionYen),
                    allocatable: Number(item.allocatableYen),
                })),
            };
        });
    }
    async getHouseholdIncomeBreakdown(year, month, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const where = {
                householdId: authContext.householdId,
                year,
                deletedAt: null,
            };
            if (month !== undefined) {
                where.month = month;
            }
            const incomes = await prisma.income.findMany({
                where,
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
            const breakdown = incomes.reduce((acc, income) => {
                const userKey = income.user.id;
                if (!acc[userKey]) {
                    acc[userKey] = {
                        user: income.user,
                        grossIncome: 0,
                        deductions: 0,
                        allocatable: 0,
                        months: [],
                    };
                }
                acc[userKey].grossIncome += Number(income.grossIncomeYen);
                acc[userKey].deductions += Number(income.deductionYen);
                acc[userKey].allocatable += Number(income.allocatableYen);
                acc[userKey].months.push({
                    month: Number(income.month),
                    grossIncome: Number(income.grossIncomeYen),
                    deductions: Number(income.deductionYen),
                    allocatable: Number(income.allocatableYen),
                });
                return acc;
            }, {});
            const totalAllocatable = Object.values(breakdown).reduce((sum, user) => sum + user.allocatable, 0);
            return {
                year,
                month,
                users: Object.values(breakdown).map((user) => ({
                    ...user,
                    percentage: totalAllocatable > 0
                        ? (user.allocatable / totalAllocatable) * 100
                        : 0,
                })),
                totals: {
                    grossIncome: Object.values(breakdown).reduce((sum, user) => sum + user.grossIncome, 0),
                    deductions: Object.values(breakdown).reduce((sum, user) => sum + user.deductions, 0),
                    allocatable: totalAllocatable,
                },
            };
        });
    }
    calculateAllocatableYen(grossIncomeYen, deductionYen) {
        const allocatable = grossIncomeYen - deductionYen;
        return Math.max(0, allocatable);
    }
    async validateIncome(dto, authContext) {
        const errors = [];
        if (!Number.isInteger(dto.grossIncomeYen) || dto.grossIncomeYen < 0) {
            errors.push('Gross income must be a non-negative integer');
        }
        if (!Number.isInteger(dto.deductionYen) || dto.deductionYen < 0) {
            errors.push('Deduction must be a non-negative integer');
        }
        if (dto.deductionYen > dto.grossIncomeYen) {
            errors.push('Deduction cannot exceed gross income');
        }
        const currentYear = new Date().getFullYear();
        if (dto.year < 1900 || dto.year > currentYear + 5) {
            errors.push(`Year must be between 1900 and ${currentYear + 5}`);
        }
        if (dto.month < 1 || dto.month > 12) {
            errors.push('Month must be between 1 and 12');
        }
        const user = await this.prismaService.prisma.user.findFirst({
            where: {
                id: dto.userId,
                householdId: authContext.householdId,
                deletedAt: null,
            },
        });
        if (!user) {
            errors.push('User not found or does not belong to household');
        }
        if (dto.description && dto.description.length > 500) {
            errors.push('Description cannot exceed 500 characters');
        }
        if (dto.sourceDocument && dto.sourceDocument.length > 255) {
            errors.push('Source document cannot exceed 255 characters');
        }
        if (errors.length > 0) {
            throw new common_1.BadRequestException(`Validation failed: ${errors.join(', ')}`);
        }
    }
    validateIncomeUpdate(mergedDto) {
        const errors = [];
        if (mergedDto.grossIncomeYen !== undefined) {
            if (!Number.isInteger(mergedDto.grossIncomeYen) ||
                mergedDto.grossIncomeYen < 0) {
                errors.push('Gross income must be a non-negative integer');
            }
        }
        if (mergedDto.deductionYen !== undefined) {
            if (!Number.isInteger(mergedDto.deductionYen) ||
                mergedDto.deductionYen < 0) {
                errors.push('Deduction must be a non-negative integer');
            }
        }
        if (mergedDto.deductionYen > mergedDto.grossIncomeYen) {
            errors.push('Deduction cannot exceed gross income');
        }
        if (mergedDto.description && mergedDto.description.length > 500) {
            errors.push('Description cannot exceed 500 characters');
        }
        if (mergedDto.sourceDocument && mergedDto.sourceDocument.length > 255) {
            errors.push('Source document cannot exceed 255 characters');
        }
        if (errors.length > 0) {
            throw new common_1.BadRequestException(`Validation failed: ${errors.join(', ')}`);
        }
    }
};
exports.IncomesService = IncomesService;
exports.IncomesService = IncomesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IncomesService);
//# sourceMappingURL=incomes.service.js.map