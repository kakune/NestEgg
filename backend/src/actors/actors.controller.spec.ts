import { Test, TestingModule } from '@nestjs/testing';
import { ActorsController } from './actors.controller';
import { ActorsService } from './actors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole, ActorKind } from '@prisma/client';
import type { AuthenticatedUser } from '../common/interfaces/auth-context.interface';
import type { Actor } from '@prisma/client';
import type { ActorStatistics } from './actors.service';

describe('ActorsController', () => {
  let controller: ActorsController;

  const mockUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'test@example.com',
    householdId: 'household-1',
    role: UserRole.member,
  };

  const mockActor: Actor = {
    id: 'actor-1',
    name: 'Test Actor',
    kind: ActorKind.USER,
    userId: 'user-1',
    householdId: 'household-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInstrumentActor: Actor = {
    id: 'actor-2',
    name: 'Credit Card',
    kind: ActorKind.INSTRUMENT,
    userId: null,
    householdId: 'household-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockActorsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUserId: jest.fn(),
    getActorStats: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActorsController],
      providers: [
        {
          provide: ActorsService,
          useValue: mockActorsService,
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

    controller = module.get<ActorsController>(ActorsController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all actors for the household', async () => {
      const mockActors = [mockActor, mockInstrumentActor];
      mockActorsService.findAll.mockResolvedValue(mockActors);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual(mockActors);
      expect(mockActorsService.findAll).toHaveBeenCalledWith(mockUser);
      expect(mockActorsService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no actors exist', async () => {
      mockActorsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual([]);
      expect(mockActorsService.findAll).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('findOne', () => {
    it('should return a specific actor', async () => {
      mockActorsService.findOne.mockResolvedValue(mockActor);

      const result = await controller.findOne('actor-1', mockUser);

      expect(result).toEqual(mockActor);
      expect(mockActorsService.findOne).toHaveBeenCalledWith(
        'actor-1',
        mockUser,
      );
      expect(mockActorsService.findOne).toHaveBeenCalledTimes(1);
    });

    it('should handle actor not found', async () => {
      const error = new Error('Actor not found');
      mockActorsService.findOne.mockRejectedValue(error);

      await expect(controller.findOne('invalid-id', mockUser)).rejects.toThrow(
        error,
      );
      expect(mockActorsService.findOne).toHaveBeenCalledWith(
        'invalid-id',
        mockUser,
      );
    });
  });

  describe('findByUserId', () => {
    it('should return actors for a specific user', async () => {
      const userActors = [mockActor];
      mockActorsService.findByUserId.mockResolvedValue(userActors);

      const result = await controller.findByUserId('user-1', mockUser);

      expect(result).toEqual(userActors);
      expect(mockActorsService.findByUserId).toHaveBeenCalledWith(
        'user-1',
        mockUser,
      );
      expect(mockActorsService.findByUserId).toHaveBeenCalledTimes(1);
    });

    it('should return empty array for user without actors', async () => {
      mockActorsService.findByUserId.mockResolvedValue([]);

      const result = await controller.findByUserId('user-2', mockUser);

      expect(result).toEqual([]);
      expect(mockActorsService.findByUserId).toHaveBeenCalledWith(
        'user-2',
        mockUser,
      );
    });
  });

  describe('getActorStats', () => {
    it('should return actor statistics', async () => {
      const mockStats: ActorStatistics = {
        actor: {
          id: 'actor-1',
          name: 'Test Actor',
          kind: ActorKind.USER,
        },
        statistics: {
          totalTransactions: 50,
          totalIncome: 15000,
          totalExpenses: 10000,
          netAmount: 5000,
          incomeTransactionCount: 30,
          expenseTransactionCount: 20,
          recentTransactions: 10,
        },
      };
      mockActorsService.getActorStats.mockResolvedValue(mockStats);

      const result = (await controller.getActorStats(
        'actor-1',
        mockUser,
      )) as ActorStatistics;

      expect(result).toEqual(mockStats);
      expect(mockActorsService.getActorStats).toHaveBeenCalledWith(
        'actor-1',
        mockUser,
      );
      expect(mockActorsService.getActorStats).toHaveBeenCalledTimes(1);
    });

    it('should return empty stats for new actor', async () => {
      const emptyStats: ActorStatistics = {
        actor: {
          id: 'actor-new',
          name: 'New Actor',
          kind: ActorKind.INSTRUMENT,
        },
        statistics: {
          totalTransactions: 0,
          totalIncome: 0,
          totalExpenses: 0,
          netAmount: 0,
          incomeTransactionCount: 0,
          expenseTransactionCount: 0,
          recentTransactions: 0,
        },
      };
      mockActorsService.getActorStats.mockResolvedValue(emptyStats);

      const result = (await controller.getActorStats(
        'actor-new',
        mockUser,
      )) as ActorStatistics;

      expect(result).toEqual(emptyStats);
      expect(mockActorsService.getActorStats).toHaveBeenCalledWith(
        'actor-new',
        mockUser,
      );
    });
  });

  describe('create', () => {
    it('should create a new instrument actor', async () => {
      const createActorDto = {
        name: 'New Credit Card',
        kind: ActorKind.INSTRUMENT,
        isActive: true,
      };

      const newActor = {
        ...mockInstrumentActor,
        id: 'actor-new',
        name: 'New Credit Card',
      };

      mockActorsService.create.mockResolvedValue(newActor);

      const result = await controller.create(createActorDto, mockUser);

      expect(result).toEqual(newActor);
      expect(mockActorsService.create).toHaveBeenCalledWith(
        createActorDto,
        mockUser,
      );
      expect(mockActorsService.create).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors', async () => {
      const createActorDto = {
        name: '',
        kind: ActorKind.INSTRUMENT,
        isActive: true,
      };

      const error = new Error('Validation failed: Name is required');
      mockActorsService.create.mockRejectedValue(error);

      await expect(controller.create(createActorDto, mockUser)).rejects.toThrow(
        error,
      );
      expect(mockActorsService.create).toHaveBeenCalledWith(
        createActorDto,
        mockUser,
      );
    });
  });

  describe('update', () => {
    it('should update an existing actor', async () => {
      const updateActorDto = {
        name: 'Updated Actor Name',
        kind: ActorKind.INSTRUMENT,
      };

      const updatedActor = {
        ...mockActor,
        name: 'Updated Actor Name',
        kind: ActorKind.INSTRUMENT,
      };

      mockActorsService.update.mockResolvedValue(updatedActor);

      const result = await controller.update(
        'actor-1',
        updateActorDto,
        mockUser,
      );

      expect(result).toEqual(updatedActor);
      expect(mockActorsService.update).toHaveBeenCalledWith(
        'actor-1',
        updateActorDto,
        mockUser,
      );
      expect(mockActorsService.update).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const updateActorDto = {
        name: 'New Name',
      };

      const updatedActor = {
        ...mockActor,
        name: 'New Name',
      };

      mockActorsService.update.mockResolvedValue(updatedActor);

      const result = await controller.update(
        'actor-1',
        updateActorDto,
        mockUser,
      );

      expect(result).toEqual(updatedActor);
      expect(mockActorsService.update).toHaveBeenCalledWith(
        'actor-1',
        updateActorDto,
        mockUser,
      );
    });

    it('should handle actor not found', async () => {
      const updateActorDto = {
        name: 'Updated Name',
      };

      const error = new Error('Actor not found');
      mockActorsService.update.mockRejectedValue(error);

      await expect(
        controller.update('invalid-id', updateActorDto, mockUser),
      ).rejects.toThrow(error);
      expect(mockActorsService.update).toHaveBeenCalledWith(
        'invalid-id',
        updateActorDto,
        mockUser,
      );
    });
  });

  describe('remove', () => {
    it('should remove an actor', async () => {
      mockActorsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('actor-1', mockUser);

      expect(result).toBeUndefined();
      expect(mockActorsService.remove).toHaveBeenCalledWith(
        'actor-1',
        mockUser,
      );
      expect(mockActorsService.remove).toHaveBeenCalledTimes(1);
    });

    it('should handle removal of non-existent actor', async () => {
      const error = new Error('Actor not found');
      mockActorsService.remove.mockRejectedValue(error);

      await expect(controller.remove('invalid-id', mockUser)).rejects.toThrow(
        error,
      );
      expect(mockActorsService.remove).toHaveBeenCalledWith(
        'invalid-id',
        mockUser,
      );
    });

    it('should handle removal of protected actor', async () => {
      const error = new Error('Cannot remove USER actor');
      mockActorsService.remove.mockRejectedValue(error);

      await expect(controller.remove('actor-user', mockUser)).rejects.toThrow(
        error,
      );
      expect(mockActorsService.remove).toHaveBeenCalledWith(
        'actor-user',
        mockUser,
      );
    });
  });
});
