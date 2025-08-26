import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    has_more?: boolean;
    next_cursor?: string;
    count?: number;
    total_amount_yen?: number;
    [key: string]: unknown;
  };
}

export interface PaginationMeta {
  has_more: boolean;
  next_cursor?: string;
  count: number;
  [key: string]: unknown;
}

interface PaginationData {
  items?: unknown;
  data?: unknown;
  has_more?: boolean;
  next_cursor?: string;
  total_amount_yen?: number;
  meta?: Record<string, unknown>;
}

interface TransactionItem {
  amount_yen?: number;
  [key: string]: unknown;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data: T): ApiResponse<T> => {
        // Skip transformation for certain routes that return raw data
        if (this.shouldSkipTransformation(request.path)) {
          return data as ApiResponse<T>;
        }

        // Handle DELETE requests (typically return void/null)
        if (
          request.method === 'DELETE' ||
          data === null ||
          data === undefined
        ) {
          response.status(204);
          return {} as ApiResponse<T>;
        }

        // Handle pagination data
        if (this.isPaginationData(data)) {
          const paginationData = data as PaginationData;
          const items = (paginationData.items || paginationData.data) as T;
          const meta = paginationData.meta || {};

          return {
            data: items,
            meta: {
              has_more: Boolean(paginationData.has_more) || false,
              ...(paginationData.next_cursor && {
                next_cursor: paginationData.next_cursor,
              }),
              count: Array.isArray(items) ? items.length : 0,
              ...(paginationData.total_amount_yen && {
                total_amount_yen: paginationData.total_amount_yen,
              }),
              ...meta,
            },
          };
        }

        // Handle array responses (list endpoints)
        if (Array.isArray(data)) {
          // Check if it's a transaction list for total amount calculation
          const totalAmount = this.calculateTotalAmount(data, request.path);

          return {
            data,
            meta: {
              has_more: false,
              count: data.length,
              ...(totalAmount !== null && { total_amount_yen: totalAmount }),
            },
          };
        }

        // Handle single resource responses
        return {
          data,
        };
      }),
    );
  }

  private shouldSkipTransformation(path: string): boolean {
    // Skip transformation for health checks, schema endpoints, etc.
    const skipPaths = [
      '/healthz',
      '/health',
      '/api/v1/schema.json',
      '/api/v1/docs',
    ];

    return skipPaths.some((skipPath) => path.includes(skipPath));
  }

  private isPaginationData(data: unknown): data is PaginationData {
    return (
      data !== null &&
      typeof data === 'object' &&
      (Object.prototype.hasOwnProperty.call(data, 'items') ||
        Object.prototype.hasOwnProperty.call(data, 'data')) &&
      (Object.prototype.hasOwnProperty.call(data, 'has_more') ||
        Object.prototype.hasOwnProperty.call(data, 'next_cursor') ||
        Object.prototype.hasOwnProperty.call(data, 'meta'))
    );
  }

  private calculateTotalAmount(data: unknown[], path: string): number | null {
    // Only calculate total amount for transaction endpoints
    if (!path.includes('/transactions')) {
      return null;
    }

    // Check if items have amount_yen property
    if (
      !Array.isArray(data) ||
      data.length === 0 ||
      !Object.prototype.hasOwnProperty.call(data[0], 'amount_yen')
    ) {
      return null;
    }

    return data.reduce((total: number, item: unknown) => {
      const typedItem = item as TransactionItem;
      const amount =
        typeof typedItem.amount_yen === 'number' ? typedItem.amount_yen : 0;
      return total + amount;
    }, 0);
  }
}
