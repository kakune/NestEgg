/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
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
import { ActorKind, UserRole, PrismaClient } from '@prisma/client';

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
    description: 'Test Description',
    householdId: 'household-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    user: mockUser,
  };

  const mockInstrumentActor: ActorWithUser = {
    id: 'actor-2',
    name: 'Credit Card',
    kind: ActorKind.INSTRUMENT,
    description: 'Main credit card',
    householdId: 'household-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
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

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findMany.mockResolvedValue(mockActors as any);

      const result = await service.findAll(mockAuthContext);

      expect(result).toEqual(mockActors);
      expect(mockPrismaService.withContext).toHaveBeenCalledWith(
        mockAuthContext,
        expect.any(Function),
      );
    });

    it('should filter actors by household', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findMany.mockImplementation((args: any) => {
        expect(args.where.householdId).toBe(mockAuthContext.householdId);
        expect(args.include.user).toBeDefined();
        expect(args.orderBy).toEqual([{ kind: 'asc' }, { name: 'asc' }]);
        return Promise.resolve([mockActor] as any);
      });

      await service.findAll(mockAuthContext);
    });

    it('should order actors by kind then by name', async () => {
      const orderedActors = [mockActor, mockInstrumentActor];

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findMany.mockResolvedValue(orderedActors as any);

      const result = await service.findAll(mockAuthContext);

      expect(result[0].kind).toBe(ActorKind.USER);
      expect(result[1].kind).toBe(ActorKind.INSTRUMENT);
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

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockResolvedValue(
        actorWithTransactions as any,
      );

      const result = await service.findOne('actor-1', mockAuthContext);

      expect(result).toEqual(actorWithTransactions);
    });

    it('should throw NotFoundException when actor not found', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce household isolation', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockImplementation((args: any) => {
        expect(args.where.id).toBe('actor-1');
        expect(args.where.householdId).toBe(mockAuthContext.householdId);
        expect(args.include.user).toBeDefined();
        expect(args.include.transactions).toBeDefined();
        return Promise.resolve(mockActor as any);
      });

      await service.findOne('actor-1', mockAuthContext);
    });
  });

  describe('findByUserId', () => {
    it('should return actors for specific user', async () => {
      const userActors = [mockActor];

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findMany.mockResolvedValue(userActors as any);

      const result = await service.findByUserId('user-1', mockAuthContext);

      expect(result).toEqual(userActors);
    });

    it('should filter by userId and householdId', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findMany.mockImplementation((args: any) => {
        expect(args.where.userId).toBe('user-1');
        expect(args.where.householdId).toBe(mockAuthContext.householdId);
        return Promise.resolve([mockActor] as any);
      });

      await service.findByUserId('user-1', mockAuthContext);
    });
  });

  describe('create', () => {
    const createActorDto: CreateActorDto = {
      name: 'New Actor',
      kind: ActorKind.INSTRUMENT,
      description: 'New Description',
    };

    it('should create actor successfully', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
        deletedAt: null,
      } as any);
      mockPrismaClient.actor.findFirst.mockResolvedValue(null);

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.create.mockResolvedValue(mockActor as any);

      const result = await service.create(createActorDto, mockAuthContext);

      expect(result).toEqual(mockActor);
      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockAuthContext.userId,
          householdId: mockAuthContext.householdId,
          deletedAt: null,
        },
      });
    });

    it('should allow admin to create actor for other user', async () => {
      const createForOtherUserDto = {
        ...createActorDto,
        userId: 'user-2',
      };

      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-2',
        householdId: 'household-1',
        deletedAt: null,
      } as any);
      mockPrismaClient.actor.findFirst.mockResolvedValue(null);

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.create.mockResolvedValue(mockActor as any);

      await service.create(createForOtherUserDto, mockAuthContext);

      expect(mockPrismaClient.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-2',
          householdId: 'household-1',
          deletedAt: null,
        },
      });
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
      mockPrismaClient.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(createActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when actor name already exists', async () => {
      mockPrismaClient.user.findFirst.mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
        deletedAt: null,
      } as any);
      mockPrismaClient.actor.findFirst.mockResolvedValue(mockActor as any);

      await expect(
        service.create(createActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const updateActorDto: UpdateActorDto = {
      name: 'Updated Actor',
      description: 'Updated Description',
    };

    it('should update actor successfully', async () => {
      const updatedActor = { ...mockActor, ...updateActorDto };

      mockPrismaService.withContext
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.actor.findFirst.mockResolvedValueOnce(
            mockActor as any,
          );
          return fn(mockPrismaClient);
        })
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.actor.update.mockResolvedValueOnce(
            updatedActor as any,
          );
          return fn(mockPrismaClient);
        });

      mockPrismaClient.actor.findFirst.mockResolvedValue(null);

      const result = await service.update(
        'actor-1',
        updateActorDto,
        mockAuthContext,
      );

      expect(result).toEqual(updatedActor);
    });

    it('should throw ForbiddenException when non-admin tries to update other user actor', async () => {
      const otherUserActor = { ...mockActor, userId: 'user-3' };

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockResolvedValue(otherUserActor as any);

      await expect(
        service.update('actor-1', updateActorDto, mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when new name already exists', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst
        .mockResolvedValueOnce(mockActor as any)
        .mockResolvedValueOnce({
          id: 'actor-2',
          name: 'Updated Actor',
        } as any);

      await expect(
        service.update('actor-1', updateActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove actor successfully', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.actor.findFirst.mockResolvedValueOnce(
            mockActor as any,
          );
          return fn(mockPrismaClient);
        })
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.actor.update.mockResolvedValueOnce(undefined as any);
          return fn(mockPrismaClient);
        });

      mockPrismaClient.transaction.count.mockResolvedValue(0);

      await service.remove('actor-1', mockAuthContext);

      expect(mockPrismaClient.transaction.count).toHaveBeenCalledWith({
        where: { actorId: 'actor-1' },
      });
    });

    it('should throw ForbiddenException when non-admin tries to delete other user actor', async () => {
      const otherUserActor = { ...mockActor, userId: 'user-3' };

      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockResolvedValue(otherUserActor as any);

      await expect(
        service.remove('actor-1', mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when actor has transactions', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockResolvedValue(mockActor as any);
      mockPrismaClient.transaction.count.mockResolvedValue(5);

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
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.actor.findFirst.mockResolvedValueOnce(
            mockActor as any,
          );
          return fn(mockPrismaClient);
        })
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.transaction.count
            .mockResolvedValueOnce(10) // total count
            .mockResolvedValueOnce(3); // recent count
          mockPrismaClient.transaction.aggregate
            .mockResolvedValueOnce({
              _sum: { amount: 5000 },
              _count: 5,
            } as any) // income
            .mockResolvedValueOnce({
              _sum: { amount: -3000 },
              _count: 5,
            } as any); // expenses
          return fn(mockPrismaClient);
        });

      const result = await service.getActorStats('actor-1', mockAuthContext);

      expect(result).toEqual(expectedStats);
    });

    it('should handle null aggregation results', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.actor.findFirst.mockResolvedValueOnce(
            mockActor as any,
          );
          return fn(mockPrismaClient);
        })
        .mockImplementationOnce((context, fn) => {
          mockPrismaClient.transaction.count
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);
          mockPrismaClient.transaction.aggregate
            .mockResolvedValueOnce({
              _sum: { amount: null },
              _count: 0,
            } as any)
            .mockResolvedValueOnce({
              _sum: { amount: null },
              _count: 0,
            } as any);
          return fn(mockPrismaClient);
        });

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
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'New Name' }, mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle actor not found in remove', async () => {
      mockPrismaService.withContext.mockImplementation((context, fn) =>
        fn(mockPrismaClient),
      );
      mockPrismaClient.actor.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
