import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Category, TransactionType } from '@prisma/client';
import { AuthContext } from '../common/interfaces/auth-context.interface';

export interface CreateCategoryDto {
  name: string;
  parentId?: string;
  type: TransactionType;
}

export interface UpdateCategoryDto {
  name?: string;
  parentId?: string;
  description?: string;
}

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
  parent?: Category;
}

export interface CategoryStatistics {
  category: {
    id: string;
    name: string;
    parent?: Category | undefined;
  };
  statistics: {
    directTransactions: number;
    directAmount: number;
    descendantTransactions: number;
    descendantAmount: number;
    totalTransactions: number;
    totalAmount: number;
    childrenCount: number;
  };
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(authContext: AuthContext): Promise<CategoryWithChildren[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      // Get all categories and build the tree structure
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
                  children: true, // Support up to 3 levels deep
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      })) as CategoryWithChildren[];

      // Return only root categories (those without parents)
      return categories.filter((category) => category.parentId === null);
    });
  }

  async findOne(
    id: string,
    authContext: AuthContext,
  ): Promise<CategoryWithChildren> {
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
              amountYen: true,
              note: true,
              occurredOn: true,
            },
            take: 10, // Latest 10 transactions
            orderBy: { occurredOn: 'desc' },
          },
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return category as CategoryWithChildren;
    });
  }

  async create(
    createCategoryDto: CreateCategoryDto,
    authContext: AuthContext,
  ): Promise<Category> {
    // Check if parent exists and belongs to the same household
    if (createCategoryDto.parentId) {
      const parent = await this.prismaService.prisma.category.findFirst({
        where: {
          id: createCategoryDto.parentId,
          householdId: authContext.householdId,
        },
      });

      if (!parent) {
        throw new BadRequestException(
          'Parent category not found or not in same household',
        );
      }

      // Check depth limit (prevent nesting too deep)
      const depth = await this.getCategoryDepth(
        createCategoryDto.parentId,
        authContext,
      );
      if (depth >= 5) {
        throw new BadRequestException(
          'Category nesting cannot exceed 5 levels',
        );
      }
    }

    // Check if category name is unique within the same parent
    const existingCategory = await this.prismaService.prisma.category.findFirst(
      {
        where: {
          name: createCategoryDto.name,
          parentId: createCategoryDto.parentId || null,
          householdId: authContext.householdId,
        },
      },
    );

    if (existingCategory) {
      throw new BadRequestException(
        'Category with this name already exists at this level',
      );
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.category.create({
        data: {
          name: createCategoryDto.name,
          parentId: createCategoryDto.parentId || null,
          type: createCategoryDto.type,
          householdId: authContext.householdId,
        },
        include: {
          parent: true,
          children: true,
        },
      });
    });
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
    authContext: AuthContext,
  ): Promise<Category> {
    const existingCategory = await this.findOne(id, authContext);

    // If updating parent, validate the new hierarchy
    if (updateCategoryDto.parentId !== undefined) {
      // Prevent self-reference
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      // Prevent circular references
      if (updateCategoryDto.parentId) {
        const wouldCreateCircle = await this.wouldCreateCircularReference(
          id,
          updateCategoryDto.parentId,
          authContext,
        );
        if (wouldCreateCircle) {
          throw new BadRequestException(
            'Moving category would create a circular reference',
          );
        }

        // Check depth limit
        const depth = await this.getCategoryDepth(
          updateCategoryDto.parentId,
          authContext,
        );
        if (depth >= 5) {
          throw new BadRequestException(
            'Category nesting cannot exceed 5 levels',
          );
        }

        // Ensure parent exists and belongs to same household
        const parent = await this.prismaService.prisma.category.findFirst({
          where: {
            id: updateCategoryDto.parentId,
            householdId: authContext.householdId,
          },
        });

        if (!parent) {
          throw new BadRequestException(
            'Parent category not found or not in same household',
          );
        }
      }
    }

    // Check name uniqueness if updating name
    if (
      updateCategoryDto.name &&
      updateCategoryDto.name !== existingCategory.name
    ) {
      const parentId =
        updateCategoryDto.parentId !== undefined
          ? updateCategoryDto.parentId
          : existingCategory.parentId;

      const existingNameCategory =
        await this.prismaService.prisma.category.findFirst({
          where: {
            name: updateCategoryDto.name,
            parentId: parentId || null,
            householdId: authContext.householdId,
            id: { not: id },
          },
        });

      if (existingNameCategory) {
        throw new BadRequestException(
          'Category with this name already exists at this level',
        );
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

  async remove(id: string, authContext: AuthContext): Promise<void> {
    await this.findOne(id, authContext); // Ensure category exists

    // Check if category has children
    const childrenCount = await this.prismaService.prisma.category.count({
      where: {
        parentId: id,
      },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with child categories',
      );
    }

    // Check if category has transactions
    const transactionCount = await this.prismaService.prisma.transaction.count({
      where: { categoryId: id },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        'Cannot delete category with existing transactions',
      );
    }

    await this.prismaService.withContext(authContext, async (prisma) => {
      await prisma.category.delete({
        where: { id },
      });
    });
  }

  async getCategoryTree(
    authContext: AuthContext,
  ): Promise<CategoryWithChildren[]> {
    return this.findAll(authContext);
  }

  async getCategoryPath(
    id: string,
    authContext: AuthContext,
  ): Promise<Category[]> {
    const category = await this.findOne(id, authContext);
    const path: Category[] = [category];

    let currentCategory = category;
    while (currentCategory.parent) {
      path.unshift(currentCategory.parent);
      currentCategory = await this.findOne(
        currentCategory.parent.id,
        authContext,
      );
    }

    return path;
  }

  private async getCategoryDepth(
    categoryId: string,
    authContext: AuthContext,
  ): Promise<number> {
    let depth = 0;
    let currentCategoryId: string | null = categoryId;

    while (currentCategoryId) {
      const category = (await this.prismaService.prisma.category.findFirst({
        where: {
          id: currentCategoryId,
          householdId: authContext.householdId,
        },
        select: { parentId: true },
      })) as { parentId: string | null } | null;

      if (!category) break;

      depth++;
      currentCategoryId = category.parentId;

      // Safety check to prevent infinite loops
      if (depth > 10) {
        throw new BadRequestException(
          'Category hierarchy is too deep or contains a circular reference',
        );
      }
    }

    return depth;
  }

  private async wouldCreateCircularReference(
    categoryId: string,
    newParentId: string,
    authContext: AuthContext,
  ): Promise<boolean> {
    // Check if newParentId is a descendant of categoryId
    const descendants = await this.getAllDescendants(categoryId, authContext);
    return descendants.some((descendant) => descendant.id === newParentId);
  }

  private async getAllDescendants(
    categoryId: string,
    authContext: AuthContext,
  ): Promise<Category[]> {
    try {
      // Try to use PostgreSQL Recursive CTE for efficient hierarchy traversal
      const descendants = await this.prismaService.prisma.$queryRaw<Category[]>`
        WITH RECURSIVE category_descendants AS (
          SELECT id, name, "parentId", type, "householdId", "createdAt", "updatedAt"
          FROM "categories"
          WHERE "parentId" = ${categoryId}
            AND "householdId" = ${authContext.householdId}
          
          UNION ALL
          
          SELECT c.id, c.name, c."parentId", c.type, c."householdId", c."createdAt", c."updatedAt"
          FROM "categories" c
          INNER JOIN category_descendants cd ON c."parentId" = cd.id
          WHERE c."householdId" = ${authContext.householdId}
        )
        SELECT * FROM category_descendants;
      `;

      return descendants;
    } catch {
      // Fallback to the old recursive approach for tests or when $queryRaw is not available
      // This happens when using mocks in tests that don't support $queryRaw
      const descendants: Category[] = [];
      const visited = new Set<string>();

      const getChildren = async (parentId: string): Promise<void> => {
        if (visited.has(parentId)) {
          return; // Prevent infinite loops in case of existing circular references
        }
        visited.add(parentId);

        const children = await this.prismaService.prisma.category.findMany({
          where: {
            parentId,
            householdId: authContext.householdId,
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
  }

  async getCategoryStats(
    id: string,
    authContext: AuthContext,
  ): Promise<CategoryStatistics> {
    const category = await this.findOne(id, authContext);

    return this.prismaService.withContext(authContext, async (prisma) => {
      const [transactionCount, totalAmount, descendants] = await Promise.all([
        // Direct transaction count
        prisma.transaction.count({
          where: { categoryId: id },
        }),

        // Total amount of transactions
        prisma.transaction.aggregate({
          where: { categoryId: id },
          _sum: { amountYen: true },
          _count: true,
        }),

        // Get all descendant categories for recursive stats
        this.getAllDescendants(id, authContext),
      ]);

      // Get stats for all descendants
      let descendantTransactionCount = 0;
      let descendantTotalAmount = 0;

      for (const descendant of descendants) {
        const descendantStats = await prisma.transaction.aggregate({
          where: { categoryId: descendant.id },
          _sum: { amountYen: true },
          _count: true,
        });

        descendantTransactionCount += Number(descendantStats._count) || 0;
        descendantTotalAmount += Number(descendantStats._sum.amountYen) || 0;
      }

      return {
        category: {
          id: category.id,
          name: category.name,
          parent: category.parent || undefined,
        },
        statistics: {
          directTransactions: transactionCount || 0,
          directAmount: Number(totalAmount._sum.amountYen) || 0,
          descendantTransactions: descendantTransactionCount,
          descendantAmount: descendantTotalAmount,
          totalTransactions:
            (transactionCount || 0) + descendantTransactionCount,
          totalAmount:
            (Number(totalAmount._sum.amountYen) || 0) + descendantTotalAmount,
          childrenCount: descendants.length,
        },
      };
    });
  }
}
