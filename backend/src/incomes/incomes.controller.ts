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
  AuthContext,
  CreateIncomeDto,
  UpdateIncomeDto,
  IncomeFilters,
  IncomeWithDetails,
  IncomeStatistics,
} from './incomes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { Income } from '@prisma/client';

@Controller('incomes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncomesController {
  constructor(private readonly incomesService: IncomesService) {}

  @Get()
  async findAll(
    @Query() query: any,
    @CurrentUser() user: any,
  ): Promise<IncomeWithDetails[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    const filters: IncomeFilters = {
      userId: query.userId,
      year: query.year ? parseInt(query.year) : undefined,
      month: query.month ? parseInt(query.month) : undefined,
      yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
      yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
      minAllocatable: query.minAllocatable ? parseInt(query.minAllocatable) : undefined,
      maxAllocatable: query.maxAllocatable ? parseInt(query.maxAllocatable) : undefined,
      search: query.search,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      sortBy: query.sortBy as 'year' | 'month' | 'grossIncomeYen' | 'allocatableYen' | 'createdAt',
      sortOrder: query.sortOrder as 'asc' | 'desc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('statistics')
  async getStatistics(
    @Query() query: any,
    @CurrentUser() user: any,
  ): Promise<IncomeStatistics> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

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
    @CurrentUser() user?: any,
  ): Promise<any> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    const yearNum = parseInt(year);
    const monthNum = month ? parseInt(month) : undefined;

    return this.incomesService.getHouseholdIncomeBreakdown(yearNum, monthNum, authContext);
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ): Promise<IncomeWithDetails[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    const filters: IncomeFilters = {
      userId,
      year: query.year ? parseInt(query.year) : undefined,
      month: query.month ? parseInt(query.month) : undefined,
      yearFrom: query.yearFrom ? parseInt(query.yearFrom) : undefined,
      yearTo: query.yearTo ? parseInt(query.yearTo) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      sortBy: query.sortBy as 'year' | 'month' | 'grossIncomeYen' | 'allocatableYen' | 'createdAt',
      sortOrder: query.sortOrder as 'asc' | 'desc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('user/:userId/year/:year')
  async findByUserAndYear(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @CurrentUser() user: any,
  ): Promise<IncomeWithDetails[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

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
    @CurrentUser() user: any,
  ): Promise<Income | null> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    return this.incomesService.findByUserAndMonth(
      userId,
      parseInt(year),
      parseInt(month),
      authContext,
    );
  }

  @Get('year/:year')
  async findByYear(
    @Param('year') year: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ): Promise<IncomeWithDetails[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    const filters: IncomeFilters = {
      year: parseInt(year),
      month: query.month ? parseInt(query.month) : undefined,
      userId: query.userId,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
      sortBy: query.sortBy as 'year' | 'month' | 'grossIncomeYen' | 'allocatableYen' | 'createdAt' || 'month',
      sortOrder: query.sortOrder as 'asc' | 'desc' || 'asc',
    };

    return this.incomesService.findAll(filters, authContext);
  }

  @Get('search')
  async searchIncomes(
    @Query('q') searchQuery: string,
    @Query() query: any,
    @CurrentUser() user: any,
  ): Promise<IncomeWithDetails[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

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
    @CurrentUser() user: any,
  ): Promise<IncomeWithDetails[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

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
    @CurrentUser() user?: any,
  ): Promise<IncomeWithDetails[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

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
    @CurrentUser() user: any,
  ): Promise<IncomeWithDetails> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.incomesService.findOne(id, authContext);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createIncomeDto: CreateIncomeDto,
    @CurrentUser() user: any,
  ): Promise<Income> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.incomesService.create(createIncomeDto, authContext);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBulk(
    @Body() createIncomeDtos: CreateIncomeDto[],
    @CurrentUser() user: any,
  ): Promise<Income[]> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

    const results: Income[] = [];
    for (const dto of createIncomeDtos) {
      try {
        const income = await this.incomesService.create(dto, authContext);
        results.push(income);
      } catch (error) {
        // Log error but continue with other incomes
        console.error(`Failed to create income for ${dto.userId} ${dto.year}-${dto.month}`, error);
      }
    }

    return results;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateIncomeDto: UpdateIncomeDto,
    @CurrentUser() user: any,
  ): Promise<Income> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    return this.incomesService.update(id, updateIncomeDto, authContext);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
    await this.incomesService.remove(id, authContext);
  }

  @Delete('user/:userId/year/:year')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeByUserAndYear(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    const authContext: AuthContext = {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };

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