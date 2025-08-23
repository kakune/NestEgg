import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth.service';
import { UserRole } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockUser = {
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
    revokedAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    lastActiveAt: new Date(),
  };

  const mockPat = {
    id: 'pat-1',
    userId: 'user-1',
    revokedAt: null,
    expiresAt: null, // No expiration
  };

  const mockPrismaService = {
    prisma: {
      user: {
        findUnique: jest.fn(),
      },
      session: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      personalAccessToken: {
        findFirst: jest.fn(),
      },
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
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

    // Reset all mocks except config
    Object.keys(mockPrismaService.prisma).forEach((key: string) => {
      const entity = (
        mockPrismaService.prisma as Record<
          string,
          Record<string, jest.MockedFunction<unknown>>
        >
      )[key];
      Object.keys(entity).forEach((method: string) => {
        entity[method].mockClear();
      });
    });
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with correct JWT configuration', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('validate', () => {
    describe('access token validation', () => {
      const accessTokenPayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        householdId: 'household-1',
        role: UserRole.admin,
        sessionId: 'session-1',
        tokenType: 'access',
      };

      it('should validate access token successfully', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(
          mockSession,
        );
        mockPrismaService.prisma.session.update.mockResolvedValue(mockSession);

        const result = await strategy.validate(accessTokenPayload);

        expect(result).toEqual({
          userId: 'user-1',
          email: 'test@example.com',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        });

        expect(mockPrismaService.prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            householdId: true,
            deletedAt: true,
          },
        });

        expect(
          mockPrismaService.prisma.session.findUnique,
        ).toHaveBeenCalledWith({
          where: { id: 'session-1' },
        });

        expect(mockPrismaService.prisma.session.update).toHaveBeenCalledWith({
          where: { id: 'session-1' },
          data: { lastActiveAt: expect.any(Date) as Date },
        });
      });

      it('should throw UnauthorizedException when user not found', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'User not found or deleted',
        );
      });

      it('should throw UnauthorizedException when user is deleted', async () => {
        const deletedUser = { ...mockUser, deletedAt: new Date() };
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(deletedUser);

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'User not found or deleted',
        );
      });

      it('should throw UnauthorizedException when session not found', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(null);

        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(accessTokenPayload)).rejects.toThrow(
          'Session invalid or expired',
        );
      });

      it('should throw UnauthorizedException when session is revoked', async () => {
        const revokedSession = { ...mockSession, revokedAt: new Date() };
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(
          revokedSession,
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
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(
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
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(
          mockSession,
        );
        mockPrismaService.prisma.session.update.mockResolvedValue(mockSession);

        await strategy.validate(accessTokenPayload);

        expect(mockPrismaService.prisma.session.update).toHaveBeenCalledWith({
          where: { id: 'session-1' },
          data: { lastActiveAt: expect.any(Date) as Date },
        });
      });

      it('should handle access token without session ID', async () => {
        const payloadWithoutSession = {
          ...accessTokenPayload,
          sessionId: undefined,
        };
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);

        const result = await strategy.validate(payloadWithoutSession);

        expect(result.sessionId).toBeUndefined();
        expect(
          mockPrismaService.prisma.session.findUnique,
        ).not.toHaveBeenCalled();
        expect(mockPrismaService.prisma.session.update).not.toHaveBeenCalled();
      });
    });

    describe('personal access token validation', () => {
      const patPayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        householdId: 'household-1',
        role: UserRole.admin,
        tokenType: 'pat',
      };

      it('should validate personal access token successfully', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.personalAccessToken.findFirst.mockResolvedValue(
          mockPat,
        );

        const result = await strategy.validate(patPayload);

        expect(result).toEqual({
          userId: 'user-1',
          email: 'test@example.com',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: undefined,
          tokenType: 'pat',
        });

        expect(
          mockPrismaService.prisma.personalAccessToken.findFirst,
        ).toHaveBeenCalledWith({
          where: {
            userId: 'user-1',
            revokedAt: null,
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: expect.any(Date) as Date } },
            ],
          },
        });
      });

      it('should validate PAT with expiration date in future', async () => {
        const futureExpiredPat = {
          ...mockPat,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        };
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.personalAccessToken.findFirst.mockResolvedValue(
          futureExpiredPat,
        );

        const result = await strategy.validate(patPayload);

        expect(result.tokenType).toBe('pat');
      });

      it('should throw UnauthorizedException when PAT not found', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.personalAccessToken.findFirst.mockResolvedValue(
          null,
        );

        await expect(strategy.validate(patPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(patPayload)).rejects.toThrow(
          'Personal access token invalid or expired',
        );
      });

      it('should throw UnauthorizedException when PAT is revoked', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.personalAccessToken.findFirst.mockResolvedValue(
          null,
        ); // revoked PAT won't be found

        await expect(strategy.validate(patPayload)).rejects.toThrow(
          UnauthorizedException,
        );
        await expect(strategy.validate(patPayload)).rejects.toThrow(
          'Personal access token invalid or expired',
        );
      });

      it('should not validate session for PAT', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.personalAccessToken.findFirst.mockResolvedValue(
          mockPat,
        );

        await strategy.validate(patPayload);

        expect(
          mockPrismaService.prisma.session.findUnique,
        ).not.toHaveBeenCalled();
        expect(mockPrismaService.prisma.session.update).not.toHaveBeenCalled();
      });
    });

    describe('user validation', () => {
      const basePayload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        householdId: 'household-1',
        role: UserRole.member,
        tokenType: 'pat',
      };

      it('should validate users with different roles', async () => {
        const memberUser = { ...mockUser, role: UserRole.member };
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(memberUser);
        mockPrismaService.prisma.personalAccessToken.findFirst.mockResolvedValue(
          mockPat,
        );

        const result = await strategy.validate(basePayload);

        expect(result.role).toBe(UserRole.member);
      });

      it('should handle user database errors', async () => {
        mockPrismaService.prisma.user.findUnique.mockRejectedValue(
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

        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockRejectedValue(
          new Error('Session database error'),
        );

        await expect(strategy.validate(accessPayload)).rejects.toThrow(
          'Session database error',
        );
      });

      it('should handle PAT database errors', async () => {
        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.personalAccessToken.findFirst.mockRejectedValue(
          new Error('PAT database error'),
        );

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

        mockPrismaService.prisma.user.findUnique.mockResolvedValue(null);

        await expect(strategy.validate(malformedPayload)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should handle concurrent session updates', async () => {
        const accessPayload: JwtPayload = {
          sub: 'user-1',
          email: 'test@example.com',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        };

        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(
          mockSession,
        );

        // Simulate concurrent update scenario
        let updateCallCount = 0;
        mockPrismaService.prisma.session.update.mockImplementation(() => {
          updateCallCount++;
          if (updateCallCount === 1) {
            // First call succeeds
            return Promise.resolve(mockSession);
          } else {
            // Subsequent calls might conflict
            throw new Error('Concurrent update conflict');
          }
        });

        const result = await strategy.validate(accessPayload);

        expect(result.sessionId).toBe('session-1');
      });

      it('should handle session update failures gracefully', async () => {
        const accessPayload: JwtPayload = {
          sub: 'user-1',
          email: 'test@example.com',
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        };

        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(
          mockSession,
        );
        mockPrismaService.prisma.session.update.mockRejectedValue(
          new Error('Update failed'),
        );

        await expect(strategy.validate(accessPayload)).rejects.toThrow(
          'Update failed',
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
          householdId: 'household-1',
          role: UserRole.admin,
          sessionId: 'session-1',
          tokenType: 'access',
        };

        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrismaService.prisma.session.findUnique.mockResolvedValue(
          exactlyExpiredSession,
        );
        // Reset the session.update mock since we shouldn't reach the update step
        mockPrismaService.prisma.session.update.mockReset();

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

        mockPrismaService.prisma.user.findUnique.mockResolvedValue(mockUser);

        const result = await strategy.validate(incompletePayload);

        expect(result.userId).toBe('user-1');
        expect(result.email).toBeUndefined();
        expect(result.householdId).toBeUndefined();
      });
    });
  });
});
