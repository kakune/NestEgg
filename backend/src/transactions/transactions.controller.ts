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
  TransformedTransaction,
  TransformedTransactionWithDetails,
} from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import { TransactionType } from '@prisma/client';

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

  @Get()
  async findAll(
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    return this.transactionsService.findAll(filters, user);
  }

  @Get('summary')
  async getTransactionSummary(
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any> {
    const filters = this.buildFilters(query);
    return this.transactionsService.getTransactionSummary(filters, user);
  }

  @Get('search')
  async searchTransactions(
    @Query('q') searchQuery: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.search = searchQuery;
    filters.limit = filters.limit || 50; // Default limit for search
    filters.sortBy = 'occurredOn';
    filters.sortOrder = 'desc';

    return this.transactionsService.findAll(filters, user);
  }

  @Get('by-category/:categoryId')
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.categoryIds = [categoryId];

    return this.transactionsService.findAll(filters, user);
  }

  @Get('by-actor/:actorId')
  async findByActor(
    @Param('actorId') actorId: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.actorIds = [actorId];

    return this.transactionsService.findAll(filters, user);
  }

  @Get('by-tag/:tag')
  async findByTag(
    @Param('tag') tag: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.tags = [tag];
    filters.sortBy = 'occurredOn';
    filters.sortOrder = 'desc';

    return this.transactionsService.findAll(filters, user);
  }

  @Get('recent')
  async findRecent(
    @Query('limit') limit: string = '20',
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails[]> {
    const filters: TransactionFilters = {
      limit: parseInt(limit),
      sortBy: 'occurredOn',
      sortOrder: 'desc',
    };

    return this.transactionsService.findAll(filters, user);
  }

  @Get('date-range/:from/:to')
  async findByDateRange(
    @Param('from') from: string,
    @Param('to') to: string,
    @Query() query: TransactionQueryParams,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails[]> {
    const filters = this.buildFilters(query);
    filters.dateFrom = new Date(from);
    filters.dateTo = new Date(to);
    filters.sortBy = filters.sortBy || 'occurredOn';
    filters.sortOrder = filters.sortOrder || 'desc';

    return this.transactionsService.findAll(filters, user);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransactionWithDetails> {
    return this.transactionsService.findOne(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransaction> {
    return this.transactionsService.create(createTransactionDto, user);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBulk(
    @Body() createTransactionDtos: CreateTransactionDto[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    count: number;
    errors: Array<{ dto: CreateTransactionDto; error: string }>;
  }> {
    const authContext = user;
    return this.transactionsService.createMany(
      createTransactionDtos,
      authContext,
    );
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransformedTransaction> {
    return this.transactionsService.update(id, updateTransactionDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.transactionsService.remove(id, user);
  }

  @Delete('bulk')
  @HttpCode(HttpStatus.OK)
  async removeBulk(
    @Body() ids: string[],
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ count: number; errors: Array<{ id: string; error: string }> }> {
    const authContext = user;
    return this.transactionsService.removeMany(ids, authContext);
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
      filters.shouldPay = query.shouldPay as 'HOUSEHOLD' | 'USER';
    if (query.amountFrom) filters.amountFrom = parseInt(query.amountFrom);
    if (query.amountTo) filters.amountTo = parseInt(query.amountTo);
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);
    if (query.sortBy)
      filters.sortBy = query.sortBy as
        | 'occurredOn'
        | 'amountYen'
        | 'note'
        | 'createdAt';
    if (query.sortOrder) filters.sortOrder = query.sortOrder as 'asc' | 'desc';

    return filters;
  }
}
