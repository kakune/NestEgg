import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Income } from '@prisma/client';
import { AuthContext } from '../common/interfaces/auth-context.interface';

export interface CreateIncomeDto {
  userId: string;
  grossIncomeYen: number;
  deductionYen: number;
  year: number;
  month: number;
  description?: string;
  sourceDocument?: string;
}

export interface UpdateIncomeDto {
  grossIncomeYen?: number;
  deductionYen?: number;
  description?: string;
  sourceDocument?: string;
}

export interface IncomeFilters {
  userId?: string;
  year?: number;
  month?: number;
  yearFrom?: number;
  yearTo?: number;
  minAllocatable?: number;
  maxAllocatable?: number;
  search?: string; // Search in description
  limit?: number;
  offset?: number;
  sortBy?: 'year' | 'month' | 'grossIncomeYen' | 'allocatableYen' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface IncomeWithDetails extends Income {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface IncomeStatistics {
  totalGrossIncome: number;
  totalDeductions: number;
  totalAllocatable: number;
  averageMonthlyIncome: number;
  monthlyIncomes: Array<{
    year: number;
    month: number;
    grossIncome: number;
    deductions: number;
    allocatable: number;
  }>;
}

@Injectable()
export class IncomesService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(
    filters: IncomeFilters,
    authContext: AuthContext,
  ): Promise<IncomeWithDetails[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: Record<string, unknown> = {
        householdId: authContext.householdId,
      };

      // User filtering
      if (filters.userId) {
        where.userId = filters.userId;
      }

      // Year/Month filtering using the DateTime month field
      if (filters.year !== undefined || filters.month !== undefined) {
        const monthFilters: Record<string, Date> = {};

        if (filters.year !== undefined && filters.month !== undefined) {
          // Specific year and month
          const startDate = new Date(filters.year, filters.month - 1, 1);
          const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59);
          monthFilters.gte = startDate;
          monthFilters.lte = endDate;
        } else if (filters.year !== undefined) {
          // Entire year
          const startDate = new Date(filters.year, 0, 1);
          const endDate = new Date(filters.year, 11, 31, 23, 59, 59);
          monthFilters.gte = startDate;
          monthFilters.lte = endDate;
        }

        if (Object.keys(monthFilters).length > 0) {
          where.month = monthFilters;
        }
      }

      // Year range filtering
      if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
        const rangeFilters: Record<string, Date> = {};
        if (filters.yearFrom !== undefined) {
          rangeFilters.gte = new Date(filters.yearFrom, 0, 1);
        }
        if (filters.yearTo !== undefined) {
          rangeFilters.lte = new Date(filters.yearTo, 11, 31, 23, 59, 59);
        }
        where.month = {
          ...((where.month as Record<string, unknown>) || {}),
          ...rangeFilters,
        };
      }

      // Allocatable amount range filtering
      if (
        filters.minAllocatable !== undefined ||
        filters.maxAllocatable !== undefined
      ) {
        const allocatableFilters: Record<string, number> = {};
        if (filters.minAllocatable !== undefined) {
          allocatableFilters.gte = filters.minAllocatable;
        }
        if (filters.maxAllocatable !== undefined) {
          allocatableFilters.lte = filters.maxAllocatable;
        }
        where.allocatableYen = allocatableFilters;
      }

      // Full-text search on description
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

      const orderBy: Record<string, 'asc' | 'desc'> = {};
      const sortBy = filters.sortBy || 'year';
      const sortOrder = filters.sortOrder || 'desc';

