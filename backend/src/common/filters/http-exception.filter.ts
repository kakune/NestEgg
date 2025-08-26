import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
    timestamp: string;
    path: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string;

    let status: number;
    let code: string;
    let message: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // Handle validation errors
        if (
          status === 400 &&
          responseObj.message &&
          Array.isArray(responseObj.message)
        ) {
          code = 'VALIDATION_ERROR';
          message = 'Request validation failed';
          details = (responseObj.message as string[]).map((msg: string) => {
            // Parse validation error messages
            const fieldMatch = msg.match(/^(\w+)\s+(.+)/);
            if (fieldMatch && fieldMatch[1] && fieldMatch[2]) {
              return {
                field: fieldMatch[1],
                message: fieldMatch[2],
                code: this.getValidationErrorCode(fieldMatch[2]),
              };
            }
            return { message: msg };
          });
        } else {
          message = (responseObj.message as string) || exception.message;
          code = this.getErrorCode(status, message);
          details = responseObj.error || responseObj.details;
        }
      } else {
        message = exception.message;
        code = this.getErrorCode(status, message);
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected error occurred';

      // Log the actual error for debugging
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        {
          path: request.url,
          method: request.method,
          requestId,
        },
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'UNKNOWN_ERROR';
      message = 'An unknown error occurred';

      this.logger.error(
        `Unknown exception type: ${typeof exception}`,
        JSON.stringify(exception),
        {
          path: request.url,
          method: request.method,
          requestId,
        },
      );
    }

    const errorObject: ErrorResponse['error'] = {
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (details) {
      errorObject.details = details;
    }

    if (requestId) {
      errorObject.request_id = requestId;
    }

    const errorResponse: ErrorResponse = {
      error: errorObject,
    };

    // Log non-validation errors
    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} ${code}: ${message}`,
        JSON.stringify(errorResponse),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `HTTP ${status} ${code}: ${message}`,
        JSON.stringify({
          path: request.url,
          method: request.method,
          requestId,
        }),
      );
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number, message: string): string {
    // Authentication errors
    if (status === 401) {
      if (message.includes('token') && message.includes('expired')) {
        return 'TOKEN_EXPIRED';
      }
      if (message.includes('token') && message.includes('revoked')) {
        return 'TOKEN_REVOKED';
      }
      if (message.includes('session') && message.includes('expired')) {
        return 'SESSION_EXPIRED';
      }
      if (message.includes('credentials')) {
        return 'INVALID_CREDENTIALS';
      }
      return 'UNAUTHORIZED';
    }

    // Authorization errors
    if (status === 403) {
      if (message.includes('scope') || message.includes('permission')) {
        return 'INSUFFICIENT_SCOPE';
      }
      if (message.includes('role')) {
        return 'INSUFFICIENT_PERMISSIONS';
      }
      return 'FORBIDDEN';
    }

    // Client errors
    if (status === 400) {
      if (message.includes('validation')) {
        return 'VALIDATION_ERROR';
      }
      if (message.includes('date') && message.includes('format')) {
        return 'INVALID_DATE_FORMAT';
      }
      if (message.includes('amount')) {
        return 'INVALID_AMOUNT';
      }
      if (message.includes('future date')) {
        return 'FUTURE_DATE_NOT_ALLOWED';
      }
      return 'BAD_REQUEST';
    }

    if (status === 404) {
      return 'RESOURCE_NOT_FOUND';
    }

    if (status === 409) {
      return 'DUPLICATE_RESOURCE';
    }

    if (status === 422) {
      if (message.includes('settlement') && message.includes('finalized')) {
        return 'SETTLEMENT_ALREADY_FINALIZED';
      }
      return 'UNPROCESSABLE_ENTITY';
    }

    if (status === 429) {
      return 'RATE_LIMIT_EXCEEDED';
    }

    // Server errors
    if (status >= 500) {
      if (message.includes('database')) {
        return 'DATABASE_ERROR';
      }
      if (message.includes('service') && message.includes('unavailable')) {
        return 'EXTERNAL_SERVICE_ERROR';
      }
      if (message.includes('maintenance')) {
        return 'MAINTENANCE_MODE';
      }
      return 'INTERNAL_SERVER_ERROR';
    }

    return `HTTP_${status}`;
  }

  private getValidationErrorCode(message: string): string {
    if (
      message.includes('must be a positive integer') ||
      message.includes('must be an integer')
    ) {
      return 'INVALID_AMOUNT';
    }
    if (message.includes('must be a valid date')) {
      return 'INVALID_DATE_FORMAT';
    }
    if (message.includes('must be a valid UUID')) {
      return 'INVALID_UUID';
    }
    if (
      message.includes('is required') ||
      message.includes('should not be empty')
    ) {
      return 'REQUIRED_FIELD_MISSING';
    }
    if (message.includes('must not exceed') || message.includes('too long')) {
      return 'FIELD_TOO_LONG';
    }
    if (message.includes('must be either')) {
      return 'INVALID_ENUM_VALUE';
    }
    return 'VALIDATION_ERROR';
  }
}
