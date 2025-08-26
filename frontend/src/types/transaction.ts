export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  category?: Category;
  actorId: string;
  actor?: Actor;
  notes?: string;
  tags: string[];
  shouldPay: boolean;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  icon?: string;
  color?: string;
  budgetLimit?: number;
  householdId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum ActorKind {
  USER = 'USER',
  INSTRUMENT = 'INSTRUMENT',
}

export interface Actor {
  id: string;
  name: string;
  kind: ActorKind;
  userId?: string;
  user?: User;
  householdId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;
  year: number;
  month: number;
  userId: string;
  user?: User;
  amount: number;
  deductions?: number;
  allocatableYen?: number;
  description?: string;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

export enum SettlementStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
}

export interface Settlement {
  id: string;
  year: number;
  month: number;
  status: SettlementStatus;
  totalExpenses: number;
  lines: SettlementLine[];
  householdId: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
}

export interface SettlementLine {
  id: string;
  settlementId: string;
  fromUserId: string;
  fromUser?: User;
  toUserId: string;
  toUser?: User;
  amount: number;
  description?: string;
}

import { User } from './user';