import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Transaction, TransactionType } from '@prisma/client';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import * as crypto from 'crypto';

// Type for Prisma where clause
interface TransactionWhere {
  householdId: string;
  date?: {
    gte?: Date;
    lte?: Date;
  };
  categoryId?: {
    in?: string[];
  };
  actorId?: {
    in?: string[];
  };
  type?: {
    in?: TransactionType[];
  };
  amount?: {
    gte?: number;
    lte?: number;
  };
  shouldPay?: boolean;
  tags?: {
    hasSome?: string[];
  };
  OR?: Array<{
    description?: {
      contains?: string;
      mode?: 'insensitive';
    };
    notes?: {
      contains?: string;
      mode?: 'insensitive';
    };
  }>;
}

// Type for Prisma orderBy clause
interface TransactionOrderBy {
  [key: string]: 'asc' | 'desc';
}

// Type for transaction summary statistics
export interface TransactionSummary {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  averageTransaction: number;
  incomeCount: number;
  expenseCount: number;
}

export interface CreateTransactionDto {
  amount: number;
  type: TransactionType;
  description: string;
  date: Date;
  categoryId: string;
  actorId: string;
  tags?: string[];
  notes?: string;
  shouldPay?: boolean;
  sourceHash?: string; // For duplicate detection during imports
}

export interface UpdateTransactionDto {
  amount?: number;
  type?: TransactionType;
  description?: string;
  date?: Date;
  categoryId?: string;
  actorId?: string;
  tags?: string[];
  notes?: string;
  shouldPay?: boolean;
}