      if (sortBy === 'year' || sortBy === 'month') {
        // For date sorting, sort by year first, then month
        orderBy.year = sortOrder;
        orderBy.month = sortOrder;
      } else {
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

  async findOne(
    id: string,
    authContext: AuthContext,
  ): Promise<IncomeWithDetails> {
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
        throw new NotFoundException('Income not found');
      }

      return income;
    });
  }

  async findByUserAndMonth(
    userId: string,
    year: number,
    month: number,
    authContext: AuthContext,
  ): Promise<Income | null> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      return prisma.income.findFirst({
        where: {
          userId,
          month: {
            gte: startDate,
            lte: endDate,
          },
          householdId: authContext.householdId,
        },
      });
    });
  }

  async create(
    createIncomeDto: CreateIncomeDto,
    authContext: AuthContext,
  ): Promise<Income> {
    // Comprehensive validation
    await this.validateIncome(createIncomeDto, authContext);

    // Check monthly uniqueness constraint
    const existingIncome = await this.findByUserAndMonth(
      createIncomeDto.userId,
      createIncomeDto.year,
      createIncomeDto.month,
      authContext,
    );

    if (existingIncome) {
      throw new ConflictException(
        `Income for user ${createIncomeDto.userId} already exists for ${createIncomeDto.year}-${createIncomeDto.month.toString().padStart(2, '0')}`,
      );
    }

    // Calculate allocatable amount
    const allocatableYen = this.calculateAllocatableYen(
      createIncomeDto.grossIncomeYen,
      createIncomeDto.deductionYen,
    );

    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.income.create({
        data: {
          userId: createIncomeDto.userId,
          grossYen: BigInt(createIncomeDto.grossIncomeYen),
          deductionTaxYen: BigInt(createIncomeDto.deductionYen || 0),
          deductionSocialYen: BigInt(0),
          deductionOtherYen: BigInt(0),
          allocatableYen,
          month: new Date(createIncomeDto.year, createIncomeDto.month - 1, 1),
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

  async update(
    id: string,
    updateIncomeDto: UpdateIncomeDto,
    authContext: AuthContext,
  ): Promise<Income> {
    const existingIncome = await this.findOne(id, authContext);

    // Validate the update
    const mergedDto = {
      ...existingIncome,
      ...updateIncomeDto,
    };

    this.validateIncomeUpdate(mergedDto);

    // Recalculate allocatable amount if gross income or deductions change
    let allocatableYen = existingIncome.allocatableYen;
    if (
      updateIncomeDto.grossIncomeYen !== undefined ||
      updateIncomeDto.deductionYen !== undefined
    ) {
      const grossIncome =
        updateIncomeDto.grossIncomeYen ?? Number(existingIncome.grossYen);
      const totalDeduction =
        Number(existingIncome.deductionTaxYen) +
        Number(existingIncome.deductionSocialYen) +
        Number(existingIncome.deductionOtherYen);
      const deduction = updateIncomeDto.deductionYen ?? totalDeduction;
      allocatableYen = this.calculateAllocatableYen(grossIncome, deduction);
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.income.update({
        where: { id },
        data: {
          ...(updateIncomeDto.grossIncomeYen !== undefined && {
            grossYen: BigInt(updateIncomeDto.grossIncomeYen),
          }),
          ...(updateIncomeDto.deductionYen !== undefined && {
            deductionTaxYen: BigInt(updateIncomeDto.deductionYen),
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

  async remove(id: string, authContext: AuthContext): Promise<void> {
    await this.findOne(id, authContext); // Ensure income exists and belongs to household

    await this.prismaService.withContext(authContext, async (prisma) => {
      await prisma.income.delete({
        where: { id },
      });
    });
  }

  async createMany(
    dtos: CreateIncomeDto[],
    authContext: AuthContext,
  ): Promise<{
    count: number;
    errors: Array<{ dto: CreateIncomeDto; error: string }>;
  }> {
    const errors: Array<{ dto: CreateIncomeDto; error: string }> = [];
    const validDtos: CreateIncomeDto[] = [];

    // Validate all DTOs first and check for duplicates
    for (const dto of dtos) {
      try {
        await this.validateIncome(dto, authContext);

        // Check monthly uniqueness constraint
        const existingIncome = await this.findByUserAndMonth(
          dto.userId,
          dto.year,
          dto.month,
          authContext,
        );

        if (existingIncome) {
          errors.push({
            dto,
            error: `Income for user ${dto.userId} already exists for ${dto.year}-${dto.month.toString().padStart(2, '0')}`,
          });
          continue;
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

    // Bulk create valid incomes
    const dataToCreate = validDtos.map((dto) => ({
      userId: dto.userId,
      grossYen: BigInt(dto.grossIncomeYen),
      deductionTaxYen: BigInt(dto.deductionYen || 0),
      deductionSocialYen: BigInt(0),
      deductionOtherYen: BigInt(0),
      allocatableYen: this.calculateAllocatableYen(
        dto.grossIncomeYen,
        dto.deductionYen || 0,
      ),
      month: new Date(dto.year, dto.month - 1, 1),
      householdId: authContext.householdId,
    }));

    const result = await this.prismaService.withContext(
      authContext,
      async (prisma) => {
        return prisma.income.createMany({
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
  ): Promise<{
    count: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    if (ids.length === 0) {
      return { count: 0, errors: [] };
    }

    const errors: Array<{ id: string; error: string }> = [];

    // First verify all incomes exist and belong to the household
    const existingIncomes = await this.prismaService.withContext(
      authContext,
      async (prisma) => {
        return prisma.income.findMany({
          where: {
            id: { in: ids },
            householdId: authContext.householdId,
          },
          select: { id: true },
        });
      },
    );

    const existingIds = new Set(existingIncomes.map((i) => i.id));

    for (const id of ids) {
      if (!existingIds.has(id)) {
        errors.push({ id, error: 'Income not found or already deleted' });
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
        return prisma.income.deleteMany({
          where: {
            id: { in: validIds },
            householdId: authContext.householdId,
          },
        });
      },
    );

    return { count: result.count, errors };
  }

  async removeByFilters(
    filters: IncomeFilters,
    authContext: AuthContext,
  ): Promise<{
    count: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    // First find all incomes matching the filters
    const incomes = await this.findAll(filters, authContext);
    const ids = incomes.map((income) => income.id);

    return this.removeMany(ids, authContext);
  }

  async getIncomeStatistics(
    filters: IncomeFilters,
    authContext: AuthContext,
  ): Promise<IncomeStatistics> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: Record<string, unknown> = {
        householdId: authContext.householdId,
        deletedAt: null,
      };

      // Apply filters
      if (filters.userId) {
        where.userId = filters.userId;
      }
      if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
        const monthFilters: Record<string, Date> = {};
        if (filters.yearFrom !== undefined) {
          monthFilters.gte = new Date(filters.yearFrom, 0, 1);
        }
        if (filters.yearTo !== undefined) {
          monthFilters.lte = new Date(filters.yearTo, 11, 31, 23, 59, 59);
        }
        where.month = monthFilters;
      }

      const [aggregates, monthlyData] = await Promise.all([
        prisma.income.aggregate({
          where,
          _sum: {
            grossYen: true,
            deductionTaxYen: true,
            deductionSocialYen: true,
            deductionOtherYen: true,
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
            month: true,
            grossYen: true,
            deductionTaxYen: true,
            deductionSocialYen: true,
            deductionOtherYen: true,
            allocatableYen: true,
          },
          orderBy: [{ month: 'desc' }],
        }),
      ]);

      return {
        totalGrossIncome: Number(aggregates._sum.grossYen) || 0,
        totalDeductions:
          (Number(aggregates._sum.deductionTaxYen) || 0) +
          (Number(aggregates._sum.deductionSocialYen) || 0) +
          (Number(aggregates._sum.deductionOtherYen) || 0),
        totalAllocatable: Number(aggregates._sum.allocatableYen) || 0,
        averageMonthlyIncome: Number(aggregates._avg.allocatableYen) || 0,
        monthlyIncomes: monthlyData.map((item) => ({
          year: item.month.getFullYear(),
          month: item.month.getMonth() + 1,
          grossIncome: Number(item.grossYen),
          deductions:
            (Number(item.deductionTaxYen) || 0) +
            (Number(item.deductionSocialYen) || 0) +
            (Number(item.deductionOtherYen) || 0),
          allocatable: Number(item.allocatableYen),
        })),
      };
    });
  }

  async getHouseholdIncomeBreakdown(
    year: number,
    authContext: AuthContext,
    month?: number,
  ): Promise<Record<string, unknown>> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: Record<string, unknown> = {
        householdId: authContext.householdId,
      };

      // Filter by date range using the month DateTime field
      if (month !== undefined) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        where.month = {
          gte: startDate,
          lte: endDate,
        };
      } else {
        // Filter by entire year
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);
        where.month = {
          gte: startDate,
          lte: endDate,
        };
      }

      // Use database aggregation with groupBy to calculate totals per user
      const [userAggregates, totalAggregates, monthlyDetails] =
        await Promise.all([
          // Group by user and aggregate their income
          prisma.income.groupBy({
            by: ['userId'],
            where,
            _sum: {
              grossYen: true,
              deductionTaxYen: true,
              deductionSocialYen: true,
              deductionOtherYen: true,
              allocatableYen: true,
            },
          }),

          // Get overall totals for the period
          prisma.income.aggregate({
            where,
            _sum: {
              grossYen: true,
              deductionTaxYen: true,
              deductionSocialYen: true,
              deductionOtherYen: true,
              allocatableYen: true,
            },
          }),

          // Get monthly breakdown details for each user (only if we need month details)
          prisma.income.findMany({
            where,
            select: {
              userId: true,
              month: true,
              grossYen: true,
              deductionTaxYen: true,
              deductionSocialYen: true,
              deductionOtherYen: true,
              allocatableYen: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: [{ userId: 'asc' }, { month: 'asc' }],
          }),
        ]);

      // Build the user breakdown from aggregated data
      const userBreakdown = await Promise.all(
        userAggregates.map(async (userAggregate) => {
          // Get user details
          const user = await prisma.user.findUnique({
            where: { id: userAggregate.userId },
            select: {
              id: true,
              name: true,
              email: true,
            },
          });

          const userGrossIncome = Number(userAggregate._sum?.grossYen) || 0;
          const userDeductions =
            (Number(userAggregate._sum?.deductionTaxYen) || 0) +
            (Number(userAggregate._sum?.deductionSocialYen) || 0) +
            (Number(userAggregate._sum?.deductionOtherYen) || 0);
          const userAllocatable =
            Number(userAggregate._sum?.allocatableYen) || 0;

          // Get monthly details for this user
          const userMonths = monthlyDetails
            .filter((income) => income.userId === userAggregate.userId)
            .map((income) => ({
              month: income.month.getMonth() + 1,
              grossIncome: Number(income.grossYen),
              deductions:
                (Number(income.deductionTaxYen) || 0) +
                (Number(income.deductionSocialYen) || 0) +
                (Number(income.deductionOtherYen) || 0),
              allocatable: Number(income.allocatableYen),
            }));

          const totalAllocatable =
            Number(totalAggregates._sum.allocatableYen) || 0;

          return {
            user,
            grossIncome: userGrossIncome,
            deductions: userDeductions,
            allocatable: userAllocatable,
            percentage:
              totalAllocatable > 0
                ? (userAllocatable / totalAllocatable) * 100
                : 0,
            months: userMonths,
          };
        }),
      );

      return {
        year,
        month,
        users: userBreakdown,
        totals: {
          grossIncome: Number(totalAggregates._sum?.grossYen) || 0,
          deductions:
            (Number(totalAggregates._sum?.deductionTaxYen) || 0) +
            (Number(totalAggregates._sum?.deductionSocialYen) || 0) +
            (Number(totalAggregates._sum?.deductionOtherYen) || 0),
          allocatable: Number(totalAggregates._sum?.allocatableYen) || 0,
        },
      };
    });
  }

  private calculateAllocatableYen(
    grossIncomeYen: number,
    deductionYen: number,
  ): bigint {
    const allocatable = grossIncomeYen - deductionYen;
    return BigInt(Math.max(0, allocatable)); // Allocatable income cannot be negative
  }

  private async validateIncome(
    dto: CreateIncomeDto,
    authContext: AuthContext,
  ): Promise<void> {
    const errors: string[] = [];

    // Validate amounts
    if (!Number.isInteger(dto.grossIncomeYen) || dto.grossIncomeYen < 0) {
      errors.push('Gross income must be a non-negative integer');
    }

    if (!Number.isInteger(dto.deductionYen) || dto.deductionYen < 0) {
      errors.push('Deduction must be a non-negative integer');
    }

    if (dto.deductionYen > dto.grossIncomeYen) {
      errors.push('Deduction cannot exceed gross income');
    }

    // Validate year and month
    const currentYear = new Date().getFullYear();
    if (dto.year < 1900 || dto.year > currentYear + 5) {
      errors.push(`Year must be between 1900 and ${currentYear + 5}`);
    }

    if (dto.month < 1 || dto.month > 12) {
      errors.push('Month must be between 1 and 12');
    }

    // Validate user exists and belongs to household
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

    // Validate description length
    if (dto.description && dto.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    // Validate source document length
    if (dto.sourceDocument && dto.sourceDocument.length > 255) {
      errors.push('Source document cannot exceed 255 characters');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Validation failed: ${errors.join(', ')}`);
    }
  }

  private validateIncomeUpdate(
    mergedDto: IncomeWithDetails & Partial<UpdateIncomeDto>,
  ): void {
    const errors: string[] = [];

    // Validate amounts if provided
    if (mergedDto.grossIncomeYen !== undefined) {
      if (
        !Number.isInteger(mergedDto.grossIncomeYen) ||
        mergedDto.grossIncomeYen < 0
      ) {
        errors.push('Gross income must be a non-negative integer');
      }
    }

    if (mergedDto.deductionYen !== undefined) {
      if (
        !Number.isInteger(mergedDto.deductionYen) ||
        mergedDto.deductionYen < 0
      ) {
        errors.push('Deduction must be a non-negative integer');
      }
    }

    if (
      mergedDto.deductionYen !== undefined &&
      mergedDto.grossIncomeYen !== undefined &&
      mergedDto.deductionYen > mergedDto.grossIncomeYen
    ) {
      errors.push('Deduction cannot exceed gross income');
    }

    // Validate description length
    if (mergedDto.description && mergedDto.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    // Validate source document length
    if (mergedDto.sourceDocument && mergedDto.sourceDocument.length > 255) {
      errors.push('Source document cannot exceed 255 characters');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Validation failed: ${errors.join(', ')}`);
    }
  }
}
