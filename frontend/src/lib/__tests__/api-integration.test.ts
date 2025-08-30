/**
 * API Integration Tests
 * Tests the API client functionality with mocked responses
 * These tests verify the API client works correctly without requiring a running backend
 */

import { api, apiHelpers } from '@/lib/api-client';
import { TransactionType, ActorKind } from '@/types/transaction';

// Mock axios interface
interface MockAxios {
  create: jest.Mock;
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
  defaults: {
    baseURL: string;
    headers: {
      common: Record<string, string>;
      'Content-Type': string;
    };
  };
  interceptors: {
    request: {
      use: jest.Mock;
      eject: jest.Mock;
    };
    response: {
      use: jest.Mock;
      eject: jest.Mock;
    };
  };
}

// Mock axios
jest.mock('axios', () => {
  const mockAxios: MockAxios = {
    create: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    defaults: {
      baseURL: '',
      headers: {
        common: {} as Record<string, string>,
        'Content-Type': 'application/json'
      }
    },
    interceptors: {
      request: {
        use: jest.fn(),
        eject: jest.fn()
      },
      response: {
        use: jest.fn(),
        eject: jest.fn()
      }
    }
  };
  
  // Make create return the mock itself
  mockAxios.create.mockReturnValue(mockAxios);
  
  return {
    default: mockAxios,
    ...mockAxios
  };
});

// Mock fetch for health check
global.fetch = jest.fn();

