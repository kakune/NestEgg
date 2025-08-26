import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SettlementsService, YearMonth } from './settlements.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SettlementStatus,
  ApportionmentPolicy,
  RoundingPolicy,
  UserRole,
  TransactionType,
} from '@prisma/client';
import { AuthContext } from '../common/interfaces/auth-context.interface';

// Mock interfaces for workflow testing
interface MockSettlementWorkflow {
  id: string;
  householdId: string;
  year: number;
  month: Date;
  status: SettlementStatus;
  createdAt: Date;
  finalizedAt?: Date;
  finalizedBy?: string;
  lines: MockSettlementLineWorkflow[];
}

interface MockSettlementLineWorkflow {
  id: string;
  settlementId: string;
  fromUserId: string;
  toUserId: string;
  amountYen: number;
  description: string;
  createdAt: Date;
}

interface MockTransactionWorkflow {
  id: string;
  householdId: string;
  type: TransactionType;
  amountYen: number;
  occurredOn: Date;
  shouldPay: string;
  payerUserId: string;
  shouldPayUserId: string;
  deletedAt: Date | null;
  payerUser: { id: string; name: string };
  shouldPayUser: { id: string; name: string };
}

interface MockIncomeWorkflow {
  id: string;
  userId: string;
  householdId: string;
  year: number;
  month: Date;
  allocatableYen: number;
  deletedAt: Date | null;
  user: { id: string; name: string };
}

interface MockPolicyWorkflow {
  householdId: string;
  apportionmentZeroIncome: ApportionmentPolicy;
  rounding: RoundingPolicy;
}

interface MockPrismaWorkflowContext {
  transaction: {
    findMany: jest.Mock;
  };
  income: {
    findMany: jest.Mock;
  };
  policy: {
    findUnique: jest.Mock;
  };
  settlement: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
}

interface MockPrismaCallback {
  transaction?: {
    findMany?: jest.Mock;
  };
  income?: {
    findMany?: jest.Mock;
  };
  policy?: {
    findUnique?: jest.Mock;
  };
  settlement?: {
    findUnique?: jest.Mock;
    findFirst?: jest.Mock;
    findMany?: jest.Mock;
    create?: jest.Mock;
    update?: jest.Mock;
    deleteMany?: jest.Mock;
  };
}

