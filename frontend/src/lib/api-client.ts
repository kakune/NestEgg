import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

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
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API helper functions
export const apiHelpers = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: { email: string; password: string; name: string; householdName: string }) =>
    api.post('/auth/register', data),
  
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
  getTransactions: (params?: Record<string, unknown>) =>
    api.get('/transactions', { params }),
  
  createTransaction: (data: {
    date: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId: string;
    actorId: string;
    notes?: string;
    tags?: string[];
    shouldPay?: boolean;
  }) => api.post('/transactions', data),
  
  updateTransaction: (id: string, data: Partial<{
    date: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId: string;
    actorId: string;
    notes?: string;
    tags?: string[];
    shouldPay?: boolean;
  }>) => api.patch(`/transactions/${id}`, data),
  
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