describe('API Client', () => {
  const mockApi = api as jest.Mocked<typeof api>;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should have content-type header set', () => {
      expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Health Check', () => {
    it('should handle health check endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' })
      } as Response);

      const response = await fetch('http://localhost:3001/health');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('status');
    });
  });

  describe('Authentication', () => {
    const testUser = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'TestPassword123!',
      name: 'Test User',
    };

    it('should register a new user', async () => {
      const mockResponse = {
        status: 201,
        data: {
          data: {
            accessToken: 'mock-access-token',
            user: {
              id: '1',
              email: testUser.email,
              username: testUser.username,
              name: testUser.name,
              role: 'admin',
              householdId: '1'
            }
          }
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.register({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
        householdName: 'Test Household',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('accessToken');
      expect(response.data.data).toHaveProperty('user');
    });

    it('should login a user', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            accessToken: 'mock-access-token',
            user: {
              id: '1',
              email: testUser.email,
              username: testUser.username,
              name: testUser.name,
              role: 'admin',
              householdId: '1'
            }
          }
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.login(testUser.username, testUser.password);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('accessToken');
      expect(response.data.data).toHaveProperty('user');
    });

    it('should get current user', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            user: {
              id: '1',
              email: testUser.email,
              username: testUser.username,
              name: testUser.name,
              role: 'admin',
              householdId: '1'
            }
          }
        }
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.getMe();
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('user');
      expect(response.data.data.user).toHaveProperty('id');
      expect(response.data.data.user).toHaveProperty('email');
    });
  });

  describe('Categories CRUD', () => {
    const mockCategoryId = 'mock-category-id';

    it('should create a category', async () => {
      const mockResponse = {
        status: 201,
        data: {
          data: {
            id: mockCategoryId,
            name: 'Test Category',
            type: TransactionType.EXPENSE,
            icon: '🍔',
            color: '#FF5733'
          }
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.createCategory({
        name: 'Test Category',
        type: TransactionType.EXPENSE,
        icon: '🍔',
        color: '#FF5733',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('id');
    });

    it('should get all categories', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: [
            {
              id: mockCategoryId,
              name: 'Test Category',
              type: TransactionType.EXPENSE,
              icon: '🍔',
              color: '#FF5733'
            }
          ]
        }
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.getCategories();
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should update a category', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            id: mockCategoryId,
            name: 'Updated Category Name',
            type: TransactionType.EXPENSE,
            color: '#00FF00'
          }
        }
      };

      mockApi.patch.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.updateCategory(mockCategoryId, {
        name: 'Updated Category Name',
        color: '#00FF00',
      });

      expect(response.status).toBe(200);
      expect(response.data.data.name).toBe('Updated Category Name');
    });

    it('should delete a category', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      };

      mockApi.delete.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.deleteCategory(mockCategoryId);
      expect(response.status).toBe(200);
    });
  });

  describe('Actors CRUD', () => {
    const mockActorId = 'mock-actor-id';

    it('should get all actors', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: [
            {
              id: mockActorId,
              name: 'Test Actor',
              kind: ActorKind.INSTRUMENT,
              isActive: true
            }
          ]
        }
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.getActors();
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should create an instrument actor', async () => {
      const mockResponse = {
        status: 201,
        data: {
          data: {
            id: mockActorId,
            name: 'Test Instrument',
            kind: ActorKind.INSTRUMENT,
            isActive: true
          }
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.createActor({
        name: 'Test Instrument',
        kind: ActorKind.INSTRUMENT,
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.kind).toBe(ActorKind.INSTRUMENT);
    });

    it('should update an actor', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            id: mockActorId,
            name: 'Updated Actor Name',
            kind: ActorKind.INSTRUMENT,
            isActive: false
          }
        }
      };

      mockApi.patch.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.updateActor(mockActorId, {
        name: 'Updated Actor Name',
        isActive: false,
      });

      expect(response.status).toBe(200);
      expect(response.data.data.name).toBe('Updated Actor Name');
      expect(response.data.data.isActive).toBe(false);
    });
  });

  describe('Transactions CRUD', () => {
    const mockTransactionId = 'mock-transaction-id';
    const mockCategoryId = 'mock-category-id';
    const mockActorId = 'mock-actor-id';

    it('should create a transaction', async () => {
      const mockResponse = {
        status: 201,
        data: {
          data: {
            id: mockTransactionId,
            occurredOn: '2024-01-01T00:00:00.000Z', // Backend field name
            amountYen: -5000, // Backend field name, negative for expenses
            type: TransactionType.EXPENSE,
            categoryId: mockCategoryId,
            payerActorId: mockActorId, // Backend field name
            payerActor: { id: mockActorId, name: 'Test Actor', kind: 'INSTRUMENT' }, // Backend field name
            category: { id: mockCategoryId, name: 'Test Category' },
            note: 'Test transaction', // Backend field name
            tags: ['test', 'integration'],
            shouldPay: 'USER', // Backend format
            householdId: 'test-household',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          }
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.createTransaction({
        date: '2024-01-01',
        amount: 5000,
        type: TransactionType.EXPENSE,
        categoryId: mockCategoryId,
        actorId: mockActorId,
        notes: 'Test transaction',
        tags: ['test', 'integration'],
        shouldPay: true,
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.amount).toBe(5000); // Transformed to positive
      expect(response.data.data.date).toBe('2024-01-01T00:00:00.000Z'); // Transformed from occurredOn
      expect(response.data.data.actorId).toBe(mockActorId); // Transformed from payerActorId
      expect(response.data.data.actor).toEqual({ id: mockActorId, name: 'Test Actor', kind: 'INSTRUMENT' }); // Transformed from payerActor
      expect(response.data.data.notes).toBe('Test transaction'); // Transformed from note
      expect(response.data.data.shouldPay).toBe(true); // Transformed from 'USER' to true
    });

    it('should get all transactions', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: [
            {
              id: mockTransactionId,
              occurredOn: '2024-01-01T00:00:00.000Z', // Backend field name
              amountYen: -5000, // Backend field name, negative for expenses
              type: TransactionType.EXPENSE,
              categoryId: mockCategoryId,
              payerActorId: mockActorId, // Backend field name
              payerActor: { id: mockActorId, name: 'Test Actor', kind: 'INSTRUMENT' }, // Backend field name
              category: { id: mockCategoryId, name: 'Test Category' },
              note: 'Test transaction', // Backend field name
              tags: ['test'],
              shouldPay: 'HOUSEHOLD', // Backend format
              householdId: 'test-household',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            }
          ],
          meta: { has_more: false, count: 1 }
        }
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.getTransactions();
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should update a transaction', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            id: mockTransactionId,
            occurredOn: '2024-01-01T00:00:00.000Z', // Backend field name
            amountYen: -7500, // Backend field name, negative for expenses
            type: TransactionType.EXPENSE,
            categoryId: mockCategoryId,
            payerActorId: mockActorId, // Backend field name
            payerActor: { id: mockActorId, name: 'Test Actor', kind: 'INSTRUMENT' }, // Backend field name
            category: { id: mockCategoryId, name: 'Test Category' },
            note: 'Updated transaction', // Backend field name
            tags: ['test'],
            shouldPay: 'HOUSEHOLD', // Backend format
            householdId: 'test-household',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          }
        }
      };

      mockApi.patch.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.updateTransaction(mockTransactionId, {
        amount: 7500,
        notes: 'Updated transaction',
      });

      expect(response.status).toBe(200);
      expect(response.data.data.amount).toBe(7500);
      expect(response.data.data.notes).toBe('Updated transaction');
    });

    it('should delete a transaction', async () => {
      const mockResponse = {
        status: 200,
        data: { success: true }
      };

      mockApi.delete.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.deleteTransaction(mockTransactionId);
      expect(response.status).toBe(200);
    });
  });

  describe('Settlements', () => {
    const mockSettlementId = 'mock-settlement-id';

    it('should run a settlement', async () => {
      const mockResponse = {
        status: 201,
        data: {
          data: {
            id: mockSettlementId,
            month: '2024-01-01',
            status: 'DRAFT',
            computedAt: new Date().toISOString()
          }
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.runSettlement(2024, 1);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data).toHaveProperty('status');
    });

    it('should get all settlements', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: [
            {
              id: mockSettlementId,
              month: '2024-01-01',
              status: 'DRAFT',
              computedAt: new Date().toISOString()
            }
          ]
        }
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.getSettlements();
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should get a specific settlement', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            id: mockSettlementId,
            month: '2024-01-01',
            status: 'DRAFT',
            computedAt: new Date().toISOString()
          }
        }
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.getSettlement(mockSettlementId);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data.id).toBe(mockSettlementId);
    });

    it('should finalize a settlement', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            id: mockSettlementId,
            month: '2024-01-01',
            status: 'FINALIZED',
            finalizedAt: new Date().toISOString()
          }
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.finalizeSettlement(mockSettlementId, {
        confirmed: true,
        notes: 'Test finalization',
      });

      expect(response.status).toBe(200);
      expect(response.data.data.status).toBe('FINALIZED');
    });
  });

  describe('CSV Import/Export', () => {
    it('should export transactions as CSV', async () => {
      const mockCsvData = 'Date,Amount,Type,Category,Actor,Notes\n2024-01-01,5000,EXPENSE,Food,John,Lunch';
      const mockResponse = {
        status: 200,
        data: mockCsvData
      };

      mockApi.get.mockResolvedValueOnce(mockResponse);

      const response = await apiHelpers.exportTransactions();
      expect(response.status).toBe(200);
      expect(typeof response.data).toBe('string');
      expect(response.data).toContain(',');
    });

    it('should preview CSV import', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: [
            {
              date: '2024-01-01',
              amount: 5000,
              type: 'EXPENSE',
              category: 'Food',
              actor: 'John',
              notes: 'Lunch'
            }
          ]
        }
      };

      mockApi.post.mockResolvedValueOnce(mockResponse);

      const csvData = [
        ['Date', 'Amount', 'Type', 'Category', 'Actor', 'Notes'],
        ['2024-01-01', '5000', 'EXPENSE', 'Food', 'John', 'Lunch'],
      ];

      const response = await apiHelpers.previewTransactionsImport({
        data: csvData,
        mapping: {
          date: '0',
          amount: '1',
          type: '2',
          category: '3',
          actor: '4',
          notes: '5',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
    });
  });
});