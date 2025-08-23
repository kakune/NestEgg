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
    search?: string;
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
export declare class IncomesService {
    private readonly prismaService;
    constructor(prismaService: PrismaService);
    findAll(filters: IncomeFilters, authContext: AuthContext): Promise<IncomeWithDetails[]>;
    findOne(id: string, authContext: AuthContext): Promise<IncomeWithDetails>;
    findByUserAndMonth(userId: string, year: number, month: number, authContext: AuthContext): Promise<Income | null>;
    create(createIncomeDto: CreateIncomeDto, authContext: AuthContext): Promise<Income>;
    update(id: string, updateIncomeDto: UpdateIncomeDto, authContext: AuthContext): Promise<Income>;
    remove(id: string, authContext: AuthContext): Promise<void>;
    getIncomeStatistics(filters: IncomeFilters, authContext: AuthContext): Promise<IncomeStatistics>;
    getHouseholdIncomeBreakdown(year: number, month?: number, authContext: AuthContext): Promise<Record<string, unknown>>;
    private calculateAllocatableYen;
    private validateIncome;
    private validateIncomeUpdate;
}