export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categoryIds?: string[];
  actorIds?: string[];
  types?: TransactionType[];
  tags?: string[];
  search?: string; // Full-text search on description and notes
  shouldPay?: boolean;
  amountFrom?: number;
  amountTo?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'date' | 'amount' | 'description' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionWithDetails extends Transaction {
  category: {
    id: string;
    name: string;
    parent?: {
      id: string;
      name: string;
    };
  };
  actor: {
    id: string;
    name: string;
    type: string;
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly actorsService: ActorsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(
    filters: TransactionFilters,
    authContext: AuthContext,
  ): Promise<TransactionWithDetails[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: TransactionWhere = {
        householdId: authContext.householdId,
      };

      // Date range filtering
      if (filters.dateFrom || filters.dateTo) {
        where.date = {};
        if (filters.dateFrom) {
          where.date.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.date.lte = filters.dateTo;
        }
      }

      // Category filtering
      if (filters.categoryIds && filters.categoryIds.length > 0) {
        where.categoryId = {
          in: filters.categoryIds,
        };
      }

      // Actor filtering
      if (filters.actorIds && filters.actorIds.length > 0) {
        where.actorId = {
          in: filters.actorIds,
        };
      }

      // Type filtering
      if (filters.types && filters.types.length > 0) {
        where.type = {
          in: filters.types,
        };
      }

      // Amount range filtering
      if (filters.amountFrom !== undefined || filters.amountTo !== undefined) {
        where.amount = {};
        if (filters.amountFrom !== undefined) {
          where.amount.gte = filters.amountFrom;
        }
        if (filters.amountTo !== undefined) {
          where.amount.lte = filters.amountTo;
        }
      }

      // Should pay filtering
      if (filters.shouldPay !== undefined) {
        where.shouldPay = filters.shouldPay;
      }

      // Tags filtering
      if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          hasSome: filters.tags,
        };
      }

      // Full-text search on description and notes
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

      const orderBy: TransactionOrderBy = {};
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

  async findOne(
    id: string,
    authContext: AuthContext,
  ): Promise<TransactionWithDetails> {
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
        throw new NotFoundException('Transaction not found');
      }

      return transaction;
    });
  }

  async create(
    createTransactionDto: CreateTransactionDto,
    authContext: AuthContext,
  ): Promise<Transaction> {
    // Comprehensive validation
    await this.validateTransaction(createTransactionDto, authContext);

    // Check for duplicate if source hash is provided (for imports)
    if (createTransactionDto.sourceHash) {
      const existingTransaction =
        await this.prismaService.prisma.transaction.findFirst({
          where: {
            sourceHash: createTransactionDto.sourceHash,
            householdId: authContext.householdId,
          },
        });

      if (existingTransaction) {
        throw new BadRequestException('Duplicate transaction detected');
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
          shouldPay:
            createTransactionDto.shouldPay ??
            this.calculateShouldPay(createTransactionDto),
          sourceHash:
            createTransactionDto.sourceHash ||
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

  async update(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
    authContext: AuthContext,
  ): Promise<Transaction> {
    const existingTransaction = await this.findOne(id, authContext);

    // Create a merged dto for validation
    const mergedDto = {
      ...existingTransaction,
      ...updateTransactionDto,
    };

    // Validate the updated transaction
    await this.validateTransaction(
      mergedDto as CreateTransactionDto,
      authContext,
    );

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

  async remove(id: string, authContext: AuthContext): Promise<void> {
    await this.findOne(id, authContext); // Ensure transaction exists and belongs to household

    await this.prismaService.withContext(authContext, async (prisma) => {
      await prisma.transaction.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  async getTransactionSummary(
    filters: TransactionFilters,
    authContext: AuthContext,
  ): Promise<TransactionSummary> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: TransactionWhere = {
        householdId: authContext.householdId,
      };

      // Apply same filters as findAll
      this.applyFiltersToWhere(where, filters);

      const [totalCount, totalIncome, totalExpenses, avgTransaction] =
        await Promise.all([
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
        netAmount:
          (Number(totalIncome._sum.amount) || 0) +
          (Number(totalExpenses._sum.amount) || 0),
        averageTransaction: Number(avgTransaction._avg.amount) || 0,
        incomeCount: totalIncome._count,
        expenseCount: totalExpenses._count,
      };
    });
  }

  private async validateTransaction(
    dto: CreateTransactionDto,
    authContext: AuthContext,
  ): Promise<void> {
    const errors: string[] = [];

    // Validate amount (must be non-zero integer)
    if (!Number.isInteger(dto.amount) || dto.amount === 0) {
      errors.push('Amount must be a non-zero integer');
    }

    // Validate description
    if (!dto.description || dto.description.trim().length === 0) {
      errors.push('Description is required');
    } else if (dto.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    // Validate date
    if (!dto.date || isNaN(dto.date.getTime())) {
      errors.push('Valid date is required');
    } else if (dto.date > new Date()) {
      errors.push('Transaction date cannot be in the future');
    }

    // Validate category exists and belongs to household
    try {
      const category = await this.categoriesService.findOne(
        dto.categoryId,
        authContext,
      );
      if (!category) {
        errors.push('Category not found');
      }
    } catch {
      errors.push('Invalid category');
    }

    // Validate actor exists and belongs to household
    try {
      const actor = await this.actorsService.findOne(dto.actorId, authContext);
      if (!actor) {
        errors.push('Actor not found');
      }
    } catch {
      errors.push('Invalid actor');
    }

    // Validate transaction type consistency
    if (dto.type === TransactionType.INCOME && dto.amount < 0) {
      errors.push('Income transactions must have positive amounts');
    } else if (dto.type === TransactionType.EXPENSE && dto.amount > 0) {
      errors.push('Expense transactions must have negative amounts');
    }

    // Validate tags
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

    // Validate notes length
    if (dto.notes && dto.notes.length > 1000) {
      errors.push('Notes cannot exceed 1000 characters');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Validation failed: ${errors.join(', ')}`);
    }
  }

  private calculateShouldPay(dto: CreateTransactionDto): boolean {
    // Default business logic: expenses should be paid, income should not
    return dto.type === TransactionType.EXPENSE;
  }

  private generateSourceHash(dto: CreateTransactionDto): string {
    // Generate a hash based on key transaction properties for duplicate detection
    const hashInput = `${dto.amount}-${dto.date.toISOString()}-${dto.description}-${dto.actorId}-${dto.categoryId}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private applyFiltersToWhere(
    where: TransactionWhere,
    filters: TransactionFilters,
  ): void {
    // Date range filtering
    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    // Other filters...
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
}
