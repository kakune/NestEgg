import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { mockDeep, MockProxy, mockReset } from 'jest-mock-extended';
import { TransactionType, UserRole, PrismaClient } from '@prisma/client';

import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActorsService } from '../actors/actors.service';
import { CategoriesService } from '../categories/categories.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionFilters,
  TransactionWithDetails,
  TransactionSummary,
} from './transactions.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';

describe('TransactionsService (Phase 3.1)', () => {
  let service: TransactionsService;
  let mockPrismaService: MockProxy<PrismaService>;
  let mockPrismaClient: MockProxy<PrismaClient>;
  let mockActorsService: MockProxy<ActorsService>;
  let mockCategoriesService: MockProxy<CategoriesService>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    householdId: 'household-1',
    role: UserRole.admin,
  };

  const mockTransaction = {
    id: 'transaction-1',
    householdId: 'household-1',
    actorId: 'actor-1',
    categoryId: 'category-1',
    payerUserId: 'user-1',
    shouldPayUserId: 'user-1',
    amount: -5000,
    type: TransactionType.EXPENSE,
    description: 'Test Expense',
    date: new Date('2024-01-15'),
    tags: ['food', 'restaurant'],
    notes: 'Dinner with friends',
    shouldPay: false,
    sourceHash: 'source-hash-1',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    deletedAt: null,
  };

  const mockTransactionWithDetails: TransactionWithDetails = {
    ...mockTransaction,
    category: {
      id: 'category-1',
      name: 'Food & Dining',
      parent: {
        id: 'parent-category-1',
        name: 'Living Expenses',
      },
    },
    actor: {
      id: 'actor-1',
      name: 'User 1',
      type: 'USER',
    },
  };

  const mockActor = {
    id: 'actor-1',
    name: 'User 1',
    type: 'USER',
  };

  const mockCategory = {
    id: 'category-1',
    name: 'Food & Dining',
    parent: {
      id: 'parent-category-1',
      name: 'Living Expenses',
    },
  };

  beforeEach(async () => {
    mockPrismaClient = mockDeep<PrismaClient>();
    mockPrismaService = mockDeep<PrismaService>();
    mockActorsService = mockDeep<ActorsService>();
    mockCategoriesService = mockDeep<CategoriesService>();

    mockPrismaService.prisma = mockPrismaClient;

    // Reset all mocks before each test
    mockReset(mockPrismaService);
    mockReset(mockPrismaClient);
    mockReset(mockActorsService);
    mockReset(mockCategoriesService);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ActorsService,
          useValue: mockActorsService,
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Transaction Validation Tests', () => {
    describe('Amount Validation', () => {
      it('should reject non-integer amounts', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: 100.5, // Invalid: non-integer
          type: TransactionType.EXPENSE,
          description: 'Test transaction',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject zero amounts', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: 0, // Invalid: zero amount
          type: TransactionType.EXPENSE,
          description: 'Test transaction',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept negative amounts for expenses', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(mockTransaction),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.amount).toBe(-5000);
        expect(result.type).toBe(TransactionType.EXPENSE);
      });

      it('should accept positive amounts for income', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: 50000,
          type: TransactionType.INCOME,
          description: 'Test income',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        const incomeTransaction = {
          ...mockTransaction,
          amount: 50000,
          type: TransactionType.INCOME,
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(incomeTransaction),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.amount).toBe(50000);
        expect(result.type).toBe(TransactionType.INCOME);
      });
    });

    describe('Should Pay Business Rules', () => {
      it('should default shouldPay to true for expenses', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  shouldPay: true,
                }),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.shouldPay).toBe(true);
      });

      it('should default shouldPay to false for income', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: 50000,
          type: TransactionType.INCOME,
          description: 'Test income',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        const incomeTransaction = {
          ...mockTransaction,
          amount: 50000,
          type: TransactionType.INCOME,
          shouldPay: false,
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(incomeTransaction),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.shouldPay).toBe(false);
      });

      it('should allow explicit shouldPay override', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
          shouldPay: false, // Explicit override
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  shouldPay: false,
                }),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.shouldPay).toBe(false);
      });
    });

    describe('Category-Type Consistency', () => {
      it('should validate actor belongs to same household', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test Expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        // Mock category validation success
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);

        // Mock actor validation failure - throw error when not found
        mockActorsService.findOne.mockRejectedValue(
          new NotFoundException('Actor not found'),
        );

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should validate category belongs to same household', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test Expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        // Mock actor validation success
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock category validation failure
        mockCategoriesService.findOne.mockRejectedValue(
          new NotFoundException('Category not found'),
        );

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject transaction with non-existent actor', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test Expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'non-existent-actor',
        };

        // Mock category validation success
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);

        // Mock actor validation failure
        mockActorsService.findOne.mockRejectedValue(
          new NotFoundException('Actor not found'),
        );

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject transaction with non-existent category', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test Expense',
          date: new Date('2024-01-15'),
          categoryId: 'non-existent-category',
          actorId: 'actor-1',
        };

        // Mock actor validation success
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock category validation failure
        mockCategoriesService.findOne.mockRejectedValue(
          new NotFoundException('Category not found'),
        );

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Tag Validation', () => {
      it('should reject more than 10 tags', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test transaction',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
          tags: Array(11).fill('tag') as string[], // Invalid: 11 tags
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject tags longer than 50 characters', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test transaction',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
          tags: ['a'.repeat(51)], // Invalid: tag too long
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept valid tags', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test transaction',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
          tags: ['food', 'restaurant', 'business'],
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  tags: ['food', 'restaurant', 'business'],
                }),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.tags).toEqual(['food', 'restaurant', 'business']);
      });
    });

    describe('Date and Description Validation', () => {
      it('should reject future transaction dates', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);

        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test transaction',
          date: futureDate,
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject empty description', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: '', // Invalid: empty description
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject description longer than 500 characters', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'a'.repeat(501), // Invalid: too long
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject notes longer than 1000 characters', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Valid description',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
          notes: 'a'.repeat(1001), // Invalid: notes too long
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Transaction CRUD Tests', () => {
    describe('Create Operations', () => {
      it('should create transaction with all fields successfully', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test Expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
          tags: ['food', 'restaurant'],
          notes: 'Dinner with friends',
          shouldPay: false,
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(mockTransaction),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result).toMatchObject({
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test Expense',
          tags: ['food', 'restaurant'],
          notes: 'Dinner with friends',
          shouldPay: false,
        });
      });

      it('should create transaction with minimal required fields', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -3000,
          type: TransactionType.EXPENSE,
          description: 'Simple expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        const minimalTransaction = {
          ...mockTransaction,
          amount: -3000,
          description: 'Simple expense',
          tags: [],
          notes: null,
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(minimalTransaction),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.amount).toBe(-3000);
        expect(result.description).toBe('Simple expense');
        expect(result.tags).toEqual([]);
      });

      it('should generate source hash for duplicate detection', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock no duplicate transaction
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Mock withContext for creation
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  sourceHash: 'generated-hash',
                }),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.sourceHash).toBeDefined();
        expect(typeof result.sourceHash).toBe('string');
        expect(result.sourceHash.length).toBeGreaterThan(0);
      });

      it('should prevent duplicate transactions with same source hash', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount: -5000,
          type: TransactionType.EXPENSE,
          description: 'Test expense',
          date: new Date('2024-01-15'),
          categoryId: 'category-1',
          actorId: 'actor-1',
          sourceHash: 'existing-hash',
        };

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock duplicate transaction found
        (mockPrismaClient.transaction.findFirst as jest.Mock).mockResolvedValue(
          mockTransaction,
        );

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Read Operations', () => {
      it('should find transaction by ID with details', async () => {
        // Mock withContext for finding transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<TransactionWithDetails>,
          ) =>
            callback({
              transaction: {
                findFirst: jest
                  .fn()
                  .mockResolvedValue(mockTransactionWithDetails),
              },
            } as MockPrismaClient),
        );

        const result = await service.findOne('transaction-1', mockAuthContext);

        expect(result).toEqual(mockTransactionWithDetails);
        expect(result.category).toBeDefined();
        expect(result.actor).toBeDefined();
      });

      it('should throw NotFoundException when transaction not found', async () => {
        // Mock withContext for finding transaction (not found)
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<TransactionWithDetails | null>,
          ) =>
            callback({
              transaction: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        await expect(
          service.findOne('non-existent', mockAuthContext),
        ).rejects.toThrow(NotFoundException);
      });

      it('should find all transactions with filtering', async () => {
        const filters: TransactionFilters = {
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-01-31'),
          types: [TransactionType.EXPENSE],
        };

        const transactions = [mockTransactionWithDetails];

        // Mock withContext for finding transactions
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<TransactionWithDetails[]>,
          ) =>
            callback({
              transaction: {
                findMany: jest.fn().mockResolvedValue(transactions),
              },
            } as MockPrismaClient),
        );

        const result = await service.findAll(filters, mockAuthContext);

        expect(result).toEqual(transactions);
        expect(result).toHaveLength(1);
      });
    });

    describe('Update Operations', () => {
      it('should update transaction successfully', async () => {
        const updateTransactionDto: UpdateTransactionDto = {
          amount: -7000,
          description: 'Updated expense',
          tags: ['updated', 'expense'],
        };

        const updatedTransaction = {
          ...mockTransaction,
          amount: -7000,
          description: 'Updated expense',
          tags: ['updated', 'expense'],
        };

        // Mock withContext for finding existing transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<TransactionWithDetails>,
          ) =>
            callback({
              transaction: {
                findFirst: jest
                  .fn()
                  .mockResolvedValue(mockTransactionWithDetails),
              },
            } as MockPrismaClient),
        );

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock withContext for updating transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
          ) =>
            callback({
              transaction: {
                update: jest.fn().mockResolvedValue(updatedTransaction),
              },
            } as MockPrismaClient),
        );

        const result = await service.update(
          'transaction-1',
          updateTransactionDto,
          mockAuthContext,
        );

        expect(result.amount).toBe(-7000);
        expect(result.description).toBe('Updated expense');
        expect(result.tags).toEqual(['updated', 'expense']);
      });
    });

    describe('Delete Operations', () => {
      it('should soft delete transaction successfully', async () => {
        // Mock withContext for finding transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<TransactionWithDetails>,
          ) =>
            callback({
              transaction: {
                findFirst: jest
                  .fn()
                  .mockResolvedValue(mockTransactionWithDetails),
              },
            } as MockPrismaClient),
        );

        // Mock withContext for soft deleting transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<void>,
          ) =>
            callback({
              transaction: {
                update: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  deletedAt: new Date(),
                }),
              },
            } as MockPrismaClient),
        );

        await expect(
          service.remove('transaction-1', mockAuthContext),
        ).resolves.not.toThrow();
      });

      it('should throw NotFoundException when deleting non-existent transaction', async () => {
        // Mock withContext for finding transaction (not found)
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<TransactionWithDetails | null>,
          ) =>
            callback({
              transaction: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        await expect(
          service.remove('non-existent', mockAuthContext),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Transaction Statistics and Filtering', () => {
    it('should calculate transaction summary correctly', async () => {
      const filters: TransactionFilters = {};

      const mockSummary: TransactionSummary = {
        totalTransactions: 10,
        totalIncome: 50000,
        totalExpenses: 30000,
        netAmount: 20000,
        averageTransaction: 2000,
        incomeCount: 3,
        expenseCount: 7,
      };

      // Mock withContext for calculating summary
      mockPrismaService.withContext.mockResolvedValue(mockSummary);

      const result: TransactionSummary = await service.getTransactionSummary(
        filters,
        mockAuthContext,
      );

      expect(result.totalTransactions).toBe(mockSummary.totalTransactions);
      expect(result.totalIncome).toBe(mockSummary.totalIncome);
      expect(result.totalExpenses).toBe(mockSummary.totalExpenses);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      mockPrismaService.withContext.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const filters: TransactionFilters = {};

      await expect(service.findAll(filters, mockAuthContext)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle invalid transaction type-amount combination', async () => {
      const createTransactionDto: CreateTransactionDto = {
        amount: 5000, // Positive amount
        type: TransactionType.EXPENSE, // But marked as expense
        description: 'Invalid transaction',
        date: new Date('2024-01-15'),
        categoryId: 'category-1',
        actorId: 'actor-1',
      };

      await expect(
        service.create(createTransactionDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle concurrent transaction creation attempts', async () => {
      const createTransactionDto: CreateTransactionDto = {
        amount: -5000,
        type: TransactionType.EXPENSE,
        description: 'Test expense',
        date: new Date('2024-01-15'),
        categoryId: 'category-1',
        actorId: 'actor-1',
        sourceHash: 'concurrent-hash',
      };

      // Mock successful validation dependencies
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);
      mockActorsService.findOne.mockResolvedValue(mockActor);

      // Mock concurrent creation scenario - first call succeeds, second finds duplicate
      (mockPrismaClient.transaction.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // First check: no duplicate
        .mockResolvedValueOnce(mockTransaction); // Second check: duplicate found

      // First creation should succeed
      (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
        (
          authContext: AuthContext,
          callback: (prisma: MockPrismaClient) => Promise<MockTransaction>,
        ) =>
          callback({
            transaction: {
              create: jest.fn().mockResolvedValue(mockTransaction),
            },
          } as MockPrismaClient),
      );

      const firstResult = await service.create(
        createTransactionDto,
        mockAuthContext,
      );
      expect(firstResult).toBeDefined();

      // Second creation should fail due to duplicate
      await expect(
        service.create(createTransactionDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
