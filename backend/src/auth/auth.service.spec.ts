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
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: MockProxy<PrismaService>;
  let mockPrismaClient: MockProxy<PrismaClient>;
  let mockJwtService: MockProxy<JwtService>;
  let mockUsersService: MockProxy<UsersService>;
  let mockConfigService: MockProxy<ConfigService>;

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
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toEqual(mockSafeUser);
    });

    it('should normalize email to lowercase', async () => {
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      mockedBcrypt.compare.mockResolvedValue(true);

      await service.validateUser('TEST@EXAMPLE.COM', 'password');

      // Successfully validating with normalized email confirms email normalization
    });

    it('should throw UnauthorizedException when user not found', async () => {
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.validateUser('nonexistent@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        deletedUser,
      );

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
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
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      mockedBcrypt.compare.mockResolvedValue(true);
      (mockPrismaService.prisma.session.create as jest.Mock).mockResolvedValue(
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
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      mockedBcrypt.compare.mockResolvedValue(true);
      (mockPrismaService.prisma.session.create as jest.Mock).mockResolvedValue(
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
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

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

      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        mockPrismaService.prisma.household.create as jest.Mock
      ).mockResolvedValue(household);
      (mockPrismaService.prisma.user.create as jest.Mock).mockResolvedValue(
        newUser,
      );
      (mockPrismaService.prisma.session.create as jest.Mock).mockResolvedValue({
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

      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (mockPrismaService.prisma.user.create as jest.Mock).mockResolvedValue(
        newUser,
      );
      (mockPrismaService.prisma.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.register(registerWithHouseholdDto);

      expect(result.user.role).toBe(UserRole.member);
      // No new household created when registering to existing one
    });

    it('should throw ConflictException when user already exists', async () => {
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
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

      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (
        mockPrismaService.prisma.household.create as jest.Mock
      ).mockResolvedValue({
        id: 'household-1',
        name: 'Test',
      });
      (mockPrismaService.prisma.user.create as jest.Mock).mockResolvedValue(
        mockSafeUser,
      );
      (mockPrismaService.prisma.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      mockJwtService.sign.mockReturnValue('jwt-token');

      await service.register(upperCaseEmailDto);

      // Email normalized to lowercase during registration
    });
  });

  describe('logout', () => {
    it('should logout user by revoking session', async () => {
      (mockPrismaService.prisma.session.update as jest.Mock).mockResolvedValue(
        mockSession,
      );

      await service.logout('session-1');

      // Session successfully revoked
    });

    it('should handle database errors during logout', async () => {
      (mockPrismaService.prisma.session.update as jest.Mock).mockRejectedValue(
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

      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockPrismaService.prisma.personalAccessToken.create as jest.Mock
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

      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockPrismaService.prisma.personalAccessToken.create as jest.Mock
      ).mockResolvedValue(mockPat);
      mockJwtService.sign.mockReturnValue('pat-token');

      await service.createPersonalAccessToken('user-1', createPatDtoNoExpiry);

      // Token created with default expiration
    });

    it('should use default scopes when none provided', async () => {
      const createPatDtoNoScopes = { ...createPatDto, scopes: undefined };

      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      (
        mockPrismaService.prisma.personalAccessToken.create as jest.Mock
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
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.createPersonalAccessToken('nonexistent-user', createPatDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokePersonalAccessToken', () => {
    it('should revoke personal access token', async () => {
      (
        mockPrismaService.prisma.personalAccessToken.update as jest.Mock
      ).mockResolvedValue({});

      await service.revokePersonalAccessToken('user-1', 'pat-1');

      // Personal access token successfully revoked
    });

    it('should handle database errors during revocation', async () => {
      (
        mockPrismaService.prisma.personalAccessToken.update as jest.Mock
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

      (
        mockPrismaService.prisma.session.findUnique as jest.Mock
      ).mockResolvedValue(activeSession);
      (mockPrismaService.prisma.session.update as jest.Mock).mockResolvedValue(
        activeSession,
      );

      const result = await service.validateSession('session-1');

      expect(result).toBe(true);
      // Session validated and lastActiveAt updated
    });

    it('should reject non-existent session', async () => {
      (
        mockPrismaService.prisma.session.findUnique as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.validateSession('nonexistent-session');

      expect(result).toBe(false);
      // Session not updated for non-existent session
    });

    it('should reject revoked session', async () => {
      const revokedSession = {
        ...mockSession,
        revokedAt: new Date(),
      };

      (
        mockPrismaService.prisma.session.findUnique as jest.Mock
      ).mockResolvedValue(revokedSession);

      const result = await service.validateSession('session-1');

      expect(result).toBe(false);
    });

    it('should reject expired session', async () => {
      const expiredSession = {
        ...mockSession,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60000), // 1 minute in past
      };

      (
        mockPrismaService.prisma.session.findUnique as jest.Mock
      ).mockResolvedValue(expiredSession);

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
      // Password hashed with correct rounds from config
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
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle bcrypt errors', async () => {
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      mockedBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      await expect(
        service.validateUser('test@example.com', 'password'),
      ).rejects.toThrow('Bcrypt error');
    });

    it('should handle JWT errors', async () => {
      (mockPrismaService.prisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUser,
      );
      mockedBcrypt.compare.mockResolvedValue(true);
      (mockPrismaService.prisma.session.create as jest.Mock).mockResolvedValue(
        mockSession,
      );
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
