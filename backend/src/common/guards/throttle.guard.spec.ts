import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { CustomThrottlerGuard } from './throttle.guard';

// Mock the parent ThrottlerGuard class
jest.mock('@nestjs/throttler', () => {
  const actual = jest.requireActual<{
    ThrottlerException: typeof import('@nestjs/throttler').ThrottlerException;
  }>('@nestjs/throttler');
  return {
    ThrottlerException: actual.ThrottlerException,
    ThrottlerGuard: class {
      protected storageService = {
        getRecord: jest.fn(),
      };

      handleRequest(): Promise<boolean> {
        return Promise.resolve<boolean>(true);
      }
    },
  };
});

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockExecutionContext: Partial<ExecutionContext>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomThrottlerGuard],
    }).compile();

    guard = module.get<CustomThrottlerGuard>(CustomThrottlerGuard);

    mockRequest = {
      ip: '192.168.1.1',
      socket: {
        remoteAddress: '192.168.1.1',
      },
    } as Partial<Request>;

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
  });

  describe('getTracker', () => {
    it('should return IP address when no user is present', async () => {
      const tracker = await guard.getTracker(mockRequest as Request);
      expect(tracker).toBe('192.168.1.1');
    });

    it('should return IP and user ID when authenticated user is present', async () => {
      const requestWithUser: Partial<Request> = {
        ...mockRequest,
        user: { id: 'user-123' },
      };

      const tracker = await guard.getTracker(requestWithUser as Request);
      expect(tracker).toBe('192.168.1.1:user-123');
    });

    it('should use socket.remoteAddress when ip is not available', async () => {
      const requestWithoutIp = {
        socket: {
          remoteAddress: '10.0.0.1',
        },
        user: undefined,
      } as unknown as Request;

      const tracker = await guard.getTracker(requestWithoutIp);
      expect(tracker).toBe('10.0.0.1');
    });

    it('should return "unknown" when no IP information is available', async () => {
      const requestWithoutIp = {
        socket: {},
        user: undefined,
      } as unknown as Request;

      const tracker = await guard.getTracker(requestWithoutIp);
      expect(tracker).toBe('unknown');
    });

    it('should combine socket.remoteAddress and user ID', async () => {
      const requestWithSocketAndUser = {
        socket: {
          remoteAddress: '172.16.0.1',
        },
        user: { id: 'user-456' },
      } as unknown as Request;

      const tracker = await guard.getTracker(requestWithSocketAndUser);
      expect(tracker).toBe('172.16.0.1:user-456');
    });
  });

  describe('throwThrottlingException', () => {
    it('should set rate limit headers and throw ThrottlerException', async () => {
      const throttlerLimitDetail = {
        limit: 10,
        ttl: 60,
      };

      // Mock Date.now to get predictable results
      const mockNow = 1609459200000; // January 1, 2021
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      await expect(async () => {
        await guard.throwThrottlingException(
          mockExecutionContext as ExecutionContext,
          throttlerLimitDetail,
        );
      }).rejects.toThrow(ThrottlerException);

      const expectedResetTime = mockNow + throttlerLimitDetail.ttl * 1000;

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '10',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '0',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        Math.ceil(expectedResetTime / 1000),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '60');

      // Restore Date.now
      jest.restoreAllMocks();
    });

    it('should throw ThrottlerException with correct error details', async () => {
      const throttlerLimitDetail = {
        limit: 5,
        ttl: 30,
      };

      const mockNow = 1609459200000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      await expect(async () => {
        await guard.throwThrottlingException(
          mockExecutionContext as ExecutionContext,
          throttlerLimitDetail,
        );
      }).rejects.toThrow(ThrottlerException);

      jest.restoreAllMocks();
    });
  });

  describe('handleRequest', () => {
    it('should set rate limit headers and return result from parent', async () => {
      const limit = 100;
      const ttl = 3600;

      // Mock the parent class method
      const parentHandleRequestSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'handleRequest',
        )
        .mockResolvedValue(true);

      const result = await guard.handleRequest({
        context: mockExecutionContext as ExecutionContext,
        limit,
        ttl,
      });

      expect(result).toBe(true);
      expect(parentHandleRequestSpy).toHaveBeenCalledWith({
        context: mockExecutionContext,
        limit,
        ttl,
        throttler: { name: 'default', limit, ttl },
        blockDuration: 0,
        getTracker: expect.any(Function) as (
          req: Record<string, unknown>,
        ) => string,
        generateKey: expect.any(Function) as () => string,
      });

      // Verify headers are set
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '100',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '99', // limit - 1
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(Number),
      );

      parentHandleRequestSpy.mockRestore();
    });

    it('should calculate reset time correctly', async () => {
      const limit = 50;
      const ttl = 900; // 15 minutes

      const mockNow = 1609459200000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const parentHandleRequestSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'handleRequest',
        )
        .mockResolvedValue(true);

      await guard.handleRequest({
        context: mockExecutionContext as ExecutionContext,
        limit,
        ttl,
      });

      const expectedResetTime = Math.ceil((mockNow + ttl * 1000) / 1000);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expectedResetTime,
      );

      parentHandleRequestSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should return false when parent handleRequest returns false', async () => {
      const limit = 10;
      const ttl = 60;

      const parentHandleRequestSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'handleRequest',
        )
        .mockResolvedValue(false);

      const result = await guard.handleRequest({
        context: mockExecutionContext as ExecutionContext,
        limit,
        ttl,
      });

      expect(result).toBe(false);
      expect(parentHandleRequestSpy).toHaveBeenCalledWith({
        context: mockExecutionContext,
        limit,
        ttl,
        throttler: { name: 'default', limit, ttl },
        blockDuration: 0,
        getTracker: expect.any(Function) as (
          req: Record<string, unknown>,
        ) => string,
        generateKey: expect.any(Function) as () => string,
      });

      // Headers should still be set even when request is throttled
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '10',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        '9',
      );

      parentHandleRequestSpy.mockRestore();
    });

    it('should handle different limit values correctly', async () => {
      const testCases = [
        { limit: 1, expectedRemaining: '0' },
        { limit: 100, expectedRemaining: '99' },
        { limit: 1000, expectedRemaining: '999' },
      ];

      const parentHandleRequestSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          'handleRequest',
        )
        .mockResolvedValue(true);

      for (const testCase of testCases) {
        (mockResponse.setHeader as jest.Mock).mockClear();

        await guard.handleRequest({
          context: mockExecutionContext as ExecutionContext,
          limit: testCase.limit,
          ttl: 60,
        });

        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'X-RateLimit-Remaining',
          testCase.expectedRemaining,
        );
      }

      parentHandleRequestSpy.mockRestore();
    });
  });
});
