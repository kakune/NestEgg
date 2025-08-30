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

export interface SettlementSummary {
  total_household_expenses_yen: number;
  total_personal_expenses_yen: number;
  participant_count: number;
  transfer_count: number;
}

export interface SettlementUserDetail {
  user: User;
  income_allocation_yen: number;
  household_share_yen: number;
  household_paid_yen: number;
  personal_net_yen: number;
  final_balance_yen: number;
}

export interface Settlement {
  id: string;
  household_id: string;
  month: string; // ISO date format YYYY-MM-DD
  status: SettlementStatus;
  computed_at: string; // ISO datetime
  finalized_at?: string; // ISO datetime
  finalized_by?: User;
  summary: SettlementSummary;
  lines: SettlementLine[];
  user_details: SettlementUserDetail[];
  created_at: string;
  updated_at: string;
}

export interface SettlementLine {
  id: string;
  from_user: User;
  to_user: User;
  amount_yen: number;
  description: string;
}

export interface SettlementRunRequest {
  year: number;
  month: number;
}

export interface SettlementFinalizeRequest {
  confirmed: boolean;
  notes?: string;
}

// Backend transaction format (snake_case fields as received from API)
export interface BackendTransaction {
  id: string;
  occurredOn: string;
  amountYen: number;
  type: TransactionType;
  categoryId: string;
  category?: Category;
  payerActorId: string;
  payerActor?: Actor;
  note?: string;
  tags?: string[];
  shouldPay: 'USER' | 'HOUSEHOLD';
  householdId: string;
  createdAt: string;
  updatedAt: string;
}

// Backend transaction request format (snake_case fields as sent to API)
export interface BackendTransactionRequest {
  type: TransactionType;
  amount_yen: number;
  occurred_on: string;
  category_id: string;
  payer_actor_id: string;
  should_pay: 'USER' | 'HOUSEHOLD';
  note?: string;
  tags?: string[];
}

import { User } from './user';