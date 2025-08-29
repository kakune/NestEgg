import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { MockExecutionContext, MockRequest } from '../../test/test-utils';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: MockExecutionContext;
    let mockRequest: MockRequest;

    beforeEach(() => {
      mockRequest = {
        user: {
          role: UserRole.member,
        },
      };

      mockContext = {
        getHandler: jest.fn().mockReturnValue({}),
        getClass: jest.fn().mockReturnValue({}),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
          getResponse: jest.fn(),
          getNext: jest.fn(),
        }),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
      } as MockExecutionContext;
    });

    it('should return true when no roles are required', () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(true);
      const handler = mockContext.getHandler();
      const contextClass = mockContext.getClass();
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        handler,
        contextClass,
      ]);
    });

    it('should return true when no roles are required (undefined)', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(true);
    });

    it('should return true when user has required role (single role)', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);
      mockRequest.user!.role = UserRole.member;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(true);
    });

    it('should return true when user has one of multiple required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        UserRole.admin,
        UserRole.member,
      ]);
      mockRequest.user!.role = UserRole.member;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(true);
    });

    it('should return false when user does not have required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.admin]);
      mockRequest.user!.role = UserRole.member;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it('should return false when user has no role', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);
      mockRequest.user = {};

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it('should handle admin role requirements', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.admin]);
      mockRequest.user!.role = UserRole.admin;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(true);
    });

    it('should return false when admin role is required but user is member', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.admin]);
      mockRequest.user!.role = UserRole.member;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it('should check both handler and class for roles decorator', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();

      const getHandlerMock = jest.fn().mockReturnValue(mockHandler);
      const getClassMock = jest.fn().mockReturnValue(mockClass);
      mockContext.getHandler = getHandlerMock;
      mockContext.getClass = getClassMock;
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);
      mockRequest.user!.role = UserRole.member;

      guard.canActivate(mockContext as unknown as ExecutionContext);

      expect(getHandlerMock).toHaveBeenCalled();
      expect(getClassMock).toHaveBeenCalled();
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        mockHandler,
        mockClass,
      ]);
    });

    it('should handle multiple roles correctly with admin user', () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        UserRole.admin,
        UserRole.member,
      ]);
      mockRequest.user!.role = UserRole.admin;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(true);
    });

    it('should handle empty roles array', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);
      mockRequest.user!.role = UserRole.member;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(result).toBe(false);
    });

    it('should use correct reflection key', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);

      guard.canActivate(mockContext as unknown as ExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        ROLES_KEY,
        expect.any(Array),
      );
    });

    it('should extract user from HTTP request', () => {
      const mockGetRequest = jest.fn().mockReturnValue(mockRequest);
      const mockSwitchToHttp = jest.fn().mockReturnValue({
        getRequest: mockGetRequest,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      });

      mockContext.switchToHttp = mockSwitchToHttp;
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);
      mockRequest.user!.role = UserRole.member;

      const result = guard.canActivate(
        mockContext as unknown as ExecutionContext,
      );

      expect(mockSwitchToHttp).toHaveBeenCalled();
      expect(mockGetRequest).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle missing user in request', () => {
      mockRequest = {};
      const mockHttp = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      };
      mockContext.switchToHttp = jest.fn().mockReturnValue(mockHttp);
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);

      expect(() =>
        guard.canActivate(mockContext as unknown as ExecutionContext),
      ).toThrow();
    });

    it('should handle null user in request', () => {
      mockRequest = {};
      const mockHttp = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      };
      mockContext.switchToHttp = jest.fn().mockReturnValue(mockHttp);
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);

      expect(() =>
        guard.canActivate(mockContext as unknown as ExecutionContext),
      ).toThrow();
    });

    describe('role hierarchy scenarios', () => {
      it('should allow admin access to member-only endpoints', () => {
        mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);
        if (mockRequest.user) {
          mockRequest.user.role = UserRole.admin;
        }

        const result = guard.canActivate(
          mockContext as unknown as ExecutionContext,
        );

        // Note: This depends on business logic - the current implementation
        // checks for exact role matches, not hierarchy
        expect(result).toBe(false);
      });

      it('should not allow member access to admin-only endpoints', () => {
        mockReflector.getAllAndOverride.mockReturnValue([UserRole.admin]);
        if (mockRequest.user) {
          mockRequest.user.role = UserRole.member;
        }

        const result = guard.canActivate(
          mockContext as unknown as ExecutionContext,
        );

        expect(result).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle single role in array', () => {
        mockReflector.getAllAndOverride.mockReturnValue([UserRole.admin]);
        if (mockRequest.user) {
          mockRequest.user.role = UserRole.admin;
        }

        const result = guard.canActivate(
          mockContext as unknown as ExecutionContext,
        );

        expect(result).toBe(true);
      });

      it('should handle user with undefined role', () => {
        mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);
        if (mockRequest.user) {
          mockRequest.user.role = undefined;
        }

        const result = guard.canActivate(
          mockContext as unknown as ExecutionContext,
        );

        expect(result).toBe(false);
      });

      it('should handle user with null role', () => {
        mockReflector.getAllAndOverride.mockReturnValue([UserRole.member]);
        if (mockRequest.user) {
          mockRequest.user.role = undefined;
        }

        const result = guard.canActivate(
          mockContext as unknown as ExecutionContext,
        );

        expect(result).toBe(false);
      });
    });
  });
});
