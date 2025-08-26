import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { mockDeep, MockProxy, mockReset } from 'jest-mock-extended';

import {
  ActorsService,
  CreateActorDto,
  UpdateActorDto,
  ActorStatistics,
  ActorWithUser,
} from './actors.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { ActorKind, UserRole, PrismaClient, Prisma } from '@prisma/client';

describe('ActorsService', () => {
  let service: ActorsService;
  let mockPrismaService: MockProxy<PrismaService>;
  let mockPrismaClient: MockProxy<PrismaClient>;

  const mockAuthContext: AuthContext = {
    userId: 'user-1',
    householdId: 'household-1',
    role: UserRole.admin,
  };

  const mockMemberAuthContext: AuthContext = {
    userId: 'user-2',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
  };

  const mockActor: ActorWithUser = {
    id: 'actor-1',
    name: 'Test Actor',
    kind: ActorKind.USER,
    householdId: 'household-1',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  };

  const mockInstrumentActor: ActorWithUser = {
    id: 'actor-2',
    name: 'Credit Card',
    kind: ActorKind.INSTRUMENT,
    householdId: 'household-1',
    userId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null,
  };

  beforeEach(async () => {
    mockPrismaClient = mockDeep<PrismaClient>();
    mockPrismaService = mockDeep<PrismaService>();
    mockPrismaService.prisma = mockPrismaClient;

    // Reset all mocks before each test
    mockReset(mockPrismaService);
    mockReset(mockPrismaClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActorsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActorsService>(ActorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all actors with user info', async () => {
      const mockActors = [mockActor, mockInstrumentActor];

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findMany as jest.Mock).mockResolvedValue(
        mockActors,
      );

      const result = await service.findAll(mockAuthContext);

      expect(result).toEqual(mockActors);
    });

    it('should filter actors by household', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findMany as jest.Mock).mockImplementation(
        (args: Prisma.ActorFindManyArgs) => {
          expect(args.where?.householdId).toBe(mockAuthContext.householdId);
          expect(args.include?.user).toBeDefined();
          expect(args.orderBy).toEqual([{ kind: 'asc' }, { name: 'asc' }]);
          return Promise.resolve([mockActor]);
        },
      );

      await service.findAll(mockAuthContext);
    });

    it('should order actors by kind then by name', async () => {
      const orderedActors = [mockActor, mockInstrumentActor];

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findMany as jest.Mock).mockResolvedValue(
        orderedActors,
      );

      const result = await service.findAll(mockAuthContext);

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(result[0]?.kind).toBe(ActorKind.USER);
      expect(result[1]?.kind).toBe(ActorKind.INSTRUMENT);
    });
  });

  describe('findOne', () => {
    it('should return actor with user info and recent transactions', async () => {
      const actorWithTransactions = {
        ...mockActor,
        transactions: [
          {
            id: 'txn-1',
            amount: 1000,
            description: 'Test transaction',
            date: new Date(),
          },
        ],
      };

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(
        actorWithTransactions,
      );

      const result = await service.findOne('actor-1', mockAuthContext);

      expect(result).toEqual(actorWithTransactions);
    });

    it('should throw NotFoundException when actor not found', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce household isolation', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockImplementation(
        (args: Prisma.ActorFindFirstArgs) => {
          expect(args.where?.id).toBe('actor-1');
          expect(args.where?.householdId).toBe(mockAuthContext.householdId);
          expect(args.include?.user).toBeDefined();
          expect(args.include?.transactions).toBeDefined();
          return Promise.resolve(mockActor);
        },
      );

      await service.findOne('actor-1', mockAuthContext);
    });
  });

  describe('findByUserId', () => {
    it('should return actors for specific user', async () => {
      const userActors = [mockActor];

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findMany as jest.Mock).mockResolvedValue(
        userActors,
      );

      const result = await service.findByUserId('user-1', mockAuthContext);

      expect(result).toEqual(userActors);
    });

    it('should filter by userId and householdId', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findMany as jest.Mock).mockImplementation(
        (args: Prisma.ActorFindManyArgs) => {
          expect(args.where?.userId).toBe('user-1');
          expect(args.where?.householdId).toBe(mockAuthContext.householdId);
          return Promise.resolve([mockActor]);
        },
      );

      await service.findByUserId('user-1', mockAuthContext);
    });
  });

  describe('create', () => {
    const createActorDto: CreateActorDto = {
      name: 'New Actor',
      kind: ActorKind.INSTRUMENT,
    };

    it('should create actor successfully', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
        deletedAt: null,
      });
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(null);

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.create as jest.Mock).mockResolvedValue(mockActor);

      const result = await service.create(createActorDto, mockAuthContext);

      expect(result).toEqual(mockActor);
    });

    it('should allow admin to create actor for other user', async () => {
      const createForOtherUserDto = {
        ...createActorDto,
        userId: 'user-2',
      };

      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-2',
        householdId: 'household-1',
        deletedAt: null,
      });
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(null);

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.create as jest.Mock).mockResolvedValue(mockActor);

      await service.create(createForOtherUserDto, mockAuthContext);

      // Successfully creating without throwing an exception validates the admin privilege
    });

    it('should throw ForbiddenException when non-admin tries to create for other user', async () => {
      const createForOtherUserDto = {
        ...createActorDto,
        userId: 'user-3',
      };

      await expect(
        service.create(createForOtherUserDto, mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when target user not found', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(createActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when actor name already exists', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
        deletedAt: null,
      });
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(
        mockActor,
      );

      await expect(
        service.create(createActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const updateActorDto: UpdateActorDto = {
      name: 'Updated Actor',
    };

    it('should update actor successfully', async () => {
      const updatedActor = { ...mockActor, ...updateActorDto };

      mockPrismaService.withContext
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            (
              mockPrismaClient.actor.findFirst as jest.Mock
            ).mockResolvedValueOnce(mockActor);
            return fn(mockPrismaClient);
          },
        )
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            (mockPrismaClient.actor.update as jest.Mock).mockResolvedValueOnce(
              updatedActor,
            );
            return fn(mockPrismaClient);
          },
        );

      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.update(
        'actor-1',
        updateActorDto,
        mockAuthContext,
      );

      expect(result).toEqual(updatedActor);
    });

    it('should throw ForbiddenException when non-admin tries to update other user actor', async () => {
      const otherUserActor = { ...mockActor, userId: 'user-3' };

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(
        otherUserActor,
      );

      await expect(
        service.update('actor-1', updateActorDto, mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when new name already exists', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockActor)
        .mockResolvedValueOnce({
          id: 'actor-2',
          name: 'Updated Actor',
        });

      await expect(
        service.update('actor-1', updateActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove actor successfully', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            (
              mockPrismaClient.actor.findFirst as jest.Mock
            ).mockResolvedValueOnce(mockActor);
            return fn(mockPrismaClient);
          },
        )
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            (mockPrismaClient.actor.update as jest.Mock).mockResolvedValueOnce(
              undefined,
            );
            return fn(mockPrismaClient);
          },
        );

      (mockPrismaClient.transaction.count as jest.Mock).mockResolvedValue(0);

      await service.remove('actor-1', mockAuthContext);

      // Successfully removing without throwing an exception validates the operation
    });

    it('should throw ForbiddenException when non-admin tries to delete other user actor', async () => {
      const otherUserActor = { ...mockActor, userId: 'user-3' };

      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(
        otherUserActor,
      );

      await expect(
        service.remove('actor-1', mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when actor has transactions', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(
        mockActor,
      );
      (mockPrismaClient.transaction.count as jest.Mock).mockResolvedValue(5);

      await expect(service.remove('actor-1', mockAuthContext)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getActorStats', () => {
    it('should return complete actor statistics', async () => {
      const expectedStats: ActorStatistics = {
        actor: {
          id: 'actor-1',
          name: 'Test Actor',
          kind: ActorKind.USER,
        },
        statistics: {
          totalTransactions: 10,
          totalIncome: 5000,
          totalExpenses: 3000,
          netAmount: 2000,
          incomeTransactionCount: 5,
          expenseTransactionCount: 5,
          recentTransactions: 3,
        },
      };

      mockPrismaService.withContext
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(
              mockActor,
            );
            return fn(mockPrismaClient);
          },
        )
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            // Mock the count calls
            (
              mockPrismaClient.transaction.count as jest.Mock
            ).mockImplementation(
              (args: { where: { occurredOn?: unknown } }) => {
                if (args.where.occurredOn) {
                  return Promise.resolve(3); // recent transactions
                }
                return Promise.resolve(10); // total count
              },
            );

            // Mock the aggregate calls
            (
              mockPrismaClient.transaction.aggregate as jest.Mock
            ).mockImplementation(
              (args: {
                where: { amountYen?: { gt?: number; lt?: number } };
              }) => {
                if (args.where.amountYen?.gt === 0) {
                  return Promise.resolve({
                    _sum: { amountYen: BigInt(5000) },
                    _count: 5,
                  }); // income
                } else if (args.where.amountYen?.lt === 0) {
                  return Promise.resolve({
                    _sum: { amountYen: BigInt(-3000) },
                    _count: 5,
                  }); // expenses
                }
                return Promise.resolve({
                  _sum: { amountYen: BigInt(0) },
                  _count: 0,
                });
              },
            );
            return fn(mockPrismaClient);
          },
        );

      const result = await service.getActorStats('actor-1', mockAuthContext);

      expect(result).toEqual(expectedStats);
    });

    it('should handle null aggregation results', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            (
              mockPrismaClient.actor.findFirst as jest.Mock
            ).mockResolvedValueOnce(mockActor);
            return fn(mockPrismaClient);
          },
        )
        .mockImplementationOnce(
          <T>(
            context: AuthContext & { showDeleted?: boolean },
            fn: (prisma: PrismaClient) => Promise<T>,
          ) => {
            (mockPrismaClient.transaction.count as jest.Mock).mockResolvedValue(
              0,
            );
            (
              mockPrismaClient.transaction.aggregate as jest.Mock
            ).mockResolvedValue({
              _sum: { amountYen: null },
              _count: 0,
            });
            return fn(mockPrismaClient);
          },
        );

      const result = await service.getActorStats('actor-1', mockAuthContext);

      expect(result.statistics.totalIncome).toBe(0);
      expect(result.statistics.totalExpenses).toBe(0);
      expect(result.statistics.netAmount).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaService.withContext.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.findAll(mockAuthContext)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle actor not found in update', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'New Name' }, mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle actor not found in remove', async () => {
      mockPrismaService.withContext.mockImplementation(
        <T>(
          context: AuthContext & { showDeleted?: boolean },
          fn: (prisma: PrismaClient) => Promise<T>,
        ) => fn(mockPrismaClient),
      );
      (mockPrismaClient.actor.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
