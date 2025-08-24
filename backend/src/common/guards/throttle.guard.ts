import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

interface ThrottlerLimitDetail {
  limit: number;
  ttl: number;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): void {
    const response = context.switchToHttp().getResponse<Response>();
    const resetTime = Date.now() + throttlerLimitDetail.ttl * 1000;

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', String(throttlerLimitDetail.limit));
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
    response.setHeader('Retry-After', String(throttlerLimitDetail.ttl));

    throw new ThrottlerException({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      details: {
        limit: throttlerLimitDetail.limit,
        window: `${throttlerLimitDetail.ttl} seconds`,
        reset_at: new Date(resetTime).toISOString(),
      },
    });
  }

  protected getTracker(req: Request): string {
    // Use IP address and user ID (if authenticated) for tracking
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.id;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    return userId ? `${ip}:${userId}` : ip;
  }

  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
  ): Promise<boolean> {
    const response = context.switchToHttp().getResponse<Response>();

    const result = await super.handleRequest(context, limit, ttl);

    // Set basic rate limit headers
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - 1)));
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil((Date.now() + ttl * 1000) / 1000),
    );

    return result;
  }
}
