import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { mockDeep, MockProxy, mockReset } from 'jest-mock-extended';
import { UserRole, PrismaClient } from '@prisma/client';

import { IncomesService } from './incomes.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateIncomeDto,
  UpdateIncomeDto,
  IncomeFilters,
  IncomeWithDetails,
} from './incomes.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';

describe('IncomesService (Phase 3.2)', () => {
  let service: IncomesService;
  let mockPrismaService: MockProxy<PrismaService>;
  let mockPrismaClient: MockProxy<PrismaClient>;

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

  const mockIncome = {
    id: 'income-1',
    userId: 'user-1',
    householdId: 'household-1',
    grossYen: BigInt(500000),
    deductionTaxYen: BigInt(120000),
    deductionSocialYen: BigInt(0),
    deductionOtherYen: BigInt(0),
    allocatableYen: BigInt(380000),
    month: new Date(2024, 0, 1), // January 2024
    createdAt: new Date('2024-01-01T09:00:00Z'),
    updatedAt: new Date('2024-01-01T09:00:00Z'),
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
    mockPrismaClient = mockDeep<PrismaClient>();
    mockPrismaService = mockDeep<PrismaService>();

    mockPrismaService.prisma = mockPrismaClient;

    // Reset all mocks before each test
    mockReset(mockPrismaService);
    mockReset(mockPrismaClient);

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

        const expectedIncome = {
          ...mockIncome,
          id: 'income-2',
          grossYen: BigInt(600000),
          deductionTaxYen: BigInt(150000),
          allocatableYen: BigInt(450000), // 600000 - 150000
          month: new Date(2024, 1, 1), // February 2024
          description: 'February 2024 Salary',
        };

        // Mock direct prisma access for user validation
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          mockUser,
        );

        // Mock withContext for checking existing income (none found)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            }),
        );

        // Mock withContext for creating income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            }),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(Number(result.allocatableYen)).toBe(450000);
        expect(Number(result.grossYen) - Number(result.deductionTaxYen)).toBe(
          Number(result.allocatableYen),
        );
      });

      it('should recalculate allocatable_yen on update', async () => {
        const updateIncomeDto: UpdateIncomeDto = {
          grossIncomeYen: 550000,
          deductionYen: 130000,
        };

        const updatedIncome = {
          ...mockIncome,
          grossYen: BigInt(550000),
          deductionTaxYen: BigInt(130000),
          allocatableYen: BigInt(420000), // 550000 - 130000
        };

        // Mock withContext for finding existing income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncome),
              },
            }),
        );

        // Mock withContext for the actual update
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                update: jest.fn().mockResolvedValue(updatedIncome),
              },
            }),
        );

        const result = await service.update(
          'income-1',
          updateIncomeDto,
          mockAuthContext,
        );

        expect(Number(result.allocatableYen)).toBe(420000);
        expect(Number(result.grossYen) - Number(result.deductionTaxYen)).toBe(
          Number(result.allocatableYen),
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

        const expectedIncome = {
          ...mockIncome,
          grossYen: BigInt(400000),
          deductionTaxYen: BigInt(0),
          allocatableYen: BigInt(400000),
          month: new Date(2024, 2, 1), // March 2024
        };

        // Mock direct prisma access for user validation
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          mockUser,
        );

        // Mock withContext for checking existing income (none found)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            }),
        );

        // Mock withContext for creating income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            }),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(Number(result.allocatableYen)).toBe(400000);
        expect(Number(result.deductionTaxYen)).toBe(0);
      });

      it('should handle maximum deduction scenarios', async () => {
        const createIncomeDto: CreateIncomeDto = {
          userId: 'user-1',
          grossIncomeYen: 300000,
          deductionYen: 300000, // Full deduction
          year: 2024,
          month: 4,
        };

        const expectedIncome = {
          ...mockIncome,
          grossIncomeYen: 300000,
          deductionYen: 300000,
          allocatableYen: 0, // 300000 - 300000
          month: 4,
        };

        // Mock direct prisma access for user validation
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          mockUser,
        );

        // Mock withContext for checking existing income (none found)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            }),
        );

        // Mock withContext for creating income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            }),
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

        const expectedIncome = {
          ...mockIncome,
          grossYen: BigInt(50000000),
          deductionTaxYen: BigInt(5000000),
          allocatableYen: BigInt(45000000),
        };

        // Mock direct prisma access for user validation
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          mockUser,
        );

        // Mock withContext for checking existing income (none found)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            }),
        );

        // Mock withContext for creating income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            }),
        );

        const result = await service.create(createIncomeDto, mockAuthContext);

        expect(Number(result.grossYen)).toBe(50000000);
        expect(Number(result.allocatableYen)).toBe(45000000);
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
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          mockUser,
        );

        // Mock withContext for checking existing income (found existing)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncome), // Found existing
              },
            }),
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

        const expectedIncome = {
          ...mockIncome,
          id: 'income-user2',
          userId: 'user-2',
          grossIncomeYen: 450000,
          deductionYen: 90000,
          allocatableYen: 360000,
        };

        // Mock direct prisma access for user validation
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          newUser,
        );

        // Mock withContext for checking existing income (none found for user-2)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null), // No existing for user-2
              },
            }),
        );

        // Mock withContext for creating income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            }),
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

        const expectedIncome = {
          ...mockIncome,
          id: 'income-feb',
          month: 2,
          grossIncomeYen: 420000,
          deductionYen: 85000,
          allocatableYen: 335000,
        };

        // Mock direct prisma access for user validation
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          mockUser,
        );

        // Mock withContext for checking existing income (none found for February)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null), // No existing for February
              },
            }),
        );

        // Mock withContext for creating income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            }),
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
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);

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
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);

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

        const expectedIncome = {
          ...mockIncome,
          userId: 'household-member',
          grossIncomeYen: 350000,
          deductionYen: 70000,
          allocatableYen: 280000,
          month: 3,
        };

        // Mock direct prisma access for user validation
        (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
          householdMember,
        );

        // Mock withContext for checking existing income (none found)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            }),
        );

        // Mock withContext for creating income
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                create: jest.fn().mockResolvedValue(expectedIncome),
              },
            }),
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
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncomeWithDetails),
              },
            }),
        );

        const result = await service.findOne('income-1', mockAuthContext);

        expect(result).toEqual(mockIncomeWithDetails);
        expect(result.user).toBeDefined();
        expect(result.user.name).toBe('John Doe');
        expect(result.user.email).toBe('john.doe@example.com');
      });

      it('should throw NotFoundException when income not found', async () => {
        // Mock withContext for finding income (none found)
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: any) => Promise<IncomeWithDetails | null>,
          ) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(null),
              },
            }),
        );

        await expect(
          service.findOne('non-existent', mockAuthContext),
        ).rejects.toThrow(NotFoundException);
      });

      it('should find income by user and month', async () => {
        // Mock withContext for finding income by user and month
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (authContext: AuthContext, callback: (prisma: any) => Promise<any>) =>
            callback({
              income: {
                findFirst: jest.fn().mockResolvedValue(mockIncome),
              },
            }),
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
        (mockPrismaService.withContext as jest.Mock).mockImplementationOnce(
          (
            authContext: AuthContext,
            callback: (prisma: any) => Promise<IncomeWithDetails[]>,
          ) =>
            callback({
              income: {
                findMany: jest.fn().mockResolvedValue(incomes),
              },
            }),
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
