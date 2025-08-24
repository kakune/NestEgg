import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

import { HttpExceptionFilter, ErrorResponse } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;
  let capturedJsonResponse: ErrorResponse;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);

    mockRequest = {
      url: '/api/v1/test',
      method: 'POST',
      headers: {},
    };

    const statusMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn().mockImplementation((response: ErrorResponse) => {
      capturedJsonResponse = response;
      return mockResponse;
    });

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
  });

  describe('catch', () => {
    it('should handle HttpException with validation errors', () => {
      const validationException = new HttpException(
        {
          message: [
            'name must be a string',
            'email must be a valid email',
            'amount must be a positive integer',
          ],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(validationException, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(capturedJsonResponse.error.code).toBe('VALIDATION_ERROR');
      expect(capturedJsonResponse.error.message).toBe(
        'Request validation failed',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
      expect(Array.isArray(capturedJsonResponse.error.details)).toBe(true);

      const details = capturedJsonResponse.error.details as Array<{
        field: string;
        message: string;
        code: string;
      }>;
      expect(details).toHaveLength(3);
      expect(details[0].field).toBe('name');
      expect(details[0].message).toBe('must be a string');
      expect(details[0].code).toBe('VALIDATION_ERROR');
      expect(details[1].field).toBe('email');
      expect(details[1].message).toBe('must be a valid email');
      expect(details[1].code).toBe('VALIDATION_ERROR');
      expect(details[2].field).toBe('amount');
      expect(details[2].message).toBe('must be a positive integer');
      expect(details[2].code).toBe('INVALID_AMOUNT');
    });

    it('should handle HttpException with simple message', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(capturedJsonResponse.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(capturedJsonResponse.error.message).toBe('Not found');
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
      expect(typeof capturedJsonResponse.error.timestamp).toBe('string');
    });

    it('should handle authentication errors correctly', () => {
      const authException = new HttpException(
        'Invalid credentials provided',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(authException, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(capturedJsonResponse.error.code).toBe('INVALID_CREDENTIALS');
      expect(capturedJsonResponse.error.message).toBe(
        'Invalid credentials provided',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should handle token expired errors', () => {
      const tokenException = new HttpException(
        'JWT token has expired',
        HttpStatus.UNAUTHORIZED,
      );

      filter.catch(tokenException, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(capturedJsonResponse.error.code).toBe('TOKEN_EXPIRED');
      expect(capturedJsonResponse.error.message).toBe('JWT token has expired');
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should handle forbidden errors with role message', () => {
      const forbiddenException = new HttpException(
        'User role is insufficient for this action',
        HttpStatus.FORBIDDEN,
      );

      filter.catch(forbiddenException, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(capturedJsonResponse.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(capturedJsonResponse.error.message).toBe(
        'User role is insufficient for this action',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should handle rate limit errors', () => {
      const rateLimitException = new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(rateLimitException, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(capturedJsonResponse.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(capturedJsonResponse.error.message).toBe('Too many requests');
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should handle settlement finalization errors', () => {
      const settlementException = new HttpException(
        'settlement is already finalized and cannot be modified',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(settlementException, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(capturedJsonResponse.error.code).toBe(
        'SETTLEMENT_ALREADY_FINALIZED',
      );
      expect(capturedJsonResponse.error.message).toBe(
        'settlement is already finalized and cannot be modified',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should handle regular Error instances', () => {
      const error = new Error('Database connection failed');

      filter.catch(error, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(capturedJsonResponse.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(capturedJsonResponse.error.message).toBe(
        'An unexpected error occurred',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should handle unknown exception types', () => {
      const unknownError = { some: 'unknown error' };

      filter.catch(unknownError, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(capturedJsonResponse.error.code).toBe('UNKNOWN_ERROR');
      expect(capturedJsonResponse.error.message).toBe(
        'An unknown error occurred',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should include request ID when provided', () => {
      mockRequest.headers = { 'x-request-id': 'req-123-456' };
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(capturedJsonResponse.error.request_id).toBe('req-123-456');
      expect(capturedJsonResponse.error.code).toBe('RESOURCE_NOT_FOUND');
      expect(capturedJsonResponse.error.message).toBe('Not found');
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });

    it('should handle HttpException with object response including details', () => {
      const exception = new HttpException(
        {
          message: 'Request validation failed',
          details: {
            field: 'email',
            issue: 'format',
          },
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(capturedJsonResponse.error.code).toBe('VALIDATION_ERROR');
      expect(capturedJsonResponse.error.message).toBe(
        'Request validation failed',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
      expect(capturedJsonResponse.error.details).toEqual({
        field: 'email',
        issue: 'format',
      });
    });

    it('should handle database errors in server errors', () => {
      const databaseException = new HttpException(
        'database connection failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(databaseException, mockArgumentsHost as ArgumentsHost);

      expect(capturedJsonResponse.error.code).toBe('DATABASE_ERROR');
      expect(capturedJsonResponse.error.message).toBe(
        'database connection failed',
      );
      expect(capturedJsonResponse.error.path).toBe('/api/v1/test');
    });
  });
});
