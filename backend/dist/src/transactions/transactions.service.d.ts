import { PrismaService } from '../prisma/prisma.service';
import { Transaction, TransactionType } from '@prisma/client';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
interface TransactionSummary {
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
    sourceHash?: string;
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
    search?: string;
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
export declare class TransactionsService {
    private readonly prismaService;
    private readonly actorsService;
    private readonly categoriesService;
    constructor(prismaService: PrismaService, actorsService: ActorsService, categoriesService: CategoriesService);
    findAll(filters: TransactionFilters, authContext: AuthContext): Promise<TransactionWithDetails[]>;
    findOne(id: string, authContext: AuthContext): Promise<TransactionWithDetails>;
    create(createTransactionDto: CreateTransactionDto, authContext: AuthContext): Promise<Transaction>;
    update(id: string, updateTransactionDto: UpdateTransactionDto, authContext: AuthContext): Promise<Transaction>;
    remove(id: string, authContext: AuthContext): Promise<void>;
    getTransactionSummary(filters: TransactionFilters, authContext: AuthContext): Promise<TransactionSummary>;
    private validateTransaction;
    private calculateShouldPay;
    private generateSourceHash;
    private applyFiltersToWhere;
}
export {};
