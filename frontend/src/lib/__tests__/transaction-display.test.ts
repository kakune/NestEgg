import axios from 'axios';

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

// Mock axios before importing api-client
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
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() }
    }
  };
  mockAxios.create.mockReturnValue(mockAxios);
  return { default: mockAxios, ...mockAxios };
});

import { apiHelpers } from '../api-client';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Transaction Display Data Transformation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransactions', () => {
    it('should transform backend response to frontend format', async () => {
      const mockBackendResponse = {
        data: {
          data: [
            {
              id: 'trans-1',
              type: 'EXPENSE',
              amountYen: -1500, // Backend stores negative for expenses
              occurredOn: '2025-08-30T00:00:00.000Z', // Backend field name
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Food & Dining' },
              payerActorId: 'actor-1', // Backend field name
              payerActor: { id: 'actor-1', name: 'Cash', kind: 'INSTRUMENT' }, // Backend field name
              note: 'Test expense', // Backend field name
              tags: ['test'],
              shouldPay: 'HOUSEHOLD',
              householdId: 'household-1',
              createdAt: '2025-08-30T11:15:20.544Z',
              updatedAt: '2025-08-30T11:15:20.544Z',
            },
            {
              id: 'trans-2',
              type: 'INCOME',
              amountYen: 50000, // Backend stores positive for income
              occurredOn: '2025-08-30T00:00:00.000Z',
              categoryId: 'cat-2',
              category: { id: 'cat-2', name: 'Salary' },
              payerActorId: 'actor-2',
              payerActor: { id: 'actor-2', name: 'John Doe', kind: 'USER' },
              note: 'Monthly salary',
              tags: ['salary', 'income'],
              shouldPay: 'USER',
              householdId: 'household-1',
              createdAt: '2025-08-30T11:43:14.866Z',
              updatedAt: '2025-08-30T11:43:14.866Z',
            }
          ],
          meta: { has_more: false, count: 2 }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockBackendResponse);

      const response = await apiHelpers.getTransactions();

      expect(mockedAxios.get).toHaveBeenCalledWith('/transactions', { params: undefined });

      // Check that the response data is transformed correctly
      const transformedTransactions = response.data.data;
      
      // First transaction (expense)
      expect(transformedTransactions[0]).toEqual({
        id: 'trans-1',
        date: '2025-08-30T00:00:00.000Z', // Transformed from occurredOn
        amount: 1500, // Transformed from amountYen, converted to positive
        type: 'EXPENSE',
        categoryId: 'cat-1',
        category: { id: 'cat-1', name: 'Food & Dining' },
        actorId: 'actor-1', // Transformed from payerActorId
        actor: { id: 'actor-1', name: 'Cash', kind: 'INSTRUMENT' }, // Transformed from payerActor
        notes: 'Test expense', // Transformed from note
        tags: ['test'],
        shouldPay: false, // Transformed from 'HOUSEHOLD' to false
        householdId: 'household-1',
        createdAt: '2025-08-30T11:15:20.544Z',
        updatedAt: '2025-08-30T11:15:20.544Z',
      });

      // Second transaction (income)
      expect(transformedTransactions[1]).toEqual({
        id: 'trans-2',
        date: '2025-08-30T00:00:00.000Z',
        amount: 50000, // Already positive, stays the same
        type: 'INCOME',
        categoryId: 'cat-2',
        category: { id: 'cat-2', name: 'Salary' },
        actorId: 'actor-2',
        actor: { id: 'actor-2', name: 'John Doe', kind: 'USER' },
        notes: 'Monthly salary',
        tags: ['salary', 'income'],
        shouldPay: true, // Transformed from 'USER' to true
        householdId: 'household-1',
        createdAt: '2025-08-30T11:43:14.866Z',
        updatedAt: '2025-08-30T11:43:14.866Z',
      });
    });

    it('should handle empty response', async () => {
      const mockBackendResponse = {
        data: {
          data: [],
          meta: { has_more: false, count: 0 }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockBackendResponse);

      const response = await apiHelpers.getTransactions();
      
      expect(response.data.data).toEqual([]);
    });

    it('should handle missing optional fields', async () => {
      const mockBackendResponse = {
        data: {
          data: [
            {
              id: 'trans-3',
              type: 'EXPENSE',
              amountYen: -1000,
              occurredOn: '2025-08-30T00:00:00.000Z',
              categoryId: 'cat-3',
              category: { id: 'cat-3', name: 'Miscellaneous' },
              payerActorId: 'actor-3',
              payerActor: { id: 'actor-3', name: 'Unknown', kind: 'INSTRUMENT' },
              note: null, // Missing note
              tags: null, // Missing tags
              shouldPay: 'HOUSEHOLD',
              householdId: 'household-1',
              createdAt: '2025-08-30T11:15:20.544Z',
              updatedAt: '2025-08-30T11:15:20.544Z',
            }
          ],
          meta: { has_more: false, count: 1 }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockBackendResponse);

      const response = await apiHelpers.getTransactions();
      const transaction = response.data.data[0];

      expect(transaction.notes).toBeNull();
      expect(transaction.tags).toEqual([]); // Should default to empty array
      expect(transaction.actor.name).toBe('Unknown'); // Should not be "Unknown" anymore
    });
  });

  describe('Amount Display Logic', () => {
    it('should show positive amounts for both income and expense in frontend', async () => {
      const mockBackendResponse = {
        data: {
          data: [
            {
              id: 'trans-expense',
              type: 'EXPENSE',
              amountYen: -1500, // Negative in backend
              occurredOn: '2025-08-30T00:00:00.000Z',
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Food' },
              payerActorId: 'actor-1',
              payerActor: { id: 'actor-1', name: 'Cash', kind: 'INSTRUMENT' },
              shouldPay: 'HOUSEHOLD',
              householdId: 'household-1',
              createdAt: '2025-08-30T11:15:20.544Z',
              updatedAt: '2025-08-30T11:15:20.544Z',
            },
            {
              id: 'trans-income',
              type: 'INCOME',
              amountYen: 2000, // Positive in backend
              occurredOn: '2025-08-30T00:00:00.000Z',
              categoryId: 'cat-2',
              category: { id: 'cat-2', name: 'Salary' },
              payerActorId: 'actor-2',
              payerActor: { id: 'actor-2', name: 'John', kind: 'USER' },
              shouldPay: 'USER',
              householdId: 'household-1',
              createdAt: '2025-08-30T11:15:20.544Z',
              updatedAt: '2025-08-30T11:15:20.544Z',
            }
          ],
          meta: { has_more: false, count: 2 }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockBackendResponse);

      const response = await apiHelpers.getTransactions();
      const transactions = response.data.data;

      // Both should be positive in frontend display
      expect(transactions[0].amount).toBe(1500); // Expense: |-1500| = 1500
      expect(transactions[1].amount).toBe(2000); // Income: |2000| = 2000
      
      // But types should be preserved
      expect(transactions[0].type).toBe('EXPENSE');
      expect(transactions[1].type).toBe('INCOME');
    });
  });
});