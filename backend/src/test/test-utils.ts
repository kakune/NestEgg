import { UserRole } from '@prisma/client';
import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    role: UserRole | undefined;
  };
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

export interface MockUser {
  id?: string | number;
  username?: string;
  email?: string;
  role?: UserRole | undefined;
  householdId?: string;
  name?: string;
  roles?: string[];
  isActive?: boolean;
  isVerified?: boolean;
  score?: number;
  count?: number;
  optionalField?: unknown;
  anotherField?: string;
  createdAt?: Date;
  profile?: {
    personal?: {
      name?: string;
      age?: number;
    };
    preferences?: {
      theme?: string;
      notifications?: boolean;
    };
    name?: string;
    age?: number;
  };
  metadata?: {
    lastLogin?: Date;
    loginCount?: number;
  };
}

export interface MockRequest {
  user?: MockUser | null | undefined;
}

export interface MockHttpContext {
  getRequest(): MockRequest;
  getResponse?(): unknown;
  getNext?(): unknown;
}

export interface MockExecutionContext {
  getHandler(): unknown;
  getClass(): unknown;
  switchToHttp(): MockHttpContext;
  switchToRpc(): unknown;
  switchToWs(): unknown;
  getType(): unknown;
  getArgs(): unknown;
  getArgByIndex(index: number): unknown;
}
