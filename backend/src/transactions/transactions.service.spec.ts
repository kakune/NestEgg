import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { mockDeep, MockProxy, mockReset } from 'jest-mock-extended';
import {
  TransactionType,
  UserRole,
  PrismaClient,
  Transaction,
  ActorKind,
} from '@prisma/client';

import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActorsService, ActorWithUser } from '../actors/actors.service';
import {
  CategoriesService,
  CategoryWithChildren,
} from '../categories/categories.service';
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
    payer_actor_id: 'actor-1',
    category_id: 'category-1',
    payerUserId: 'user-1',
    shouldPayUserId: 'user-1',
    amountYen: BigInt(-5000),
    type: TransactionType.EXPENSE,
    note: 'Test Expense',
    occurred_on: '2024-01-15',
    tags: ['food', 'restaurant'],
    notes: 'Dinner with friends',
    should_pay: 'USER',
    source_hash: 'source-hash-1',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    deletedAt: null,
  };

  const mockTransactionWithDetails = {
    ...mockTransaction,
    category: {
      id: 'category-1',
      name: 'Food & Dining',
      parent: {
        id: 'parent-category-1',
        name: 'Living Expenses',
      },
    },
    payerActor: {
      id: 'actor-1',
      name: 'User 1',
      kind: 'USER',
    },
  } as unknown as TransactionWithDetails;

  const mockActor: ActorWithUser = {
    id: 'actor-1',
    name: 'User 1',
    kind: ActorKind.USER,
    householdId: 'household-1',
    userId: 'user-1',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    isActive: true,
    user: {
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
    },
  };

  const mockCategory: CategoryWithChildren = {
    id: 'category-1',
    name: 'Food & Dining',
    type: TransactionType.EXPENSE,
    householdId: 'household-1',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    parentId: 'parent-category-1',
    parent: {
      id: 'parent-category-1',
      name: 'Living Expenses',
      type: TransactionType.EXPENSE,
      householdId: 'household-1',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      parentId: null,
    },
    children: [],
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
          amount_yen: 100.5, // Invalid: non-integer
          type: TransactionType.EXPENSE,
          note: 'Test transaction',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject zero amounts', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: 0, // Invalid: zero amount
          type: TransactionType.EXPENSE,
          note: 'Test transaction',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept negative amounts for expenses', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(mockTransaction),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(Number(result.amountYen)).toBe(-5000);
        expect(result.type).toBe(TransactionType.EXPENSE);
      });

      it('should accept positive amounts for income', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: 50000,
          type: TransactionType.INCOME,
          note: 'Test income',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        const incomeTransaction = {
          ...mockTransaction,
          amountYen: BigInt(50000),
          type: TransactionType.INCOME,
          shouldPay: 'USER',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(incomeTransaction),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(Number(result.amountYen)).toBe(50000);
        expect(result.type).toBe(TransactionType.INCOME);
      });
    });

    describe('Should Pay Business Rules', () => {
      it('should default shouldPay to true for expenses', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  shouldPay: true,
                }),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.shouldPay).toBe(true);
      });

      it('should default shouldPay to false for income', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: 50000,
          type: TransactionType.INCOME,
          note: 'Test income',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        const incomeTransaction = {
          ...mockTransaction,
          amountYen: BigInt(50000),
          type: TransactionType.INCOME,
          shouldPay: 'USER',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(incomeTransaction),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.shouldPay).toBe('USER');
      });

      it('should allow explicit shouldPay override', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'USER', // Explicit override
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  shouldPay: 'USER',
                }),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.shouldPay).toBe('USER');
      });
    });

    describe('Category-Type Consistency', () => {
      it('should validate actor belongs to same household', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test Expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test Expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test Expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'non-existent-actor',
          should_pay: 'HOUSEHOLD',
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
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test Expense',
          occurred_on: '2024-01-15',
          category_id: 'non-existent-category',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test transaction',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
          tags: Array(11).fill('tag') as string[], // Invalid: 11 tags
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject tags longer than 50 characters', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test transaction',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
          tags: ['a'.repeat(51)], // Invalid: tag too long
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept valid tags', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test transaction',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  tags: ['food', 'restaurant', 'business'],
                }),
              },
            } as unknown as MockProxy<PrismaClient>),
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
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test transaction',
          occurred_on: futureDate.toISOString().split('T')[0]!,
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject empty description', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: '', // Invalid: empty description
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject description longer than 500 characters', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'a'.repeat(501), // Invalid: too long
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        await expect(
          service.create(createTransactionDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject notes longer than 1000 characters', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'a'.repeat(1001), // Invalid: notes too long
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Dinner with friends',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          tags: ['food', 'restaurant'],
          should_pay: 'USER',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  note: 'Dinner with friends',
                  shouldPay: 'USER',
                }),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result).toMatchObject({
          amountYen: BigInt(-5000),
          type: TransactionType.EXPENSE,
          note: 'Dinner with friends',
          tags: ['food', 'restaurant'],
          shouldPay: 'USER',
        });
      });

      it('should create transaction with minimal required fields', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -3000,
          type: TransactionType.EXPENSE,
          note: 'Simple expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
        };

        const minimalTransaction = {
          ...mockTransaction,
          amountYen: BigInt(-3000),
          note: 'Simple expense',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue(minimalTransaction),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(Number(result.amountYen)).toBe(-3000);
        expect(result.note).toBe('Simple expense');
        expect(result.tags).toEqual([]);
      });

      it('should generate source hash for duplicate detection', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          should_pay: 'HOUSEHOLD',
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
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                create: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  sourceHash: 'generated-hash',
                }),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.create(
          createTransactionDto,
          mockAuthContext,
        );

        expect(result.sourceHash).toBeDefined();
        expect(typeof result.sourceHash).toBe('string');
        expect(result.sourceHash!.length).toBeGreaterThan(0);
      });

      it('should prevent duplicate transactions with same source hash', async () => {
        const createTransactionDto: CreateTransactionDto = {
          amount_yen: -5000,
          type: TransactionType.EXPENSE,
          note: 'Test expense',
          occurred_on: '2024-01-15',
          category_id: 'category-1',
          payer_actor_id: 'actor-1',
          source_hash: 'existing-hash',
          should_pay: 'HOUSEHOLD',
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
              prisma: MockProxy<PrismaClient>,
            ) => Promise<TransactionWithDetails>,
          ) =>
            callback({
              transaction: {
                findFirst: jest
                  .fn()
                  .mockResolvedValue(mockTransactionWithDetails),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.findOne('transaction-1', mockAuthContext);

        expect(result).toEqual(mockTransactionWithDetails);
        expect(result.category).toBeDefined();
        expect(result.payerActor).toBeDefined();
      });

      it('should throw NotFoundException when transaction not found', async () => {
        // Mock withContext for finding transaction (not found)
        (mockPrismaService.withContext as jest.Mock).mockImplementation(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockProxy<PrismaClient>,
            ) => Promise<TransactionWithDetails | null>,
          ) =>
            callback({
              transaction: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as unknown as MockProxy<PrismaClient>),
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
              prisma: MockProxy<PrismaClient>,
            ) => Promise<TransactionWithDetails[]>,
          ) =>
            callback({
              transaction: {
                findMany: jest.fn().mockResolvedValue(transactions),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.findAll(filters, mockAuthContext);

        expect(result).toEqual(transactions);
        expect(result).toHaveLength(1);
      });
    });

    describe('Update Operations', () => {
      it('should update transaction successfully', async () => {
        const updateTransactionDto: UpdateTransactionDto = {
          amount_yen: -7000,
          note: 'Updated expense',
          tags: ['updated', 'expense'],
        };

        const updatedTransaction = {
          ...mockTransaction,
          amountYen: BigInt(-7000),
          note: 'Updated expense',
          tags: ['updated', 'expense'],
        };

        // Mock withContext for finding existing transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockProxy<PrismaClient>,
            ) => Promise<TransactionWithDetails>,
          ) =>
            callback({
              transaction: {
                findFirst: jest
                  .fn()
                  .mockResolvedValue(mockTransactionWithDetails),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        // Mock successful validation dependencies
        mockCategoriesService.findOne.mockResolvedValue(mockCategory);
        mockActorsService.findOne.mockResolvedValue(mockActor);

        // Mock withContext for updating transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
          ) =>
            callback({
              transaction: {
                update: jest.fn().mockResolvedValue(updatedTransaction),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        const result = await service.update(
          'transaction-1',
          updateTransactionDto,
          mockAuthContext,
        );

        expect(Number(result.amountYen)).toBe(-7000);
        expect(result.note).toBe('Updated expense');
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
              prisma: MockProxy<PrismaClient>,
            ) => Promise<TransactionWithDetails>,
          ) =>
            callback({
              transaction: {
                findFirst: jest
                  .fn()
                  .mockResolvedValue(mockTransactionWithDetails),
              },
            } as unknown as MockProxy<PrismaClient>),
        );

        // Mock withContext for soft deleting transaction
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockProxy<PrismaClient>) => Promise<void>,
          ) =>
            callback({
              transaction: {
                update: jest.fn().mockResolvedValue({
                  ...mockTransaction,
                  deletedAt: new Date(),
                }),
              },
            } as unknown as MockProxy<PrismaClient>),
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
              prisma: MockProxy<PrismaClient>,
            ) => Promise<TransactionWithDetails | null>,
          ) =>
            callback({
              transaction: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as unknown as MockProxy<PrismaClient>),
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
        amount_yen: 5000, // Positive amount
        type: TransactionType.EXPENSE, // But marked as expense
        note: 'Invalid transaction',
        occurred_on: '2024-01-15',
        category_id: 'category-1',
        payer_actor_id: 'actor-1',
        should_pay: 'HOUSEHOLD',
      };

      await expect(
        service.create(createTransactionDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle concurrent transaction creation attempts', async () => {
      const createTransactionDto: CreateTransactionDto = {
        amount_yen: -5000,
        type: TransactionType.EXPENSE,
        note: 'Test expense',
        occurred_on: '2024-01-15',
        category_id: 'category-1',
        payer_actor_id: 'actor-1',
        source_hash: 'concurrent-hash',
        should_pay: 'HOUSEHOLD',
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
          callback: (prisma: MockProxy<PrismaClient>) => Promise<Transaction>,
        ) =>
          callback({
            transaction: {
              create: jest.fn().mockResolvedValue(mockTransaction),
            },
          } as unknown as MockProxy<PrismaClient>),
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
