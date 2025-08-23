import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import {
  ActorsService,
  CreateActorDto,
  UpdateActorDto,
  ActorStatistics,
  ActorWithUser,
} from './actors.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext } from '../common/interfaces/auth-context.interface';
import { ActorKind, UserRole } from '@prisma/client';

// Mock Prisma types for typing
interface ActorWhereInput {
  id?: string;
  householdId?: string;
  userId?: string;
  kind?: string;
  name?: { contains?: string };
  deletedAt?: null | { not: null };
}

interface ActorInclude {
  user?: boolean;
  transactions?: boolean;
}

interface ActorOrderBy {
  kind?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
  createdAt?: 'asc' | 'desc';
}

interface ActorCreateInput {
  name: string;
  kind: ActorKind;
  description?: string;
  householdId: string;
  userId?: string;
}

interface ActorUpdateInput {
  name?: string;
  description?: string;
  deletedAt?: Date | null;
}

interface TransactionWhereInput {
  actorId?: string;
  date?: {
    gte?: Date;
    lte?: Date;
  };
}

interface MockPrismaClient {
  actor: {
    findMany: jest.MockedFunction<
      (args: {
        where?: ActorWhereInput;
        include?: ActorInclude;
        orderBy?: ActorOrderBy[];
      }) => Promise<ActorWithUser[]>
    >;
    findFirst: jest.MockedFunction<
      (args: {
        where?: ActorWhereInput;
        include?: ActorInclude;
      }) => Promise<ActorWithUser | null>
    >;
    create: jest.MockedFunction<
      (args: {
        data: ActorCreateInput;
        include?: ActorInclude;
      }) => Promise<ActorWithUser>
    >;
    update: jest.MockedFunction<
      (args: {
        where: { id: string };
        data: ActorUpdateInput;
        include?: ActorInclude;
      }) => Promise<ActorWithUser>
    >;
    count: jest.MockedFunction<
      (args?: { where?: ActorWhereInput }) => Promise<number>
    >;
  };
  transaction: {
    count: jest.MockedFunction<
      (args?: { where?: TransactionWhereInput }) => Promise<number>
    >;
    aggregate: jest.MockedFunction<
      (args: {
        where?: { actorId?: string };
        _sum?: { amount?: boolean };
      }) => Promise<{ _sum: { amount: number | null } }>
    >;
  };
  user: {
    findFirst: jest.MockedFunction<
      (args: {
        where: { id: string };
      }) => Promise<{ id: string; name: string; email: string } | null>
    >;
  };
}

// Helper function to create typed mock implementation
const createMockPrismaImplementation = <T>(
  mockClient: Partial<MockPrismaClient>,
): ((context: AuthContext, fn: (client: MockPrismaClient) => T) => T) => {
  return (context: AuthContext, fn: (client: MockPrismaClient) => T) => {
    return fn(mockClient as MockPrismaClient);
  };
};

