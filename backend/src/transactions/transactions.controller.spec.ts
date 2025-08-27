import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole, TransactionType } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import type {
  TransactionWithDetails,
  TransactionSummary,
} from './transactions.service';

describe('TransactionsController', () => {
  let controller: TransactionsController;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@example.com',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockTransaction: TransactionWithDetails = {
    id: 'transaction-1',
    householdId: 'household-1',
    type: TransactionType.EXPENSE,
    amountYen: BigInt(1000),
    occurredOn: new Date('2025-01-15'),
    bookedAt: new Date(),
    categoryId: 'category-1',
    payerActorId: 'actor-1',
    payerUserId: null,
    shouldPay: 'USER',
    shouldPayUserId: 'user-1',
    note: 'Test transaction',
    tags: ['groceries'],
    sourceHash: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: {
      id: 'category-1',
      name: 'Groceries',
      parent: null,
    },
    payerActor: {
      id: 'actor-1',
      name: 'Test User',
      kind: 'USER',
    },
  };

  const mockTransactionsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getTransactionSummary: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    removeMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile();

    controller = module.get<TransactionsController>(TransactionsController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all transactions', async () => {
      const mockTransactions = [mockTransaction];
      mockTransactionsService.findAll.mockResolvedValue(mockTransactions);

      const result = await controller.findAll({}, mockUser);

      expect(result).toEqual(mockTransactions);
      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {},
        mockUser,
      );
    });

    it('should apply filters', async () => {
      const query = {
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        categoryIds: 'category-1',
        types: TransactionType.EXPENSE,
        limit: '10',
      };

      mockTransactionsService.findAll.mockResolvedValue([mockTransaction]);

      await controller.findAll(query, mockUser);

      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          dateFrom: new Date('2025-01-01'),
          dateTo: new Date('2025-01-31'),
          categoryIds: ['category-1'],
          types: [TransactionType.EXPENSE],
          limit: 10,
        },
        mockUser,
      );
    });

    it('should handle array filters', async () => {
      const query = {
        categoryIds: ['category-1', 'category-2'],
        actorIds: ['actor-1', 'actor-2'],
        tags: ['groceries', 'food'],
      };

      mockTransactionsService.findAll.mockResolvedValue([]);

      await controller.findAll(query, mockUser);

      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          categoryIds: ['category-1', 'category-2'],
          actorIds: ['actor-1', 'actor-2'],
          tags: ['groceries', 'food'],
        },
        mockUser,
      );
    });
  });

  describe('getTransactionSummary', () => {
    it('should return transaction summary', async () => {
      const mockSummary: TransactionSummary = {
        totalTransactions: 25,
        totalIncome: 100000,
        totalExpenses: 50000,
        netAmount: 50000,
        averageTransaction: 6000,
        incomeCount: 15,
        expenseCount: 10,
      };

      mockTransactionsService.getTransactionSummary.mockResolvedValue(
        mockSummary,
      );

      const result = (await controller.getTransactionSummary(
        {},
        mockUser,
      )) as TransactionSummary;

      expect(result).toEqual(mockSummary);
      expect(
        mockTransactionsService.getTransactionSummary,
      ).toHaveBeenCalledWith({}, mockUser);
    });

    it('should apply filters to summary', async () => {
      const query = {
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
      };

      const emptySummary: TransactionSummary = {
        totalTransactions: 0,
        totalIncome: 0,
        totalExpenses: 0,
        netAmount: 0,
        averageTransaction: 0,
        incomeCount: 0,
        expenseCount: 0,
      };
      mockTransactionsService.getTransactionSummary.mockResolvedValue(
        emptySummary,
      );

      await controller.getTransactionSummary(query, mockUser);

      expect(
        mockTransactionsService.getTransactionSummary,
      ).toHaveBeenCalledWith(
        {
          dateFrom: new Date('2025-01-01'),
          dateTo: new Date('2025-01-31'),
        },
        mockUser,
      );
    });
  });

  describe('searchTransactions', () => {
    it('should search transactions', async () => {
      const searchQuery = 'coffee';
      mockTransactionsService.findAll.mockResolvedValue([mockTransaction]);

      const result = await controller.searchTransactions(
        searchQuery,
        {},
        mockUser,
      );

      expect(result).toEqual([mockTransaction]);
      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          search: searchQuery,
          limit: 50,
          sortBy: 'occurredOn',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });
  });

  describe('findByCategory', () => {
    it('should find transactions by category', async () => {
      mockTransactionsService.findAll.mockResolvedValue([mockTransaction]);

      const result = await controller.findByCategory(
        'category-1',
        {},
        mockUser,
      );

      expect(result).toEqual([mockTransaction]);
      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          categoryIds: ['category-1'],
        },
        mockUser,
      );
    });
  });

  describe('findByActor', () => {
    it('should find transactions by actor', async () => {
      mockTransactionsService.findAll.mockResolvedValue([mockTransaction]);

      const result = await controller.findByActor('actor-1', {}, mockUser);

      expect(result).toEqual([mockTransaction]);
      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          actorIds: ['actor-1'],
        },
        mockUser,
      );
    });
  });

  describe('findByTag', () => {
    it('should find transactions by tag', async () => {
      mockTransactionsService.findAll.mockResolvedValue([mockTransaction]);

      const result = await controller.findByTag('groceries', {}, mockUser);

      expect(result).toEqual([mockTransaction]);
      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          tags: ['groceries'],
          sortBy: 'occurredOn',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });
  });

  describe('findRecent', () => {
    it('should find recent transactions with default limit', async () => {
      mockTransactionsService.findAll.mockResolvedValue([mockTransaction]);

      const result = await controller.findRecent(undefined, mockUser);

      expect(result).toEqual([mockTransaction]);
      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          limit: 20,
          sortBy: 'occurredOn',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });

    it('should find recent transactions with custom limit', async () => {
      mockTransactionsService.findAll.mockResolvedValue([]);

      await controller.findRecent('50', mockUser);

      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          limit: 50,
          sortBy: 'occurredOn',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });
  });

  describe('findByDateRange', () => {
    it('should find transactions in date range', async () => {
      mockTransactionsService.findAll.mockResolvedValue([mockTransaction]);

      const result = await controller.findByDateRange(
        '2025-01-01',
        '2025-01-31',
        {},
        mockUser,
      );

      expect(result).toEqual([mockTransaction]);
      expect(mockTransactionsService.findAll).toHaveBeenCalledWith(
        {
          dateFrom: new Date('2025-01-01'),
          dateTo: new Date('2025-01-31'),
          sortBy: 'occurredOn',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });
  });

  describe('findOne', () => {
    it('should return a specific transaction', async () => {
      mockTransactionsService.findOne.mockResolvedValue(mockTransaction);

      const result = await controller.findOne('transaction-1', mockUser);

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionsService.findOne).toHaveBeenCalledWith(
        'transaction-1',
        mockUser,
      );
    });

    it('should handle transaction not found', async () => {
      const error = new Error('Transaction not found');
      mockTransactionsService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('invalid-id', mockUser)).rejects.toThrow(
        error,
      );
    });
  });

  describe('create', () => {
    it('should create a new transaction', async () => {
      const createTransactionDto = {
        type: TransactionType.EXPENSE,
        amount_yen: 2000,
        occurred_on: '2025-01-20',
        category_id: 'category-1',
        payer_actor_id: 'actor-1',
        note: 'New transaction',
        tags: ['food'],
        should_pay: 'USER' as const,
        should_pay_user_id: 'user-1',
      };

      const newTransaction = { ...mockTransaction, id: 'transaction-new' };
      mockTransactionsService.create.mockResolvedValue(newTransaction);

      const result = await controller.create(createTransactionDto, mockUser);

      expect(result).toEqual(newTransaction);
      expect(mockTransactionsService.create).toHaveBeenCalledWith(
        createTransactionDto,
        mockUser,
      );
    });
  });

  describe('createBulk', () => {
    it('should create multiple transactions', async () => {
      const createTransactionDtos = [
        {
          type: TransactionType.EXPENSE,
          amount_yen: 1000,
          occurred_on: '2025-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'USER' as const,
          should_pay_user_id: 'user-1',
        },
        {
          type: TransactionType.INCOME,
          amount_yen: 5000,
          occurred_on: '2025-01-15',
          category_id: 'category-2',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD' as const,
        },
      ];

      const mockResult = {
        count: 2,
        errors: [],
      };

      mockTransactionsService.createMany.mockResolvedValue(mockResult);

      const result = await controller.createBulk(
        createTransactionDtos,
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(mockTransactionsService.createMany).toHaveBeenCalledWith(
        createTransactionDtos,
        mockUser,
      );
    });

    it('should handle partial failures in bulk create', async () => {
      const createTransactionDtos = [
        {
          type: TransactionType.EXPENSE,
          amount_yen: 1000,
          occurred_on: '2025-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'USER' as const,
          should_pay_user_id: 'user-1',
        },
      ];

      const mockResult = {
        count: 0,
        errors: [
          {
            dto: createTransactionDtos[0],
            error: 'Validation failed',
          },
        ],
      };

      mockTransactionsService.createMany.mockResolvedValue(mockResult);

      const result = await controller.createBulk(
        createTransactionDtos,
        mockUser,
      );

      expect(result).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('should update a transaction', async () => {
      const updateTransactionDto = {
        note: 'Updated note',
      };

      const updatedTransaction = {
        ...mockTransaction,
        note: 'Updated note',
      };

      mockTransactionsService.update.mockResolvedValue(updatedTransaction);

      const result = await controller.update(
        'transaction-1',
        updateTransactionDto,
        mockUser,
      );

      expect(result).toEqual(updatedTransaction);
      expect(mockTransactionsService.update).toHaveBeenCalledWith(
        'transaction-1',
        updateTransactionDto,
        mockUser,
      );
    });
  });

  describe('remove', () => {
    it('should remove a transaction', async () => {
      mockTransactionsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('transaction-1', mockUser);

      expect(result).toBeUndefined();
      expect(mockTransactionsService.remove).toHaveBeenCalledWith(
        'transaction-1',
        mockUser,
      );
    });
  });

  describe('removeBulk', () => {
    it('should remove multiple transactions', async () => {
      const ids = ['transaction-1', 'transaction-2'];
      const mockResult = {
        count: 2,
        errors: [],
      };

      mockTransactionsService.removeMany.mockResolvedValue(mockResult);

      const result = await controller.removeBulk(ids, mockUser);

      expect(result).toEqual(mockResult);
      expect(mockTransactionsService.removeMany).toHaveBeenCalledWith(
        ids,
        mockUser,
      );
    });

    it('should handle partial failures in bulk delete', async () => {
      const ids = ['transaction-1', 'invalid-id'];
      const mockResult = {
        count: 1,
        errors: [
          {
            id: 'invalid-id',
            error: 'Transaction not found',
          },
        ],
      };

      mockTransactionsService.removeMany.mockResolvedValue(mockResult);

      const result = await controller.removeBulk(ids, mockUser);

      expect(result).toEqual(mockResult);
    });
  });
});
