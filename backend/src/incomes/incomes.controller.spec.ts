import { Test, TestingModule } from '@nestjs/testing';
import { IncomesController } from './incomes.controller';
import { IncomesService } from './incomes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import type {
  CreateIncomeDto,
  UpdateIncomeDto,
  IncomeWithDetails,
  IncomeStatistics,
} from './incomes.service';

describe('IncomesController', () => {
  let controller: IncomesController;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@example.com',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockIncomeWithDetails: IncomeWithDetails = {
    id: 'income-1',
    householdId: 'household-1',
    userId: 'user-1',
    month: new Date('2025-01-01'),
    grossYen: BigInt(300000),
    deductionTaxYen: BigInt(30000),
    deductionSocialYen: BigInt(40000),
    deductionOtherYen: BigInt(5000),
    allocatableYen: BigInt(225000),
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  const mockIncome = {
    id: 'income-1',
    householdId: 'household-1',
    userId: 'user-1',
    month: new Date('2025-01-01'),
    grossYen: BigInt(300000),
    deductionTaxYen: BigInt(30000),
    deductionSocialYen: BigInt(40000),
    deductionOtherYen: BigInt(5000),
    allocatableYen: BigInt(225000),
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  };

  const mockIncomeStatistics: IncomeStatistics = {
    totalGrossIncome: 3600000,
    totalDeductions: 900000,
    totalAllocatable: 2700000,
    averageMonthlyIncome: 300000,
    monthlyIncomes: [
      {
        year: 2025,
        month: 1,
        grossIncome: 300000,
        deductions: 75000,
        allocatable: 225000,
      },
    ],
  };

  const mockIncomesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUserAndMonth: jest.fn(),
    getIncomeStatistics: jest.fn(),
    getHouseholdIncomeBreakdown: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    removeByFilters: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IncomesController],
      providers: [
        {
          provide: IncomesService,
          useValue: mockIncomesService,
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

    controller = module.get<IncomesController>(IncomesController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all incomes with no filters', async () => {
      const mockIncomes = [mockIncomeWithDetails];
      mockIncomesService.findAll.mockResolvedValue(mockIncomes);

      const result = await controller.findAll({}, mockUser);

      expect(result).toEqual(mockIncomes);
      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          sortBy: undefined,
          sortOrder: undefined,
        },
        mockUser,
      );
    });

    it('should apply all query parameters correctly', async () => {
      const query = {
        userId: 'user-2',
        year: '2024',
        month: '6',
        yearFrom: '2023',
        yearTo: '2025',
        minAllocatable: '200000',
        maxAllocatable: '400000',
        search: 'bonus',
        limit: '20',
        offset: '10',
        sortBy: 'grossIncomeYen' as const,
        sortOrder: 'desc' as const,
      };

      mockIncomesService.findAll.mockResolvedValue([mockIncomeWithDetails]);

      await controller.findAll(query, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          userId: 'user-2',
          year: 2024,
          month: 6,
          yearFrom: 2023,
          yearTo: 2025,
          minAllocatable: 200000,
          maxAllocatable: 400000,
          search: 'bonus',
          limit: 20,
          offset: 10,
          sortBy: 'grossIncomeYen',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });

    it('should handle optional parameters correctly', async () => {
      const query = {
        year: '2024',
        sortBy: 'year' as const,
      };

      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findAll(query, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          year: 2024,
          sortBy: 'year',
          sortOrder: undefined,
        },
        mockUser,
      );
    });
  });

  describe('getStatistics', () => {
    it('should return income statistics with no filters', async () => {
      mockIncomesService.getIncomeStatistics.mockResolvedValue(
        mockIncomeStatistics,
      );

      const result = await controller.getStatistics({}, mockUser);

      expect(result).toEqual(mockIncomeStatistics);
      expect(mockIncomesService.getIncomeStatistics).toHaveBeenCalledWith(
        {},
        mockUser,
      );
    });

    it('should apply filters to statistics', async () => {
      const query = {
        userId: 'user-1',
        yearFrom: '2024',
        yearTo: '2025',
      };

      mockIncomesService.getIncomeStatistics.mockResolvedValue(
        mockIncomeStatistics,
      );

      await controller.getStatistics(query, mockUser);

      expect(mockIncomesService.getIncomeStatistics).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          yearFrom: 2024,
          yearTo: 2025,
        },
        mockUser,
      );
    });
  });

  describe('getHouseholdBreakdown', () => {
    it('should return household income breakdown for year only', async () => {
      const mockBreakdown: Record<string, unknown> = {
        totalIncome: 3600000,
        users: [],
      };
      mockIncomesService.getHouseholdIncomeBreakdown.mockResolvedValue(
        mockBreakdown,
      );

      const result = (await controller.getHouseholdBreakdown(
        '2025',
        undefined,
        mockUser,
      )) as Record<string, unknown>;

      expect(result).toEqual(mockBreakdown);
      expect(
        mockIncomesService.getHouseholdIncomeBreakdown,
      ).toHaveBeenCalledWith(2025, mockUser, undefined);
    });

    it('should return household income breakdown for year and month', async () => {
      const mockBreakdown: Record<string, unknown> = {
        totalIncome: 300000,
        users: [],
      };
      mockIncomesService.getHouseholdIncomeBreakdown.mockResolvedValue(
        mockBreakdown,
      );

      const result = (await controller.getHouseholdBreakdown(
        '2025',
        '6',
        mockUser,
      )) as Record<string, unknown>;

      expect(result).toEqual(mockBreakdown);
      expect(
        mockIncomesService.getHouseholdIncomeBreakdown,
      ).toHaveBeenCalledWith(2025, mockUser, 6);
    });

    it('should throw error when user is not authenticated', async () => {
      await expect(
        controller.getHouseholdBreakdown('2025', undefined, undefined),
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('findByUser', () => {
    it('should return incomes for specific user', async () => {
      mockIncomesService.findAll.mockResolvedValue([mockIncomeWithDetails]);

      const result = await controller.findByUser('user-2', {}, mockUser);

      expect(result).toEqual([mockIncomeWithDetails]);
      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          userId: 'user-2',
          sortBy: undefined,
          sortOrder: undefined,
        },
        mockUser,
      );
    });

    it('should apply additional filters for user incomes', async () => {
      const query = {
        year: '2024',
        month: '3',
        yearFrom: '2023',
        yearTo: '2025',
        limit: '10',
        offset: '5',
        sortBy: 'allocatableYen' as const,
        sortOrder: 'asc' as const,
      };

      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findByUser('user-2', query, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          userId: 'user-2',
          year: 2024,
          month: 3,
          yearFrom: 2023,
          yearTo: 2025,
          limit: 10,
          offset: 5,
          sortBy: 'allocatableYen',
          sortOrder: 'asc',
        },
        mockUser,
      );
    });
  });

  describe('findByUserAndYear', () => {
    it('should return incomes for user and year', async () => {
      mockIncomesService.findAll.mockResolvedValue([mockIncomeWithDetails]);

      const result = await controller.findByUserAndYear(
        'user-2',
        '2024',
        mockUser,
      );

      expect(result).toEqual([mockIncomeWithDetails]);
      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          userId: 'user-2',
          year: 2024,
          sortBy: 'month',
          sortOrder: 'asc',
        },
        mockUser,
      );
    });
  });

  describe('findByUserAndMonth', () => {
    it('should return income for specific user, year and month', async () => {
      mockIncomesService.findByUserAndMonth.mockResolvedValue(mockIncome);

      const result = await controller.findByUserAndMonth(
        'user-1',
        '2024',
        '6',
        mockUser,
      );

      expect(result).toEqual(mockIncome);
      expect(mockIncomesService.findByUserAndMonth).toHaveBeenCalledWith(
        'user-1',
        2024,
        6,
        mockUser,
      );
    });

    it('should return null when no income found', async () => {
      mockIncomesService.findByUserAndMonth.mockResolvedValue(null);

      const result = await controller.findByUserAndMonth(
        'user-1',
        '2024',
        '6',
        mockUser,
      );

      expect(result).toBeNull();
    });
  });

  describe('findByYear', () => {
    it('should return incomes for specific year with default sorting', async () => {
      mockIncomesService.findAll.mockResolvedValue([mockIncomeWithDetails]);

      const result = await controller.findByYear('2024', {}, mockUser);

      expect(result).toEqual([mockIncomeWithDetails]);
      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          year: 2024,
          sortBy: 'month',
          sortOrder: 'asc',
        },
        mockUser,
      );
    });

    it('should apply query parameters for year search', async () => {
      const query = {
        month: '6',
        userId: 'user-2',
        limit: '15',
        offset: '5',
        sortBy: 'grossIncomeYen' as const,
        sortOrder: 'desc' as const,
      };

      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findByYear('2024', query, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          year: 2024,
          month: 6,
          userId: 'user-2',
          limit: 15,
          offset: 5,
          sortBy: 'grossIncomeYen',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });
  });

  describe('searchIncomes', () => {
    it('should search incomes with default settings', async () => {
      mockIncomesService.findAll.mockResolvedValue([mockIncomeWithDetails]);

      const result = await controller.searchIncomes('bonus', {}, mockUser);

      expect(result).toEqual([mockIncomeWithDetails]);
      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          search: 'bonus',
          limit: 50,
          sortBy: 'year',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });

    it('should apply additional filters to search', async () => {
      const query = {
        userId: 'user-2',
        year: '2024',
        yearFrom: '2023',
        yearTo: '2025',
        limit: '25',
        offset: '10',
      };

      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.searchIncomes('overtime', query, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          search: 'overtime',
          userId: 'user-2',
          year: 2024,
          yearFrom: 2023,
          yearTo: 2025,
          limit: 25,
          offset: 10,
          sortBy: 'year',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });
  });

  describe('findRecent', () => {
    it('should return recent incomes with default limit', async () => {
      mockIncomesService.findAll.mockResolvedValue([mockIncomeWithDetails]);

      const result = await controller.findRecent(undefined, mockUser);

      expect(result).toEqual([mockIncomeWithDetails]);
      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          limit: 12,
          sortBy: 'year',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });

    it('should return recent incomes with custom limit', async () => {
      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findRecent('24', mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          limit: 24,
          sortBy: 'year',
          sortOrder: 'desc',
        },
        mockUser,
      );
    });
  });

  describe('findCurrentYear', () => {
    it('should return current year incomes', async () => {
      const currentYear = new Date().getFullYear();
      mockIncomesService.findAll.mockResolvedValue([mockIncomeWithDetails]);

      const result = await controller.findCurrentYear(undefined, mockUser);

      expect(result).toEqual([mockIncomeWithDetails]);
      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          year: currentYear,
          sortBy: 'month',
          sortOrder: 'asc',
        },
        mockUser,
      );
    });

    it('should return current year incomes for specific user', async () => {
      const currentYear = new Date().getFullYear();
      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findCurrentYear('user-2', mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          year: currentYear,
          userId: 'user-2',
          sortBy: 'month',
          sortOrder: 'asc',
        },
        mockUser,
      );
    });

    it('should throw error when user is not authenticated', async () => {
      await expect(
        controller.findCurrentYear(undefined, undefined),
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('findOne', () => {
    it('should return a specific income', async () => {
      mockIncomesService.findOne.mockResolvedValue(mockIncomeWithDetails);

      const result = await controller.findOne('income-1', mockUser);

      expect(result).toEqual(mockIncomeWithDetails);
      expect(mockIncomesService.findOne).toHaveBeenCalledWith(
        'income-1',
        mockUser,
      );
    });

    it('should handle income not found error', async () => {
      const error = new Error('Income not found');
      mockIncomesService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('invalid-id', mockUser)).rejects.toThrow(
        error,
      );
    });
  });

  describe('create', () => {
    it('should create a new income', async () => {
      const createIncomeDto: CreateIncomeDto = {
        userId: 'user-1',
        grossIncomeYen: 350000,
        deductionYen: 85000,
        year: 2025,
        month: 2,
        description: 'February salary',
        sourceDocument: 'payslip-2025-02',
      };

      mockIncomesService.create.mockResolvedValue(mockIncome);

      const result = await controller.create(createIncomeDto, mockUser);

      expect(result).toEqual(mockIncome);
      expect(mockIncomesService.create).toHaveBeenCalledWith(
        createIncomeDto,
        mockUser,
      );
    });

    it('should handle validation errors', async () => {
      const createIncomeDto: CreateIncomeDto = {
        userId: 'user-1',
        grossIncomeYen: -100,
        deductionYen: 85000,
        year: 2025,
        month: 13,
      };

      const error = new Error('Validation failed');
      mockIncomesService.create.mockRejectedValue(error);

      await expect(
        controller.create(createIncomeDto, mockUser),
      ).rejects.toThrow(error);
    });
  });

  describe('createBulk', () => {
    it('should create multiple incomes successfully', async () => {
      const createIncomeDtos: CreateIncomeDto[] = [
        {
          userId: 'user-1',
          grossIncomeYen: 300000,
          deductionYen: 75000,
          year: 2025,
          month: 1,
        },
        {
          userId: 'user-1',
          grossIncomeYen: 320000,
          deductionYen: 80000,
          year: 2025,
          month: 2,
        },
      ];

      const mockResult = {
        count: 2,
        errors: [],
      };

      mockIncomesService.createMany.mockResolvedValue(mockResult);

      const result = await controller.createBulk(createIncomeDtos, mockUser);

      expect(result).toEqual(mockResult);
      expect(mockIncomesService.createMany).toHaveBeenCalledWith(
        createIncomeDtos,
        mockUser,
      );
    });

    it('should handle partial failures in bulk create', async () => {
      const createIncomeDtos: CreateIncomeDto[] = [
        {
          userId: 'user-1',
          grossIncomeYen: 300000,
          deductionYen: 75000,
          year: 2025,
          month: 1,
        },
        {
          userId: 'invalid-user',
          grossIncomeYen: 320000,
          deductionYen: 80000,
          year: 2025,
          month: 2,
        },
      ];

      const mockResult = {
        count: 1,
        errors: [
          {
            dto: createIncomeDtos[1],
            error: 'User not found',
          },
        ],
      };

      mockIncomesService.createMany.mockResolvedValue(mockResult);

      const result = await controller.createBulk(createIncomeDtos, mockUser);

      expect(result).toEqual(mockResult);
    });

    it('should handle empty array', async () => {
      const mockResult = {
        count: 0,
        errors: [],
      };

      mockIncomesService.createMany.mockResolvedValue(mockResult);

      const result = await controller.createBulk([], mockUser);

      expect(result).toEqual(mockResult);
      expect(mockIncomesService.createMany).toHaveBeenCalledWith([], mockUser);
    });
  });

  describe('update', () => {
    it('should update an income', async () => {
      const updateIncomeDto: UpdateIncomeDto = {
        grossIncomeYen: 350000,
        description: 'Updated description',
      };

      const updatedIncome = {
        ...mockIncome,
        grossYen: BigInt(350000),
      };

      mockIncomesService.update.mockResolvedValue(updatedIncome);

      const result = await controller.update(
        'income-1',
        updateIncomeDto,
        mockUser,
      );

      expect(result).toEqual(updatedIncome);
      expect(mockIncomesService.update).toHaveBeenCalledWith(
        'income-1',
        updateIncomeDto,
        mockUser,
      );
    });

    it('should handle update with minimal data', async () => {
      const updateIncomeDto: UpdateIncomeDto = {
        description: 'Just description update',
      };

      mockIncomesService.update.mockResolvedValue(mockIncome);

      await controller.update('income-1', updateIncomeDto, mockUser);

      expect(mockIncomesService.update).toHaveBeenCalledWith(
        'income-1',
        updateIncomeDto,
        mockUser,
      );
    });

    it('should handle update errors', async () => {
      const updateIncomeDto: UpdateIncomeDto = {
        grossIncomeYen: 350000,
      };

      const error = new Error('Income not found');
      mockIncomesService.update.mockRejectedValue(error);

      await expect(
        controller.update('invalid-id', updateIncomeDto, mockUser),
      ).rejects.toThrow(error);
    });
  });

  describe('remove', () => {
    it('should remove an income', async () => {
      mockIncomesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('income-1', mockUser);

      expect(result).toBeUndefined();
      expect(mockIncomesService.remove).toHaveBeenCalledWith(
        'income-1',
        mockUser,
      );
    });

    it('should handle remove errors', async () => {
      const error = new Error('Income not found');
      mockIncomesService.remove.mockRejectedValue(error);

      await expect(controller.remove('invalid-id', mockUser)).rejects.toThrow(
        error,
      );
    });
  });

  describe('removeByUserAndYear', () => {
    it('should remove incomes by user and year', async () => {
      const mockResult = {
        count: 12,
        errors: [],
      };

      mockIncomesService.removeByFilters.mockResolvedValue(mockResult);

      const result = await controller.removeByUserAndYear(
        'user-1',
        '2024',
        mockUser,
      );

      expect(result).toEqual(mockResult);
      expect(mockIncomesService.removeByFilters).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          year: 2024,
        },
        mockUser,
      );
    });

    it('should handle partial failures in bulk remove', async () => {
      const mockResult = {
        count: 10,
        errors: [
          {
            id: 'income-1',
            error: 'Income already deleted',
          },
          {
            id: 'income-2',
            error: 'Permission denied',
          },
        ],
      };

      mockIncomesService.removeByFilters.mockResolvedValue(mockResult);

      const result = await controller.removeByUserAndYear(
        'user-1',
        '2024',
        mockUser,
      );

      expect(result).toEqual(mockResult);
    });

    it('should handle no incomes found for removal', async () => {
      const mockResult = {
        count: 0,
        errors: [],
      };

      mockIncomesService.removeByFilters.mockResolvedValue(mockResult);

      const result = await controller.removeByUserAndYear(
        'user-1',
        '2023',
        mockUser,
      );

      expect(result).toEqual(mockResult);
    });
  });

  // Error handling tests
  describe('error handling', () => {
    it('should propagate service errors in findAll', async () => {
      const error = new Error('Database connection failed');
      mockIncomesService.findAll.mockRejectedValue(error);

      await expect(controller.findAll({}, mockUser)).rejects.toThrow(error);
    });

    it('should propagate service errors in getStatistics', async () => {
      const error = new Error('Statistics calculation failed');
      mockIncomesService.getIncomeStatistics.mockRejectedValue(error);

      await expect(controller.getStatistics({}, mockUser)).rejects.toThrow(
        error,
      );
    });

    it('should propagate service errors in getHouseholdBreakdown', async () => {
      const error = new Error('Breakdown calculation failed');
      mockIncomesService.getHouseholdIncomeBreakdown.mockRejectedValue(error);

      await expect(
        controller.getHouseholdBreakdown('2025', undefined, mockUser),
      ).rejects.toThrow(error);
    });
  });

  // Parameter parsing tests
  describe('parameter parsing', () => {
    it('should handle invalid year string in findByYear', async () => {
      // This would normally be caught by validation at the framework level
      // but we test the controller's behavior with parsed values
      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findByYear('2024', {}, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
        }),
        mockUser,
      );
    });

    it('should handle optional query parameters correctly', async () => {
      const query = {
        limit: '10',
        // Other parameters intentionally omitted
      };

      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findAll(query, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        {
          limit: 10,
          sortBy: undefined,
          sortOrder: undefined,
        },
        mockUser,
      );
    });
  });

  // Default values tests
  describe('default values', () => {
    it('should use default limit in search when not provided', async () => {
      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.searchIncomes('test', {}, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        }),
        mockUser,
      );
    });

    it('should use default sorting in findByYear', async () => {
      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findByYear('2024', {}, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'month',
          sortOrder: 'asc',
        }),
        mockUser,
      );
    });

    it('should use default limit in findRecent', async () => {
      mockIncomesService.findAll.mockResolvedValue([]);

      await controller.findRecent(undefined, mockUser);

      expect(mockIncomesService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 12,
        }),
        mockUser,
      );
    });
  });
});
