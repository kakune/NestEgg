import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Check if request ID is already provided in headers
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();

    // Set request ID in headers for downstream services
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    // Add request ID to request object for easy access
    (req as Request & { requestId: string }).requestId = requestId;

    next();
  }
}
