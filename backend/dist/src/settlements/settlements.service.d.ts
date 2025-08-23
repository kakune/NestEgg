import { PrismaService } from '../prisma/prisma.service';
import { Settlement, SettlementLine } from '@prisma/client';
import { AuthContext } from '../common/interfaces/auth-context.interface';
export interface YearMonth {
    year: number;
    month: number;
}
export interface SettlementBalance {
    userId: string;
    balance: number;
}
export interface CreateSettlementLineDto {
    fromUserId: string;
    toUserId: string;
    amountYen: number;
    description?: string;
}
export interface SettlementWithLines extends Settlement {
    lines: SettlementLine[];
}
export declare class SettlementsService {
    private readonly prismaService;
    constructor(prismaService: PrismaService);
    runSettlement(householdId: string, month: YearMonth, authContext: AuthContext): Promise<SettlementWithLines>;
    finalizeSettlement(settlementId: string, authContext: AuthContext): Promise<SettlementWithLines>;
    findOne(settlementId: string, authContext: AuthContext): Promise<SettlementWithLines>;
    findAll(authContext: AuthContext): Promise<SettlementWithLines[]>;
    private loadMonthTransactions;
    private loadMonthIncomes;
    private getHouseholdPolicy;
    private computeIncomeWeights;
    private apportionExpenses;
    private calculateActualPayments;
    private computeDeltas;
    private buildReimbursementMatrix;
    private mergeBalances;
    private greedyNetting;
    private upsertDraftSettlement;
    private applyRounding;
}
