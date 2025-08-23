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
exports.CategoriesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CategoriesService = class CategoriesService {
    prismaService;
    constructor(prismaService) {
        this.prismaService = prismaService;
    }
    async findAll(authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const categories = (await prisma.category.findMany({
                where: {
                    householdId: authContext.householdId,
                },
                include: {
                    parent: true,
                    children: {
                        include: {
                            children: {
                                include: {
                                    children: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { name: 'asc' },
            }));
            return categories.filter((category) => category.parentId === null);
        });
    }
    async findOne(id, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const category = await prisma.category.findFirst({
                where: {
                    id,
                    householdId: authContext.householdId,
                },
                include: {
                    parent: true,
                    children: {
                        include: {
                            children: true,
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
            if (!category) {
                throw new common_1.NotFoundException('Category not found');
            }
            return category;
        });
    }
    async create(createCategoryDto, authContext) {
        if (createCategoryDto.parentId) {
            const parent = await this.prismaService.prisma.category.findFirst({
                where: {
                    id: createCategoryDto.parentId,
                    householdId: authContext.householdId,
                    deletedAt: null,
                },
            });
            if (!parent) {
                throw new common_1.BadRequestException('Parent category not found or not in same household');
            }
            const depth = await this.getCategoryDepth(createCategoryDto.parentId, authContext);
            if (depth >= 5) {
                throw new common_1.BadRequestException('Category nesting cannot exceed 5 levels');
            }
        }
        const existingCategory = await this.prismaService.prisma.category.findFirst({
            where: {
                name: createCategoryDto.name,
                parentId: createCategoryDto.parentId || null,
                householdId: authContext.householdId,
                deletedAt: null,
            },
        });
        if (existingCategory) {
            throw new common_1.BadRequestException('Category with this name already exists at this level');
        }
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.category.create({
                data: {
                    name: createCategoryDto.name,
                    parentId: createCategoryDto.parentId,
                    description: createCategoryDto.description,
                    householdId: authContext.householdId,
                },
                include: {
                    parent: true,
                    children: true,
                },
            });
        });
    }
    async update(id, updateCategoryDto, authContext) {
        const existingCategory = await this.findOne(id, authContext);
        if (updateCategoryDto.parentId !== undefined) {
            if (updateCategoryDto.parentId === id) {
                throw new common_1.BadRequestException('Category cannot be its own parent');
            }
            if (updateCategoryDto.parentId) {
                const wouldCreateCircle = await this.wouldCreateCircularReference(id, updateCategoryDto.parentId, authContext);
                if (wouldCreateCircle) {
                    throw new common_1.BadRequestException('Moving category would create a circular reference');
                }
                const depth = await this.getCategoryDepth(updateCategoryDto.parentId, authContext);
                if (depth >= 5) {
                    throw new common_1.BadRequestException('Category nesting cannot exceed 5 levels');
                }
                const parent = await this.prismaService.prisma.category.findFirst({
                    where: {
                        id: updateCategoryDto.parentId,
                        householdId: authContext.householdId,
                        deletedAt: null,
                    },
                });
                if (!parent) {
                    throw new common_1.BadRequestException('Parent category not found or not in same household');
                }
            }
        }
        if (updateCategoryDto.name &&
            updateCategoryDto.name !== existingCategory.name) {
            const parentId = updateCategoryDto.parentId !== undefined
                ? updateCategoryDto.parentId
                : existingCategory.parentId;
            const existingNameCategory = await this.prismaService.prisma.category.findFirst({
                where: {
                    name: updateCategoryDto.name,
                    parentId: parentId || null,
                    householdId: authContext.householdId,
                    id: { not: id },
                    deletedAt: null,
                },
            });
            if (existingNameCategory) {
                throw new common_1.BadRequestException('Category with this name already exists at this level');
            }
        }
        return this.prismaService.withContext(authContext, async (prisma) => {
            return prisma.category.update({
                where: { id },
                data: {
                    ...(updateCategoryDto.name && { name: updateCategoryDto.name }),
                    ...(updateCategoryDto.parentId !== undefined && {
                        parentId: updateCategoryDto.parentId,
                    }),
                    ...(updateCategoryDto.description !== undefined && {
                        description: updateCategoryDto.description,
                    }),
                },
                include: {
                    parent: true,
                    children: true,
                },
            });
        });
    }
    async remove(id, authContext) {
        await this.findOne(id, authContext);
        const childrenCount = await this.prismaService.prisma.category.count({
            where: {
                parentId: id,
                deletedAt: null,
            },
        });
        if (childrenCount > 0) {
            throw new common_1.BadRequestException('Cannot delete category with child categories');
        }
        const transactionCount = await this.prismaService.prisma.transaction.count({
            where: { categoryId: id },
        });
        if (transactionCount > 0) {
            throw new common_1.BadRequestException('Cannot delete category with existing transactions');
        }
        await this.prismaService.withContext(authContext, async (prisma) => {
            await prisma.category.update({
                where: { id },
                data: { deletedAt: new Date() },
            });
        });
    }
    async getCategoryTree(authContext) {
        return this.findAll(authContext);
    }
    async getCategoryPath(id, authContext) {
        const category = await this.findOne(id, authContext);
        const path = [category];
        let currentCategory = category;
        while (currentCategory.parent) {
            path.unshift(currentCategory.parent);
            currentCategory = await this.findOne(currentCategory.parent.id, authContext);
        }
        return path;
    }
    async getCategoryDepth(categoryId, authContext) {
        let depth = 0;
        let currentCategoryId = categoryId;
        while (currentCategoryId) {
            const category = (await this.prismaService.prisma.category.findFirst({
                where: {
                    id: currentCategoryId,
                    householdId: authContext.householdId,
                },
                select: { parentId: true },
            }));
            if (!category)
                break;
            depth++;
            currentCategoryId = category.parentId;
            if (depth > 10) {
                throw new common_1.BadRequestException('Category hierarchy is too deep or contains a circular reference');
            }
        }
        return depth;
    }
    async wouldCreateCircularReference(categoryId, newParentId, authContext) {
        const descendants = await this.getAllDescendants(categoryId, authContext);
        return descendants.some((descendant) => descendant.id === newParentId);
    }
    async getAllDescendants(categoryId, authContext) {
        const descendants = [];
        const visited = new Set();
        const getChildren = async (parentId) => {
            if (visited.has(parentId)) {
                return;
            }
            visited.add(parentId);
            const children = await this.prismaService.prisma.category.findMany({
                where: {
                    parentId,
                    householdId: authContext.householdId,
                    deletedAt: null,
                },
            });
            for (const child of children) {
                descendants.push(child);
                await getChildren(child.id);
            }
        };
        await getChildren(categoryId);
        return descendants;
    }
    async getCategoryStats(id, authContext) {
        const category = await this.findOne(id, authContext);
        return this.prismaService.withContext(authContext, async (prisma) => {
            const [transactionCount, totalAmount, descendants] = await Promise.all([
                prisma.transaction.count({
                    where: { categoryId: id },
                }),
                prisma.transaction.aggregate({
                    where: { categoryId: id },
                    _sum: { amount: true },
                    _count: true,
                }),
                this.getAllDescendants(id, authContext),
            ]);
            let descendantTransactionCount = 0;
            let descendantTotalAmount = 0;
            for (const descendant of descendants) {
                const descendantStats = await prisma.transaction.aggregate({
                    where: { categoryId: descendant.id },
                    _sum: { amount: true },
                    _count: true,
                });
                descendantTransactionCount += Number(descendantStats._count) || 0;
                descendantTotalAmount += Number(descendantStats._sum.amount) || 0;
            }
            return {
                category: {
                    id: category.id,
                    name: category.name,
                    parent: category.parent,
                },
                statistics: {
                    directTransactions: transactionCount || 0,
                    directAmount: Number(totalAmount._sum.amount) || 0,
                    descendantTransactions: descendantTransactionCount,
                    descendantAmount: descendantTotalAmount,
                    totalTransactions: (transactionCount || 0) + descendantTransactionCount,
                    totalAmount: (Number(totalAmount._sum.amount) || 0) + descendantTotalAmount,
                    childrenCount: descendants.length,
                },
            };
        });
    }
};
exports.CategoriesService = CategoriesService;
exports.CategoriesService = CategoriesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoriesService);
//# sourceMappingURL=categories.service.js.map