import { http, HttpResponse } from 'msw';

// Mock data
const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  householdId: '1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockCategories: Array<{
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  budgetLimit: number | null;
  parentId: string | null;
  householdId: string;
  createdAt: string;
  updatedAt: string;
}> = [
  {
    id: '1',
    name: 'Food',
    type: 'EXPENSE',
    icon: '🍕',
    color: '#ff0000',
    budgetLimit: null,
    parentId: null,
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Salary',
    type: 'INCOME',
    icon: '💰',
    color: '#00ff00',
    budgetLimit: null,
    parentId: null,
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockActors = [
  {
    id: '1',
    name: 'Test Actor',
    kind: 'USER',
    isActive: true,
    userId: '1',
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockTransactions: Array<{
  id: string;
  date: string;
  amount: number;
  type: string;
  notes: string;
  tags: string[];
  shouldPay: boolean;
  category: typeof mockCategories[0];
  actor: typeof mockActors[0];
  createdAt: string;
  updatedAt: string;
}> = [
  {
    id: '1',
    date: '2024-01-01',
    amount: 1000,
    type: 'EXPENSE',
    notes: 'Test transaction',
    tags: ['test'],
    shouldPay: true,
    category: mockCategories[0],
    actor: mockActors[0],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

export const handlers = [
  // Authentication endpoints
  http.post('http://localhost:3000/api/v1/auth/login', async ({ request }) => {
    console.log('MSW: Login handler called');
    const { email, password } = await request.json() as { email: string; password: string };
    
    console.log('MSW: Login attempt with', { email, password });
    if (email === 'test@example.com' && password === 'password') {
      const response = {
        accessToken: 'mock-access-token',
        user: mockUser,
      };
      console.log('MSW: Returning login response', response);
      return HttpResponse.json(response);
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post('http://localhost:3000/api/v1/auth/register', async ({ request }) => {
    const body = await request.json() as {
      email: string;
      password: string;
      name: string;
      householdName: string;
    };
    
    return HttpResponse.json({
      accessToken: 'mock-access-token',
      user: {
        ...mockUser,
        email: body.email,
        name: body.name,
      },
    });
  }),

  http.post('http://localhost:3000/api/v1/auth/logout', () => {
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  http.get('http://localhost:3000/api/v1/auth/me', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.includes('Bearer')) {
      return HttpResponse.json(mockUser);
    }
    
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }),

  // Transaction endpoints
  http.get('http://localhost:3000/api/v1/transactions', () => {
    return HttpResponse.json({
      data: mockTransactions,
      meta: {
        total: mockTransactions.length,
        page: 1,
        limit: 20,
      },
    });
  }),

  http.post('http://localhost:3000/api/v1/transactions', async ({ request }) => {
    const body = await request.json() as {
      date: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE';
      categoryId: string;
      actorId: string;
      notes?: string;
      tags?: string[];
      shouldPay?: boolean;
    };

    const newTransaction = {
      id: String(Date.now()),
      ...body,
      notes: body.notes || '',
      tags: body.tags || [],
      shouldPay: body.shouldPay || false,
      category: mockCategories.find(c => c.id === body.categoryId) || mockCategories[0],
      actor: mockActors.find(a => a.id === body.actorId) || mockActors[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockTransactions.push(newTransaction);
    return HttpResponse.json(newTransaction, { status: 201 });
  }),

  http.patch('http://localhost:3000/api/v1/transactions/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as Partial<{
      date: string;
      amount: number;
      type: 'INCOME' | 'EXPENSE';
      categoryId: string;
      actorId: string;
      notes?: string;
      tags?: string[];
      shouldPay?: boolean;
    }>;

    const transactionIndex = mockTransactions.findIndex(t => t.id === id);
    
    if (transactionIndex === -1) {
      return HttpResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const updatedTransaction = {
      ...mockTransactions[transactionIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    if (body.categoryId) {
      updatedTransaction.category = mockCategories.find(c => c.id === body.categoryId) || mockCategories[0];
    }

    if (body.actorId) {
      updatedTransaction.actor = mockActors.find(a => a.id === body.actorId) || mockActors[0];
    }

    mockTransactions[transactionIndex] = updatedTransaction;
    return HttpResponse.json(updatedTransaction);
  }),

  http.delete('http://localhost:3000/api/v1/transactions/:id', ({ params }) => {
    const { id } = params;
    const transactionIndex = mockTransactions.findIndex(t => t.id === id);
    
    if (transactionIndex === -1) {
      return HttpResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    mockTransactions.splice(transactionIndex, 1);
    return HttpResponse.json(null, { status: 204 });
  }),

  // Category endpoints
  http.get('http://localhost:3000/api/v1/categories', () => {
    return HttpResponse.json({
      data: mockCategories,
      meta: {
        total: mockCategories.length,
      },
    });
  }),

  http.post('http://localhost:3000/api/v1/categories', async ({ request }) => {
    const body = await request.json() as {
      name: string;
      type: 'INCOME' | 'EXPENSE';
      parentId?: string;
      icon?: string;
      color?: string;
      budgetLimit?: number;
    };

    const newCategory = {
      id: String(Date.now()),
      ...body,
      icon: body.icon || '📁',
      color: body.color || '#000000',
      budgetLimit: body.budgetLimit || null,
      parentId: body.parentId || null,
      householdId: '1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockCategories.push(newCategory);
    return HttpResponse.json(newCategory, { status: 201 });
  }),

  http.get('http://localhost:3000/api/v1/categories/tree', () => {
    return HttpResponse.json({
      data: [
        {
          id: '1',
          name: 'Food',
          type: 'EXPENSE',
          children: [],
        },
      ],
    });
  }),

  // Actor endpoints
  http.get('http://localhost:3000/api/v1/actors', () => {
    return HttpResponse.json({
      data: mockActors,
      meta: {
        total: mockActors.length,
      },
    });
  }),

  // User endpoints
  http.get('http://localhost:3000/api/v1/users', () => {
    return HttpResponse.json({
      data: [mockUser],
      meta: {
        total: 1,
      },
    });
  }),

  // Settlement endpoints
  http.get('http://localhost:3000/api/v1/settlements', () => {
    return HttpResponse.json({
      data: [],
      meta: { total: 0 },
    });
  }),

  http.post('http://localhost:3000/api/v1/settlements/run', async ({ request }) => {
    const body = await request.json() as {
      year: number;
      month: number;
    };
    return HttpResponse.json({
      id: '1',
      year: body.year,
      month: body.month,
      status: 'DRAFT',
    }, { status: 201 });
  }),

  http.post('http://localhost:3000/api/v1/settlements/:id/finalize', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'FINALIZED',
    });
  }),

  // CSV Import/Export endpoints
  http.post('http://localhost:3000/api/v1/csv/transactions/upload', () => {
    return HttpResponse.json({
      data: [['Date', 'Amount', 'Description']],
      headers: ['Date', 'Amount', 'Description'],
    });
  }),

  http.post('http://localhost:3000/api/v1/csv/transactions/preview', () => {
    return HttpResponse.json({
      preview: [['2024-01-01', '1000', 'Test']],
      errors: [],
    });
  }),

  http.post('http://localhost:3000/api/v1/csv/transactions/import', () => {
    return HttpResponse.json({
      imported: 1,
      errors: [],
    });
  }),

  http.get('http://localhost:3000/api/v1/csv/transactions/export', () => {
    return HttpResponse.text('Date,Amount,Description\n2024-01-01,1000,Test');
  }),

  // Fallback for unhandled requests (these must come LAST)
  http.get('*', ({ request }) => {
    console.warn(`Unhandled GET request to ${request.url}`);
    return HttpResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }),

  http.post('*', ({ request }) => {
    console.warn(`Unhandled POST request to ${request.url}`);
    return HttpResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }),
];
