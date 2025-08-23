/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Settlement,
  SettlementLine,
  SettlementStatus,
  ApportionmentPolicy,
  UserRole,
  RoundingPolicy,
} from '@prisma/client';
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

@Injectable()
export class SettlementsService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Run month-end settlement calculation for a household
   * Implements the algorithm from the design document
   */
  async runSettlement(
    householdId: string,
    month: YearMonth,
    authContext: AuthContext,
  ): Promise<SettlementWithLines> {
    // Use advisory lock to prevent concurrent settlement calculations
    return this.prismaService.withContext(authContext, async (prisma) => {
      // Check if settlement is already finalized
      const existingSettlement = await prisma.settlement.findUnique({
        where: {
          householdId_year_month: {
            householdId,
            year: month.year,
            month: month.month,
          },
        },
      });

      if (
        existingSettlement &&
        existingSettlement.status === SettlementStatus.FINALIZED
      ) {
        throw new ConflictException(
          `Settlement for ${month.year}-${month.month} is already finalized`,
        );
      }

      // 1. Load data
      const transactions = await this.loadMonthTransactions(
        prisma,
        householdId,
        month,
      );
      const incomes = await this.loadMonthIncomes(prisma, householdId, month);
      const policy = await this.getHouseholdPolicy(prisma, householdId);

      // 2. Compute household expense apportionment
      const householdExpenses = transactions.filter(
        (t) => t.type === 'EXPENSE' && t.shouldPay === 'HOUSEHOLD',
      );
      const weights = this.computeIncomeWeights(
        incomes,
        policy.apportionmentZeroIncome,
      );
      const shares = this.apportionExpenses(
        householdExpenses,
        weights,
        policy.rounding,
      );

      // 3. Calculate actual payments per user
      const actualPayments = this.calculateActualPayments(householdExpenses);
      const householdDeltas = this.computeDeltas(actualPayments, shares);

      // 4. Build reimbursement matrix
      const personalExpenses = transactions.filter(
        (t) => t.type === 'EXPENSE' && t.shouldPay === 'USER',
      );
      const reimbursements = this.buildReimbursementMatrix(personalExpenses);

      // 5. Net settlement with greedy algorithm
      const balances = this.mergeBalances(householdDeltas, reimbursements);
      const settlementLines = this.greedyNetting(balances);

      // 6. Persist results
      const settlement = await this.upsertDraftSettlement(
        prisma,
        householdId,
        month,
        settlementLines,
      );

      return settlement;
    });
  }

  /**
   * Finalize a draft settlement
   */
  async finalizeSettlement(
    settlementId: string,
    authContext: AuthContext,
  ): Promise<SettlementWithLines> {
    // Only admin users can finalize settlements
    if (authContext.role !== UserRole.admin) {
      throw new ConflictException('Only admin users can finalize settlements');
    }

    return this.prismaService.withContext(authContext, async (prisma) => {
      const settlement = await prisma.settlement.findFirst({
        where: {
          id: settlementId,
          householdId: authContext.householdId,
        },
        include: {
          lines: true,
        },
      });

      if (!settlement) {
        throw new NotFoundException('Settlement not found');
      }

      if (settlement.status === SettlementStatus.FINALIZED) {
        throw new ConflictException('Settlement is already finalized');
      }

      // Update settlement to finalized
      const finalizedSettlement = await prisma.settlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.FINALIZED,
          finalizedBy: authContext.userId,
          finalizedAt: new Date(),
        },
        include: {
          lines: true,
        },
      });

      return finalizedSettlement;
    });
  }

  /**
   * Get settlement by ID
   */
  async findOne(
    settlementId: string,
    authContext: AuthContext,
  ): Promise<SettlementWithLines> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      const settlement = await prisma.settlement.findFirst({
        where: {
          id: settlementId,
          householdId: authContext.householdId,
        },
        include: {
          lines: true,
        },
      });

      if (!settlement) {
        throw new NotFoundException('Settlement not found');
      }

      return settlement;
    });
  }

  /**
   * Get all settlements for a household
   */
  async findAll(authContext: AuthContext): Promise<SettlementWithLines[]> {
    return this.prismaService.withContext(authContext, async (prisma) => {
      return prisma.settlement.findMany({
        where: {
          householdId: authContext.householdId,
        },
        include: {
          lines: true,
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
    });
  }

  // Private helper methods

  private async loadMonthTransactions(
    prisma: PrismaService['prisma'],
    householdId: string,
    month: YearMonth,
  ) {
    return prisma.transaction.findMany({
      where: {
        householdId,
        occurredOn: {
          gte: new Date(month.year, month.month - 1, 1),
          lt: new Date(month.year, month.month, 1),
        },
        deletedAt: null,
      },
      include: {
        payerUser: true,
        shouldPayUser: true,
      },
    });
  }

  private async loadMonthIncomes(
    prisma: PrismaService['prisma'],
    householdId: string,
    month: YearMonth,
  ) {
    return prisma.income.findMany({
      where: {
        householdId,
        year: month.year,
        month: month.month,
        deletedAt: null,
      },
      include: {
        user: true,
      },
    });
  }

  private async getHouseholdPolicy(
    prisma: PrismaService['prisma'],
    householdId: string,
  ) {
    const policy = await prisma.policy.findUnique({
      where: { householdId },
    });

    return (
      policy || {
        apportionmentZeroIncome: ApportionmentPolicy.EXCLUDE,
        rounding: RoundingPolicy.ROUND,
      }
    );
  }

  private computeIncomeWeights(
    incomes: Array<{ userId: string; allocatableYen: number }>,
    apportionmentZeroIncome: ApportionmentPolicy,
  ): Map<string, number> {
    const weights = new Map<string, number>();

    // Calculate total allocatable income
    const totalAllocatable = incomes.reduce(
      (sum, income) => sum + income.allocatableYen,
      0,
    );

    if (totalAllocatable === 0) {
      // Handle zero income scenario based on policy
      if (apportionmentZeroIncome === ApportionmentPolicy.EXCLUDE) {
        return weights; // Empty weights, no apportionment
      } else {
        // MIN_SHARE: equal distribution
        const equalWeight = 1 / incomes.length;
        incomes.forEach((income) => {
          weights.set(income.userId, equalWeight);
        });
      }
    } else {
      // Normal case: weight by income proportion
      incomes.forEach((income) => {
        weights.set(income.userId, income.allocatableYen / totalAllocatable);
      });
    }

    return weights;
  }

  private apportionExpenses(
    expenses: Array<{
      amountYen: number;
      actorId: string;
      userId: string | null;
      shouldPay: boolean;
    }>,
    weights: Map<string, number>,
    rounding: RoundingPolicy,
  ): Map<string, number> {
    const shares = new Map<string, number>();

    // Initialize shares
    for (const userId of weights.keys()) {
      shares.set(userId, 0);
    }

    // Apportion each expense
    for (const expense of expenses) {
      const totalAmount = Math.abs(expense.amountYen);

      for (const [userId, weight] of weights.entries()) {
        const share = totalAmount * weight;
        const roundedShare = this.applyRounding(share, rounding);
        shares.set(userId, (shares.get(userId) || 0) + roundedShare);
      }
    }

    return shares;
  }

  private calculateActualPayments(
    expenses: Array<{
      amountYen: number;
      payerUserId: string;
      actorId: string;
      userId: string | null;
      shouldPay: boolean;
    }>,
  ): Map<string, number> {
    const payments = new Map<string, number>();

    for (const expense of expenses) {
      const payerId = expense.payerUserId;
      const amount = Math.abs(expense.amountYen);
      payments.set(payerId, (payments.get(payerId) || 0) + amount);
    }

    return payments;
  }

  private computeDeltas(
    actualPayments: Map<string, number>,
    shares: Map<string, number>,
  ): Map<string, number> {
    const deltas = new Map<string, number>();

    // Get all user IDs
    const allUserIds = new Set([...actualPayments.keys(), ...shares.keys()]);

    for (const userId of allUserIds) {
      const paid = actualPayments.get(userId) || 0;
      const shouldPay = shares.get(userId) || 0;
      deltas.set(userId, paid - shouldPay); // Positive = overpaid, negative = underpaid
    }

    return deltas;
  }

  private buildReimbursementMatrix(
    personalExpenses: Array<{
      amountYen: number;
      payerUserId: string;
      shouldPayUserId: string;
      actorId: string;
      userId: string | null;
      shouldPay: boolean;
    }>,
  ): Map<string, number> {
    const reimbursements = new Map<string, number>();

    for (const expense of personalExpenses) {
      const payerId = expense.payerUserId;
      const beneficiaryId = expense.shouldPayUserId;

      if (payerId !== beneficiaryId) {
        // Payer should receive reimbursement from beneficiary
        const amount = Math.abs(expense.amountYen);
        reimbursements.set(
          payerId,
          (reimbursements.get(payerId) || 0) + amount,
        );
        reimbursements.set(
          beneficiaryId,
          (reimbursements.get(beneficiaryId) || 0) - amount,
        );
      }
    }

    return reimbursements;
  }

  private mergeBalances(
    householdDeltas: Map<string, number>,
    reimbursements: Map<string, number>,
  ): Map<string, number> {
    const balances = new Map<string, number>();

    // Get all user IDs
    const allUserIds = new Set([
      ...householdDeltas.keys(),
      ...reimbursements.keys(),
    ]);

    for (const userId of allUserIds) {
      const householdDelta = householdDeltas.get(userId) || 0;
      const reimbursementDelta = reimbursements.get(userId) || 0;
      balances.set(userId, householdDelta + reimbursementDelta);
    }

    return balances;
  }

  /**
   * Greedy netting algorithm to minimize number of transfers
   */
  private greedyNetting(
    balances: Map<string, number>,
  ): CreateSettlementLineDto[] {
    // Create mutable copy of balances
    const workingBalances = new Map(balances);

    // Separate payers and receivers
    const payers = Array.from(workingBalances.entries())
      .filter(([_, balance]) => balance < 0)
      .sort((a, b) => a[1] - b[1]); // Most negative first

    const receivers = Array.from(workingBalances.entries())
      .filter(([_, balance]) => balance > 0)
      .sort((a, b) => b[1] - a[1]); // Most positive first

    const lines: CreateSettlementLineDto[] = [];

    for (const [payerId, payerBalance] of payers) {
      let remaining = Math.abs(payerBalance);

      for (const [receiverId] of receivers) {
        if (remaining === 0 || workingBalances.get(receiverId)! <= 0) continue;

        const currentReceiverBalance = workingBalances.get(receiverId)!;
        const transferAmount = Math.min(remaining, currentReceiverBalance);

        if (transferAmount > 0) {
          lines.push({
            fromUserId: payerId,
            toUserId: receiverId,
            amountYen: transferAmount,
            description: `Settlement transfer`,
          });

          remaining -= transferAmount;
          workingBalances.set(
            receiverId,
            currentReceiverBalance - transferAmount,
          );
        }
      }
    }

    return lines;
  }

  private async upsertDraftSettlement(
    prisma: PrismaService['prisma'],
    householdId: string,
    month: YearMonth,
    settlementLines: CreateSettlementLineDto[],
  ): Promise<SettlementWithLines> {
    // Delete existing draft settlement if it exists
    await prisma.settlement.deleteMany({
      where: {
        householdId,
        year: month.year,
        month: month.month,
        status: SettlementStatus.DRAFT,
      },
    });

    // Create new settlement
    const settlement = await prisma.settlement.create({
      data: {
        householdId,
        year: month.year,
        month: month.month,
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: {
          create: settlementLines,
        },
      },
      include: {
        lines: true,
      },
    });

    return settlement;
  }

  private applyRounding(amount: number, rounding: RoundingPolicy): number {
    switch (rounding) {
      case RoundingPolicy.CEILING:
        return Math.ceil(amount);
      case RoundingPolicy.FLOOR:
        return Math.floor(amount);
      case RoundingPolicy.ROUND:
      default:
        return Math.round(amount);
    }
  }
}
