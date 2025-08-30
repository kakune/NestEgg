import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Transaction, TransactionType, ShouldPayType } from '@prisma/client';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import * as crypto from 'crypto';

// Re-export DTOs for controllers
export { CreateTransactionDto, UpdateTransactionDto };

// Interface for database data conversion
interface ConvertedTransactionData {
  type?: TransactionType;
  amountYen?: number;
  note?: string;
  occurredOn?: Date;
  categoryId?: string;
  payerActorId?: string;
  tags?: string[];
  shouldPay?: ShouldPayType;
  shouldPayUserId?: string;
  sourceHash?: string;
}

// Interface for complete transaction creation data
interface TransactionCreateData {
  type: TransactionType;
  amountYen: number;
  occurredOn: Date;
  categoryId: string;
  payerActorId: string;
  note?: string | null;
  tags: string[];
  shouldPay: ShouldPayType;
  shouldPayUserId?: string | null;
  sourceHash: string;
  householdId: string;
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

export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categoryIds?: string[];
  actorIds?: string[];
  types?: TransactionType[];
  tags?: string[];
  search?: string; // Full-text search on note
  shouldPay?: 'HOUSEHOLD' | 'USER';
  amountFrom?: number;
  amountTo?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'occurredOn' | 'amountYen' | 'note' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionWithDetails extends Transaction {
  category: {
    id: string;
    name: string;
    parent: {
      id: string;
      name: string;
    } | null;
  };
  payerActor: {
    id: string;
    name: string;
    kind: string;
  };
}

// Type to transform BigInt to number and Date to string recursively
type TransformBigIntAndDate<T> = T extends bigint
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? TransformBigIntAndDate<U>[]
      : T extends object
        ? { [K in keyof T]: TransformBigIntAndDate<T[K]> }
        : T;

// Transformed types for API responses
export type TransformedTransaction = TransformBigIntAndDate<Transaction>;
export type TransformedTransactionWithDetails =
  TransformBigIntAndDate<TransactionWithDetails>;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly actorsService: ActorsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  private convertDtoToDbData(
    dto: CreateTransactionDto | UpdateTransactionDto,
  ): ConvertedTransactionData {
    const result: ConvertedTransactionData = {};

    if ('amount_yen' in dto) result.amountYen = dto.amount_yen;
    if ('type' in dto) result.type = dto.type;
    if ('note' in dto && dto.note !== undefined) result.note = dto.note;
    if ('occurred_on' in dto) {
      result.occurredOn =
        typeof dto.occurred_on === 'string'
          ? new Date(dto.occurred_on)
          : dto.occurred_on;
    }
    if ('category_id' in dto) result.categoryId = dto.category_id;
    if ('payer_actor_id' in dto) result.payerActorId = dto.payer_actor_id;
    if ('tags' in dto && dto.tags !== undefined) result.tags = dto.tags;
    if ('should_pay' in dto && dto.should_pay !== undefined)
      result.shouldPay = dto.should_pay as ShouldPayType;
    if ('should_pay_user_id' in dto && dto.should_pay_user_id !== undefined)
      result.shouldPayUserId = dto.should_pay_user_id;
    if ('source_hash' in dto && dto.source_hash !== undefined)
      result.sourceHash = dto.source_hash;

    return result;
  }

  async findAll(
    filters: TransactionFilters,
    authContext: AuthContext,
  ): Promise<TransformedTransactionWithDetails[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: Record<string, unknown> = {
        householdId: authContext.householdId,
        deletedAt: null,
      };

      // Apply filters using the helper method
      this.applyFiltersToWhere(where, filters);

      const orderBy: TransactionOrderBy = {};
      const sortBy = filters.sortBy || 'occurredOn';
      const sortOrder = filters.sortOrder || 'desc';
      orderBy[sortBy] = sortOrder;

      const transactions = await prisma.transaction.findMany({
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
          payerActor: {
            select: {
              id: true,
              name: true,
              kind: true,
            },
          },
        },
        orderBy,
        take: filters.limit || 100,
        skip: filters.offset || 0,
      });

