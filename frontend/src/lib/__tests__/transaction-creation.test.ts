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
import { BackendTransactionRequest } from '@/types/transaction';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Transaction Creation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    it('should transform expense amounts to negative values', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'trans-123',
          type: 'EXPENSE',
          amount_yen: -1500,
        },
      });

      await apiHelpers.createTransaction({
        date: '2025-08-30',
        amount: 1500, // Frontend sends positive
        type: 'EXPENSE',
        categoryId: 'cat-123',
        actorId: 'actor-123',
        shouldPay: false,
        notes: 'Test expense',
        tags: ['test'],
      });

      expect(mockedAxios.post).toHaveBeenCalledWith('/transactions', {
        type: 'EXPENSE',
        amount_yen: -1500, // Backend expects negative for expenses
        occurred_on: '2025-08-30',
        category_id: 'cat-123',
        payer_actor_id: 'actor-123',
        should_pay: 'HOUSEHOLD',
        note: 'Test expense',
        tags: ['test'],
      });
    });

    it('should keep income amounts positive', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          id: 'trans-124',
          type: 'INCOME',
          amount_yen: 5000,
        },
      });

      await apiHelpers.createTransaction({
        date: '2025-08-30',
        amount: 5000, // Frontend sends positive
        type: 'INCOME',
        categoryId: 'cat-124',
        actorId: 'actor-124',
        shouldPay: false,
        notes: 'Test income',
        tags: ['income'],
      });

      expect(mockedAxios.post).toHaveBeenCalledWith('/transactions', {
        type: 'INCOME',
        amount_yen: 5000, // Backend expects positive for income
        occurred_on: '2025-08-30',
        category_id: 'cat-124',
        payer_actor_id: 'actor-124',
        should_pay: 'HOUSEHOLD',
        note: 'Test income',
        tags: ['income'],
      });
    });

    it('should transform field names from camelCase to snake_case', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 'trans-125' },
      });

      await apiHelpers.createTransaction({
        date: '2025-08-30',
        amount: 1000,
        type: 'EXPENSE',
        categoryId: 'cat-125',
        actorId: 'actor-125',
        shouldPay: true,
        notes: 'Test notes',
        tags: ['tag1', 'tag2'],
      });

      const callArgs = mockedAxios.post.mock.calls[0][1] as BackendTransactionRequest;
      
      // Check that camelCase fields are transformed to snake_case
      expect(callArgs).toHaveProperty('amount_yen');
      expect(callArgs).toHaveProperty('occurred_on');
      expect(callArgs).toHaveProperty('category_id');
      expect(callArgs).toHaveProperty('payer_actor_id');
      expect(callArgs).toHaveProperty('should_pay');
      expect(callArgs).toHaveProperty('note');
      
      // Check that original camelCase fields don't exist
      expect(callArgs).not.toHaveProperty('amount');
      expect(callArgs).not.toHaveProperty('date');
      expect(callArgs).not.toHaveProperty('categoryId');
      expect(callArgs).not.toHaveProperty('actorId');
      expect(callArgs).not.toHaveProperty('shouldPay');
      expect(callArgs).not.toHaveProperty('notes');
    });

    it('should handle shouldPay boolean to enum conversion', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 'trans-126' },
      });

      // Test with shouldPay = true (USER)
      await apiHelpers.createTransaction({
        date: '2025-08-30',
        amount: 1000,
        type: 'EXPENSE',
        categoryId: 'cat-126',
        actorId: 'actor-126',
        shouldPay: true,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          should_pay: 'USER',
        })
      );

      mockedAxios.post.mockClear();
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 'trans-127' },
      });

      // Test with shouldPay = false (HOUSEHOLD)
      await apiHelpers.createTransaction({
        date: '2025-08-30',
        amount: 1000,
        type: 'EXPENSE',
        categoryId: 'cat-127',
        actorId: 'actor-127',
        shouldPay: false,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/transactions',
        expect.objectContaining({
          should_pay: 'HOUSEHOLD',
        })
      );
    });

    it('should handle optional fields correctly', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 'trans-128' },
      });

      await apiHelpers.createTransaction({
        date: '2025-08-30',
        amount: 1000,
        type: 'EXPENSE',
        categoryId: 'cat-128',
        actorId: 'actor-128',
        // Optional fields not provided
      });

      const callArgs = mockedAxios.post.mock.calls[0][1] as BackendTransactionRequest;
      
      expect(callArgs.note).toBeUndefined();
      expect(callArgs.tags).toEqual([]); // Default empty array
      expect(callArgs.should_pay).toBe('HOUSEHOLD'); // Default value
    });
  });

  describe('updateTransaction', () => {
    it('should transform expense amounts to negative when type is provided', async () => {
      mockedAxios.patch.mockResolvedValueOnce({
        data: { id: 'trans-129' },
      });

      await apiHelpers.updateTransaction('trans-129', {
        amount: 2000, // Frontend sends positive
        type: 'EXPENSE',
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        '/transactions/trans-129',
        expect.objectContaining({
          amount_yen: -2000, // Backend expects negative for expenses
          type: 'EXPENSE',
        })
      );
    });

    it('should keep income amounts positive when type is provided', async () => {
      mockedAxios.patch.mockResolvedValueOnce({
        data: { id: 'trans-130' },
      });

      await apiHelpers.updateTransaction('trans-130', {
        amount: 3000, // Frontend sends positive
        type: 'INCOME',
      });

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        '/transactions/trans-130',
        expect.objectContaining({
          amount_yen: 3000, // Backend expects positive for income
          type: 'INCOME',
        })
      );
    });

    it('should transform field names for updates', async () => {
      mockedAxios.patch.mockResolvedValueOnce({
        data: { id: 'trans-131' },
      });

      await apiHelpers.updateTransaction('trans-131', {
        date: '2025-08-31',
        categoryId: 'cat-new',
        actorId: 'actor-new',
        notes: 'Updated notes',
      });

      const callArgs = mockedAxios.patch.mock.calls[0][1] as Partial<BackendTransactionRequest>;
      
      expect(callArgs).toHaveProperty('occurred_on', '2025-08-31');
      expect(callArgs).toHaveProperty('category_id', 'cat-new');
      expect(callArgs).toHaveProperty('payer_actor_id', 'actor-new');
      expect(callArgs).toHaveProperty('note', 'Updated notes');
      
      expect(callArgs).not.toHaveProperty('date');
      expect(callArgs).not.toHaveProperty('categoryId');
      expect(callArgs).not.toHaveProperty('actorId');
      expect(callArgs).not.toHaveProperty('notes');
    });
  });
});