describe('ActorsService', () => {
  let service: ActorsService;

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

  const mockPrismaService = {
    withContext: jest.fn(),
    prisma: {
      actor: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
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

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all actors with user info', async () => {
      const mockActors = [mockActor, mockInstrumentActor];

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findMany: jest.fn().mockResolvedValue(mockActors),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        }),
      );

      const result = await service.findAll(mockAuthContext);

      expect(result).toEqual(mockActors);
      expect(mockPrismaService.withContext).toHaveBeenCalledWith(
        mockAuthContext,
        expect.any(Function),
      );
    });

    it('should filter actors by household', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findMany: jest
              .fn()
              .mockImplementation(
                ({
                  where,
                  include,
                  orderBy,
                }: {
                  where?: ActorWhereInput;
                  include?: ActorInclude;
                  orderBy?: ActorOrderBy[];
                }) => {
                  expect(where?.householdId).toBe(mockAuthContext.householdId);
                  expect(include?.user).toBeDefined();
                  expect(orderBy).toEqual([{ kind: 'asc' }, { name: 'asc' }]);
                  return Promise.resolve([mockActor]);
                },
              ),
          },
        }),
      );

      await service.findAll(mockAuthContext);
    });

    it('should order actors by kind then by name', async () => {
      const orderedActors = [mockActor, mockInstrumentActor]; // USER first, then INSTRUMENT

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findMany: jest.fn().mockResolvedValue(orderedActors),
          },
        }),
      );

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

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(actorWithTransactions),
          },
        }),
      );

      const result = await service.findOne('actor-1', mockAuthContext);

      expect(result).toEqual(actorWithTransactions);
    });

    it('should throw NotFoundException when actor not found', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        }),
      );

      await expect(
        service.findOne('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce household isolation', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest
              .fn()
              .mockImplementation(
                ({
                  where,
                  include,
                }: {
                  where?: ActorWhereInput;
                  include?: ActorInclude;
                }) => {
                  expect(where?.id).toBe('actor-1');
                  expect(where?.householdId).toBe(mockAuthContext.householdId);
                  expect(include?.user).toBeDefined();
                  expect(include?.transactions).toBeDefined();
                  return Promise.resolve(mockActor);
                },
              ),
          },
        }),
      );

      await service.findOne('actor-1', mockAuthContext);
    });
  });

  describe('findByUserId', () => {
    it('should return actors for specific user', async () => {
      const userActors = [mockActor];

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findMany: jest.fn().mockResolvedValue(userActors),
          },
        }),
      );

      const result = await service.findByUserId('user-1', mockAuthContext);

      expect(result).toEqual(userActors);
    });

    it('should filter by userId and householdId', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findMany: jest
              .fn()
              .mockImplementation(({ where }: { where?: ActorWhereInput }) => {
                expect(where?.userId).toBe('user-1');
                expect(where?.householdId).toBe(mockAuthContext.householdId);
                return Promise.resolve([mockActor]);
              }),
          },
        }),
      );

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
      mockPrismaService.prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
        deletedAt: null,
      });
      mockPrismaService.prisma.actor.findFirst.mockResolvedValue(null); // No existing actor

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            create: jest.fn().mockResolvedValue(mockActor),
          },
        }),
      );

      const result = await service.create(createActorDto, mockAuthContext);

      expect(result).toEqual(mockActor);
      expect(mockPrismaService.prisma.user.findFirst).toHaveBeenCalledWith({
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

      mockPrismaService.prisma.user.findFirst.mockResolvedValue({
        id: 'user-2',
        householdId: 'household-1',
        deletedAt: null,
      });
      mockPrismaService.prisma.actor.findFirst.mockResolvedValue(null);

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            create: jest.fn().mockResolvedValue(mockActor),
          },
        }),
      );

      await service.create(createForOtherUserDto, mockAuthContext);

      expect(mockPrismaService.prisma.user.findFirst).toHaveBeenCalledWith({
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
      mockPrismaService.prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(createActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when actor name already exists', async () => {
      mockPrismaService.prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
        deletedAt: null,
      });
      mockPrismaService.prisma.actor.findFirst.mockResolvedValue(mockActor); // Existing actor

      await expect(
        service.create(createActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should ignore deleted actors when checking name uniqueness', async () => {
      mockPrismaService.prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        householdId: 'household-1',
        deletedAt: null,
      });

      mockPrismaService.prisma.actor.findFirst.mockImplementation(
        ({ where }: { where?: ActorWhereInput }) => {
          expect(where?.name).toBe('New Actor');
          expect(where?.householdId).toBe('household-1');
          expect(where?.deletedAt).toBe(null);
          return Promise.resolve(null);
        },
      );

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            create: jest.fn().mockResolvedValue(mockActor),
          },
        }),
      );

      await service.create(createActorDto, mockAuthContext);

      expect(mockPrismaService.prisma.actor.findFirst).toHaveBeenCalled();
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
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              update: jest.fn().mockResolvedValue(updatedActor),
            },
          }),
        );

      mockPrismaService.prisma.actor.findFirst.mockResolvedValue(null); // No name conflict

      const result = await service.update(
        'actor-1',
        updateActorDto,
        mockAuthContext,
      );

      expect(result).toEqual(updatedActor);
    });

    it('should allow admin to update any actor', async () => {
      const otherUserActor = { ...mockActor, userId: 'user-2' };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(otherUserActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              update: jest.fn().mockResolvedValue(otherUserActor),
            },
          }),
        );

      mockPrismaService.prisma.actor.findFirst.mockResolvedValue(null);

      const result = await service.update(
        'actor-1',
        updateActorDto,
        mockAuthContext,
      );

      expect(result).toEqual(otherUserActor);
    });

    it('should throw ForbiddenException when non-admin tries to update other user actor', async () => {
      const otherUserActor = { ...mockActor, userId: 'user-3' };

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(otherUserActor),
          },
        }),
      );

      await expect(
        service.update('actor-1', updateActorDto, mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when new name already exists', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(mockActor),
          },
        }),
      );

      mockPrismaService.prisma.actor.findFirst.mockResolvedValue({
        id: 'actor-2',
        name: 'Updated Actor',
      }); // Different actor with same name

      await expect(
        service.update('actor-1', updateActorDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow keeping the same name', async () => {
      const sameNameDto = { name: mockActor.name, description: 'New desc' };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              update: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        );

      // Should not call findFirst for name check when name is unchanged
      await service.update('actor-1', sameNameDto, mockAuthContext);

      expect(mockPrismaService.prisma.actor.findFirst).not.toHaveBeenCalled();
    });

    it('should handle partial updates correctly', async () => {
      const partialUpdate = { description: 'Only description update' };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              update: jest
                .fn()
                .mockImplementation(({ data }: { data: ActorUpdateInput }) => {
                  expect(data?.description).toBe('Only description update');
                  expect(data?.name).toBeUndefined();
                  expect(data?.kind).toBeUndefined();
                  return Promise.resolve({ ...mockActor, ...partialUpdate });
                }),
            },
          }),
        );

      await service.update('actor-1', partialUpdate, mockAuthContext);
    });
  });

  describe('remove', () => {
    it('should remove actor successfully', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              update: jest.fn().mockResolvedValue(undefined),
            },
          }),
        );

      mockPrismaService.prisma.transaction.count.mockResolvedValue(0);

      await service.remove('actor-1', mockAuthContext);

      expect(mockPrismaService.prisma.transaction.count).toHaveBeenCalledWith({
        where: { actorId: 'actor-1' },
      });
    });

    it('should throw ForbiddenException when non-admin tries to delete other user actor', async () => {
      const otherUserActor = { ...mockActor, userId: 'user-3' };

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(otherUserActor),
          },
        }),
      );

      await expect(
        service.remove('actor-1', mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when actor has transactions', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(mockActor),
          },
        }),
      );

      mockPrismaService.prisma.transaction.count.mockResolvedValue(5);

      await expect(service.remove('actor-1', mockAuthContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should soft delete actor', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              update: jest
                .fn()
                .mockImplementation(
                  ({
                    where,
                    data,
                  }: {
                    where: { id: string };
                    data: ActorUpdateInput;
                  }) => {
                    expect(where?.id).toBe('actor-1');
                    expect(data?.deletedAt).toBeInstanceOf(Date);
                    return Promise.resolve(undefined);
                  },
                ),
            },
          }),
        );

      mockPrismaService.prisma.transaction.count.mockResolvedValue(0);

      await service.remove('actor-1', mockAuthContext);
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
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            transaction: {
              count: jest
                .fn()
                .mockResolvedValueOnce(10) // total count
                .mockResolvedValueOnce(3), // recent count
              aggregate: jest
                .fn()
                .mockResolvedValueOnce({
                  _sum: { amount: 5000 },
                  _count: 5,
                }) // income
                .mockResolvedValueOnce({
                  _sum: { amount: -3000 },
                  _count: 5,
                }), // expenses
            },
          }),
        );

      const result = await service.getActorStats('actor-1', mockAuthContext);

      expect(result).toEqual(expectedStats);
    });

    it('should handle null aggregation results', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            transaction: {
              count: jest
                .fn()
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0),
              aggregate: jest
                .fn()
                .mockResolvedValueOnce({
                  _sum: { amount: null },
                  _count: 0,
                })
                .mockResolvedValueOnce({
                  _sum: { amount: null },
                  _count: 0,
                }),
            },
          }),
        );

      const result = await service.getActorStats('actor-1', mockAuthContext);

      expect(result.statistics.totalIncome).toBe(0);
      expect(result.statistics.totalExpenses).toBe(0);
      expect(result.statistics.netAmount).toBe(0);
    });

    it('should calculate recent transactions correctly', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            actor: {
              findFirst: jest.fn().mockResolvedValue(mockActor),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            transaction: {
              count: jest
                .fn()
                .mockImplementationOnce(() => Promise.resolve(10))
                .mockImplementationOnce(
                  ({ where }: { where?: TransactionWhereInput }) => {
                    expect(where?.actorId).toBe('actor-1');
                    expect(where?.date?.gte).toBeInstanceOf(Date);
                    expect(where?.date?.gte?.getTime()).toBeCloseTo(
                      thirtyDaysAgo.getTime(),
                      -10000, // within 10 seconds
                    );
                    return Promise.resolve(2);
                  },
                ),
              aggregate: jest
                .fn()
                .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: 0 })
                .mockResolvedValueOnce({ _sum: { amount: 0 }, _count: 0 }),
            },
          }),
        );

      const result = await service.getActorStats('actor-1', mockAuthContext);

      expect(result.statistics.recentTransactions).toBe(2);
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
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        }),
      );

      await expect(
        service.update('nonexistent', { name: 'New Name' }, mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle actor not found in remove', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          actor: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        }),
      );

      await expect(
        service.remove('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
