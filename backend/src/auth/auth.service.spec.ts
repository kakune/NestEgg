import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService, JwtPayload, SafeUser } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreatePersonalAccessTokenDto } from './dto/create-personal-access-token.dto';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Define types for mocked Prisma models
interface MockUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  householdId: string;
  passwordHash: string;
  deletedAt: Date | null;
}

interface MockSession {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MockPersonalAccessToken {
  id: string;
  name: string;
  userId: string;
  scopes: string[];
  expiresAt: Date | null;
  revokedAt?: Date | null;
}

interface MockHousehold {
  id: string;
  name: string;
}

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    passwordHash: 'hashed-password',
    deletedAt: null,
  };

  const mockSafeUser: SafeUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    deletedAt: null,
  };

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    revokedAt: null,
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    prisma: {
      user: {
        findUnique: jest.fn() as jest.MockedFunction<
          (args: { where: { email: string } }) => Promise<MockUser | null>
        >,
        create: jest.fn() as jest.MockedFunction<
          (args: { data: Partial<MockUser> }) => Promise<MockUser>
        >,
      },
      session: {
        create: jest.fn() as jest.MockedFunction<
          (args: { data: Partial<MockSession> }) => Promise<MockSession>
        >,
        update: jest.fn() as jest.MockedFunction<
          (args: {
            where: { id: string };
            data: Partial<MockSession>;
          }) => Promise<MockSession>
        >,
        findUnique: jest.fn() as jest.MockedFunction<
          (args: { where: { id: string } }) => Promise<MockSession | null>
        >,
      },
      personalAccessToken: {
        create: jest.fn() as jest.MockedFunction<
          (args: {
            data: Partial<MockPersonalAccessToken>;
          }) => Promise<MockPersonalAccessToken>
        >,
        update: jest.fn() as jest.MockedFunction<
          (args: {
            where: { id: string; userId: string };
            data: Partial<MockPersonalAccessToken>;
          }) => Promise<MockPersonalAccessToken>
        >,
      },
      household: {
        create: jest.fn() as jest.MockedFunction<
          (args: { data: { name: string } }) => Promise<MockHousehold>
        >,
      },
    },
  };

  const mockUsersService = {
    findByEmail: jest.fn() as jest.MockedFunction<
      (email: string) => Promise<SafeUser | null>
    >,
    create: jest.fn() as jest.MockedFunction<
      (data: unknown) => Promise<SafeUser>
    >,
  };

  const mockJwtService = {
    sign: jest.fn() as jest.MockedFunction<
      (payload: JwtPayload, options?: { expiresIn?: string }) => string
    >,
    verify: jest.fn() as jest.MockedFunction<(token: string) => JwtPayload>,
  };

  const mockConfigService = {
    get: jest.fn() as jest.MockedFunction<
      (key: string, defaultValue?: unknown) => unknown
    >,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset all mocks
    jest.clearAllMocks();
    // Setup default config returns
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        if (key === 'BCRYPT_ROUNDS') return 12;
        if (key === 'JWT_EXPIRES_IN') return '24h';
        return defaultValue;
      },
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(mockSafeUser);
      expect(mockPrismaService.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          householdId: true,
          passwordHash: true,
          deletedAt: true,
        },
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'password',
        'hashed-password',
      );
    });

    it('should normalize email to lowercase', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);

      await service.validateUser('TEST@EXAMPLE.COM', 'password');

      expect(mockPrismaService.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: expect.any(Object) as Record<string, boolean>,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.prisma.user.findUnique).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(deletedUser);

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.validateUser('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('should login user successfully', async () => {
      const expectedPayload: JwtPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        householdId: mockUser.householdId,
        role: mockUser.role,
        sessionId: mockSession.id,
        tokenType: 'access',
      };

      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockPrismaService.prisma.session.create.mockResolvedValue(mockSession);
      mockJwtService.sign.mockReturnValue('jwt-token');
      mockConfigService.get.mockReturnValue('24h');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          householdId: mockUser.householdId,
          role: mockUser.role,
        },
        expiresIn: 86400,
      });

      expect(mockPrismaService.prisma.session.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          expiresAt: expect.any(Date) as Date,
        },
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(expectedPayload);
    });

    it('should handle different JWT expiration formats', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockPrismaService.prisma.session.create.mockResolvedValue(mockSession);
      mockJwtService.sign.mockReturnValue('jwt-token');

      // Test hours format
      mockConfigService.get.mockReturnValue('12h');
      let result = await service.login(loginDto);
      expect(result.expiresIn).toBe(43200); // 12 * 3600

      // Test days format
      mockConfigService.get.mockReturnValue('7d');
      result = await service.login(loginDto);
      expect(result.expiresIn).toBe(604800); // 7 * 86400

      // Test default - mock returns proper default for invalid format
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRES_IN') return 'invalid-format';
        return 12; // BCRYPT_ROUNDS
      });
      result = await service.login(loginDto);
      expect(result.expiresIn).toBe(86400); // Default 24h
    });

    it('should propagate validation errors', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'password',
      name: 'New User',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('should register new user successfully', async () => {
      const newUser = {
        id: 'user-2',
        email: 'newuser@example.com',
        name: 'New User',
        householdId: 'household-2',
        role: UserRole.admin,
      };

      const household = {
        id: 'household-2',
        name: "New User's Household",
      };

      mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);
      mockPrismaService.prisma.household.create.mockResolvedValue(household);
      mockPrismaService.prisma.user.create.mockResolvedValue(newUser);
      mockPrismaService.prisma.session.create.mockResolvedValue({
        ...mockSession,
        id: 'session-2',
      });
      mockedBcrypt.hash.mockResolvedValue('hashed-new-password');
      mockJwtService.sign.mockReturnValue('new-jwt-token');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        accessToken: 'new-jwt-token',
        user: newUser,
        expiresIn: 86400,
      });

      expect(mockPrismaService.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@example.com' },
      });

      expect(mockPrismaService.prisma.household.create).toHaveBeenCalledWith({
        data: {
          name: "New User's Household",
        },
      });

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password', 12);
    });

    it('should register user to existing household', async () => {
      const registerWithHouseholdDto = {
        ...registerDto,
        householdId: 'existing-household',
      };

      const newUser = {
        id: 'user-3',
        email: 'newuser@example.com',
        name: 'New User',
        householdId: 'existing-household',
        role: UserRole.member,
      };

      mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);
      mockPrismaService.prisma.user.create.mockResolvedValue(newUser);
      mockPrismaService.prisma.session.create.mockResolvedValue(mockSession);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(registerWithHouseholdDto);

      expect(result.user.role).toBe(UserRole.member);
      expect(mockPrismaService.prisma.household.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user already exists', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should normalize email to lowercase during registration', async () => {
      const upperCaseEmailDto = {
        ...registerDto,
        email: 'NEWUSER@EXAMPLE.COM',
      };

      mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);
      mockPrismaService.prisma.household.create.mockResolvedValue({
        id: 'household-1',
        name: 'Test',
      });
      mockPrismaService.prisma.user.create.mockResolvedValue(mockSafeUser);
      mockPrismaService.prisma.session.create.mockResolvedValue(mockSession);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwtService.sign.mockReturnValue('jwt-token');

      await service.register(upperCaseEmailDto);

      expect(mockPrismaService.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@example.com' },
      });
    });
  });

  describe('logout', () => {
    it('should logout user by revoking session', async () => {
      mockPrismaService.prisma.session.update.mockResolvedValue(mockSession);

      await service.logout('session-1');

      expect(mockPrismaService.prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) as Date },
      });
    });

    it('should handle database errors during logout', async () => {
      mockPrismaService.prisma.session.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.logout('session-1')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('createPersonalAccessToken', () => {
    const createPatDto: CreatePersonalAccessTokenDto = {
      name: 'Test Token',
      scopes: ['read', 'write'],
      expiresInDays: 30,
    };

    it('should create personal access token successfully', async () => {
      const mockPat = {
        id: 'pat-1',
        name: 'Test Token',
        userId: 'user-1',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.prisma.personalAccessToken.create.mockResolvedValue(
        mockPat,
      );
      mockJwtService.sign.mockReturnValue('pat-token');

      const result = await service.createPersonalAccessToken(
        'user-1',
        createPatDto,
      );

      expect(result).toEqual({
        token: 'pat-token',
        id: 'pat-1',
      });

      expect(
        mockPrismaService.prisma.personalAccessToken.create,
      ).toHaveBeenCalledWith({
        data: {
          name: 'Test Token',
          userId: 'user-1',
          scopes: ['read', 'write'],
          expiresAt: expect.any(Date) as Date,
        },
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          sub: mockUser.id,
          email: mockUser.email,
          householdId: mockUser.householdId,
          role: mockUser.role,
          tokenType: 'pat',
        },
        { expiresIn: undefined },
      );
    });

    it('should create token without expiration', async () => {
      const createPatDtoNoExpiry = {
        ...createPatDto,
        expiresInDays: undefined,
      };
      const mockPat = {
        id: 'pat-1',
        name: 'Test Token',
        userId: 'user-1',
        scopes: ['read', 'write'],
        expiresAt: null,
      };

      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.prisma.personalAccessToken.create.mockResolvedValue(
        mockPat,
      );
      mockJwtService.sign.mockReturnValue('pat-token');

      await service.createPersonalAccessToken('user-1', createPatDtoNoExpiry);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object) as JwtPayload,
        {
          expiresIn: '365d',
        },
      );
    });

    it('should use default scopes when none provided', async () => {
      const createPatDtoNoScopes = { ...createPatDto, scopes: undefined };

      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.prisma.personalAccessToken.create.mockResolvedValue({
        id: 'pat-1',
        name: 'Test Token',
        userId: 'user-1',
        scopes: ['read'],
        expiresAt: null,
      });
      mockJwtService.sign.mockReturnValue('pat-token');

      await service.createPersonalAccessToken('user-1', createPatDtoNoScopes);

      expect(
        mockPrismaService.prisma.personalAccessToken.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopes: ['read'],
        }) as Record<string, unknown>,
      });
    });

    it('should throw BadRequestException when user not found', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createPersonalAccessToken('nonexistent-user', createPatDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokePersonalAccessToken', () => {
    it('should revoke personal access token', async () => {
      mockPrismaService.prisma.personalAccessToken.update.mockResolvedValue({});

      await service.revokePersonalAccessToken('user-1', 'pat-1');

      expect(
        mockPrismaService.prisma.personalAccessToken.update,
      ).toHaveBeenCalledWith({
        where: {
          id: 'pat-1',
          userId: 'user-1',
        },
        data: {
          revokedAt: expect.any(Date) as Date,
        },
      });
    });

    it('should handle database errors during revocation', async () => {
      mockPrismaService.prisma.personalAccessToken.update.mockRejectedValue(
        new Error('Token not found'),
      );

      await expect(
        service.revokePersonalAccessToken('user-1', 'nonexistent-pat'),
      ).rejects.toThrow('Token not found');
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const activeSession = {
        ...mockSession,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000), // 1 minute in future
      };

      mockPrismaService.prisma.session.findUnique.mockResolvedValue(
        activeSession,
      );
      mockPrismaService.prisma.session.update.mockResolvedValue(activeSession);

      const result = await service.validateSession('session-1');

      expect(result).toBe(true);
      expect(mockPrismaService.prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { lastActiveAt: expect.any(Date) as Date },
      });
    });

    it('should reject non-existent session', async () => {
      mockPrismaService.prisma.session.findUnique.mockResolvedValue(null);

      const result = await service.validateSession('nonexistent-session');

      expect(result).toBe(false);
      expect(mockPrismaService.prisma.session.update).not.toHaveBeenCalled();
    });

    it('should reject revoked session', async () => {
      const revokedSession = {
        ...mockSession,
        revokedAt: new Date(),
      };

      mockPrismaService.prisma.session.findUnique.mockResolvedValue(
        revokedSession,
      );

      const result = await service.validateSession('session-1');

      expect(result).toBe(false);
    });

    it('should reject expired session', async () => {
      const expiredSession = {
        ...mockSession,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60000), // 1 minute in past
      };

      mockPrismaService.prisma.session.findUnique.mockResolvedValue(
        expiredSession,
      );

      const result = await service.validateSession('session-1');

      expect(result).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password with correct rounds', async () => {
      mockConfigService.get.mockReturnValue(10);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');

      const result = await service.hashPassword('plaintext-password');

      expect(result).toBe('hashed-password');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-password', 10);
      expect(mockConfigService.get).toHaveBeenCalledWith('BCRYPT_ROUNDS', 12);
    });

    it('should use default rounds when config not available', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'BCRYPT_ROUNDS') return defaultValue; // Use default value when config is undefined
          return defaultValue || 12; // Return the default value when config is not available
        },
      );
      mockedBcrypt.hash.mockResolvedValue('hashed-password');

      await service.hashPassword('plaintext-password');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-password', 12);
    });
  });

  describe('comparePasswords', () => {
    it('should compare passwords correctly', async () => {
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.comparePasswords('plaintext', 'hashed');

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('plaintext', 'hashed');
    });

    it('should return false for incorrect passwords', async () => {
      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await service.comparePasswords('wrong-password', 'hashed');

      expect(result).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database connection errors', async () => {
      mockPrismaService.prisma.user.findUnique.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt errors', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow('Bcrypt error');
    });

    it('should handle JWT errors', async () => {
      mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockPrismaService.prisma.session.create.mockResolvedValue(mockSession);
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT error');
      });

      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      await expect(service.login(loginDto)).rejects.toThrow('JWT error');
    });
  });
});