      // Convert BigInt to number for JSON serialization
      return transactions.map((t) => this.transformBigIntToNumber(t));
    });
  }

  async findOne(
    id: string,
    authContext: AuthContext,
  ): Promise<TransformedTransactionWithDetails> {
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
          payerActor: {
            select: {
              id: true,
              name: true,
              kind: true,
            },
          },
        },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      // Convert BigInt to number for JSON serialization
      return this.transformBigIntToNumber(transaction);
    });
  }

  async create(
    createTransactionDto: CreateTransactionDto,
    authContext: AuthContext,
  ): Promise<TransformedTransaction> {
    // Comprehensive validation
    await this.validateTransaction(createTransactionDto, authContext);

    // Check for duplicate if source hash is provided (for imports)
    if (createTransactionDto.source_hash) {
      const existingTransaction =
        await this.prismaService.prisma.transaction.findFirst({
          where: {
            sourceHash: createTransactionDto.source_hash,
            householdId: authContext.householdId,
          },
        });

      if (existingTransaction) {
        throw new BadRequestException('Duplicate transaction detected');
      }
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      const dbData = this.convertDtoToDbData(createTransactionDto);

      const createData: TransactionCreateData = {
        type: dbData.type!,
        amountYen: dbData.amountYen!,
        occurredOn: dbData.occurredOn!,
        categoryId: dbData.categoryId!,
        payerActorId: dbData.payerActorId!,
        note: dbData.note || null,
        tags: dbData.tags || [],
        shouldPay:
          (dbData.shouldPay as ShouldPayType) ??
          this.calculateShouldPay(createTransactionDto),
        shouldPayUserId: dbData.shouldPayUserId || null,
        sourceHash:
          dbData.sourceHash || this.generateSourceHash(createTransactionDto),
        householdId: authContext.householdId,
      };

      const transaction = await prisma.transaction.create({
        data: createData,
        include: {
          category: true,
          payerActor: true,
        },
      });

      // Convert BigInt to number for JSON serialization
      return this.transformBigIntToNumber(transaction);
    });
  }

  private transformBigIntToNumber<T>(obj: T): TransformBigIntAndDate<T> {
    if (obj === null || obj === undefined)
      return obj as TransformBigIntAndDate<T>;
    if (typeof obj === 'bigint')
      return Number(obj) as TransformBigIntAndDate<T>;
    if (obj instanceof Date)
      return obj.toISOString() as TransformBigIntAndDate<T>;
    if (Array.isArray(obj))
      return obj.map((item: unknown) =>
        this.transformBigIntToNumber(item),
      ) as TransformBigIntAndDate<T>;
    if (typeof obj === 'object') {
      const transformed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        transformed[key] = this.transformBigIntToNumber(value);
      }
      return transformed as TransformBigIntAndDate<T>;
    }
    return obj as TransformBigIntAndDate<T>;
  }

  async update(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
    authContext: AuthContext,
  ): Promise<TransformedTransaction> {
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
      const dbData = this.convertDtoToDbData(updateTransactionDto);

      const transaction = await prisma.transaction.update({
        where: { id },
        data: dbData,
        include: {
          category: true,
          payerActor: true,
        },
      });

      // Convert BigInt to number for JSON serialization
      return this.transformBigIntToNumber(transaction);
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

  async createMany(
    dtos: CreateTransactionDto[],
    authContext: AuthContext,
  ): Promise<{
    count: number;
    errors: Array<{ dto: CreateTransactionDto; error: string }>;
  }> {
    const errors: Array<{ dto: CreateTransactionDto; error: string }> = [];
    const validDtos: CreateTransactionDto[] = [];

    // Validate all DTOs first
    for (const dto of dtos) {
      try {
        await this.validateTransaction(dto, authContext);

        // Check for duplicate if source hash is provided
        if (dto.source_hash) {
          const existingTransaction =
            await this.prismaService.prisma.transaction.findFirst({
              where: {
                sourceHash: dto.source_hash,
                householdId: authContext.householdId,
              },
            });

          if (existingTransaction) {
            errors.push({ dto, error: 'Duplicate transaction detected' });
            continue;
          }
        }

        validDtos.push(dto);
      } catch (error) {
        errors.push({
          dto,
          error:
            error instanceof Error ? error.message : 'Unknown validation error',
        });
      }
    }

    if (validDtos.length === 0) {
      return { count: 0, errors };
    }

    // Bulk create valid transactions
    const dataToCreate: TransactionCreateData[] = validDtos.map((dto) => {
      const dbData = this.convertDtoToDbData(dto);
      return {
        type: dbData.type!,
        amountYen: dbData.amountYen!,
        occurredOn: dbData.occurredOn!,
        categoryId: dbData.categoryId!,
        payerActorId: dbData.payerActorId!,
        note: dbData.note || null,
        tags: dbData.tags || [],
        shouldPay:
          (dbData.shouldPay as ShouldPayType) ?? this.calculateShouldPay(dto),
        shouldPayUserId: dbData.shouldPayUserId || null,
        sourceHash: dbData.sourceHash || this.generateSourceHash(dto),
        householdId: authContext.householdId,
      };
    });

    const result = await this.prismaService.withContext(
      authContext,
      async (prisma) => {
        return prisma.transaction.createMany({
          data: dataToCreate,
          skipDuplicates: true,
        });
      },
    );

    return { count: result.count, errors };
  }

  async removeMany(
    ids: string[],
    authContext: AuthContext,
  ): Promise<{ count: number; errors: Array<{ id: string; error: string }> }> {
    if (ids.length === 0) {
      return { count: 0, errors: [] };
    }

    const errors: Array<{ id: string; error: string }> = [];

    // First verify all transactions exist and belong to the household
    const existingTransactions = await this.prismaService.withContext(
      authContext,
      async (prisma) => {
        return prisma.transaction.findMany({
          where: {
            id: { in: ids },
            householdId: authContext.householdId,
            deletedAt: null,
          },
          select: { id: true },
        });
      },
    );

    const existingIds = new Set(existingTransactions.map((t) => t.id));

    for (const id of ids) {
      if (!existingIds.has(id)) {
        errors.push({ id, error: 'Transaction not found or already deleted' });
      }
    }

    const validIds = ids.filter((id) => existingIds.has(id));

    if (validIds.length === 0) {
      return { count: 0, errors };
    }

    // Bulk soft delete
    const result = await this.prismaService.withContext(
      authContext,
      async (prisma) => {
        return prisma.transaction.updateMany({
          where: {
            id: { in: validIds },
            householdId: authContext.householdId,
          },
          data: { deletedAt: new Date() },
        });
      },
    );

    return { count: result.count, errors };
  }

  async getTransactionSummary(
    filters: TransactionFilters,
    authContext: AuthContext,
  ): Promise<TransactionSummary> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: Record<string, unknown> = {
        householdId: authContext.householdId,
        deletedAt: null,
      };

      // Apply same filters as findAll
      this.applyFiltersToWhere(where, filters);

      const [totalCount, totalIncome, totalExpenses, avgTransaction] =
        await Promise.all([
          prisma.transaction.count({ where }),
          prisma.transaction.aggregate({
            where: { ...where, amountYen: { gt: 0 } },
            _sum: { amountYen: true },
            _count: true,
          }),
          prisma.transaction.aggregate({
            where: { ...where, amountYen: { lt: 0 } },
            _sum: { amountYen: true },
            _count: true,
          }),
          prisma.transaction.aggregate({
            where,
            _avg: { amountYen: true },
          }),
        ]);

      return {
        totalTransactions: totalCount,
        totalIncome: Number(totalIncome._sum.amountYen || 0),
        totalExpenses: Math.abs(Number(totalExpenses._sum.amountYen || 0)),
        netAmount:
          Number(totalIncome._sum.amountYen || 0) +
          Number(totalExpenses._sum.amountYen || 0),
        averageTransaction: Number(avgTransaction._avg.amountYen || 0),
        incomeCount: Number(totalIncome._count || 0),
        expenseCount: Number(totalExpenses._count || 0),
      };
    });
  }

  private async validateTransaction(
    dto: CreateTransactionDto,
    authContext: AuthContext,
  ): Promise<void> {
    const errors: string[] = [];

    // Validate amount (must be non-zero integer)
    if (!Number.isInteger(dto.amount_yen) || dto.amount_yen === 0) {
      errors.push('Amount must be a non-zero integer');
    }

    // Validate note
    if (dto.note && dto.note.length > 500) {
      errors.push('Note cannot exceed 500 characters');
    }

    // Validate date
    const occurredOn = new Date(dto.occurred_on);
    if (!dto.occurred_on || isNaN(occurredOn.getTime())) {
      errors.push('Valid date is required');
    } else if (occurredOn > new Date()) {
      errors.push('Transaction date cannot be in the future');
    }

    // Validate category exists and belongs to household
    try {
      const category = await this.categoriesService.findOne(
        dto.category_id,
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
      const actor = await this.actorsService.findOne(
        dto.payer_actor_id,
        authContext,
      );
      if (!actor) {
        errors.push('Actor not found');
      }
    } catch {
      errors.push('Invalid actor');
    }

    // Validate transaction type consistency
    if (dto.type === TransactionType.INCOME && dto.amount_yen < 0) {
      errors.push('Income transactions must have positive amounts');
    } else if (dto.type === TransactionType.EXPENSE && dto.amount_yen > 0) {
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

    // Note validation is already covered above

    if (errors.length > 0) {
      throw new BadRequestException(`Validation failed: ${errors.join(', ')}`);
    }
  }

  private calculateShouldPay(dto: CreateTransactionDto): ShouldPayType {
    // Default business logic: expenses should be paid by household, income by user
    return dto.type === TransactionType.EXPENSE ? 'HOUSEHOLD' : 'USER';
  }

  private generateSourceHash(dto: CreateTransactionDto): string {
    // Generate a hash based on key transaction properties for duplicate detection
    const hashInput = `${dto.amount_yen}-${dto.occurred_on}-${dto.note || ''}-${dto.payer_actor_id}-${dto.category_id}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private applyFiltersToWhere(
    where: Record<string, unknown>,
    filters: TransactionFilters,
  ): void {
    // Date range filtering
    if (filters.dateFrom || filters.dateTo) {
      where.occurredOn = {};
      if (filters.dateFrom) {
        (where.occurredOn as Record<string, unknown>).gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (where.occurredOn as Record<string, unknown>).lte = filters.dateTo;
      }
    }

    // Amount range filtering
    if (filters.amountFrom !== undefined || filters.amountTo !== undefined) {
      where.amountYen = {};
      if (filters.amountFrom !== undefined) {
        (where.amountYen as Record<string, unknown>).gte = filters.amountFrom;
      }
      if (filters.amountTo !== undefined) {
        (where.amountYen as Record<string, unknown>).lte = filters.amountTo;
      }
    }

    // Other filters...
    if (filters.categoryIds?.length) {
      where.categoryId = { in: filters.categoryIds };
    }
    if (filters.actorIds?.length) {
      where.payerActorId = { in: filters.actorIds };
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
      where.OR = [{ note: { contains: filters.search, mode: 'insensitive' } }];
    }
  }
}
