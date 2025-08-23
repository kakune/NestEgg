import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  IncomesService,
  CreateIncomeDto,
  UpdateIncomeDto,
  IncomeFilters,
  IncomeWithDetails,
  IncomeStatistics,
} from './incomes.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import { Income } from '@prisma/client';

interface IncomeQueryParams {
  userId?: string;
  year?: string;
  month?: string;
  yearFrom?: string;
  yearTo?: string;
  minAllocatable?: string;
  maxAllocatable?: string;
  search?: string;
  limit?: string;
  offset?: string;
  sortBy?: 'year' | 'month' | 'grossIncomeYen' | 'allocatableYen' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface StatisticsQueryParams {
  userId?: string;
  yearFrom?: string;
  yearTo?: string;
}

interface YearQueryParams {
  userId?: string;
  month?: string;
  limit?: string;
  offset?: string;
  sortBy?: 'year' | 'month' | 'grossIncomeYen' | 'allocatableYen' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface SearchQueryParams {
  q?: string;
  userId?: string;
  year?: string;
  yearFrom?: string;
  yearTo?: string;
  limit?: string;
  offset?: string;
}

@Controller('incomes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncomesController {
  constructor(private readonly incomesService: IncomesService) {}

  private getAuthContext(user: AuthenticatedUser): AuthContext {
    return {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
  }

  @Get()
  async findAll(
    @Query() query: IncomeQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails[]> {
    const authContext = this.getAuthContext(user);
    const filters: IncomeFilters = {
      userId: query.userId,
      year: query.year ? parseInt(query.year) : undefined,
      month: query.month ? parseInt(query.month) : undefined,
      yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
      yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
      minAllocatable: query.minAllocatable
        ? parseInt(query.minAllocatable)
        : undefined,
      maxAllocatable: query.maxAllocatable
        ? parseInt(query.maxAllocatable)
        : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      sortBy: query.sortBy as
        | 'year'
        | 'month'
        | 'grossIncomeYen'
        | 'allocatableYen'
        | 'createdAt',
      sortOrder: query.sortOrder as 'asc' | 'desc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('statistics')
  async getStatistics(
    @Query() query: StatisticsQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeStatistics> {
    const authContext = this.getAuthContext(user);
    const filters: IncomeFilters = {
      userId: query.userId,
      yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
      yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
    };

    return this.incomesService.getIncomeStatistics(filters, authContext);
  }

  @Get('breakdown/:year')
  async getHouseholdBreakdown(
    @Param('year') year: string,
    @Query('month') month?: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    const authContext = this.getAuthContext(user);
    const yearNum = parseInt(year);
    const monthNum = month ? parseInt(month) : undefined;

    return this.incomesService.getHouseholdIncomeBreakdown(
      yearNum,
      monthNum,
      authContext,
    );
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query() query: IncomeQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails[]> {
    const authContext = this.getAuthContext(user);
    const filters: IncomeFilters = {
      userId,
      year: query.year ? parseInt(query.year) : undefined,
      month: query.month ? parseInt(query.month) : undefined,
      yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
      yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      sortBy: query.sortBy as
        | 'year'
        | 'month'
        | 'grossIncomeYen'
        | 'allocatableYen'
        | 'createdAt',
      sortOrder: query.sortOrder as 'asc' | 'desc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('user/:userId/year/:year')
  async findByUserAndYear(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails[]> {
    const authContext = this.getAuthContext(user);
    const filters: IncomeFilters = {
      userId,
      year: parseInt(year),
      sortBy: 'month',
      sortOrder: 'asc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('user/:userId/month/:year/:month')
  async findByUserAndMonth(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Income | null> {
    return this.incomesService.findByUserAndMonth(
      userId,
      parseInt(year),
      parseInt(month),
      this.getAuthContext(user),
    );
  }

  @Get('year/:year')
  async findByYear(
    @Param('year') year: string,
    @Query() query: YearQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails[]> {
    const authContext = this.getAuthContext(user);
    const filters: IncomeFilters = {
      year: parseInt(year),
      month: query.month ? parseInt(query.month) : undefined,
      userId: query.userId,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      sortBy:
        (query.sortBy as
          | 'year'
          | 'month'
          | 'grossIncomeYen'
          | 'allocatableYen'
          | 'createdAt') || 'month',
      sortOrder: (query.sortOrder as 'asc' | 'desc') || 'asc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('search')
  async searchIncomes(
    @Query('q') searchQuery: string,
    @Query() query: SearchQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails[]> {
    const authContext = this.getAuthContext(user);
    const filters: IncomeFilters = {
      search: searchQuery,
      userId: query.userId,
      year: query.year ? parseInt(query.year) : undefined,
      yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
      yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
      limit: query.limit ? parseInt(query.limit) : 50, // Default limit for search
      offset: query.offset ? parseInt(query.offset) : undefined,
      sortBy: 'year',
      sortOrder: 'desc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('recent')
  async findRecent(
    @Query('limit') limit: string = '12', // Default to 12 months
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails[]> {
    const authContext = this.getAuthContext(user);
    const filters: IncomeFilters = {
      limit: parseInt(limit),
      sortBy: 'year',
      sortOrder: 'desc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('current-year')
  async findCurrentYear(
    @Query('userId') userId?: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails[]> {
    const authContext = this.getAuthContext(user);
    const currentYear = new Date().getFullYear();
    const filters: IncomeFilters = {
      year: currentYear,
      userId,
      sortBy: 'month',
      sortOrder: 'asc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomeWithDetails> {
    return this.incomesService.findOne(id, this.getAuthContext(user));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createIncomeDto: CreateIncomeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Income> {
    return this.incomesService.create(
      createIncomeDto,
      this.getAuthContext(user),
    );
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBulk(
    @Body() createIncomeDtos: CreateIncomeDto[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Income[]> {
    const authContext = this.getAuthContext(user);
    const results: Income[] = [];
    for (const dto of createIncomeDtos) {
      try {
        const income = await this.incomesService.create(dto, authContext);
        results.push(income);
      } catch (error) {
        // Log error but continue with other incomes
        console.error(
          `Failed to create income for ${dto.userId} ${dto.year}-${dto.month}`,
          error,
        );
      }
    }

    return results;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateIncomeDto: UpdateIncomeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Income> {
    return this.incomesService.update(
      id,
      updateIncomeDto,
      this.getAuthContext(user),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.incomesService.remove(id, this.getAuthContext(user));
  }

  @Delete('user/:userId/year/:year')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeByUserAndYear(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const authContext = this.getAuthContext(user);
    // Find all incomes for the user and year, then delete them
    const filters: IncomeFilters = {
      userId,
      year: parseInt(year),
    };

    const incomes = await this.incomesService.findAll(filters, authContext);

    for (const income of incomes) {
      try {
        await this.incomesService.remove(income.id, authContext);
      } catch (error) {
        // Log error but continue with other deletions
        console.error(`Failed to delete income: ${income.id}`, error);
      }
    }
  }
}
