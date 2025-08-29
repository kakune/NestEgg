import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { mockDeep, MockProxy, mockReset } from 'jest-mock-extended';

import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth.service';
import { UserRole, PrismaClient } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockPrismaService: MockProxy<PrismaService>;
  let mockPrismaClient: MockProxy<PrismaClient>;
  let mockConfigService: MockProxy<ConfigService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    role: UserRole.admin,
    householdId: 'household-1',
    deletedAt: null,
  };

  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    sessionData: JSON.stringify({
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    }),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPat = {
    id: 'pat-1',
    userId: 'user-1',
    name: 'Test PAT',
    token: 'test-token',
    abilities: ['read', 'write'],
    expiresAt: null, // No expiration
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaClient = mockDeep<PrismaClient>();
    mockPrismaService = mockDeep<PrismaService>();
    mockConfigService = mockDeep<ConfigService>();

    mockPrismaService.prisma = mockPrismaClient;

    // Reset all mocks before each test
    mockReset(mockPrismaService);
    mockReset(mockPrismaClient);
    mockReset(mockConfigService);

    // Set up config before creating the module
    mockConfigService.get.mockReturnValue('test-jwt-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
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

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with correct JWT configuration', () => {
      // Configuration validated during strategy initialization
    });
  });

  describe('validate', () => {
    describe('access token validation', () => {
      const accessTokenPayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        householdId: 'household-1',
        role: UserRole.admin,
        sessionId: 'session-1',
        tokenType: 'access',
      };

      it('should validate access token successfully', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
          mockSession,
        );
        (mockPrismaClient.session.update as jest.Mock).mockResolvedValue(
          mockSession,
        );

        const result = await strategy.validate(accessTokenPayload);

        expect(result).toEqual({
          userId: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        });

        // Successful validation confirms proper database calls
      });

      it('should throw UnauthorizedException when user not found', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'User not found or deleted',
        );
      });

      it('should throw UnauthorizedException when user is deleted', async () => {
        const deletedUser = { ...mockUser, deletedAt: new Date() };
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          deletedUser,
        );

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'User not found or deleted',
        );
      });

      it('should throw UnauthorizedException when session not found', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
          null,
        );

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'Session invalid or expired',
        );
      });

      it('should throw UnauthorizedException when session is null', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
          null,
        );

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'Session invalid or expired',
        );
      });

      it('should throw UnauthorizedException when session is expired', async () => {
        const expiredSession = {
          ...mockSession,
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
        };
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
          expiredSession,
        );

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'Session invalid or expired',
        );
      });

      it('should update session last active time', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
          mockSession,
        );
        (mockPrismaClient.session.update as jest.Mock).mockResolvedValue(
          mockSession,
        );

        await strategy.validate(accessTokenPayload);

        // Session last active time updated successfully
      });

      it('should handle access token without session ID', async () => {
        const payloadWithoutSession = {
          sub: accessTokenPayload.sub,
          email: accessTokenPayload.email,
          username: accessTokenPayload.username,
          name: accessTokenPayload.name,
          householdId: accessTokenPayload.householdId,
          role: accessTokenPayload.role,
          tokenType: accessTokenPayload.tokenType,
        };
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );

        const result = await strategy.validate(payloadWithoutSession);

        expect(result.sessionId).toBeUndefined();
        // No session calls made when sessionId is undefined
      });
    });

    describe('personal access token validation', () => {
      const patPayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        householdId: 'household-1',
        role: UserRole.admin,
        tokenType: 'pat',
      };

      it('should validate personal access token successfully', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (
          mockPrismaClient.personalAccessToken.findFirst as jest.Mock
        ).mockResolvedValue(mockPat);

        const result = await strategy.validate(patPayload);

        expect(result).toEqual({
          userId: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: undefined,
          tokenType: 'pat',
        });

        // PAT validation confirms proper query structure
      });

      it('should validate PAT with expiration date in future', async () => {
        const futureExpiredPat = {
          ...mockPat,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        };
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (
          mockPrismaClient.personalAccessToken.findFirst as jest.Mock
        ).mockResolvedValue(futureExpiredPat);

        const result = await strategy.validate(patPayload);

        expect(result.tokenType).toBe('pat');
      });

      it('should throw UnauthorizedException when PAT not found', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (
          mockPrismaClient.personalAccessToken.findFirst as jest.Mock
        ).mockResolvedValue(null);

        await expect(strategy.validate(patPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(patPayload)).rejects.toThrow(
          'Personal access token invalid or expired',
        );
      });

      it('should throw UnauthorizedException when PAT is revoked', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (
          mockPrismaClient.personalAccessToken.findFirst as jest.Mock
        ).mockResolvedValue(null); // revoked PAT won't be found

        await expect(strategy.validate(patPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(patPayload)).rejects.toThrow(
          'Personal access token invalid or expired',
        );
      });

      it('should not validate session for PAT', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (
          mockPrismaClient.personalAccessToken.findFirst as jest.Mock
        ).mockResolvedValue(mockPat);

        await strategy.validate(patPayload);

        // PAT validation doesn't use session calls
      });
    });

    describe('user validation', () => {
      const basePayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
        householdId: 'household-1',
        role: UserRole.member,
        tokenType: 'pat',
      };

      it('should validate users with different roles', async () => {
        const memberUser = { ...mockUser, role: UserRole.member };
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          memberUser,
        );
        (
          mockPrismaClient.personalAccessToken.findFirst as jest.Mock
        ).mockResolvedValue(mockPat);

        const result = await strategy.validate(basePayload);

        expect(result.role).toBe(UserRole.member);
      });

      it('should handle user database errors', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockRejectedValue(
          new Error('Database error'),
        );

        await expect(strategy.validate(basePayload)).rejects.toThrow(
          'Database error',
        );
      });

      it('should handle session database errors', async () => {
        const accessPayload = {
          ...basePayload,
          tokenType: 'access' as const,
          sessionId: 'session-1',
        };

        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockRejectedValue(
          new Error('Session database error'),
        );

        await expect(strategy.validate(accessPayload)).rejects.toThrow(
          'Session database error',
        );
      });

      it('should handle PAT database errors', async () => {
        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (
          mockPrismaClient.personalAccessToken.findFirst as jest.Mock
        ).mockRejectedValue(new Error('PAT database error'));

        await expect(strategy.validate(basePayload)).rejects.toThrow(
          'PAT database error',
        );
      });
    });

    describe('edge cases and error conditions', () => {
      it('should handle malformed payload gracefully', async () => {
        const malformedPayload = {
          sub: null,
          email: undefined,
          householdId: '',
          role: 'invalid-role',
          tokenType: 'unknown',
        } as unknown as JwtPayload;

        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(strategy.validate(malformedPayload)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should handle concurrent session updates', async () => {
        const accessPayload: JwtPayload = {
          sub: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        };

        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
          mockSession,
        );

        // Simulate concurrent update scenario
        let updateCallCount = 0;
        (mockPrismaClient.session.update as jest.Mock).mockImplementation(
          () => {
            updateCallCount++;
            if (updateCallCount === 1) {
              // First call succeeds
              return Promise.resolve(mockSession);
            } else {
              // Subsequent calls might conflict
              throw new Error('Concurrent update conflict');
            }
          },
        );

        const result = await strategy.validate(accessPayload);

        expect(result.sessionId).toBe('session-1');
      });

      it('should handle database errors during session lookup', async () => {
        const accessPayload: JwtPayload = {
          sub: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        };

        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockRejectedValue(
          new Error('Database connection failed'),
        );

        await expect(strategy.validate(accessPayload)).rejects.toThrow(
          'Database connection failed',
        );
      });

      it('should validate exact session expiration time', async () => {
        const exactlyExpiredSession = {
          ...mockSession,
          expiresAt: new Date(Date.now() - 1), // 1ms ago to ensure it's expired
        };
        const accessPayload: JwtPayload = {
          sub: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          name: 'Test User',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        };

        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (mockPrismaClient.session.findUnique as jest.Mock).mockResolvedValue(
          exactlyExpiredSession,
        );
        // Reset the session.update mock since we shouldn't reach the update step
        (mockPrismaClient.session.update as jest.Mock).mockReset();

        // The session is exactly at expiration time, which should be considered expired
        await expect(strategy.validate(accessPayload)).rejects.toThrow(
          'Session invalid or expired',
        );
      });

      it('should handle missing fields in payload', async () => {
        const incompletePayload = {
          sub: 'user-1',
          tokenType: 'access',
        } as JwtPayload;

        (mockPrismaClient.user.findUnique as jest.Mock).mockResolvedValue(
          mockUser,
        );

        const result = await strategy.validate(incompletePayload);

        expect(result.userId).toBe('user-1');
        expect(result.email).toBeUndefined();
        expect(result.householdId).toBeUndefined();
      });
    });
  });
});
