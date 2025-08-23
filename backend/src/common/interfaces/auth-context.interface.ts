import { UserRole } from '@prisma/client';

export interface AuthContext {
  userId: string;
  householdId: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  userId: string;
  householdId: string;
  role: UserRole;
  email?: string;
  name?: string;
}
