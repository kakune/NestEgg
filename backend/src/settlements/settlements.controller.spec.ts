import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsController } from './settlements.controller';
import {
  SettlementsService,
  YearMonth,
  SettlementWithLines,
} from './settlements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole, SettlementStatus } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';

describe('SettlementsController', () => {
  let controller: SettlementsController;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@example.com',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockAdminUser: AuthenticatedUser = {
    userId: 'admin-1',
    email: 'admin@example.com',
    householdId: 'household-1',
    role: UserRole.admin,
  };

  const mockSettlement: SettlementWithLines = {
    id: 'settlement-1',
    householdId: 'household-1',
    month: new Date('2025-01-01'),
    status: SettlementStatus.DRAFT,
    computedAt: new Date('2025-01-15T10:00:00Z'),
    finalizedBy: null,
    finalizedAt: null,
    notes: null,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    lines: [
      {
        id: 'line-1',
        settlementId: 'settlement-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amountYen: BigInt(5000),
        description: 'Settlement transfer',
      },
    ],
  };

  const mockFinalizedSettlement: SettlementWithLines = {
    ...mockSettlement,
    id: 'settlement-2',
    status: SettlementStatus.FINALIZED,
    finalizedBy: 'admin-1',
    finalizedAt: new Date('2025-01-16T12:00:00Z'),
  };

  const mockSettlementsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    runSettlement: jest.fn(),
    finalizeSettlement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettlementsController],
      providers: [
        {
          provide: SettlementsService,
          useValue: mockSettlementsService,
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

    controller = module.get<SettlementsController>(SettlementsController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all settlements for the user', async () => {
      const mockSettlements = [mockSettlement, mockFinalizedSettlement];
      mockSettlementsService.findAll.mockResolvedValue(mockSettlements);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(mockSettlements);
      expect(mockSettlementsService.findAll).toHaveBeenCalledWith(mockUser);
    });

    it('should return empty array when no settlements found', async () => {
      mockSettlementsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual([]);
      expect(mockSettlementsService.findAll).toHaveBeenCalledWith(mockUser);
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed');
      mockSettlementsService.findAll.mockRejectedValue(error);

      await expect(controller.findAll(mockUser)).rejects.toThrow(error);
    });

    it('should work with admin user', async () => {
      const mockSettlements = [mockSettlement];
      mockSettlementsService.findAll.mockResolvedValue(mockSettlements);

      const result = await controller.findAll(mockAdminUser);

      expect(result).toEqual(mockSettlements);
      expect(mockSettlementsService.findAll).toHaveBeenCalledWith(
        mockAdminUser,
      );
    });
  });

  describe('findOne', () => {
    it('should return a specific settlement', async () => {
      mockSettlementsService.findOne.mockResolvedValue(mockSettlement);

      const result = await controller.findOne('settlement-1', mockUser);

      expect(result).toEqual(mockSettlement);
      expect(mockSettlementsService.findOne).toHaveBeenCalledWith(
        'settlement-1',
        mockUser,
      );
    });

    it('should return finalized settlement', async () => {
      mockSettlementsService.findOne.mockResolvedValue(mockFinalizedSettlement);

      const result = await controller.findOne('settlement-2', mockUser);

      expect(result).toEqual(mockFinalizedSettlement);
      expect(mockSettlementsService.findOne).toHaveBeenCalledWith(
        'settlement-2',
        mockUser,
      );
    });

    it('should handle settlement not found', async () => {
      const error = new NotFoundException('Settlement not found');
      mockSettlementsService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('invalid-id', mockUser)).rejects.toThrow(
        error,
      );
      expect(mockSettlementsService.findOne).toHaveBeenCalledWith(
        'invalid-id',
        mockUser,
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database connection failed');
      mockSettlementsService.findOne.mockRejectedValue(error);

      await expect(
        controller.findOne('settlement-1', mockUser),
      ).rejects.toThrow(error);
    });

    it('should work with admin user', async () => {
      mockSettlementsService.findOne.mockResolvedValue(mockSettlement);

      const result = await controller.findOne('settlement-1', mockAdminUser);

      expect(result).toEqual(mockSettlement);
      expect(mockSettlementsService.findOne).toHaveBeenCalledWith(
        'settlement-1',
        mockAdminUser,
      );
    });

    it('should handle different settlement IDs', async () => {
      const settlementIds = [
        'settlement-1',
        'settlement-2',
        'uuid-formatted-id',
        'another-settlement',
      ];

      for (const id of settlementIds) {
        mockSettlementsService.findOne.mockResolvedValue({
          ...mockSettlement,
          id,
        });

        const result = await controller.findOne(id, mockUser);

        expect(result.id).toBe(id);
        expect(mockSettlementsService.findOne).toHaveBeenCalledWith(
          id,
          mockUser,
        );
      }
    });
  });

  describe('runSettlement', () => {
    const runSettlementDto = {
      year: 2025,
      month: 1,
    };

    it('should run settlement for admin user', async () => {
      mockSettlementsService.runSettlement.mockResolvedValue(mockSettlement);

      const result = await controller.runSettlement(
        runSettlementDto,
        mockAdminUser,
      );

      expect(result).toEqual(mockSettlement);
      expect(mockSettlementsService.runSettlement).toHaveBeenCalledWith(
        mockAdminUser.householdId,
        { year: 2025, month: 1 },
        mockAdminUser,
      );
    });

    it('should create YearMonth object correctly', async () => {
      const testCases = [
        { year: 2025, month: 1 },
        { year: 2024, month: 12 },
        { year: 2023, month: 6 },
        { year: 2025, month: 3 },
      ];

      for (const dto of testCases) {
        mockSettlementsService.runSettlement.mockResolvedValue(mockSettlement);

        await controller.runSettlement(dto, mockAdminUser);

        const expectedYearMonth: YearMonth = {
          year: dto.year,
          month: dto.month,
        };

        expect(mockSettlementsService.runSettlement).toHaveBeenCalledWith(
          mockAdminUser.householdId,
          expectedYearMonth,
          mockAdminUser,
        );
      }
    });

    it('should handle already finalized settlement error', async () => {
      const error = new ConflictException(
        'Settlement for 2025-1 is already finalized',
      );
      mockSettlementsService.runSettlement.mockRejectedValue(error);

      await expect(
        controller.runSettlement(runSettlementDto, mockAdminUser),
      ).rejects.toThrow(error);
    });

    it('should handle service errors during settlement run', async () => {
      const error = new Error('Settlement calculation failed');
      mockSettlementsService.runSettlement.mockRejectedValue(error);

      await expect(
        controller.runSettlement(runSettlementDto, mockAdminUser),
      ).rejects.toThrow(error);
    });

    it('should pass householdId from authenticated user', async () => {
      const userWithDifferentHousehold = {
        ...mockAdminUser,
        householdId: 'different-household',
      };

      mockSettlementsService.runSettlement.mockResolvedValue(mockSettlement);

      await controller.runSettlement(
        runSettlementDto,
        userWithDifferentHousehold,
      );

      expect(mockSettlementsService.runSettlement).toHaveBeenCalledWith(
        'different-household',
        { year: 2025, month: 1 },
        userWithDifferentHousehold,
      );
    });

    it('should handle different month and year combinations', async () => {
      const testCombinations = [
        { year: 2025, month: 1 }, // January
        { year: 2025, month: 12 }, // December
        { year: 2024, month: 6 }, // June
        { year: 2023, month: 2 }, // February
      ];

      for (const dto of testCombinations) {
        mockSettlementsService.runSettlement.mockResolvedValue({
          ...mockSettlement,
          month: new Date(dto.year, dto.month - 1, 1),
        });

        const result = await controller.runSettlement(dto, mockAdminUser);

        expect(result.month).toEqual(new Date(dto.year, dto.month - 1, 1));
      }
    });

    it('should return settlement with lines', async () => {
      const settlementWithMultipleLines: SettlementWithLines = {
        ...mockSettlement,
        lines: [
          {
            id: 'line-1',
            settlementId: 'settlement-1',
            fromUserId: 'user-1',
            toUserId: 'user-2',
            amountYen: BigInt(3000),
            description: 'Settlement transfer 1',
          },
          {
            id: 'line-2',
            settlementId: 'settlement-1',
            fromUserId: 'user-3',
            toUserId: 'user-1',
            amountYen: BigInt(2000),
            description: 'Settlement transfer 2',
          },
        ],
      };

      mockSettlementsService.runSettlement.mockResolvedValue(
        settlementWithMultipleLines,
      );

      const result = await controller.runSettlement(
        runSettlementDto,
        mockAdminUser,
      );

      expect(result.lines).toHaveLength(2);
      expect(result.lines[0]!.amountYen).toBe(BigInt(3000));
      expect(result.lines[1]!.amountYen).toBe(BigInt(2000));
    });
  });

  describe('finalizeSettlement', () => {
    it('should finalize settlement for admin user', async () => {
      mockSettlementsService.finalizeSettlement.mockResolvedValue(
        mockFinalizedSettlement,
      );

      const result = await controller.finalizeSettlement(
        'settlement-1',
        mockAdminUser,
      );

      expect(result).toEqual(mockFinalizedSettlement);
      expect(mockSettlementsService.finalizeSettlement).toHaveBeenCalledWith(
        'settlement-1',
        mockAdminUser,
      );
    });

    it('should handle settlement not found during finalization', async () => {
      const error = new NotFoundException('Settlement not found');
      mockSettlementsService.finalizeSettlement.mockRejectedValue(error);

      await expect(
        controller.finalizeSettlement('invalid-id', mockAdminUser),
      ).rejects.toThrow(error);
    });

    it('should handle already finalized settlement error', async () => {
      const error = new ConflictException('Settlement is already finalized');
      mockSettlementsService.finalizeSettlement.mockRejectedValue(error);

      await expect(
        controller.finalizeSettlement('settlement-1', mockAdminUser),
      ).rejects.toThrow(error);
    });

    it('should handle unauthorized finalization attempt', async () => {
      const error = new ConflictException(
        'Only admin users can finalize settlements',
      );
      mockSettlementsService.finalizeSettlement.mockRejectedValue(error);

      await expect(
        controller.finalizeSettlement('settlement-1', mockUser),
      ).rejects.toThrow(error);
    });

    it('should handle service errors during finalization', async () => {
      const error = new Error('Database error during finalization');
      mockSettlementsService.finalizeSettlement.mockRejectedValue(error);

      await expect(
        controller.finalizeSettlement('settlement-1', mockAdminUser),
      ).rejects.toThrow(error);
    });

    it('should return finalized settlement with correct status', async () => {
      const finalizedResult = {
        ...mockSettlement,
        status: SettlementStatus.FINALIZED,
        finalizedBy: 'admin-1',
        finalizedAt: new Date('2025-01-16T12:00:00Z'),
      };

      mockSettlementsService.finalizeSettlement.mockResolvedValue(
        finalizedResult,
      );

      const result = await controller.finalizeSettlement(
        'settlement-1',
        mockAdminUser,
      );

      expect(result.status).toBe(SettlementStatus.FINALIZED);
      expect(result.finalizedBy).toBe('admin-1');
      expect(result.finalizedAt).toBeInstanceOf(Date);
    });

    it('should handle different settlement IDs for finalization', async () => {
      const settlementIds = [
        'settlement-1',
        'settlement-2',
        'uuid-formatted-id',
        'another-settlement',
      ];

      for (const id of settlementIds) {
        mockSettlementsService.finalizeSettlement.mockResolvedValue({
          ...mockFinalizedSettlement,
          id,
        });

        const result = await controller.finalizeSettlement(id, mockAdminUser);

        expect(result.id).toBe(id);
        expect(mockSettlementsService.finalizeSettlement).toHaveBeenCalledWith(
          id,
          mockAdminUser,
        );
      }
    });

    it('should preserve settlement lines after finalization', async () => {
      const settlementWithLines = {
        ...mockFinalizedSettlement,
        lines: [
          {
            id: 'line-1',
            settlementId: 'settlement-1',
            fromUserId: 'user-1',
            toUserId: 'user-2',
            amountYen: BigInt(5000),
            description: 'Final settlement transfer',
          },
        ],
      };

      mockSettlementsService.finalizeSettlement.mockResolvedValue(
        settlementWithLines,
      );

      const result = await controller.finalizeSettlement(
        'settlement-1',
        mockAdminUser,
      );

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]!.description).toBe('Final settlement transfer');
    });
  });

  // User context and authorization tests
  describe('user context and authorization', () => {
    it('should pass correct user context to findAll', async () => {
      const users = [mockUser, mockAdminUser];

      for (const user of users) {
        mockSettlementsService.findAll.mockResolvedValue([]);

        await controller.findAll(user);

        expect(mockSettlementsService.findAll).toHaveBeenCalledWith(user);
      }
    });

    it('should pass correct user context to findOne', async () => {
      const users = [mockUser, mockAdminUser];

      for (const user of users) {
        mockSettlementsService.findOne.mockResolvedValue(mockSettlement);

        await controller.findOne('settlement-1', user);

        expect(mockSettlementsService.findOne).toHaveBeenCalledWith(
          'settlement-1',
          user,
        );
      }
    });

    it('should pass admin user context to runSettlement', async () => {
      mockSettlementsService.runSettlement.mockResolvedValue(mockSettlement);

      const runSettlementDto = { year: 2025, month: 1 };
      await controller.runSettlement(runSettlementDto, mockAdminUser);

      expect(mockSettlementsService.runSettlement).toHaveBeenCalledWith(
        mockAdminUser.householdId,
        { year: 2025, month: 1 },
        mockAdminUser,
      );
    });

    it('should pass admin user context to finalizeSettlement', async () => {
      mockSettlementsService.finalizeSettlement.mockResolvedValue(
        mockFinalizedSettlement,
      );

      await controller.finalizeSettlement('settlement-1', mockAdminUser);

      expect(mockSettlementsService.finalizeSettlement).toHaveBeenCalledWith(
        'settlement-1',
        mockAdminUser,
      );
    });
  });

  // HTTP status code tests (implicit through decorators)
  describe('HTTP response handling', () => {
    it('should return settlements with correct structure for findAll', async () => {
      const settlements = [mockSettlement, mockFinalizedSettlement];
      mockSettlementsService.findAll.mockResolvedValue(settlements);

      const result = await controller.findAll(mockUser);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('lines');
    });

    it('should return single settlement with correct structure for findOne', async () => {
      mockSettlementsService.findOne.mockResolvedValue(mockSettlement);

      const result = await controller.findOne('settlement-1', mockUser);

      expect(result).toHaveProperty('id', 'settlement-1');
      expect(result).toHaveProperty('status', SettlementStatus.DRAFT);
      expect(result).toHaveProperty('lines');
      expect(Array.isArray(result.lines)).toBe(true);
    });

    it('should return settlement after successful run', async () => {
      mockSettlementsService.runSettlement.mockResolvedValue(mockSettlement);

      const result = await controller.runSettlement(
        { year: 2025, month: 1 },
        mockAdminUser,
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', SettlementStatus.DRAFT);
      expect(result).toHaveProperty('lines');
    });

    it('should return settlement after successful finalization', async () => {
      mockSettlementsService.finalizeSettlement.mockResolvedValue(
        mockFinalizedSettlement,
      );

      const result = await controller.finalizeSettlement(
        'settlement-1',
        mockAdminUser,
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status', SettlementStatus.FINALIZED);
      expect(result).toHaveProperty('finalizedBy');
      expect(result).toHaveProperty('finalizedAt');
    });
  });

  // Edge cases and boundary conditions
  describe('edge cases and boundary conditions', () => {
    it('should handle empty settlement lines', async () => {
      const settlementWithNoLines = {
        ...mockSettlement,
        lines: [],
      };
      mockSettlementsService.findOne.mockResolvedValue(settlementWithNoLines);

      const result = await controller.findOne('settlement-1', mockUser);

      expect(result.lines).toEqual([]);
    });

    it('should handle large amount values in settlement lines', async () => {
      const settlementWithLargeAmount = {
        ...mockSettlement,
        lines: [
          {
            ...mockSettlement.lines[0],
            amountYen: BigInt('999999999999'),
          },
        ],
      };
      mockSettlementsService.findOne.mockResolvedValue(
        settlementWithLargeAmount,
      );

      const result = await controller.findOne('settlement-1', mockUser);

      expect(result.lines[0]!.amountYen).toBe(BigInt('999999999999'));
    });

    it('should handle date boundary conditions in runSettlement', async () => {
      const boundaryDates = [
        { year: 2025, month: 1 }, // January
        { year: 2025, month: 12 }, // December
        { year: 2024, month: 2 }, // February (leap year)
        { year: 2023, month: 2 }, // February (non-leap year)
      ];

      for (const dto of boundaryDates) {
        mockSettlementsService.runSettlement.mockResolvedValue(mockSettlement);

        await controller.runSettlement(dto, mockAdminUser);

        expect(mockSettlementsService.runSettlement).toHaveBeenCalledWith(
          mockAdminUser.householdId,
          { year: dto.year, month: dto.month },
          mockAdminUser,
        );
      }
    });

    it('should handle different household contexts', async () => {
      const userFromDifferentHousehold = {
        ...mockUser,
        householdId: 'different-household',
      };

      mockSettlementsService.findAll.mockResolvedValue([]);

      await controller.findAll(userFromDifferentHousehold);

      expect(mockSettlementsService.findAll).toHaveBeenCalledWith(
        userFromDifferentHousehold,
      );
    });
  });

  // Data consistency tests
  describe('data consistency', () => {
    it('should maintain householdId consistency in runSettlement', async () => {
      const testUsers = [
        { ...mockAdminUser, householdId: 'household-a' },
        { ...mockAdminUser, householdId: 'household-b' },
        { ...mockAdminUser, householdId: 'household-c' },
      ];

      const dto = { year: 2025, month: 1 };

      for (const user of testUsers) {
        mockSettlementsService.runSettlement.mockResolvedValue({
          ...mockSettlement,
          householdId: user.householdId,
        });

        await controller.runSettlement(dto, user);

        expect(mockSettlementsService.runSettlement).toHaveBeenCalledWith(
          user.householdId,
          { year: 2025, month: 1 },
          user,
        );
      }
    });

    it('should pass complete user context to service methods', async () => {
      const completeUser: AuthenticatedUser = {
        userId: 'complete-user-id',
        email: 'complete@example.com',
        householdId: 'complete-household',
        role: UserRole.admin,
      };

      mockSettlementsService.runSettlement.mockResolvedValue(mockSettlement);

      await controller.runSettlement({ year: 2025, month: 1 }, completeUser);

      expect(mockSettlementsService.runSettlement).toHaveBeenCalledWith(
        'complete-household',
        { year: 2025, month: 1 },
        completeUser,
      );
    });
  });
});
