export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export interface User {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: UserRole;
  householdId: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Household {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}