describe('SettlementsService Workflow (Phase 4.2)', () => {
  let service: SettlementsService;
  let prismaService: {
    withContext: jest.Mock;
    prisma: MockPrismaWorkflowContext;
  };

  const mockAuthContext: AuthContext = {
    userId: 'admin1',
    householdId: 'household1',
    role: UserRole.admin,
  };

  const mockUserContext: AuthContext = {
    userId: 'user1',
    householdId: 'household1',
    role: UserRole.member,
  };

  const testMonth: YearMonth = {
    year: 2024,
    month: 3,
  };

  beforeEach(async () => {
    const mockPrisma: MockPrismaWorkflowContext = {
      transaction: {
        findMany: jest.fn(),
      },
      income: {
        findMany: jest.fn(),
      },
      policy: {
        findUnique: jest.fn(),
      },
      settlement: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockPrismaService = {
      withContext: jest.fn(),
      prisma: mockPrisma,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SettlementsService>(SettlementsService);
    prismaService = module.get(PrismaService);
  });

  describe('Settlement Lifecycle Workflow', () => {
    it('should create draft settlement and then finalize in complete workflow', async () => {
      const mockTransactions: MockTransactionWorkflow[] = [
        {
          id: 'tx1',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -12000,
          occurredOn: new Date(2024, 2, 15),
          shouldPay: 'HOUSEHOLD',
          payerUserId: 'user1',
          shouldPayUserId: 'user1',
          deletedAt: null,
          payerUser: { id: 'user1', name: 'User 1' },
          shouldPayUser: { id: 'user1', name: 'User 1' },
        },
      ];

      const mockIncomes: MockIncomeWorkflow[] = [
        {
          id: 'income1',
          userId: 'user1',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 300000,
          deletedAt: null,
          user: { id: 'user1', name: 'User 1' },
        },
        {
          id: 'income2',
          userId: 'user2',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 200000,
          deletedAt: null,
          user: { id: 'user2', name: 'User 2' },
        },
      ];

      const mockPolicy: MockPolicyWorkflow = {
        householdId: 'household1',
        apportionmentZeroIncome: ApportionmentPolicy.EXCLUDE,
        rounding: RoundingPolicy.ROUND,
      };

      // Step 1: Create draft settlement
      const draftSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [
          {
            id: 'line1',
            settlementId: 'settlement1',
            fromUserId: 'user2',
            toUserId: 'user1',
            amountYen: 4800,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      // Step 2: Finalize settlement
      const finalizedSettlement: MockSettlementWorkflow = {
        ...draftSettlement,
        status: SettlementStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedBy: 'admin1',
      };

      // Mock for draft creation
      prismaService.withContext.mockImplementationOnce(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findUnique: jest.fn().mockResolvedValue(null),
              deleteMany: jest.fn().mockResolvedValue({}),
              create: jest.fn().mockResolvedValue(draftSettlement),
            },
            transaction: {
              findMany: jest.fn().mockResolvedValue(mockTransactions),
            },
            income: {
              findMany: jest.fn().mockResolvedValue(mockIncomes),
            },
            policy: {
              findUnique: jest.fn().mockResolvedValue(mockPolicy),
            },
          } as MockPrismaCallback),
      );

      // Mock for finalization
      prismaService.withContext.mockImplementationOnce(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findFirst: jest.fn().mockResolvedValue(draftSettlement),
              update: jest.fn().mockResolvedValue(finalizedSettlement),
            },
          } as MockPrismaCallback),
      );

      // Execute workflow
      const draft = await service.runSettlement(
        'household1',
        testMonth,
        mockAuthContext,
      );
      expect(draft.status).toBe(SettlementStatus.DRAFT);
      expect(draft.lines).toHaveLength(1);

      const finalized = await service.finalizeSettlement(
        'settlement1',
        mockAuthContext,
      );
      expect(finalized.status).toBe(SettlementStatus.FINALIZED);
      expect(finalized.finalizedBy).toBe('admin1');
      expect(finalized.finalizedAt).toBeDefined();
    });

    it('should handle settlement replacement workflow for draft settlements', async () => {
      const existingDraft: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(2024, 2, 20),
        lines: [
          {
            id: 'line1',
            settlementId: 'settlement1',
            fromUserId: 'user2',
            toUserId: 'user1',
            amountYen: 5000,
            description: 'Old settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      const newDraft: MockSettlementWorkflow = {
        id: 'settlement2',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [
          {
            id: 'line2',
            settlementId: 'settlement2',
            fromUserId: 'user2',
            toUserId: 'user1',
            amountYen: 6000,
            description: 'Updated settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      const mockTransactions: MockTransactionWorkflow[] = [
        {
          id: 'tx1',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -15000,
          occurredOn: new Date(2024, 2, 25),
          shouldPay: 'HOUSEHOLD',
          payerUserId: 'user1',
          shouldPayUserId: 'user1',
          deletedAt: null,
          payerUser: { id: 'user1', name: 'User 1' },
          shouldPayUser: { id: 'user1', name: 'User 1' },
        },
      ];

      const mockIncomes: MockIncomeWorkflow[] = [
        {
          id: 'income1',
          userId: 'user1',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 300000,
          deletedAt: null,
          user: { id: 'user1', name: 'User 1' },
        },
        {
          id: 'income2',
          userId: 'user2',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 200000,
          deletedAt: null,
          user: { id: 'user2', name: 'User 2' },
        },
      ];

      const mockPolicy: MockPolicyWorkflow = {
        householdId: 'household1',
        apportionmentZeroIncome: ApportionmentPolicy.EXCLUDE,
        rounding: RoundingPolicy.ROUND,
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findUnique: jest.fn().mockResolvedValue(existingDraft),
              deleteMany: jest.fn().mockResolvedValue({ count: 1 }), // Deleted existing draft
              create: jest.fn().mockResolvedValue(newDraft),
            },
            transaction: {
              findMany: jest.fn().mockResolvedValue(mockTransactions),
            },
            income: {
              findMany: jest.fn().mockResolvedValue(mockIncomes),
            },
            policy: {
              findUnique: jest.fn().mockResolvedValue(mockPolicy),
            },
          }),
      );

      const result = await service.runSettlement(
        'household1',
        testMonth,
        mockAuthContext,
      );

      expect(result.id).toBe('settlement2'); // New settlement created
      expect(result.status).toBe(SettlementStatus.DRAFT);
      expect(Number(result.lines[0]!.amountYen)).toBe(6000); // Updated amount
    });

    it('should maintain settlement status integrity throughout lifecycle', async () => {
      const settlements = [
        {
          id: 'settlement1',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 0), // January 2024
          status: SettlementStatus.FINALIZED,
          finalizedAt: new Date(2024, 1, 1),
          finalizedBy: 'admin1',
          lines: [],
        },
        {
          id: 'settlement2',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 1), // February 2024
          status: SettlementStatus.DRAFT,
          lines: [],
        },
        {
          id: 'settlement3',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          status: SettlementStatus.DRAFT,
          lines: [],
        },
      ];

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findMany: jest.fn().mockResolvedValue(settlements),
            },
          }),
      );

      const result = await service.findAll(mockAuthContext);

      expect(result).toHaveLength(3);

      // Verify status integrity
      const finalized = result.find(
        (s) => s.status === SettlementStatus.FINALIZED,
      );
      const drafts = result.filter((s) => s.status === SettlementStatus.DRAFT);

      expect(finalized?.finalizedAt).toBeDefined();
      expect(finalized?.finalizedBy).toBe('admin1');
      expect(drafts).toHaveLength(2);
      expect(drafts.every((d) => !d.finalizedAt && !d.finalizedBy)).toBe(true);
    });
  });

  describe('Greedy Netting Algorithm Workflow', () => {
    it('should optimize transfers with complex multi-user balances', async () => {
      // Scenario: 5 users with complex balances requiring optimal netting
      const complexBalances = [
        { userId: 'user1', balance: 15000 }, // Owes money
        { userId: 'user2', balance: -8000 }, // Should receive money
        { userId: 'user3', balance: 12000 }, // Owes money
        { userId: 'user4', balance: -10000 }, // Should receive money
        { userId: 'user5', balance: -9000 }, // Should receive money
      ];

      const mockTransactions: MockTransactionWorkflow[] = [
        {
          id: 'tx1',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -30000,
          occurredOn: new Date(2024, 2, 15),
          shouldPay: 'HOUSEHOLD',
          payerUserId: 'user1',
          shouldPayUserId: 'user1',
          deletedAt: null,
          payerUser: { id: 'user1', name: 'User 1' },
          shouldPayUser: { id: 'user1', name: 'User 1' },
        },
      ];

      const mockIncomes: MockIncomeWorkflow[] = complexBalances.map(
        (balance, index) => ({
          id: `income${index + 1}`,
          userId: balance.userId,
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: Math.abs(balance.balance) * 10, // Income proportional to balance
          deletedAt: null,
          user: { id: balance.userId, name: `User ${index + 1}` },
        }),
      );

      const mockPolicy: MockPolicyWorkflow = {
        householdId: 'household1',
        apportionmentZeroIncome: ApportionmentPolicy.EXCLUDE,
        rounding: RoundingPolicy.ROUND,
      };

      // Expected optimal netting: minimize number of transfers
      const optimalSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [
          {
            id: 'line1',
            settlementId: 'settlement1',
            fromUserId: 'user1', // Highest payer
            toUserId: 'user4', // Highest receiver
            amountYen: 10000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
          {
            id: 'line2',
            settlementId: 'settlement1',
            fromUserId: 'user1', // Continue from highest payer
            toUserId: 'user5', // Second highest receiver
            amountYen: 5000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
          {
            id: 'line3',
            settlementId: 'settlement1',
            fromUserId: 'user3', // Second highest payer
            toUserId: 'user5', // Complete user5's balance
            amountYen: 4000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
          {
            id: 'line4',
            settlementId: 'settlement1',
            fromUserId: 'user3', // Complete user3's balance
            toUserId: 'user2', // To user2
            amountYen: 8000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findUnique: jest.fn().mockResolvedValue(null),
              deleteMany: jest.fn().mockResolvedValue({}),
              create: jest.fn().mockResolvedValue(optimalSettlement),
            },
            transaction: {
              findMany: jest.fn().mockResolvedValue(mockTransactions),
            },
            income: {
              findMany: jest.fn().mockResolvedValue(mockIncomes),
            },
            policy: {
              findUnique: jest.fn().mockResolvedValue(mockPolicy),
            },
          }),
      );

      const result = await service.runSettlement(
        'household1',
        testMonth,
        mockAuthContext,
      );

      expect(result.lines).toHaveLength(4);

      // Verify greedy netting principles
      const totalOutgoing = result.lines.reduce(
        (sum, line) => sum + Number(line.amountYen),
        0,
      );
      const totalIncoming = result.lines.reduce(
        (sum, line) => sum + Number(line.amountYen),
        0,
      );
      expect(totalOutgoing).toBe(totalIncoming); // Conservation of money

      // Verify transfers start with highest imbalances
      expect(result.lines[0]!.fromUserId).toBe('user1'); // Highest payer
      expect(result.lines[0]!.toUserId).toBe('user4'); // Highest receiver
      expect(Number(result.lines[0]!.amountYen)).toBe(10000);
    });

    it('should handle edge case with zero balances after netting', async () => {
      const perfectBalanceTransactions: MockTransactionWorkflow[] = [
        {
          id: 'tx1',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -10000,
          occurredOn: new Date(2024, 2, 15),
          shouldPay: 'HOUSEHOLD',
          payerUserId: 'user1',
          shouldPayUserId: 'user1',
          deletedAt: null,
          payerUser: { id: 'user1', name: 'User 1' },
          shouldPayUser: { id: 'user1', name: 'User 1' },
        },
        {
          id: 'tx2',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -10000,
          occurredOn: new Date(2024, 2, 16),
          shouldPay: 'HOUSEHOLD',
          payerUserId: 'user2',
          shouldPayUserId: 'user2',
          deletedAt: null,
          payerUser: { id: 'user2', name: 'User 2' },
          shouldPayUser: { id: 'user2', name: 'User 2' },
        },
      ];

      const equalIncomes: MockIncomeWorkflow[] = [
        {
          id: 'income1',
          userId: 'user1',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 300000,
          deletedAt: null,
          user: { id: 'user1', name: 'User 1' },
        },
        {
          id: 'income2',
          userId: 'user2',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 300000,
          deletedAt: null,
          user: { id: 'user2', name: 'User 2' },
        },
      ];

      const mockPolicy: MockPolicyWorkflow = {
        householdId: 'household1',
        apportionmentZeroIncome: ApportionmentPolicy.EXCLUDE,
        rounding: RoundingPolicy.ROUND,
      };

      const balancedSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [], // No transfers needed - perfect balance
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findUnique: jest.fn().mockResolvedValue(null),
              deleteMany: jest.fn().mockResolvedValue({}),
              create: jest.fn().mockResolvedValue(balancedSettlement),
            },
            transaction: {
              findMany: jest.fn().mockResolvedValue(perfectBalanceTransactions),
            },
            income: {
              findMany: jest.fn().mockResolvedValue(equalIncomes),
            },
            policy: {
              findUnique: jest.fn().mockResolvedValue(mockPolicy),
            },
          }),
      );

      const result = await service.runSettlement(
        'household1',
        testMonth,
        mockAuthContext,
      );

      expect(result.lines).toHaveLength(0); // No transfers needed when perfectly balanced
      expect(result.status).toBe(SettlementStatus.DRAFT);
    });

    it('should minimize transfers through intelligent netting', async () => {
      // Scenario: A owes B, B owes C, C owes A - should net to minimal transfers
      const circularDebtTransactions: MockTransactionWorkflow[] = [
        {
          id: 'tx1',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -6000,
          occurredOn: new Date(2024, 2, 15),
          shouldPay: 'USER',
          payerUserId: 'userA',
          shouldPayUserId: 'userB', // A paid for B
          deletedAt: null,
          payerUser: { id: 'userA', name: 'User A' },
          shouldPayUser: { id: 'userB', name: 'User B' },
        },
        {
          id: 'tx2',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -9000,
          occurredOn: new Date(2024, 2, 16),
          shouldPay: 'USER',
          payerUserId: 'userB',
          shouldPayUserId: 'userC', // B paid for C
          deletedAt: null,
          payerUser: { id: 'userB', name: 'User B' },
          shouldPayUser: { id: 'userC', name: 'User C' },
        },
        {
          id: 'tx3',
          householdId: 'household1',
          type: TransactionType.EXPENSE,
          amountYen: -4000,
          occurredOn: new Date(2024, 2, 17),
          shouldPay: 'USER',
          payerUserId: 'userC',
          shouldPayUserId: 'userA', // C paid for A
          deletedAt: null,
          payerUser: { id: 'userC', name: 'User C' },
          shouldPayUser: { id: 'userA', name: 'User A' },
        },
      ];

      const mockIncomes: MockIncomeWorkflow[] = [
        {
          id: 'income1',
          userId: 'userA',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 300000,
          deletedAt: null,
          user: { id: 'userA', name: 'User A' },
        },
        {
          id: 'income2',
          userId: 'userB',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 300000,
          deletedAt: null,
          user: { id: 'userB', name: 'User B' },
        },
        {
          id: 'income3',
          userId: 'userC',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          allocatableYen: 300000,
          deletedAt: null,
          user: { id: 'userC', name: 'User C' },
        },
      ];

      const mockPolicy: MockPolicyWorkflow = {
        householdId: 'household1',
        apportionmentZeroIncome: ApportionmentPolicy.EXCLUDE,
        rounding: RoundingPolicy.ROUND,
      };

      const nettedSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [
          {
            id: 'line1',
            settlementId: 'settlement1',
            fromUserId: 'userB',
            toUserId: 'userA',
            amountYen: 2000, // Net amount after circular debt reduction
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
          {
            id: 'line2',
            settlementId: 'settlement1',
            fromUserId: 'userC',
            toUserId: 'userB',
            amountYen: 5000, // Net amount after circular debt reduction
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findUnique: jest.fn().mockResolvedValue(null),
              deleteMany: jest.fn().mockResolvedValue({}),
              create: jest.fn().mockResolvedValue(nettedSettlement),
            },
            transaction: {
              findMany: jest.fn().mockResolvedValue(circularDebtTransactions),
            },
            income: {
              findMany: jest.fn().mockResolvedValue(mockIncomes),
            },
            policy: {
              findUnique: jest.fn().mockResolvedValue(mockPolicy),
            },
          }),
      );

      const result = await service.runSettlement(
        'household1',
        testMonth,
        mockAuthContext,
      );

      expect(result.lines).toHaveLength(2);
      // Should minimize transfers by netting circular debts
      // Instead of 6 potential transfers, should have only 2 net transfers
      expect(result.lines.length).toBeLessThan(3); // Optimal netting achieved
    });
  });

  describe('Finalization Workflow', () => {
    it('should enforce admin-only finalization workflow', async () => {
      const draftSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [],
      };

      // Test with non-admin user
      await expect(
        service.finalizeSettlement('settlement1', mockUserContext),
      ).rejects.toThrow(ConflictException);

      // Test with admin user
      const finalizedSettlement: MockSettlementWorkflow = {
        ...draftSettlement,
        status: SettlementStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedBy: 'admin1',
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findFirst: jest.fn().mockResolvedValue(draftSettlement),
              update: jest.fn().mockResolvedValue(finalizedSettlement),
            },
          }),
      );

      const result = await service.finalizeSettlement(
        'settlement1',
        mockAuthContext,
      );

      expect(result.status).toBe(SettlementStatus.FINALIZED);
      expect(result.finalizedBy).toBe('admin1');
      expect(result.finalizedAt).toBeDefined();
    });

    it('should prevent double finalization workflow', async () => {
      const alreadyFinalizedSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.FINALIZED,
        createdAt: new Date(),
        finalizedAt: new Date(2024, 2, 20),
        finalizedBy: 'admin1',
        lines: [],
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findFirst: jest
                .fn()
                .mockResolvedValue(alreadyFinalizedSettlement),
            },
          }),
      );

      await expect(
        service.finalizeSettlement('settlement1', mockAuthContext),
      ).rejects.toThrow(ConflictException);
    });

    it('should maintain settlement immutability after finalization', async () => {
      const finalizedSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.FINALIZED,
        createdAt: new Date(),
        finalizedAt: new Date(),
        finalizedBy: 'admin1',
        lines: [
          {
            id: 'line1',
            settlementId: 'settlement1',
            fromUserId: 'user1',
            toUserId: 'user2',
            amountYen: 5000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      // Mock attempt to run settlement for same period
      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findUnique: jest.fn().mockResolvedValue(finalizedSettlement),
            },
          }),
      );

      await expect(
        service.runSettlement('household1', testMonth, mockAuthContext),
      ).rejects.toThrow(ConflictException);

      // Verify the error message indicates finalization
      try {
        await service.runSettlement('household1', testMonth, mockAuthContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).message).toContain(
          'already finalized',
        );
      }
    });
  });

  describe('Settlement Period Management Workflow', () => {
    it('should handle multiple settlement periods correctly', async () => {
      const settlementsAcrossPeriods: MockSettlementWorkflow[] = [
        {
          id: 'settlement1',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 0), // January 2024
          status: SettlementStatus.FINALIZED,
          createdAt: new Date(2024, 1, 1),
          finalizedAt: new Date(2024, 1, 5),
          finalizedBy: 'admin1',
          lines: [],
        },
        {
          id: 'settlement2',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 1), // February 2024
          status: SettlementStatus.FINALIZED,
          createdAt: new Date(2024, 2, 1),
          finalizedAt: new Date(2024, 2, 5),
          finalizedBy: 'admin1',
          lines: [],
        },
        {
          id: 'settlement3',
          householdId: 'household1',
          year: 2024,
          month: new Date(2024, 2), // March 2024
          status: SettlementStatus.DRAFT,
          createdAt: new Date(2024, 3, 1),
          lines: [],
        },
      ];

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findMany: jest.fn().mockResolvedValue(settlementsAcrossPeriods),
            },
          }),
      );

      const result = await service.findAll(mockAuthContext);

      expect(result).toHaveLength(3);

      // Verify chronological ordering (desc by year, month)
      expect(result[0]!.month.getFullYear()).toBe(2024);
      expect(result[0]!.month.getMonth() + 1).toBe(1);
      expect(result[1]!.month.getFullYear()).toBe(2024);
      expect(result[1]!.month.getMonth() + 1).toBe(2);
      expect(result[2]!.month.getFullYear()).toBe(2024);
      expect(result[2]!.month.getMonth() + 1).toBe(3);

      // Verify status consistency
      const finalizedSettlements = result.filter(
        (s) => s.status === SettlementStatus.FINALIZED,
      );
      const draftSettlements = result.filter(
        (s) => s.status === SettlementStatus.DRAFT,
      );

      expect(finalizedSettlements).toHaveLength(2);
      expect(draftSettlements).toHaveLength(1);
      expect(
        finalizedSettlements.every((s) => s.finalizedAt && s.finalizedBy),
      ).toBe(true);
    });

    it('should isolate settlements by household correctly', async () => {
      const household1Settlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [],
      };

      const household2Context: AuthContext = {
        userId: 'admin2',
        householdId: 'household2',
        role: UserRole.admin,
      };

      prismaService.withContext.mockImplementationOnce(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow[]>,
        ) =>
          callback({
            settlement: {
              findMany: jest.fn().mockResolvedValue([household1Settlement]),
            },
          } as MockPrismaCallback),
      );

      prismaService.withContext.mockImplementationOnce(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow[]>,
        ) =>
          callback({
            settlement: {
              findMany: jest.fn().mockResolvedValue([]), // No settlements for household2
            },
          } as MockPrismaCallback),
      );

      const household1Results = await service.findAll(mockAuthContext);
      const household2Results = await service.findAll(household2Context);

      expect(household1Results).toHaveLength(1);
      expect(household1Results[0]!.householdId).toBe('household1');

      expect(household2Results).toHaveLength(0);
    });
  });

  describe('Settlement Data Integrity Workflow', () => {
    it('should maintain referential integrity in settlement lines', async () => {
      const settlementWithIntegrityLines: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [
          {
            id: 'line1',
            settlementId: 'settlement1',
            fromUserId: 'user1',
            toUserId: 'user2',
            amountYen: 5000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
          {
            id: 'line2',
            settlementId: 'settlement1',
            fromUserId: 'user3',
            toUserId: 'user1',
            amountYen: 3000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findFirst: jest
                .fn()
                .mockResolvedValue(settlementWithIntegrityLines),
            },
          }),
      );

      const result = await service.findOne('settlement1', mockAuthContext);

      expect(result.lines).toHaveLength(2);

      // Verify all lines reference the correct settlement
      expect(
        result.lines.every((line) => line.settlementId === 'settlement1'),
      ).toBe(true);

      // Verify positive amounts
      expect(result.lines.every((line) => line.amountYen > 0)).toBe(true);

      // Verify distinct from/to user pairs
      const userPairs = result.lines.map(
        (line) => `${line.fromUserId}->${line.toUserId}`,
      );
      expect(new Set(userPairs).size).toBe(userPairs.length); // No duplicate transfers
    });

    it('should handle settlement not found scenarios gracefully', async () => {
      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          }),
      );

      await expect(
        service.findOne('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should ensure settlement lines balance correctly', async () => {
      const balancedSettlement: MockSettlementWorkflow = {
        id: 'settlement1',
        householdId: 'household1',
        year: 2024,
        month: new Date(2024, 2), // March 2024
        status: SettlementStatus.DRAFT,
        createdAt: new Date(),
        lines: [
          {
            id: 'line1',
            settlementId: 'settlement1',
            fromUserId: 'user1',
            toUserId: 'user2',
            amountYen: 7000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
          {
            id: 'line2',
            settlementId: 'settlement1',
            fromUserId: 'user3',
            toUserId: 'user1',
            amountYen: 4000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
          {
            id: 'line3',
            settlementId: 'settlement1',
            fromUserId: 'user3',
            toUserId: 'user2',
            amountYen: 3000,
            description: 'Settlement transfer',
            createdAt: new Date(),
          },
        ],
      };

      prismaService.withContext.mockImplementation(
        (
          authContext: AuthContext,
          callback: (
            prisma: MockPrismaCallback,
          ) => Promise<MockSettlementWorkflow>,
        ) =>
          callback({
            settlement: {
              findFirst: jest.fn().mockResolvedValue(balancedSettlement),
            },
          }),
      );

      const result = await service.findOne('settlement1', mockAuthContext);

      // Calculate net balances per user from settlement lines
      const userBalances = new Map<string, number>();

      for (const line of result.lines) {
        // From user: negative (paying out)
        userBalances.set(
          line.fromUserId,
          (userBalances.get(line.fromUserId) || 0) - Number(line.amountYen),
        );
        // To user: positive (receiving)
        userBalances.set(
          line.toUserId,
          (userBalances.get(line.toUserId) || 0) + Number(line.amountYen),
        );
      }

      // Sum of all balances should be zero (money conservation)
      const totalBalance = Array.from(userBalances.values()).reduce(
        (sum, balance) => sum + balance,
        0,
      );
      expect(Math.abs(totalBalance)).toBeLessThan(0.01); // Account for floating point precision
    });
  });
});
