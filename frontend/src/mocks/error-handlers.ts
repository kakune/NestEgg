import { http, HttpResponse } from 'msw';

// Error scenario handlers for comprehensive testing
export const errorHandlers = [
  // Authentication errors
  http.post('http://localhost:3000/api/v1/auth/login', () => {
    return HttpResponse.json(
      { error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } },
      { status: 401 }
    );
  }),

  http.get('http://localhost:3000/api/v1/auth/me', () => {
    return HttpResponse.json(
      { error: { message: 'Token expired', code: 'TOKEN_EXPIRED' } },
      { status: 401 }
    );
  }),

  // Transaction errors
  http.get('http://localhost:3000/api/v1/transactions', () => {
    return HttpResponse.json(
      { error: { message: 'Database connection failed', code: 'DATABASE_ERROR' } },
      { status: 500 }
    );
  }),

  http.post('http://localhost:3000/api/v1/transactions', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Validation failed', 
          code: 'VALIDATION_ERROR',
          details: {
            amount: 'Amount must be greater than 0',
            categoryId: 'Category is required'
          }
        } 
      },
      { status: 400 }
    );
  }),

  http.patch('http://localhost:3000/api/v1/transactions/:id', () => {
    return HttpResponse.json(
      { error: { message: 'Transaction not found', code: 'NOT_FOUND' } },
      { status: 404 }
    );
  }),

  http.delete('http://localhost:3000/api/v1/transactions/:id', () => {
    return HttpResponse.json(
      { error: { message: 'Cannot delete finalized transaction', code: 'CONFLICT' } },
      { status: 409 }
    );
  }),

  // Category errors
  http.get('http://localhost:3000/api/v1/categories', () => {
    return HttpResponse.json(
      { error: { message: 'Access denied', code: 'FORBIDDEN' } },
      { status: 403 }
    );
  }),

  http.post('http://localhost:3000/api/v1/categories', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Circular reference detected', 
          code: 'CIRCULAR_REFERENCE',
          details: 'Cannot set parent category to create circular reference'
        } 
      },
      { status: 400 }
    );
  }),

  // Actor errors
  http.get('http://localhost:3000/api/v1/actors', () => {
    return HttpResponse.json(
      { error: { message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' } },
      { status: 503 }
    );
  }),

  // Settlement errors
  http.post('http://localhost:3000/api/v1/settlements/run', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Settlement already exists for this period', 
          code: 'ALREADY_EXISTS',
          details: 'A settlement for this month has already been created'
        } 
      },
      { status: 409 }
    );
  }),

  http.post('http://localhost:3000/api/v1/settlements/:id/finalize', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Settlement cannot be finalized', 
          code: 'INVALID_STATE',
          details: 'Settlement must be in DRAFT status to finalize'
        } 
      },
      { status: 422 }
    );
  }),

  // CSV import/export errors
  http.post('http://localhost:3000/api/v1/csv/transactions/upload', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'File format not supported', 
          code: 'UNSUPPORTED_FORMAT',
          details: 'Only CSV files are supported'
        } 
      },
      { status: 415 }
    );
  }),

  http.post('http://localhost:3000/api/v1/csv/transactions/import', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Import validation failed', 
          code: 'IMPORT_ERROR',
          details: {
            errors: [
              { row: 2, field: 'amount', message: 'Invalid number format' },
              { row: 3, field: 'date', message: 'Invalid date format' },
            ],
            imported: 1,
            failed: 2
          }
        } 
      },
      { status: 422 }
    );
  }),

  // Network simulation errors
  http.get('http://localhost:3000/api/v1/slow-endpoint', () => {
    // Simulate slow network
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(HttpResponse.json({ data: 'slow response' }));
      }, 5000);
    });
  }),

  // Rate limiting error
  http.post('http://localhost:3000/api/v1/rate-limited', () => {
    return HttpResponse.json(
      { 
        error: { 
          message: 'Too many requests', 
          code: 'RATE_LIMITED',
          details: 'Please try again in 60 seconds'
        } 
      },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }),
];

// Network simulation handlers
export const networkHandlers = [
  // Simulate network timeout
  http.get('http://localhost:3000/api/v1/timeout', () => {
    return new Promise(() => {
      // Never resolve to simulate timeout
    });
  }),

  // Simulate network error
  http.get('http://localhost:3000/api/v1/network-error', () => {
    throw new Error('Network Error');
  }),

  // Simulate intermittent failures
  http.get('http://localhost:3000/api/v1/flaky', () => {
    if (Math.random() > 0.5) {
      return HttpResponse.json({ data: 'success' });
    } else {
      return HttpResponse.json(
        { error: { message: 'Service temporarily unavailable', code: 'TEMPORARY_ERROR' } },
        { status: 503 }
      );
    }
  }),
];

// Load testing handlers - return large datasets
export const loadTestHandlers = [
  http.get('http://localhost:3000/api/v1/transactions/large-dataset', () => {
    const largeTransactionSet = Array.from({ length: 1000 }, (_, index) => ({
      id: String(index + 1),
      date: new Date(2024, Math.floor(index / 30), (index % 30) + 1).toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 10000) + 100,
      type: Math.random() > 0.7 ? 'INCOME' : 'EXPENSE',
      notes: `Generated transaction ${index + 1}`,
      tags: ['generated', 'test'],
      shouldPay: Math.random() > 0.5,
      category: {
        id: String((index % 10) + 1),
        name: `Category ${(index % 10) + 1}`,
        type: Math.random() > 0.7 ? 'INCOME' : 'EXPENSE',
      },
      actor: {
        id: String((index % 5) + 1),
        name: `Actor ${(index % 5) + 1}`,
        kind: Math.random() > 0.8 ? 'INSTRUMENT' : 'USER',
      },
      createdAt: new Date(2024, Math.floor(index / 30), (index % 30) + 1).toISOString(),
      updatedAt: new Date(2024, Math.floor(index / 30), (index % 30) + 1).toISOString(),
    }));

    return HttpResponse.json({
      data: largeTransactionSet,
      meta: {
        total: 1000,
        page: 1,
        limit: 1000,
      },
    });
  }),
];