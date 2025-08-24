import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserRole } from '@prisma/client';

import { IncomesService } from './incomes.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateIncomeDto,
  UpdateIncomeDto,
  IncomeFilters,
  IncomeWithDetails,
} from './incomes.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';

interface MockIncome {
  id: string;
  userId: string;
  householdId: string;
  grossIncomeYen: number;
  deductionYen: number;
  allocatableYen: number;
  year: number;
  month: number;
  description?: string;
  sourceDocument?: string;
  sourceHash?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

interface MockPrismaClient {
  income: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
}

describe('IncomesService (Phase 3.2)', () => {
  let service: IncomesService;
  let mockPrismaService: {
    withContext: jest.Mock;
    prisma: {
      income: {
        findMany: jest.Mock;
        findUnique: jest.Mock;
        findFirst: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
        count: jest.Mock;
        aggregate: jest.Mock;
        groupBy: jest.Mock;
      };
      user: {
        findUnique: jest.Mock;
        findMany: jest.Mock;
        findFirst: jest.Mock;
      };
    };
  };

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    householdId: 'household-1',
    role: UserRole.admin,
  };

  const mockMemberAuthContext: AuthContext = {
    userId: 'member-user',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockIncome: MockIncome = {
    id: 'income-1',
    userId: 'user-1',
    householdId: 'household-1',
    grossIncomeYen: 500000,
    deductionYen: 120000,
    allocatableYen: 380000,
    year: 2024,
    month: 1,
    description: 'January 2024 Salary',
    sourceDocument: 'payroll-jan-2024.pdf',
    sourceHash: 'hash-jan-2024',
    createdAt: new Date('2024-01-01T09:00:00Z'),
    updatedAt: new Date('2024-01-01T09:00:00Z'),
    deletedAt: null,
  };

  const mockIncomeWithDetails: IncomeWithDetails = {
    ...mockIncome,
    user: {
      id: 'user-1',
      name: 'John Doe',
      email: 'john.doe@example.com',
    },
  };

  const mockUser = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    householdId: 'household-1',
    role: UserRole.admin,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockPrisma = {
      income: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    mockPrismaService = {
      withContext: jest.fn(),
      prisma: mockPrisma,
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        IncomesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IncomesService>(IncomesService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Income Calculation Tests', () => {
    describe('Allocatable Yen Computation', () => {
      it('should calculate allocatable_yen correctly on creation', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 600000,
          deductionYen: 150000,
          year: 2024,
          month: 2,
          description: 'February 2024 Salary',
        };

        const expectedIncome: MockIncome = {
          ...mockIncome,
          id: 'income-2',
          grossIncomeYen: 600000,
          deductionYen: 150000,
          allocatableYen: 450000, // 600000 - 150000
          month: 2,
          description: 'February 2024 Salary',
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(mockUser);

        // Mock withContext for checking existing income (none found)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        // Mock withContext for creating income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(result.allocatableYen).toBe(450000);
        expect(result.grossIncomeYen - result.deductionYen).toBe(
          result.allocatableYen,
        );
      });

      it('should recalculate allocatable_yen on update', async () => {
        const updateIncomeDto: UpdateIncomeDto = {
          grossIncomeYen: 550000,
          deductionYen: 130000,
        };

        const updatedIncome: MockIncome = {
          ...mockIncome,
          grossIncomeYen: 550000,
          deductionYen: 130000,
          allocatableYen: 420000, // 550000 - 130000
        };

        // Mock withContext for finding existing income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncome),
              },
            } as MockPrismaClient),
        );

        // Mock withContext for the actual update
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                update: jest.fn().mockResolvedValue(updatedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.update(
          'income-1',
          updateIncomeDto,
          mockAuthContext,
        );

        expect(result.allocatableYen).toBe(420000);
        expect(result.grossIncomeYen - result.deductionYen).toBe(
          result.allocatableYen,
        );
      });

      it('should handle zero deductions correctly', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 400000,
          deductionYen: 0,
          year: 2024,
          month: 3,
        };

        const expectedIncome: MockIncome = {
          ...mockIncome,
          grossIncomeYen: 400000,
          deductionYen: 0,
          allocatableYen: 400000,
          month: 3,
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(mockUser);

        // Mock withContext for checking existing income (none found)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        // Mock withContext for creating income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(result.allocatableYen).toBe(400000);
        expect(result.deductionYen).toBe(0);
      });

      it('should handle maximum deduction scenarios', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 300000,
          deductionYen: 300000, // Full deduction
          year: 2024,
          month: 4,
        };

        const expectedIncome: MockIncome = {
          ...mockIncome,
          grossIncomeYen: 300000,
          deductionYen: 300000,
          allocatableYen: 0, // 300000 - 300000
          month: 4,
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(mockUser);

        // Mock withContext for checking existing income (none found)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        // Mock withContext for creating income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(result.allocatableYen).toBe(0);
      });
    });

    describe('Deduction Validation Rules', () => {
      it('should reject negative gross income', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: -100000, // Invalid: negative income
          deductionYen: 50000,
          year: 2024,
          month: 1,
        };

        await expect(
          service.create(createIncomeDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject negative deductions', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 400000,
          deductionYen: -50000, // Invalid: negative deduction
          year: 2024,
          month: 1,
        };

        await expect(
          service.create(createIncomeDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject deductions exceeding gross income', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 300000,
          deductionYen: 400000, // Invalid: deduction > income
          year: 2024,
          month: 1,
        };

        await expect(
          service.create(createIncomeDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should validate reasonable income ranges', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 50000000, // 50M yen (very high but possible)
          deductionYen: 5000000,
          year: 2024,
          month: 1,
        };

        const expectedIncome: MockIncome = {
          ...mockIncome,
          grossIncomeYen: 50000000,
          deductionYen: 5000000,
          allocatableYen: 45000000,
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(mockUser);

        // Mock withContext for checking existing income (none found)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        // Mock withContext for creating income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(result.grossIncomeYen).toBe(50000000);
        expect(result.allocatableYen).toBe(45000000);
      });
    });

    describe('Monthly Uniqueness Constraints', () => {
      it('should prevent duplicate income entries for same user and month', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 400000,
          deductionYen: 80000,
          year: 2024,
          month: 1, // Same month as existing income
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(mockUser);

        // Mock withContext for checking existing income (found existing)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncome), // Found existing
              },
            } as MockPrismaClient),
        );

        await expect(
          service.create(createIncomeDto, mockAuthContext),
        ).rejects.toThrow(ConflictException);
      });

      it('should allow multiple users to have income for same month', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-2', // Different user
          grossIncomeYen: 450000,
          deductionYen: 90000,
          year: 2024,
          month: 1, // Same month as existing income for user-1
        };

        const newUser = {
          id: 'user-2',
          name: 'Jane Doe',
          email: 'jane.doe@example.com',
          householdId: 'household-1',
          role: UserRole.member,
        };

        const expectedIncome: MockIncome = {
          ...mockIncome,
          id: 'income-user2',
          userId: 'user-2',
          grossIncomeYen: 450000,
          deductionYen: 90000,
          allocatableYen: 360000,
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(newUser);

        // Mock withContext for checking existing income (none found for user-2)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null), // No existing for user-2
              },
            } as MockPrismaClient),
        );

        // Mock withContext for creating income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(result.userId).toBe('user-2');
        expect(result.allocatableYen).toBe(360000);
      });

      it('should allow same user to have income for different months', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 420000,
          deductionYen: 85000,
          year: 2024,
          month: 2, // Different month
        };

        const expectedIncome: MockIncome = {
          ...mockIncome,
          id: 'income-feb',
          month: 2,
          grossIncomeYen: 420000,
          deductionYen: 85000,
          allocatableYen: 335000,
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(mockUser);

        // Mock withContext for checking existing income (none found for February)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null), // No existing for February
              },
            } as MockPrismaClient),
        );

        // Mock withContext for creating income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(result.userId).toBe('user-1');
        expect(result.month).toBe(2);
      });
    });

    describe('User-Household Consistency', () => {
      it('should enforce user belongs to same household', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-other-household',
          grossIncomeYen: 400000,
          deductionYen: 80000,
          year: 2024,
          month: 1,
        };

        // Mock direct prisma access for user validation (user not found)
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(null);

        await expect(
          service.create(createIncomeDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject income creation for non-existent user', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'non-existent-user',
          grossIncomeYen: 400000,
          deductionYen: 80000,
          year: 2024,
          month: 1,
        };

        // Mock direct prisma access for user validation (user not found)
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(null);

        await expect(
          service.create(createIncomeDto, mockAuthContext),
        ).rejects.toThrow(BadRequestException);
      });

      it('should allow admin to create income for any household member', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'household-member',
          grossIncomeYen: 350000,
          deductionYen: 70000,
          year: 2024,
          month: 3,
        };

        const householdMember = {
          ...mockUser,
          id: 'household-member',
          name: 'Household Member',
          role: UserRole.member,
        };

        const expectedIncome: MockIncome = {
          ...mockIncome,
          userId: 'household-member',
          grossIncomeYen: 350000,
          deductionYen: 70000,
          allocatableYen: 280000,
          month: 3,
        };

        // Mock direct prisma access for user validation
        mockPrismaService.prisma.user.findFirst.mockResolvedValue(
          householdMember,
        );

        // Mock withContext for checking existing income (none found)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        // Mock withContext for creating income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(result.userId).toBe('household-member');
        expect(result.allocatableYen).toBe(280000);
      });

      it('should prevent non-admin from creating income for other users', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'other-user', // Different from member-user
          grossIncomeYen: 350000,
          deductionYen: 70000,
          year: 2024,
          month: 3,
        };

        await expect(
          service.create(createIncomeDto, mockMemberAuthContext),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Income CRUD Operations', () => {
    describe('Read Operations', () => {
      it('should find income by ID with user details', async () => {
        // Mock withContext for finding income
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<IncomeWithDetails>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncomeWithDetails),
              },
            } as MockPrismaClient),
        );

        const result = await service.findOne('income-1', mockAuthContext);

        expect(result).toEqual(mockIncomeWithDetails);
        expect(result.user).toBeDefined();
        expect(result.user.name).toBe('John Doe');
        expect(result.user.email).toBe('john.doe@example.com');
      });

      it('should throw NotFoundException when income not found', async () => {
        // Mock withContext for finding income (none found)
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<IncomeWithDetails | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            } as MockPrismaClient),
        );

        await expect(
          service.findOne('non-existent', mockAuthContext),
        ).rejects.toThrow(NotFoundException);
      });

      it('should find income by user and month', async () => {
        // Mock withContext for finding income by user and month
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: MockPrismaClient) => Promise<MockIncome>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncome),
              },
            } as MockPrismaClient),
        );

        const result = await service.findByUserAndMonth(
          'user-1',
          2024,
          1,
          mockAuthContext,
        );

        expect(result).toEqual(mockIncome);
      });

      it('should find all incomes with proper filtering', async () => {
        const filters: IncomeFilters = {
          year: 2024,
        };

        const incomes = [mockIncomeWithDetails];

        // Mock withContext for finding filtered incomes
        mockPrismaService.withContext.mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (
              prisma: MockPrismaClient,
            ) => Promise<IncomeWithDetails[]>,
          ) =>
            callback({
              income: {
                findMany: jest.fn().mockResolvedValue(incomes),
              },
            } as MockPrismaClient),
        );

        const result = await service.findAll(filters, mockAuthContext);

        expect(result).toEqual(incomes);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      mockPrismaService.withContext.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const filters: IncomeFilters = {};

      await expect(service.findAll(filters, mockAuthContext)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle invalid date inputs', async () => {
      const createIncomeDto: CreateIncomeDto = {
        userId: 'user-1',
        grossIncomeYen: 500000,
        deductionYen: 120000,
        year: -1, // Invalid year
        month: 1,
      };

      await expect(
        service.create(createIncomeDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid month inputs', async () => {
      const createIncomeDto: CreateIncomeDto = {
        userId: 'user-1',
        grossIncomeYen: 500000,
        deductionYen: 120000,
        year: 2024,
        month: 13, // Invalid month
      };

      await expect(
        service.create(createIncomeDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
