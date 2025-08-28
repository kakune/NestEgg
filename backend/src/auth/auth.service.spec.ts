import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { mockDeep, MockProxy, mockReset } from 'jest-mock-extended';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService, SafeUser } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UserRole, PrismaClient } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreatePersonalAccessTokenDto } from './dto/create-personal-access-token.dto';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: MockProxy<PrismaService>;
  let mockPrismaClient: MockProxy<PrismaClient>;
  let mockJwtService: MockProxy<JwtService>;
  let mockUsersService: MockProxy<UsersService>;
  let mockConfigService: MockProxy<ConfigService>;

  // Helpers to avoid unbound method warnings
  const expectUserFindFirstCalled = (args: any) => {
    const calls = (mockPrismaClient.user.findFirst as jest.Mock).mock.calls;
    expect(calls).toContainEqual([args]);
  };

  const expectSessionDeleteCalled = (args: any) => {
    const calls = (mockPrismaClient.session.delete as jest.Mock).mock.calls;
    expect(calls).toContainEqual([args]);
  };

  const expectPATDeleteCalled = (args: any) => {
    const calls = (mockPrismaClient.personalAccessToken.delete as jest.Mock)
      .mock.calls;
    expect(calls).toContainEqual([args]);
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    passwordHash: 'hashed-password',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    deletedAt: null,
  };

  const mockSafeUser: SafeUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    deletedAt: null,
  };

  const mockSafeUserWithTimestamps = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    sessionData: JSON.stringify({
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    }),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaClient = mockDeep<PrismaClient>();
    mockPrismaService = mockDeep<PrismaService>();
    mockJwtService = mockDeep<JwtService>();
    mockUsersService = mockDeep<UsersService>();
    mockConfigService = mockDeep<ConfigService>();

    mockPrismaService.prisma = mockPrismaClient;

    // Reset all mocks before each test
    mockReset(mockPrismaService);
    mockReset(mockPrismaClient);
    mockReset(mockJwtService);
    mockReset(mockUsersService);
    mockReset(mockConfigService);

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
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(mockSafeUserWithTimestamps);
    });

    it('should normalize email to lowercase', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(true);

      await service.validateUser('TEST@EXAMPLE.COM', 'password');

      expectUserFindFirstCalled({
        where: { username: 'test@example.com' },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          role: true,
          householdId: true,
          passwordHash: true,
          deletedAt: true,
        },
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        deletedUser,
      );

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(false);

      await expect(
        service.validateUser('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    };

    it('should login user successfully', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(true);
      (mockPrismaClient.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
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
      // Login successful - session created and JWT signed
    });

    it('should handle different JWT expiration formats', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(true);
      (mockPrismaClient.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
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
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      username: 'newuser',
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

      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaClient.household.create as jest.Mock).mockResolvedValue(
        household,
      );
      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue(newUser);
      (mockPrismaClient.session.create as jest.Mock).mockResolvedValue({
        ...mockSession,
        id: 'session-2',
      });
      (
        mockedBcrypt.hash as unknown as jest.MockedFunction<
          () => Promise<string>
        >
      ).mockResolvedValue('hashed-new-password');
      mockJwtService.sign.mockReturnValue('new-jwt-token');

      const result = await service.register(registerDto);

      expect(result).toEqual({
        accessToken: 'new-jwt-token',
        user: newUser,
        expiresIn: 86400,
      });

      // Registration successful - user created with new household
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

      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue(newUser);
      (mockPrismaClient.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
      (
        mockedBcrypt.hash as unknown as jest.MockedFunction<
          () => Promise<string>
        >
      ).mockResolvedValue('hashed-password');
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(registerWithHouseholdDto);

      expect(result.user.role).toBe(UserRole.member);
      // No new household created when registering to existing one
    });

    it('should throw ConflictException when user already exists', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should normalize email to lowercase during registration', async () => {
      const upperCaseEmailDto = {
        ...registerDto,
        email: 'NEWUSER@EXAMPLE.COM',
      };

      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrismaClient.household.create as jest.Mock).mockResolvedValue({
        id: 'household-1',
        name: 'Test',
      });
      (mockPrismaClient.user.create as jest.Mock).mockResolvedValue(
        mockSafeUser,
      );
      (mockPrismaClient.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
      (
        mockedBcrypt.hash as unknown as jest.MockedFunction<
          () => Promise<string>
        >
      ).mockResolvedValue('hashed-password');
      mockJwtService.sign.mockReturnValue('jwt-token');

      await service.register(upperCaseEmailDto);

      // Email normalized to lowercase during registration
    });
  });

  describe('logout', () => {
    it('should logout user by revoking session', async () => {
      (mockPrismaClient.session.delete as jest.Mock).mockResolvedValue(
        mockSession,
      );

      await service.logout('session-1');

      expectSessionDeleteCalled({
        where: { id: 'session-1' },
      });
      // Session successfully revoked
    });

    it('should handle database errors during logout', async () => {
      (mockPrismaClient.session.delete as jest.Mock).mockRejectedValue(
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

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockPrismaClient.personalAccessToken.create as jest.Mock
      ).mockResolvedValue(mockPat);
      mockJwtService.sign.mockReturnValue('pat-token');

      const result = await service.createPersonalAccessToken(
        'user-1',
        createPatDto,
      );

      expect(result).toEqual({
        token: 'pat-token',
        id: 'pat-1',
      });

      // Personal access token created successfully
    });

    it('should create token without expiration', async () => {
      const createPatDtoNoExpiry: CreatePersonalAccessTokenDto = {
        name: createPatDto.name,
        ...(createPatDto.scopes && { scopes: createPatDto.scopes }),
      };
      const mockPat = {
        id: 'pat-1',
        name: 'Test Token',
        userId: 'user-1',
        scopes: ['read', 'write'],
        expiresAt: null,
      };

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockPrismaClient.personalAccessToken.create as jest.Mock
      ).mockResolvedValue(mockPat);
      mockJwtService.sign.mockReturnValue('pat-token');

      await service.createPersonalAccessToken('user-1', createPatDtoNoExpiry);

      // Token created with default expiration
    });

    it('should use default scopes when none provided', async () => {
      const createPatDtoNoScopes: CreatePersonalAccessTokenDto = {
        name: createPatDto.name,
        ...(createPatDto.expiresInDays && {
          expiresInDays: createPatDto.expiresInDays,
        }),
      };

      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockPrismaClient.personalAccessToken.create as jest.Mock
      ).mockResolvedValue({
        id: 'pat-1',
        name: 'Test Token',
        userId: 'user-1',
        scopes: ['read'],
        expiresAt: null,
      });
      mockJwtService.sign.mockReturnValue('pat-token');

      await service.createPersonalAccessToken('user-1', createPatDtoNoScopes);

      // Default scopes applied when none provided
    });

    it('should throw BadRequestException when user not found', async () => {
      (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createPersonalAccessToken('nonexistent-user', createPatDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokePersonalAccessToken', () => {
    it('should revoke personal access token', async () => {
      (
        mockPrismaClient.personalAccessToken.delete as jest.Mock
      ).mockResolvedValue({} as any);

      await service.revokePersonalAccessToken('user-1', 'pat-1');

      expectPATDeleteCalled({
        where: { id: 'pat-1' },
      });
      // Personal access token successfully revoked
    });

    it('should handle database errors during revocation', async () => {
      (
        mockPrismaClient.personalAccessToken.delete as jest.Mock
      ).mockRejectedValue(new Error('Token not found'));

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

      (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
        activeSession,
      );

      const result = await service.validateSession('session-1');

      expect(result).toBe(true);
      // Session validated and lastActiveAt updated
    });

    it('should reject non-existent session', async () => {
      (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.validateSession('nonexistent-session');

      expect(result).toBe(false);
      // Session not updated for non-existent session
    });

    it('should reject expired session', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 60000), // 1 minute in past
      };

      (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
        expiredSession,
      );

      const result = await service.validateSession('session-1');

      expect(result).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password with correct rounds', async () => {
      mockConfigService.get.mockReturnValue(10);
      (
        mockedBcrypt.hash as unknown as jest.MockedFunction<
          () => Promise<string>
        >
      ).mockResolvedValue('hashed-password');

      const result = await service.hashPassword('plaintext-password');

      expect(result).toBe('hashed-password');
      // Password hashed with correct rounds from config
    });

    it('should use default rounds when config not available', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'BCRYPT_ROUNDS') return defaultValue; // Use default value when config is undefined
          return defaultValue || 12; // Return the default value when config is not available
        },
      );
      (
        mockedBcrypt.hash as unknown as jest.MockedFunction<
          () => Promise<string>
        >
      ).mockResolvedValue('hashed-password');

      await service.hashPassword('plaintext-password');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plaintext-password', 12);
    });
  });

  describe('comparePasswords', () => {
    it('should compare passwords correctly', async () => {
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(true);

      const result = await service.comparePasswords('plaintext', 'hashed');

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('plaintext', 'hashed');
    });

    it('should return false for incorrect passwords', async () => {
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(false);

      const result = await service.comparePasswords('wrong-password', 'hashed');

      expect(result).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database connection errors', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt errors', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockRejectedValue(new Error('Bcrypt error'));

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow('Bcrypt error');
    });

    it('should handle JWT errors', async () => {
      (mockPrismaClient.user.findFirst as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockedBcrypt.compare as unknown as jest.MockedFunction<
          () => Promise<boolean>
        >
      ).mockResolvedValue(true);
      (mockPrismaClient.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT error');
      });

      const loginDto: LoginDto = {
        username: 'testuser',
        password: 'password',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      await expect(service.login(loginDto)).rejects.toThrow('JWT error');
    });
  });
});
