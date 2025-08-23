import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import {
  UsersService,
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  AuthContext,
} from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, User } from '@prisma/client';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock console.log to prevent test output pollution
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

// Mock Prisma types for typing
interface UserWhereInput {
  id?: string;
  email?: string;
  householdId?: string;
  role?: UserRole;
  deletedAt?: null | { not: null };
}

interface UserCreateInput {
  email: string;
  name?: string;
  role: UserRole;
  householdId: string;
  passwordHash: string;
}

interface UserUpdateInput {
  email?: string;
  name?: string;
  role?: UserRole;
  passwordHash?: string;
  deletedAt?: Date | null;
}

interface SessionWhereInput {
  userId?: string;
}

interface SessionUpdateInput {
  revokedAt?: Date;
}

interface TokenWhereInput {
  userId?: string;
}

interface TokenUpdateInput {
  revokedAt?: Date;
}

interface MockPrismaClient {
  user: {
    findMany: jest.MockedFunction<
      (args?: { where?: UserWhereInput; select?: unknown }) => Promise<User[]>
    >;
    findFirst: jest.MockedFunction<
      (args?: { where?: UserWhereInput }) => Promise<User | null>
    >;
    findUnique: jest.MockedFunction<
      (args: { where: { id?: string; email?: string } }) => Promise<User | null>
    >;
    create: jest.MockedFunction<
      (args: { data: UserCreateInput }) => Promise<User>
    >;
    update: jest.MockedFunction<
      (args: { where: { id: string }; data: UserUpdateInput }) => Promise<User>
    >;
    count: jest.MockedFunction<
      (args?: { where?: UserWhereInput }) => Promise<number>
    >;
    updateMany: jest.MockedFunction<
      (args: {
        where: UserWhereInput;
        data: UserUpdateInput;
      }) => Promise<{ count: number }>
    >;
  };
  session: {
    updateMany: jest.MockedFunction<
      (args: {
        where: SessionWhereInput;
        data: SessionUpdateInput;
      }) => Promise<{ count: number }>
    >;
  };
  personalAccessToken: {
    updateMany: jest.MockedFunction<
      (args: {
        where: TokenWhereInput;
        data: TokenUpdateInput;
      }) => Promise<{ count: number }>
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

describe('UsersService', () => {
  let service: UsersService;

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

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockUserSafe = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockPrismaService = {
    withContext: jest.fn(),
    prisma: {
      user: {
        findMany: jest.fn() as jest.MockedFunction<
          (args?: {
            where?: UserWhereInput;
            select?: unknown;
          }) => Promise<User[]>
        >,
        findFirst: jest.fn() as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >,
        findUnique: jest.fn() as jest.MockedFunction<
          (args: {
            where: { id?: string; email?: string };
          }) => Promise<User | null>
        >,
        create: jest.fn() as jest.MockedFunction<
          (args: { data: UserCreateInput }) => Promise<User>
        >,
        update: jest.fn() as jest.MockedFunction<
          (args: {
            where: { id: string };
            data: UserUpdateInput;
          }) => Promise<User>
        >,
        count: jest.fn() as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<number>
        >,
        updateMany: jest.fn() as jest.MockedFunction<
          (args: {
            where: UserWhereInput;
            data: UserUpdateInput;
          }) => Promise<{ count: number }>
        >,
      },
      session: {
        updateMany: jest.fn() as jest.MockedFunction<
          (args: {
            where: SessionWhereInput;
            data: SessionUpdateInput;
          }) => Promise<{ count: number }>
        >,
      },
      personalAccessToken: {
        updateMany: jest.fn() as jest.MockedFunction<
          (args: {
            where: TokenWhereInput;
            data: TokenUpdateInput;
          }) => Promise<{ count: number }>
        >,
      },
    },
  };

  const mockConfigService = {
    get: jest.fn() as jest.MockedFunction<
      (key: string, defaultValue?: unknown) => unknown
    >,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Reset all mocks
    jest.clearAllMocks();
    // Setup default config returns
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        if (key === 'BCRYPT_ROUNDS') return 12;
        return defaultValue;
      },
    );
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users in household', async () => {
      const mockUsers = [mockUserSafe];

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findMany: jest.fn().mockResolvedValue(mockUsers),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            updateMany: jest.fn(),
          },
        }),
      );

      const result = await service.findAll(mockAuthContext);

      expect(result).toEqual(mockUsers);
      expect(mockPrismaService.withContext).toHaveBeenCalledWith(
        mockAuthContext,
        expect.any(Function),
      );
    });

    it('should filter users by household', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findMany: jest
              .fn()
              .mockImplementation(
                ({
                  where,
                  select,
                }: {
                  where?: UserWhereInput;
                  select?: unknown;
                }) => {
                  expect(where?.householdId).toBe(mockAuthContext.householdId);
                  expect(
                    (select as Record<string, unknown>)?.passwordHash,
                  ).toBeUndefined();
                  return Promise.resolve([mockUserSafe]);
                },
              ),
          },
        }),
      );

      await service.findAll(mockAuthContext);
    });

    it('should exclude password hash from results', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findMany: jest
              .fn()
              .mockImplementation(
                ({ select }: { select: Record<string, unknown> }) => {
                  expect(select).not.toHaveProperty('passwordHash');
                  expect(select?.id).toBe(true);
                  expect(select?.email).toBe(true);
                  expect(select?.name).toBe(true);
                  expect(select?.role).toBe(true);
                  return Promise.resolve([]);
                },
              ),
          },
        }),
      );

      await service.findAll(mockAuthContext);
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest.fn().mockResolvedValue(mockUserSafe),
          },
        }),
      );

      const result = await service.findOne('user-1', mockAuthContext);

      expect(result).toEqual(mockUserSafe);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        }),
      );

      await expect(
        service.findOne('nonexistent', mockAuthContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by household and id', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest
              .fn()
              .mockImplementation(({ where }: { where?: UserWhereInput }) => {
                expect(where?.id).toBe('user-1');
                expect(where?.householdId).toBe(mockAuthContext.householdId);
                return Promise.resolve(mockUserSafe);
              }),
          },
        }),
      );

      await service.findOne('user-1', mockAuthContext);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.objectContaining({
          id: true,
          email: true,
          passwordHash: true,
        }) as Record<string, boolean>,
      });
    });

    it('should normalize email to lowercase', async () => {
      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(mockUser);

      await service.findByEmail('TEST@EXAMPLE.COM');

      expect(mockPrismaService.prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.any(Object) as Record<string, boolean>,
      });
    });

    it('should return null when user not found', async () => {
      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should include password hash in results', async () => {
      mockPrismaService.prisma.user.findFirst.mockImplementation(
        ({ select }: { select?: Record<string, boolean> }) => {
          expect(select?.passwordHash).toBe(true);
          return Promise.resolve(mockUser);
        },
      );

      await service.findByEmail('test@example.com');
    });
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      name: 'New User',
      role: UserRole.member,
      householdId: 'household-1',
    };

    it('should create user successfully', async () => {
      const newUser = {
        ...mockUserSafe,
        id: 'user-2',
        email: 'newuser@example.com',
        name: 'New User',
        role: UserRole.member,
      };

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null); // No existing user
      (
        mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('hashed-temp-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
        }),
      );

      const result = await service.create(createUserDto, mockAuthContext);

      expect(result).toEqual(newUser);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(expect.any(String), 12);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Temporary password for newuser@example.com:'),
      );
    });

    it('should throw ForbiddenException when non-admin tries to create user', async () => {
      await expect(
        service.create(createUserDto, mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when user already exists', async () => {
      mockPrismaService.prisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        deletedAt: null,
      });

      await expect(
        service.create(createUserDto, mockAuthContext),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow creating user if existing user is deleted', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      const newUser = { ...mockUserSafe, email: 'newuser@example.com' };

      mockPrismaService.prisma.user.findFirst.mockResolvedValue(deletedUser);
      (
        mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('hashed-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
        }),
      );

      const result = await service.create(createUserDto, mockAuthContext);

      expect(result).toEqual(newUser);
    });

    it('should default to member role when not specified', async () => {
      const createUserDtoNoRole = {
        email: 'newuser@example.com',
        name: 'New User',
        householdId: 'household-1',
      };

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);
      (
        mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('hashed-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            create: jest
              .fn()
              .mockImplementation(({ data }: { data: UserCreateInput }) => {
                expect(data?.role).toBe(UserRole.member);
                return Promise.resolve(mockUserSafe);
              }),
          },
        }),
      );

      await service.create(createUserDtoNoRole, mockAuthContext);
    });

    it('should normalize email to lowercase', async () => {
      const createUserDtoUpperCase = {
        ...createUserDto,
        email: 'NEWUSER@EXAMPLE.COM',
      };

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);
      (
        mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('hashed-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            create: jest
              .fn()
              .mockImplementation(({ data }: { data: UserCreateInput }) => {
                expect(data?.email).toBe('newuser@example.com');
                return Promise.resolve(mockUserSafe);
              }),
          },
        }),
      );

      await service.create(createUserDtoUpperCase, mockAuthContext);
    });

    it('should generate temporary password with correct length and characters', async () => {
      // Mock Math.random to make password generation predictable
      const mockMath = Object.create(global.Math) as Math;
      mockMath.random = jest.fn(() => 0.5);
      global.Math = mockMath;

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);
      (
        mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('hashed-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            create: jest.fn().mockResolvedValue(mockUserSafe),
          },
        }),
      );

      await service.create(createUserDto, mockAuthContext);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^[A-Za-z0-9!@#$%^&*]{12}$/),
        12,
      );
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      name: 'Updated Name',
      email: 'updated@example.com',
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUserSafe, ...updateUserDto };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(mockUserSafe),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest.fn().mockResolvedValue(updatedUser),
            },
          }),
        );

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null); // No email conflict

      const result = await service.update(
        'user-1',
        updateUserDto,
        mockAuthContext,
      );

      expect(result).toEqual(updatedUser);
    });

    it('should allow admin to update any user', async () => {
      const otherUser = { ...mockUserSafe, id: 'user-2' };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(otherUser),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest.fn().mockResolvedValue(otherUser),
            },
          }),
        );

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);

      const result = await service.update(
        'user-2',
        updateUserDto,
        mockAuthContext,
      );

      expect(result).toEqual(otherUser);
    });

    it('should throw ForbiddenException when non-admin tries to update other user', async () => {
      const otherUser = { ...mockUserSafe, id: 'user-3' };

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest.fn().mockResolvedValue(otherUser),
          },
        }),
      );

      await expect(
        service.update('user-3', updateUserDto, mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow user to update themselves', async () => {
      const userSelfUpdate = { ...mockUserSafe, id: 'user-2' };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(userSelfUpdate),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest.fn().mockResolvedValue(userSelfUpdate),
            },
          }),
        );

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);

      await service.update(
        'user-2',
        { name: 'New Name' },
        mockMemberAuthContext,
      );

      expect(mockPrismaService.withContext).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException when non-admin tries to change role', async () => {
      const updateWithRole = { ...updateUserDto, role: UserRole.admin };

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest.fn().mockResolvedValue(mockUserSafe),
          },
        }),
      );

      await expect(
        service.update('user-2', updateWithRole, mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent last admin from demoting themselves', async () => {
      const updateToMember = { role: UserRole.member };

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest.fn().mockResolvedValue(mockUserSafe),
          },
        }),
      );

      mockPrismaService.prisma.user.count.mockResolvedValue(1); // Only one admin

      await expect(
        service.update('user-1', updateToMember, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow admin demotion when multiple admins exist', async () => {
      const updateToMember = { role: UserRole.member };
      const demotedUser = { ...mockUserSafe, role: UserRole.member };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(mockUserSafe),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest.fn().mockResolvedValue(demotedUser),
            },
          }),
        );

      mockPrismaService.prisma.user.count.mockResolvedValue(2); // Multiple admins

      const result = await service.update(
        'user-1',
        updateToMember,
        mockAuthContext,
      );

      expect(result.role).toBe(UserRole.member);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest.fn().mockResolvedValue(mockUserSafe),
          },
        }),
      );

      mockPrismaService.prisma.user.findFirst.mockResolvedValue({
        id: 'other-user',
        email: 'updated@example.com',
        deletedAt: null,
      });

      await expect(
        service.update('user-1', updateUserDto, mockAuthContext),
      ).rejects.toThrow(ConflictException);
    });

    it('should normalize email to lowercase', async () => {
      const updateWithUpperEmail = { email: 'UPDATED@EXAMPLE.COM' };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(mockUserSafe),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest
                .fn()
                .mockImplementation(({ data }: { data: UserUpdateInput }) => {
                  expect(data?.email).toBe('updated@example.com');
                  return Promise.resolve(mockUserSafe);
                }),
            },
          }),
        );

      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);

      await service.update('user-1', updateWithUpperEmail, mockAuthContext);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'oldpassword',
      newPassword: 'newpassword',
    };

    it('should change password successfully', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue({
        passwordHash: 'hashed-old-password',
      } as User);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('hashed-new-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            update: jest.fn().mockResolvedValue(undefined),
          },
          session: {
            updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          },
        }),
      );

      await service.changePassword(
        'user-1',
        changePasswordDto,
        mockAuthContext,
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'oldpassword',
        'hashed-old-password',
      );
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newpassword', 12);
    });

    it('should allow admin to change other user password without current password', async () => {
      (
        mockPrismaService.prisma.user.findUnique as jest.MockedFunction<
          (args: {
            where: { id?: string; email?: string };
          }) => Promise<User | null>
        >
      ).mockResolvedValue({
        passwordHash: 'hashed-password',
      } as User);
      mockedBcrypt.hash.mockResolvedValue('hashed-new-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            update: jest.fn().mockResolvedValue(undefined),
          },
          session: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }),
      );

      await service.changePassword(
        'user-2',
        changePasswordDto,
        mockAuthContext,
      );

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-admin tries to change other password', async () => {
      await expect(
        service.changePassword(
          'user-3',
          changePasswordDto,
          mockMemberAuthContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(
          'nonexistent',
          changePasswordDto,
          mockAuthContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when current password is incorrect', async () => {
      (
        mockPrismaService.prisma.user.findUnique as jest.MockedFunction<
          (args: {
            where: { id?: string; email?: string };
          }) => Promise<User | null>
        >
      ).mockResolvedValue({
        passwordHash: 'hashed-password',
      } as User);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', changePasswordDto, mockAuthContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revoke all user sessions after password change', async () => {
      (
        mockPrismaService.prisma.user.findUnique as jest.MockedFunction<
          (args: {
            where: { id?: string; email?: string };
          }) => Promise<User | null>
        >
      ).mockResolvedValue({
        passwordHash: 'hashed-password',
      } as User);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockedBcrypt.hash.mockResolvedValue('hashed-new-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            update: jest.fn().mockResolvedValue(undefined),
          },
          session: {
            updateMany: jest
              .fn()
              .mockImplementation(
                ({
                  where,
                  data,
                }: {
                  where: SessionWhereInput;
                  data: SessionUpdateInput;
                }) => {
                  expect(where?.userId).toBe('user-1');
                  expect(data?.revokedAt).toBeInstanceOf(Date);
                  return Promise.resolve({ count: 2 });
                },
              ),
          },
        }),
      );

      await service.changePassword(
        'user-1',
        changePasswordDto,
        mockAuthContext,
      );
    });
  });

  describe('remove', () => {
    it('should remove user successfully', async () => {
      const memberUser = { ...mockUserSafe, role: UserRole.member };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(memberUser),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest.fn().mockResolvedValue(undefined),
            },
            session: {
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            personalAccessToken: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          }),
        );

      await service.remove('user-2', mockAuthContext);

      expect(mockPrismaService.withContext).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException when non-admin tries to delete user', async () => {
      await expect(
        service.remove('user-1', mockMemberAuthContext),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when trying to delete last admin', async () => {
      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            findFirst: jest.fn().mockResolvedValue(mockUserSafe),
          },
        }),
      );

      mockPrismaService.prisma.user.count.mockResolvedValue(1);

      await expect(service.remove('user-1', mockAuthContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow deleting admin when multiple admins exist', async () => {
      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(mockUserSafe),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest.fn().mockResolvedValue(undefined),
            },
            session: {
              updateMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
            personalAccessToken: {
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          }),
        );

      mockPrismaService.prisma.user.count.mockResolvedValue(2);

      await service.remove('user-1', mockAuthContext);
    });

    it('should soft delete user and revoke all sessions and tokens', async () => {
      const memberUser = { ...mockUserSafe, role: UserRole.member };

      mockPrismaService.withContext
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              findFirst: jest.fn().mockResolvedValue(memberUser),
            },
          }),
        )
        .mockImplementationOnce(
          createMockPrismaImplementation({
            user: {
              update: jest
                .fn()
                .mockImplementation(
                  ({
                    where,
                    data,
                  }: {
                    where: { id: string };
                    data: UserUpdateInput;
                  }) => {
                    expect(where?.id).toBe('user-2');
                    expect(data?.deletedAt).toBeInstanceOf(Date);
                    return Promise.resolve(undefined);
                  },
                ),
            },
            session: {
              updateMany: jest
                .fn()
                .mockImplementation(
                  ({
                    where,
                    data,
                  }: {
                    where: SessionWhereInput;
                    data: SessionUpdateInput;
                  }) => {
                    expect(where?.userId).toBe('user-2');
                    expect(data?.revokedAt).toBeInstanceOf(Date);
                    return Promise.resolve({ count: 1 });
                  },
                ),
            },
            personalAccessToken: {
              updateMany: jest
                .fn()
                .mockImplementation(
                  ({
                    where,
                    data,
                  }: {
                    where: TokenWhereInput;
                    data: TokenUpdateInput;
                  }) => {
                    expect(where?.userId).toBe('user-2');
                    expect(data?.revokedAt).toBeInstanceOf(Date);
                    return Promise.resolve({ count: 1 });
                  },
                ),
            },
          }),
        );

      await service.remove('user-2', mockAuthContext);
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

    it('should handle bcrypt errors during password operations', async () => {
      (
        mockPrismaService.prisma.user.findUnique as jest.MockedFunction<
          (args: {
            where: { id?: string; email?: string };
          }) => Promise<User | null>
        >
      ).mockResolvedValue({
        passwordHash: 'hashed-password',
      } as User);
      mockedBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      const changePasswordDto: ChangePasswordDto = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      };

      await expect(
        service.changePassword('user-1', changePasswordDto, mockAuthContext),
      ).rejects.toThrow('Bcrypt error');
    });

    it('should handle configuration errors for bcrypt rounds', async () => {
      (
        mockConfigService.get as jest.MockedFunction<
          (key: string, defaultValue?: unknown) => unknown
        >
      ).mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'BCRYPT_ROUNDS') return defaultValue; // Use default value when config is undefined
        return defaultValue || 12; // Return default for other keys
      });
      (
        mockPrismaService.prisma.user.findFirst as jest.MockedFunction<
          (args?: { where?: UserWhereInput }) => Promise<User | null>
        >
      ).mockResolvedValue(null);
      (
        mockedBcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>
      ).mockResolvedValue('hashed-password');

      mockPrismaService.withContext.mockImplementation(
        createMockPrismaImplementation({
          user: {
            create: jest.fn().mockResolvedValue(mockUserSafe),
          },
        }),
      );

      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        name: 'Test User',
        householdId: 'household-1',
      };

      await service.create(createUserDto, mockAuthContext);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(expect.any(String), 12);
    });
  });
});
