import axios from 'axios';
import { BackendTransaction } from '@/types/transaction';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5173/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
      // Don't redirect here - let the auth provider handle state updates
    }
    return Promise.reject(error);
  }
);

// API helper functions
export const apiHelpers = {
  // Auth
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  
  register: (data: { email: string; password: string; name: string; username?: string; householdName?: string }) => {
    // Generate username from email if not provided
    const username = data.username || data.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    
    return api.post('/auth/register', {
      email: data.email,
      password: data.password,
      name: data.name,
      username,
    });
  },
  
  logout: () => api.post('/auth/logout'),
  
  getMe: () => api.get('/auth/me'),
  
  // Users
  getUsers: () => api.get('/users'),
  
  createUser: (data: { email: string; password: string; name: string; role: string }) =>
    api.post('/users', data),
  
  updateUser: (id: string, data: Partial<{ email: string; name: string; role: string }>) =>
    api.patch(`/users/${id}`, data),
  
  deleteUser: (id: string) => api.delete(`/users/${id}`),
  
  // Transactions
  getTransactions: async (params?: Record<string, unknown>) => {
    const response = await api.get('/transactions', { params });
    
    // Transform backend response to frontend format
    if (response.data?.data) {
      response.data.data = response.data.data.map((transaction: BackendTransaction) => ({
        id: transaction.id,
        date: transaction.occurredOn,
        amount: Math.abs(transaction.amountYen), // Frontend shows positive amounts
        type: transaction.type,
        categoryId: transaction.categoryId,
        category: transaction.category,
        actorId: transaction.payerActorId,
        actor: transaction.payerActor,
        notes: transaction.note,
        tags: transaction.tags || [],
        shouldPay: transaction.shouldPay === 'USER',
        householdId: transaction.householdId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      }));
    }
    
    return response;
  },
  
  createTransaction: async (data: {
    date: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId: string;
    actorId: string;
    notes?: string;
    tags?: string[];
    shouldPay?: boolean;
  }) => {
    // Transform camelCase frontend data to snake_case backend format
    // Backend expects negative amounts for expenses, positive for income
    const transformedData = {
      type: data.type,
      amount_yen: data.type === 'EXPENSE' ? -Math.abs(data.amount) : Math.abs(data.amount),
      occurred_on: data.date,
      category_id: data.categoryId,
      payer_actor_id: data.actorId,
      should_pay: data.shouldPay ? 'USER' : 'HOUSEHOLD',
      note: data.notes,
      tags: data.tags || [],
    };
    
    const response = await api.post('/transactions', transformedData);
    
    // Transform response back to frontend format
    if (response.data?.data) {
      const transaction = response.data.data;
      response.data.data = {
        id: transaction.id,
        date: transaction.occurredOn,
        amount: Math.abs(transaction.amountYen),
        type: transaction.type,
        categoryId: transaction.categoryId,
        category: transaction.category,
        actorId: transaction.payerActorId,
        actor: transaction.payerActor,
        notes: transaction.note,
        tags: transaction.tags || [],
        shouldPay: transaction.shouldPay === 'USER',
        householdId: transaction.householdId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      };
    }
    
    return response;
  },
  
  updateTransaction: async (id: string, data: Partial<{
    date: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId: string;
    actorId: string;
    notes?: string;
    tags?: string[];
    shouldPay?: boolean;
  }>) => {
    // Transform camelCase frontend data to snake_case backend format
    // Backend expects negative amounts for expenses, positive for income
    const transformedData: Record<string, unknown> = {};
    if (data.type !== undefined) transformedData.type = data.type;
    if (data.amount !== undefined) {
      // If type is provided, use it to determine sign, otherwise we'll let backend handle it
      if (data.type !== undefined) {
        transformedData.amount_yen = data.type === 'EXPENSE' ? -Math.abs(data.amount) : Math.abs(data.amount);
      } else {
        // When type is not provided, we need to preserve the sign intent from frontend
        // Frontend always shows positive amounts, so for updates without type, assume EXPENSE if negative was intended
        transformedData.amount_yen = data.amount;
      }
    }
    if (data.date !== undefined) transformedData.occurred_on = data.date;
    if (data.categoryId !== undefined) transformedData.category_id = data.categoryId;
    if (data.actorId !== undefined) transformedData.payer_actor_id = data.actorId;
    if (data.shouldPay !== undefined) transformedData.should_pay = data.shouldPay ? 'USER' : 'HOUSEHOLD';
    if (data.notes !== undefined) transformedData.note = data.notes;
    if (data.tags !== undefined) transformedData.tags = data.tags;
    
    const response = await api.patch(`/transactions/${id}`, transformedData);
    
    // Transform response back to frontend format
    if (response.data?.data) {
      const transaction = response.data.data;
      response.data.data = {
        id: transaction.id,
        date: transaction.occurredOn,
        amount: Math.abs(transaction.amountYen),
        type: transaction.type,
        categoryId: transaction.categoryId,
        category: transaction.category,
        actorId: transaction.payerActorId,
        actor: transaction.payerActor,
        notes: transaction.note,
        tags: transaction.tags || [],
        shouldPay: transaction.shouldPay === 'USER',
        householdId: transaction.householdId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      };
    }
    
    return response;
  },
  
  deleteTransaction: (id: string) => api.delete(`/transactions/${id}`),
  
  // Categories
  getCategories: () => api.get('/categories'),
  
  getCategoryTree: () => api.get('/categories/tree'),
  
  createCategory: (data: {
    name: string;
    type: 'INCOME' | 'EXPENSE';
    parentId?: string;
    icon?: string;
    color?: string;
    budgetLimit?: number;
  }) => api.post('/categories', data),
  
  updateCategory: (id: string, data: Partial<{
    name: string;
    parentId?: string;
    icon?: string;
    color?: string;
    budgetLimit?: number;
  }>) => api.patch(`/categories/${id}`, data),
  
  deleteCategory: (id: string) => api.delete(`/categories/${id}`),
  
  // Actors
  getActors: () => api.get('/actors'),
  
  createActor: (data: {
    name: string;
    kind: 'USER' | 'INSTRUMENT';
    userId?: string;
  }) => api.post('/actors', data),
  
  updateActor: (id: string, data: Partial<{
    name: string;
    isActive: boolean;
  }>) => api.patch(`/actors/${id}`, data),
  
  deleteActor: (id: string) => api.delete(`/actors/${id}`),
  
  // Incomes
  getIncomes: (params?: Record<string, unknown>) =>
    api.get('/incomes', { params }),
  
  createIncome: (data: {
    year: number;
    month: number;
    userId: string;
    amount: number;
    deductions?: number;
    description?: string;
  }) => api.post('/incomes', data),
  
  updateIncome: (id: string, data: Partial<{
    amount: number;
    deductions?: number;
    description?: string;
  }>) => api.patch(`/incomes/${id}`, data),
  
  deleteIncome: (id: string) => api.delete(`/incomes/${id}`),
  
  // Settlements
  getSettlements: (params?: Record<string, unknown>) =>
    api.get('/settlements', { params }),
  
  getSettlement: (id: string) =>
    api.get(`/settlements/${id}`),
  
  getSettlementByMonth: (month: string) =>
    api.get(`/settlements/${month}`),
  
  runSettlement: (year: number, month: number) =>
    api.post('/settlements/run', { year, month }),
  
  finalizeSettlement: (id: string, data?: { confirmed: boolean; notes?: string }) =>
    api.post(`/settlements/${id}/finalize`, data || { confirmed: true }),
  
  // CSV Import/Export
  uploadTransactionsCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/csv/transactions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  previewTransactionsImport: (data: {
    data: string[][];
    mapping: Record<string, string>;
  }) => api.post('/csv/transactions/preview', data),
  
  importTransactions: (data: {
    data: string[][];
    mapping: Record<string, string>;
  }) => api.post('/csv/transactions/import', data),
  
  exportTransactions: (params?: Record<string, unknown>) =>
    api.get('/csv/transactions/export', { params }),
};