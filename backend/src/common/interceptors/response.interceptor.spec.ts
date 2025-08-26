import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Request, Response } from 'express';
import { of } from 'rxjs';

import { ResponseInterceptor, ApiResponse } from './response.interceptor';

interface MockRequest extends Partial<Request> {
  path: string;
}

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;
  let mockRequest: MockRequest;
  let mockResponse: Partial<Response>;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResponseInterceptor],
    }).compile();

    interceptor = module.get<ResponseInterceptor<any>>(ResponseInterceptor);

    mockRequest = {
      path: '/api/v1/users',
      method: 'GET',
    };

    const statusMock = jest.fn().mockReturnThis();
    mockResponse = {
      status: statusMock,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  describe('intercept', () => {
    it('should wrap single resource response in ApiResponse format', (done) => {
      const testData = { id: '1', name: 'John Doe' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData,
          });
          done();
        });
    });

    it('should wrap array responses with metadata', (done) => {
      const testData = [
        { id: '1', name: 'User 1' },
        { id: '2', name: 'User 2' },
      ];
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData,
            meta: {
              has_more: false,
              count: 2,
            },
          });
          done();
        });
    });

    it('should calculate total amount for transaction endpoints', (done) => {
      mockRequest.path = '/api/v1/transactions';
      const testData = [
        { id: '1', amount_yen: 1000, description: 'Test 1' },
        { id: '2', amount_yen: 2500, description: 'Test 2' },
      ];
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData,
            meta: {
              has_more: false,
              count: 2,
              total_amount_yen: 3500,
            },
          });
          done();
        });
    });

    it('should not calculate total amount for non-transaction endpoints', (done) => {
      mockRequest.path = '/api/v1/users';
      const testData = [
        { id: '1', amount_yen: 1000, name: 'User 1' },
        { id: '2', amount_yen: 2500, name: 'User 2' },
      ];
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData,
            meta: {
              has_more: false,
              count: 2,
            },
          });
          done();
        });
    });

    it('should handle pagination data with items property', (done) => {
      const testData = {
        items: [{ id: '1' }, { id: '2' }],
        has_more: true,
        next_cursor: 'cursor-123',
        total_amount_yen: 5000,
        meta: { additional: 'metadata' },
      };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData.items,
            meta: {
              has_more: true,
              next_cursor: 'cursor-123',
              count: 2,
              total_amount_yen: 5000,
              additional: 'metadata',
            },
          });
          done();
        });
    });

    it('should handle pagination data with data property', (done) => {
      const testData = {
        data: [{ id: '1' }, { id: '2' }, { id: '3' }],
        has_more: false,
        next_cursor: undefined,
        meta: { page: 1 },
      };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData.data,
            meta: {
              has_more: false,
              next_cursor: undefined,
              count: 3,
              page: 1,
            },
          });
          done();
        });
    });

    it('should handle DELETE requests by setting 204 status', (done) => {
      mockRequest.method = 'DELETE';
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(null));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(mockResponse.status).toHaveBeenCalledWith(204);
          expect(result).toEqual({});
          done();
        });
    });

    it('should handle null/undefined responses by setting 204 status', (done) => {
      mockRequest.method = 'POST';
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(undefined));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(mockResponse.status).toHaveBeenCalledWith(204);
          expect(result).toEqual({});
          done();
        });
    });

    it('should skip transformation for health check paths', (done) => {
      mockRequest.path = '/health';
      const testData = { status: 'ok' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual(testData);
          done();
        });
    });

    it('should skip transformation for healthz paths', (done) => {
      mockRequest.path = '/healthz';
      const testData = { status: 'healthy' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual(testData);
          done();
        });
    });

    it('should skip transformation for schema endpoints', (done) => {
      mockRequest.path = '/api/v1/schema.json';
      const testData = { openapi: '3.0.0' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual(testData);
          done();
        });
    });

    it('should skip transformation for docs endpoints', (done) => {
      mockRequest.path = '/api/v1/docs';
      const testData = { title: 'API Documentation' };
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual(testData);
          done();
        });
    });

    it('should handle empty arrays', (done) => {
      const testData: any[] = [];
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: [],
            meta: {
              has_more: false,
              count: 0,
            },
          });
          done();
        });
    });

    it('should handle array with invalid amount_yen values', (done) => {
      mockRequest.path = '/api/v1/transactions';
      const testData = [
        { id: '1', amount_yen: 1000 },
        { id: '2', amount_yen: null },
        { id: '3', amount_yen: 'invalid' },
        { id: '4', amount_yen: 2000 },
      ];
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData,
            meta: {
              has_more: false,
              count: 4,
              total_amount_yen: 3000, // Only valid numbers are summed
            },
          });
          done();
        });
    });

    it('should return null for total amount when no items have amount_yen', (done) => {
      mockRequest.path = '/api/v1/transactions';
      const testData = [
        { id: '1', description: 'Test 1' },
        { id: '2', description: 'Test 2' },
      ];
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

      interceptor
        .intercept(
          mockExecutionContext as ExecutionContext,
          mockCallHandler as CallHandler,
        )
        .subscribe((result: ApiResponse<any>) => {
          expect(result).toEqual({
            data: testData,
            meta: {
              has_more: false,
              count: 2,
            },
          });
          done();
        });
    });
  });
});
