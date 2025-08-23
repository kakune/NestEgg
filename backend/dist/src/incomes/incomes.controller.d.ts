import { IncomesService, CreateIncomeDto, UpdateIncomeDto, IncomeWithDetails, IncomeStatistics } from './incomes.service';
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
export declare class IncomesController {
    private readonly incomesService;
    constructor(incomesService: IncomesService);
    private getAuthContext;
    findAll(query: IncomeQueryParams, user: AuthenticatedUser): Promise<IncomeWithDetails[]>;
    getStatistics(query: StatisticsQueryParams, user: AuthenticatedUser): Promise<IncomeStatistics>;
    getHouseholdBreakdown(year: string, month?: string, user: AuthenticatedUser): Promise<any>;
    findByUser(userId: string, query: IncomeQueryParams, user: AuthenticatedUser): Promise<IncomeWithDetails[]>;
    findByUserAndYear(userId: string, year: string, user: AuthenticatedUser): Promise<IncomeWithDetails[]>;
    findByUserAndMonth(userId: string, year: string, month: string, user: AuthenticatedUser): Promise<Income | null>;
    findByYear(year: string, query: YearQueryParams, user: AuthenticatedUser): Promise<IncomeWithDetails[]>;
    searchIncomes(searchQuery: string, query: SearchQueryParams, user: AuthenticatedUser): Promise<IncomeWithDetails[]>;
    findRecent(limit: string | undefined, user: AuthenticatedUser): Promise<IncomeWithDetails[]>;
    findCurrentYear(userId?: string, user: AuthenticatedUser): Promise<IncomeWithDetails[]>;
    findOne(id: string, user: AuthenticatedUser): Promise<IncomeWithDetails>;
    create(createIncomeDto: CreateIncomeDto, user: AuthenticatedUser): Promise<Income>;
    createBulk(createIncomeDtos: CreateIncomeDto[], user: AuthenticatedUser): Promise<Income[]>;
    update(id: string, updateIncomeDto: UpdateIncomeDto, user: AuthenticatedUser): Promise<Income>;
    remove(id: string, user: AuthenticatedUser): Promise<void>;
    removeByUserAndYear(userId: string, year: string, user: AuthenticatedUser): Promise<void>;
}
export {};
