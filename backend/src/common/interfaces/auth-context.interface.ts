import { UserRole } from '@prisma/client';

export interface AuthContext {
  userId: string;
  householdId: string;
  role: UserRole;
}