import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Income, UserRole } from '@prisma/client';
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
    name: string;
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

  async findAll(filters: IncomeFilters, authContext: AuthContext): Promise<IncomeWithDetails[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: any = {
        householdId: authContext.householdId,
      };

      // User filtering
      if (filters.userId) {
        where.userId = filters.userId;
      }

      // Year filtering
      if (filters.year !== undefined) {
        where.year = filters.year;
      }

      // Month filtering
      if (filters.month !== undefined) {
        where.month = filters.month;
      }

      // Year range filtering
      if (filters.yearFrom !== undefined || filters.yearTo !== undefined) {
        where.year = {};
        if (filters.yearFrom !== undefined) {
          where.year.gte = filters.yearFrom;
        }
        if (filters.yearTo !== undefined) {
          where.year.lte = filters.yearTo;
        }
      }

      // Allocatable amount range filtering
      if (filters.minAllocatable !== undefined || filters.maxAllocatable !== undefined) {
        where.allocatableYen = {};
        if (filters.minAllocatable !== undefined) {
          where.allocatableYen.gte = filters.minAllocatable;
        }
        if (filters.maxAllocatable !== undefined) {
          where.allocatableYen.lte = filters.maxAllocatable;
        }
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

      const orderBy: any = {};
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

  async findOne(id: string, authContext: AuthContext): Promise<IncomeWithDetails> {
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

  async create(createIncomeDto: CreateIncomeDto, authContext: AuthContext): Promise<Income> {
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
        `Income for user ${createIncomeDto.userId} already exists for ${createIncomeDto.year}-${createIncomeDto.month.toString().padStart(2, '0')}`
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

    await this.validateIncomeUpdate(mergedDto, authContext);

    // Recalculate allocatable amount if gross income or deductions change
    let allocatableYen = existingIncome.allocatableYen;
    if (updateIncomeDto.grossIncomeYen !== undefined || updateIncomeDto.deductionYen !== undefined) {
      const grossIncome = updateIncomeDto.grossIncomeYen ?? existingIncome.grossIncomeYen;
      const deduction = updateIncomeDto.deductionYen ?? existingIncome.deductionYen;
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

  async remove(id: string, authContext: AuthContext): Promise<void> {
    await this.findOne(id, authContext); // Ensure income exists and belongs to household

    await this.prismaService.withContext(authContext, async (prisma) => {
      await prisma.income.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  async getIncomeStatistics(
    filters: IncomeFilters,
    authContext: AuthContext,
  ): Promise<IncomeStatistics> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: any = {
        householdId: authContext.householdId,
        deletedAt: null,
      };

      // Apply filters
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
        totalGrossIncome: aggregates._sum.grossIncomeYen || 0,
        totalDeductions: aggregates._sum.deductionYen || 0,
        totalAllocatable: aggregates._sum.allocatableYen || 0,
        averageMonthlyIncome: aggregates._avg.allocatableYen || 0,
        monthlyIncomes: monthlyData.map(item => ({
          year: item.year,
          month: item.month,
          grossIncome: item.grossIncomeYen,
          deductions: item.deductionYen,
          allocatable: item.allocatableYen,
        })),
      };
    });
  }

  async getHouseholdIncomeBreakdown(
    year: number,
    month?: number,
    authContext: AuthContext,
  ): Promise<any> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const where: any = {
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

        acc[userKey].grossIncome += income.grossIncomeYen;
        acc[userKey].deductions += income.deductionYen;
        acc[userKey].allocatable += income.allocatableYen;
        acc[userKey].months.push({
          month: income.month,
          grossIncome: income.grossIncomeYen,
          deductions: income.deductionYen,
          allocatable: income.allocatableYen,
        });

        return acc;
      }, {} as any);

      const totalAllocatable = Object.values(breakdown).reduce(
        (sum: number, user: any) => sum + user.allocatable,
        0,
      );

      return {
        year,
        month,
        users: Object.values(breakdown).map((user: any) => ({
          ...user,
          percentage: totalAllocatable > 0 ? (user.allocatable / totalAllocatable) * 100 : 0,
        })),
        totals: {
          grossIncome: Object.values(breakdown).reduce(
            (sum: number, user: any) => sum + user.grossIncome,
            0,
          ),
          deductions: Object.values(breakdown).reduce(
            (sum: number, user: any) => sum + user.deductions,
            0,
          ),
          allocatable: totalAllocatable,
        },
      };
    });
  }

  private calculateAllocatableYen(grossIncomeYen: number, deductionYen: number): number {
    const allocatable = grossIncomeYen - deductionYen;
    return Math.max(0, allocatable); // Allocatable income cannot be negative
  }

  private async validateIncome(dto: CreateIncomeDto, authContext: AuthContext): Promise<void> {
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

  private async validateIncomeUpdate(mergedDto: any, authContext: AuthContext): Promise<void> {
    const errors: string[] = [];

    // Validate amounts if provided
    if (mergedDto.grossIncomeYen !== undefined) {
      if (!Number.isInteger(mergedDto.grossIncomeYen) || mergedDto.grossIncomeYen < 0) {
        errors.push('Gross income must be a non-negative integer');
      }
    }

    if (mergedDto.deductionYen !== undefined) {
      if (!Number.isInteger(mergedDto.deductionYen) || mergedDto.deductionYen < 0) {
        errors.push('Deduction must be a non-negative integer');
      }
    }

    if (mergedDto.deductionYen > mergedDto.grossIncomeYen) {
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