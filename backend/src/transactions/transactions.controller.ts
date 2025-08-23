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
  TransactionsService,
  TransactionFilters,
  TransactionWithDetails,
} from './transactions.service';
import type {
  CreateTransactionDto,
  UpdateTransactionDto,
} from './transactions.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import { Transaction, TransactionType } from '@prisma/client';

interface TransactionQueryParams {
  dateFrom?: string;
  dateTo?: string;
  categoryIds?: string | string[];
  actorIds?: string | string[];
  types?: TransactionType | TransactionType[];
  tags?: string | string[];
  search?: string;
  shouldPay?: string;
  amountFrom?: string;
  amountTo?: string;
  limit?: string;
  offset?: string;
  sortBy?: string;
  sortOrder?: string;
}

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  private getAuthContext(user: AuthenticatedUser): AuthContext {
    return {
      userId: user.userId,
      householdId: user.householdId,
      role: user.role,
    };
  }

  @Get()
  async findAll(
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    return this.transactionsService.findAll(filters, this.getAuthContext(user));
  }

  @Get('summary')
  async getTransactionSummary(
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    const filters = this.buildFilters(query);
    return this.transactionsService.getTransactionSummary(
      filters,
      this.getAuthContext(user),
    );
  }

  @Get('search')
  async searchTransactions(
    @Query('q') searchQuery: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.search = searchQuery;
    filters.limit = filters.limit || 50; // Default limit for search
    filters.sortBy = 'date';
    filters.sortOrder = 'desc';

    return this.transactionsService.findAll(filters, this.getAuthContext(user));
  }

  @Get('by-category/:categoryId')
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.categoryIds = [categoryId];

    return this.transactionsService.findAll(filters, this.getAuthContext(user));
  }

  @Get('by-actor/:actorId')
  async findByActor(
    @Param('actorId') actorId: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.actorIds = [actorId];

    return this.transactionsService.findAll(filters, this.getAuthContext(user));
  }

  @Get('by-tag/:tag')
  async findByTag(
    @Param('tag') tag: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.tags = [tag];
    filters.sortBy = 'date';
    filters.sortOrder = 'desc';

    return this.transactionsService.findAll(filters, this.getAuthContext(user));
  }

  @Get('recent')
  async findRecent(
    @Query('limit') limit: string = '20',
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails[]> {
    const filters: TransactionFilters = {
      limit: parseInt(limit),
      sortBy: 'date',
      sortOrder: 'desc',
    };

    return this.transactionsService.findAll(filters, this.getAuthContext(user));
  }

  @Get('date-range/:from/:to')
  async findByDateRange(
    @Param('from') from: string,
    @Param('to') to: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.dateFrom = new Date(from);
    filters.dateTo = new Date(to);
    filters.sortBy = filters.sortBy || 'date';
    filters.sortOrder = filters.sortOrder || 'desc';

    return this.transactionsService.findAll(filters, this.getAuthContext(user));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionWithDetails> {
    return this.transactionsService.findOne(id, this.getAuthContext(user));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Transaction> {
    return this.transactionsService.create(
      createTransactionDto,
      this.getAuthContext(user),
    );
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBulk(
    @Body() createTransactionDtos: CreateTransactionDto[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Transaction[]> {
    const authContext = this.getAuthContext(user);
    const results: Transaction[] = [];
    for (const dto of createTransactionDtos) {
      try {
        const transaction = await this.transactionsService.create(
          dto,
          authContext,
        );
        results.push(transaction);
      } catch (error) {
        // Log error but continue with other transactions
        console.error(
          `Failed to create transaction: ${dto.description}`,
          error,
        );
      }
    }

    return results;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Transaction> {
    return this.transactionsService.update(
      id,
      updateTransactionDto,
      this.getAuthContext(user),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.transactionsService.remove(id, this.getAuthContext(user));
  }

  @Delete('bulk')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBulk(
    @Body() ids: string[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const authContext = this.getAuthContext(user);

    for (const id of ids) {
      try {
        await this.transactionsService.remove(id, authContext);
      } catch (error) {
        // Log error but continue with other deletions
        console.error(`Failed to delete transaction: ${id}`, error);
      }
    }
  }

  private buildFilters(query: TransactionQueryParams): TransactionFilters {
    const filters: TransactionFilters = {};

    if (query.dateFrom) filters.dateFrom = new Date(query.dateFrom);
    if (query.dateTo) filters.dateTo = new Date(query.dateTo);
    if (query.categoryIds)
      filters.categoryIds = Array.isArray(query.categoryIds)
        ? query.categoryIds
        : [query.categoryIds];
    if (query.actorIds)
      filters.actorIds = Array.isArray(query.actorIds)
        ? query.actorIds
        : [query.actorIds];
    if (query.types)
      filters.types = Array.isArray(query.types) ? query.types : [query.types];
    if (query.tags)
      filters.tags = Array.isArray(query.tags) ? query.tags : [query.tags];
    if (query.search) filters.search = query.search;
    if (query.shouldPay !== undefined)
      filters.shouldPay = query.shouldPay === 'true';
    if (query.amountFrom) filters.amountFrom = parseInt(query.amountFrom);
    if (query.amountTo) filters.amountTo = parseInt(query.amountTo);
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);
    if (query.sortBy)
      filters.sortBy = query.sortBy as
        | 'date'
        | 'amount'
        | 'description'
        | 'createdAt';
    if (query.sortOrder) filters.sortOrder = query.sortOrder as 'asc' | 'desc';

    return filters;
  }
}
