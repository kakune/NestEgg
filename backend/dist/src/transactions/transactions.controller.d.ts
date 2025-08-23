import { TransactionsService, TransactionWithDetails } from './transactions.service';
import type { CreateTransactionDto, UpdateTransactionDto } from './transactions.service';
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
export declare class TransactionsController {
    private readonly transactionsService;
    constructor(transactionsService: TransactionsService);
    private getAuthContext;
    findAll(query: TransactionQueryParams, user: AuthenticatedUser): Promise<TransactionWithDetails[]>;
    getTransactionSummary(query: TransactionQueryParams, user: AuthenticatedUser): Promise<any>;
    searchTransactions(searchQuery: string, query: TransactionQueryParams, user: AuthenticatedUser): Promise<TransactionWithDetails[]>;
    findByCategory(categoryId: string, query: TransactionQueryParams, user: AuthenticatedUser): Promise<TransactionWithDetails[]>;
    findByActor(actorId: string, query: TransactionQueryParams, user: AuthenticatedUser): Promise<TransactionWithDetails[]>;
    findByTag(tag: string, query: TransactionQueryParams, user: AuthenticatedUser): Promise<TransactionWithDetails[]>;
    findRecent(limit: string | undefined, user: AuthenticatedUser): Promise<TransactionWithDetails[]>;
    findByDateRange(from: string, to: string, query: TransactionQueryParams, user: AuthenticatedUser): Promise<TransactionWithDetails[]>;
    findOne(id: string, user: AuthenticatedUser): Promise<TransactionWithDetails>;
    create(createTransactionDto: CreateTransactionDto, user: AuthenticatedUser): Promise<Transaction>;
    createBulk(createTransactionDtos: CreateTransactionDto[], user: AuthenticatedUser): Promise<Transaction[]>;
    update(id: string, updateTransactionDto: UpdateTransactionDto, user: AuthenticatedUser): Promise<Transaction>;
    remove(id: string, user: AuthenticatedUser): Promise<void>;
    removeBulk(ids: string[], user: AuthenticatedUser): Promise<void>;
    private buildFilters;
}
export {};
