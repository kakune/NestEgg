"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let SettlementsService = class SettlementsService {
    prismaService;
    constructor(prismaService) {
        this.prismaService = prismaService;
    }
    async runSettlement(householdId, month, authContext) {
        return this.prismaService.withContext(authContext, async (prisma) => {
            const existingSettlement = await prisma.settlement.findUnique({
                where: {
                    householdId_year_month: {
                        householdId,
                        year: month.year,
                        month: month.month,
                    },
                },
            });
            if (existingSettlement &&
                existingSettlement.status === client_1.SettlementStatus.FINALIZED) {
                throw new common_1.ConflictException(`Settlement for ${month.year}-${month.month} is already finalized`);
            }
            const transactions = await this.loadMonthTransactions(prisma, householdId, month);
            const incomes = await this.loadMonthIncomes(prisma, householdId, month);
            const policy = await this.getHouseholdPolicy(prisma, householdId);
            const householdExpenses = transactions.filter((t) => t.type === 'EXPENSE' && t.shouldPay === 'HOUSEHOLD');
            const weights = this.computeIncomeWeights(incomes, policy.apportionmentZeroIncome);
            const shares = this.apportionExpenses(householdExpenses, weights, policy.rounding);
            const actualPayments = this.calculateActualPayments(householdExpenses);
            const householdDeltas = this.computeDeltas(actualPayments, shares);
            const personalExpenses = transactions.filter((t) => t.type === 'EXPENSE' && t.shouldPay === 'USER');
            const reimbursements = this.buildReimbursementMatrix(personalExpenses);
            const balances = this.mergeBalances(householdDeltas, reimbursements);
            const settlementLines = this.greedyNetting(balances);
            const settlement = await this.upsertDraftSettlement(prisma, householdId, month, settlementLines);
            return settlement;
        });
    }
    async finalizeSettlement(settlementId, authContext) {
        if (authContext.role !== client_1.UserRole.admin) {
            throw new common_1.ConflictException('Only admin users can finalize settlements');
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
                throw new common_1.NotFoundException('Settlement not found');
            }
            if (settlement.status === client_1.SettlementStatus.FINALIZED) {
                throw new common_1.ConflictException('Settlement is already finalized');
            }
            const finalizedSettlement = await prisma.settlement.update({
                where: { id: settlementId },
                data: {
                    status: client_1.SettlementStatus.FINALIZED,
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
    async findOne(settlementId, authContext) {
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
                throw new common_1.NotFoundException('Settlement not found');
            }
            return settlement;
        });
    }
    async findAll(authContext) {
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
    async loadMonthTransactions(prisma, householdId, month) {
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
    async loadMonthIncomes(prisma, householdId, month) {
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
    async getHouseholdPolicy(prisma, householdId) {
        const policy = await prisma.policy.findUnique({
            where: { householdId },
        });
        return (policy || {
            apportionmentZeroIncome: client_1.ApportionmentPolicy.EXCLUDE,
            rounding: client_1.RoundingPolicy.ROUND,
        });
    }
    computeIncomeWeights(incomes, apportionmentZeroIncome) {
        const weights = new Map();
        const totalAllocatable = incomes.reduce((sum, income) => sum + income.allocatableYen, 0);
        if (totalAllocatable === 0) {
            if (apportionmentZeroIncome === client_1.ApportionmentPolicy.EXCLUDE) {
                return weights;
            }
            else {
                const equalWeight = 1 / incomes.length;
                incomes.forEach((income) => {
                    weights.set(income.userId, equalWeight);
                });
            }
        }
        else {
            incomes.forEach((income) => {
                weights.set(income.userId, income.allocatableYen / totalAllocatable);
            });
        }
        return weights;
    }
    apportionExpenses(expenses, weights, rounding) {
        const shares = new Map();
        for (const userId of weights.keys()) {
            shares.set(userId, 0);
        }
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
    calculateActualPayments(expenses) {
        const payments = new Map();
        for (const expense of expenses) {
            const payerId = expense.payerUserId;
            const amount = Math.abs(expense.amountYen);
            payments.set(payerId, (payments.get(payerId) || 0) + amount);
        }
        return payments;
    }
    computeDeltas(actualPayments, shares) {
        const deltas = new Map();
        const allUserIds = new Set([...actualPayments.keys(), ...shares.keys()]);
        for (const userId of allUserIds) {
            const paid = actualPayments.get(userId) || 0;
            const shouldPay = shares.get(userId) || 0;
            deltas.set(userId, paid - shouldPay);
        }
        return deltas;
    }
    buildReimbursementMatrix(personalExpenses) {
        const reimbursements = new Map();
        for (const expense of personalExpenses) {
            const payerId = expense.payerUserId;
            const beneficiaryId = expense.shouldPayUserId;
            if (payerId !== beneficiaryId) {
                const amount = Math.abs(expense.amountYen);
                reimbursements.set(payerId, (reimbursements.get(payerId) || 0) + amount);
                reimbursements.set(beneficiaryId, (reimbursements.get(beneficiaryId) || 0) - amount);
            }
        }
        return reimbursements;
    }
    mergeBalances(householdDeltas, reimbursements) {
        const balances = new Map();
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
    greedyNetting(balances) {
        const workingBalances = new Map(balances);
        const payers = Array.from(workingBalances.entries())
            .filter(([, balance]) => balance < 0)
            .sort((a, b) => a[1] - b[1]);
        const receivers = Array.from(workingBalances.entries())
            .filter(([, balance]) => balance > 0)
            .sort((a, b) => b[1] - a[1]);
        const lines = [];
        for (const [payerId, payerBalance] of payers) {
            let remaining = Math.abs(payerBalance);
            for (const [receiverId] of receivers) {
                if (remaining === 0 || workingBalances.get(receiverId) <= 0)
                    continue;
                const currentReceiverBalance = workingBalances.get(receiverId);
                const transferAmount = Math.min(remaining, currentReceiverBalance);
                if (transferAmount > 0) {
                    lines.push({
                        fromUserId: payerId,
                        toUserId: receiverId,
                        amountYen: transferAmount,
                        description: `Settlement transfer`,
                    });
                    remaining -= transferAmount;
                    workingBalances.set(receiverId, currentReceiverBalance - transferAmount);
                }
            }
        }
        return lines;
    }
    async upsertDraftSettlement(prisma, householdId, month, settlementLines) {
        await prisma.settlement.deleteMany({
            where: {
                householdId,
                year: month.year,
                month: month.month,
                status: client_1.SettlementStatus.DRAFT,
            },
        });
        const settlement = await prisma.settlement.create({
            data: {
                householdId,
                year: month.year,
                month: month.month,
                status: client_1.SettlementStatus.DRAFT,
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
    applyRounding(amount, rounding) {
        switch (rounding) {
            case client_1.RoundingPolicy.CEILING:
                return Math.ceil(amount);
            case client_1.RoundingPolicy.FLOOR:
                return Math.floor(amount);
            case client_1.RoundingPolicy.ROUND:
            default:
                return Math.round(amount);
        }
    }
};
exports.SettlementsService = SettlementsService;
exports.SettlementsService = SettlementsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettlementsService);
//# sourceMappingURL=settlements.service.js.map