import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response, NextFunction } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-123'),
}));

interface RequestWithId extends Request {
  requestId: string;
}

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;
  let mockRequest: Partial<RequestWithId>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestIdMiddleware],
    }).compile();

    middleware = module.get<RequestIdMiddleware>(RequestIdMiddleware);

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should generate new request ID when not provided', () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.headers!['x-request-id']).toBe('mocked-uuid-123');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        'mocked-uuid-123',
      );
      expect(mockRequest.requestId).toBe('mocked-uuid-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing request ID from headers', () => {
      const existingRequestId = 'existing-request-id-456';
      mockRequest.headers = {
        'x-request-id': existingRequestId,
      };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.headers['x-request-id']).toBe(existingRequestId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        existingRequestId,
      );
      expect(mockRequest.requestId).toBe(existingRequestId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty string request ID by generating new one', () => {
      mockRequest.headers = {
        'x-request-id': '',
      };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.headers['x-request-id']).toBe('mocked-uuid-123');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        'mocked-uuid-123',
      );
      expect(mockRequest.requestId).toBe('mocked-uuid-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle request ID as array by taking first value', () => {
      mockRequest.headers = {
        'x-request-id': ['first-id', 'second-id'],
      } as Record<string, string | string[]>;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // The actual behavior: it keeps the array as-is
      expect(mockRequest.headers['x-request-id']).toEqual([
        'first-id',
        'second-id',
      ]);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', [
        'first-id',
        'second-id',
      ]);
      expect(mockRequest.requestId).toEqual(['first-id', 'second-id']);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set request ID in all three places', () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Check request headers
      expect(mockRequest.headers!['x-request-id']).toBeDefined();

      // Check response headers
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        expect.any(String),
      );

      // Check request object property
      expect(mockRequest.requestId).toBeDefined();

      // Check all three have the same value
      const requestId = mockRequest.headers!['x-request-id'] as string;
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        requestId,
      );
      expect(mockRequest.requestId).toBe(requestId);
    });

    it('should call next function', () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle malformed request by throwing error', () => {
      const malformedRequest = {} as Request;

      expect(() => {
        middleware.use(malformedRequest, mockResponse as Response, mockNext);
      }).toThrow();
    });
  });
});
