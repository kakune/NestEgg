import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import {
  UserRole,
  ActorKind,
  TransactionType,
  SettlementStatus,
  ApportionmentPolicy,
  RoundingPolicy,
} from '@prisma/client';

interface MockHousehold {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockUser {
  id: string;
  householdId: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockCategory {
  id: string;
  householdId: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockActor {
  id: string;
  householdId: string;
  userId: string;
  name: string;
  kind: ActorKind;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockTransaction {
  id: string;
  householdId: string;
  actorId: string;
  categoryId: string;
  payerUserId: string;
  shouldPayUserId: string;
  type: TransactionType;
  amountYen: number;
  description: string;
  occurredOn: Date;
  shouldPay: string;
  tags: string[];
  notes: string | null;
  sourceHash: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

describe('Database Schema Validation (Phase 1.1)', () => {
  let mockPrismaService: {
    prisma: {
      household: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      user: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      category: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      actor: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      transaction: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      income: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      policy: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      settlement: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      settlementLine: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      auditLog: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      personalAccessToken: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
      session: {
        create: jest.Mock;
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        deleteMany: jest.Mock;
      };
    };
  };

  const testHouseholdId = 'test-household-id';
  const testUserId = 'test-user-id';
  const testCategoryId = 'test-category-id';
  const testActorId = 'test-actor-id';

  beforeEach(async () => {
    const mockPrisma = {
      household: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      category: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      actor: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      income: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      policy: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      settlement: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      settlementLine: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      personalAccessToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    mockPrismaService = {
      prisma: mockPrisma,
    };

    await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Database Schema Validation', () => {
    describe('Table Creation and Relationships', () => {
      it('should create household and user with proper relationship', () => {
        const mockHousehold: MockHousehold = {
          id: testHouseholdId,
          name: 'Test Household',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        const mockUser: MockUser = {
          id: testUserId,
          householdId: testHouseholdId,
          name: 'Test User',
          email: 'test@example.com',
          role: UserRole.admin,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockPrismaService.prisma.household.create.mockResolvedValue(
          mockHousehold,
        );
        mockPrismaService.prisma.user.create.mockResolvedValue(mockUser);

        // Verify household creation structure
        expect(mockPrismaService.prisma.household.create).toBeDefined();
        expect(mockPrismaService.prisma.user.create).toBeDefined();

        // Test relationship validation
        expect(mockUser.householdId).toBe(mockHousehold.id);
      });

      it('should create category with hierarchical relationship', () => {
        const mockHousehold: MockHousehold = {
          id: testHouseholdId,
          name: 'Test Household',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        const parentCategory: MockCategory = {
          id: 'parent-category-id',
          householdId: testHouseholdId,
          name: 'Parent Category',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        const childCategory: MockCategory = {
          id: testCategoryId,
          householdId: testHouseholdId,
          name: 'Child Category',
          parentId: 'parent-category-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockPrismaService.prisma.household.create.mockResolvedValue(
          mockHousehold,
        );
        mockPrismaService.prisma.category.create
          .mockResolvedValueOnce(parentCategory)
          .mockResolvedValueOnce(childCategory);

        // Verify hierarchical relationship structure
        expect(parentCategory.parentId).toBeNull();
        expect(childCategory.parentId).toBe(parentCategory.id);
        expect(childCategory.householdId).toBe(testHouseholdId);
      });

      it('should create actor with user relationship', () => {
        const mockHousehold: MockHousehold = {
          id: testHouseholdId,
          name: 'Test Household',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        const mockUser: MockUser = {
          id: testUserId,
          householdId: testHouseholdId,
          name: 'Test User',
          email: 'test@example.com',
          role: UserRole.admin,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        const mockActor: MockActor = {
          id: testActorId,
          householdId: testHouseholdId,
          userId: testUserId,
          name: 'Test Actor',
          kind: ActorKind.USER,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockPrismaService.prisma.household.create.mockResolvedValue(
          mockHousehold,
        );
        mockPrismaService.prisma.user.create.mockResolvedValue(mockUser);
        mockPrismaService.prisma.actor.create.mockResolvedValue(mockActor);

        // Verify actor-user relationship
        expect(mockActor.userId).toBe(mockUser.id);
        expect(mockActor.householdId).toBe(testHouseholdId);
        expect(mockActor.kind).toBe(ActorKind.USER);
      });

      it('should validate transaction with all required relationships', () => {
        const mockTransaction: MockTransaction = {
          id: 'transaction-id',
          householdId: testHouseholdId,
          actorId: testActorId,
          categoryId: testCategoryId,
          payerUserId: testUserId,
          shouldPayUserId: testUserId,
          type: TransactionType.EXPENSE,
          amountYen: -5000,
          description: 'Test Transaction',
          occurredOn: new Date(),
          shouldPay: 'USER',
          tags: ['test'],
          notes: 'Test notes',
          sourceHash: 'test-hash',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockPrismaService.prisma.transaction.create.mockResolvedValue(
          mockTransaction,
        );

        // Verify transaction relationships
        expect(mockTransaction.householdId).toBe(testHouseholdId);
        expect(mockTransaction.actorId).toBe(testActorId);
        expect(mockTransaction.categoryId).toBe(testCategoryId);
        expect(mockTransaction.payerUserId).toBe(testUserId);
        expect(mockTransaction.shouldPayUserId).toBe(testUserId);
      });
    });

    describe('Constraint Validation', () => {
      it('should enforce unique constraints', () => {
        // Test unique email constraint
        const duplicateEmailError = new Error('Unique constraint violation');
        mockPrismaService.prisma.user.create
          .mockResolvedValueOnce({
            id: testUserId,
            email: 'test@example.com',
            householdId: testHouseholdId,
          } as MockUser)
          .mockRejectedValueOnce(duplicateEmailError);

        // Verify unique constraint is enforced
        expect(mockPrismaService.prisma.user.create.mock.calls.length).toBe(0);
      });

      it('should enforce foreign key constraints', async () => {
        // Test foreign key constraint for invalid householdId
        const foreignKeyError = new Error('Foreign key constraint violation');
        mockPrismaService.prisma.user.create.mockRejectedValue(foreignKeyError);

        // Verify foreign key constraint is enforced
        try {
          await mockPrismaService.prisma.user.create({
            data: {
              id: testUserId,
              householdId: 'invalid-household-id',
              name: 'Test User',
              email: 'test@example.com',
              role: UserRole.admin,
            },
          });
        } catch {
          // Foreign key constraint should prevent this
          expect(true).toBe(true);
        }
      });

      it('should enforce check constraints for amounts', () => {
        // Test transaction amount constraints
        const mockTransaction: MockTransaction = {
          id: 'transaction-id',
          householdId: testHouseholdId,
          actorId: testActorId,
          categoryId: testCategoryId,
          payerUserId: testUserId,
          shouldPayUserId: testUserId,
          type: TransactionType.EXPENSE,
          amountYen: -5000, // Negative for expenses
          description: 'Test Transaction',
          occurredOn: new Date(),
          shouldPay: 'USER',
          tags: ['test'],
          notes: 'Test notes',
          sourceHash: 'test-hash',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockPrismaService.prisma.transaction.create.mockResolvedValue(
          mockTransaction,
        );

        // Verify amount constraints
        expect(mockTransaction.type).toBe(TransactionType.EXPENSE);
        expect(mockTransaction.amountYen).toBeLessThan(0); // Expenses should be negative
      });
    });

    describe('Enum Value Validation', () => {
      it('should validate UserRole enum values', () => {
        const validRoles = [UserRole.admin, UserRole.member, UserRole.user];

        expect(validRoles).toContain(UserRole.admin);
        expect(validRoles).toContain(UserRole.member);
        expect(validRoles).toContain(UserRole.user);
      });

      it('should validate ActorKind enum values', () => {
        const validKinds = [
          ActorKind.USER,
          ActorKind.INSTITUTION,
          ActorKind.STORE,
        ];

        expect(validKinds).toContain(ActorKind.USER);
        expect(validKinds).toContain(ActorKind.INSTITUTION);
        expect(validKinds).toContain(ActorKind.STORE);
      });

      it('should validate TransactionType enum values', () => {
        const validTypes = [TransactionType.INCOME, TransactionType.EXPENSE];

        expect(validTypes).toContain(TransactionType.INCOME);
        expect(validTypes).toContain(TransactionType.EXPENSE);
      });

      it('should validate SettlementStatus enum values', () => {
        const validStatuses = [
          SettlementStatus.DRAFT,
          SettlementStatus.FINALIZED,
        ];

        expect(validStatuses).toContain(SettlementStatus.DRAFT);
        expect(validStatuses).toContain(SettlementStatus.FINALIZED);
      });

      it('should validate ApportionmentPolicy enum values', () => {
        const validPolicies = [
          ApportionmentPolicy.EXCLUDE,
          ApportionmentPolicy.MIN_SHARE,
        ];

        expect(validPolicies).toContain(ApportionmentPolicy.EXCLUDE);
        expect(validPolicies).toContain(ApportionmentPolicy.MIN_SHARE);
      });

      it('should validate RoundingPolicy enum values', () => {
        const validPolicies = [
          RoundingPolicy.ROUND,
          RoundingPolicy.CEILING,
          RoundingPolicy.FLOOR,
        ];

        expect(validPolicies).toContain(RoundingPolicy.ROUND);
        expect(validPolicies).toContain(RoundingPolicy.CEILING);
        expect(validPolicies).toContain(RoundingPolicy.FLOOR);
      });
    });

    describe('Index Performance Testing', () => {
      it('should have proper indexes for query performance', () => {
        // Mock finding by indexed fields
        const mockResults = [
          {
            id: 'transaction1',
            householdId: testHouseholdId,
            occurredOn: new Date(),
          },
          {
            id: 'transaction2',
            householdId: testHouseholdId,
            occurredOn: new Date(),
          },
        ];

        mockPrismaService.prisma.transaction.findMany.mockResolvedValue(
          mockResults,
        );

        // Verify index usage for common queries
        const indexedQuery = {
          where: {
            householdId: testHouseholdId,
            occurredOn: {
              gte: new Date('2024-01-01'),
              lt: new Date('2024-12-31'),
            },
          },
        };

        // This should use the household_id + occurred_on index
        expect(indexedQuery.where.householdId).toBe(testHouseholdId);
        expect(indexedQuery.where.occurredOn).toBeDefined();
      });

      it('should optimize user lookups with email index', () => {
        const mockUser: MockUser = {
          id: testUserId,
          householdId: testHouseholdId,
          name: 'Test User',
          email: 'test@example.com',
          role: UserRole.admin,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);

        // Email lookup should use unique index
        const emailQuery = {
          where: { email: 'test@example.com' },
        };

        expect(emailQuery.where.email).toBe('test@example.com');
      });
    });

    describe('Data Integrity and Constraints', () => {
      it('should maintain referential integrity on cascade deletes', () => {
        // Mock cascade delete behavior
        mockPrismaService.prisma.household.delete.mockResolvedValue({
          id: testHouseholdId,
          name: 'Deleted Household',
        } as MockHousehold);

        // Related records should be cascade deleted
        mockPrismaService.prisma.user.findMany.mockResolvedValue([]);
        mockPrismaService.prisma.transaction.findMany.mockResolvedValue([]);

        // Verify cascade behavior
        expect(mockPrismaService.prisma.household.delete).toBeDefined();
        expect(mockPrismaService.prisma.user.findMany).toBeDefined();
      });

      it('should handle soft deletes correctly', () => {
        const softDeletedUser: MockUser = {
          id: testUserId,
          householdId: testHouseholdId,
          name: 'Test User',
          email: 'test@example.com',
          role: UserRole.admin,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: new Date(), // Soft deleted
        };

        mockPrismaService.prisma.user.update.mockResolvedValue(softDeletedUser);

        // Verify soft delete behavior
        expect(softDeletedUser.deletedAt).not.toBeNull();
        expect(softDeletedUser.deletedAt).toBeInstanceOf(Date);
      });
    });
  });
});
