import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../../test/test-utils';

interface ThrottlerLimitDetail {
  limit: number;
  ttl: number;
}

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  public async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    const resetTime = Date.now() + throttlerLimitDetail.ttl * 1000;

    // Add rate limit headers
    response.setHeader('X-RateLimit-Limit', String(throttlerLimitDetail.limit));
    response.setHeader('X-RateLimit-Remaining', '0');
    response.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));
    response.setHeader('Retry-After', String(throttlerLimitDetail.ttl));

    // Using Promise.resolve to make this properly async
    await Promise.resolve();

    throw new ThrottlerException(
      `Too many requests. Limit: ${throttlerLimitDetail.limit}, Window: ${throttlerLimitDetail.ttl} seconds`,
    );
  }

  public getTracker(req: Request): Promise<string> {
    // Use IP address and user ID (if authenticated) for tracking
    const authenticatedReq = req as AuthenticatedRequest;
    const userId = authenticatedReq.user?.id;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    return Promise.resolve(userId ? `${ip}:${userId}` : ip);
  }

  public async handleRequest(requestProps: {
    context: ExecutionContext;
    limit: number;
    ttl: number;
  }): Promise<boolean> {
    const { context, limit, ttl } = requestProps;
    const response = context.switchToHttp().getResponse<Response>();

    const result = await super.handleRequest({
      ...requestProps,
      throttler: { name: 'default', limit, ttl },
      blockDuration: 0,
      getTracker: (req: Record<string, unknown>) =>
        this.getTracker(req as unknown as Request),
      generateKey: () => 'key',
    });

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
