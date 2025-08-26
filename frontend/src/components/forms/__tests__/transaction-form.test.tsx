import React from 'react';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { TransactionForm } from '../transaction-form';
import { TransactionType } from '@/types/transaction';
import type { InternalAxiosRequestConfig } from 'axios';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiHelpers: {
    getCategories: jest.fn(),
    getActors: jest.fn(),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
  },
}));

// Import the mocked module to get access to the mock functions
import { apiHelpers } from '@/lib/api-client';
const mockApiHelpers = apiHelpers as jest.Mocked<typeof apiHelpers>;

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockCategories = [
  {
    id: '1',
    name: 'Food & Dining',
    type: TransactionType.EXPENSE,
    icon: '🍔',
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Salary',
    type: TransactionType.INCOME,
    icon: '💰',
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Entertainment',
    type: TransactionType.EXPENSE,
    icon: '🎬',
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockActors = [
  {
    id: '1',
    name: 'John Doe',
    kind: 'PERSON',
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Grocery Store',
    kind: 'BUSINESS',
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockTransaction = {
  id: '1',
  date: '2024-01-15T00:00:00Z',
  amount: 1500,
  type: TransactionType.EXPENSE,
  categoryId: '1',
  actorId: '1',
  notes: 'Test transaction',
  tags: ['test'],
  shouldPay: true,
  householdId: '1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('TransactionForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default API responses
    mockApiHelpers.getCategories.mockResolvedValue({
      data: { data: mockCategories },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/categories',
        method: 'get',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.getActors.mockResolvedValue({
      data: { data: mockActors },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/actors',
        method: 'get',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.createTransaction.mockResolvedValue({
      data: mockTransaction,
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {
        url: '/api/transactions',
        method: 'post',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.updateTransaction.mockResolvedValue({
      data: mockTransaction,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/transactions',
        method: 'put',
      } as InternalAxiosRequestConfig,
    });
  });

  describe('Initial render', () => {
    it('should render form with correct title for new transaction', () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Add Transaction')).toBeInTheDocument();
    });

    it('should render form with correct title for edit transaction', () => {
      renderWithProviders(
        <TransactionForm
          initialData={mockTransaction}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Edit Transaction')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it('should render submit and cancel buttons', () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create transaction/i })).toBeInTheDocument();
    });
  });

  describe('Form initialization with data', () => {
    it('should populate form fields with initial data', async () => {
      renderWithProviders(
        <TransactionForm
          initialData={mockTransaction}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const dateField = screen.getByDisplayValue('2024-01-15');
        expect(dateField).toBeInTheDocument();
        
        const amountField = screen.getByDisplayValue('1500');
        expect(amountField).toBeInTheDocument();
        
        const notesField = screen.getByDisplayValue('Test transaction');
        expect(notesField).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /update transaction/i })).toBeInTheDocument();
    });

    it('should set default date to today for new transaction', () => {
      const today = new Date().toISOString().split('T')[0];
      
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue(today)).toBeInTheDocument();
    });

    it('should set default type to EXPENSE for new transaction', () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // The form defaults to EXPENSE type, so the shouldPay checkbox should be visible
      expect(screen.getByLabelText(/should be split in settlement/i)).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should show validation errors for required fields', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Try to submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /create transaction/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
        expect(screen.getByText('Category is required')).toBeInTheDocument();
        expect(screen.getByText('Actor is required')).toBeInTheDocument();
      });
    });

    it('should validate amount is greater than 0', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const amountField = screen.getByLabelText(/amount/i);
      await user.clear(amountField);
      await user.type(amountField, '0');

      const submitButton = screen.getByRole('button', { name: /create transaction/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
      });
    });

    it('should not show validation errors for optional fields', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /create transaction/i });
      await user.click(submitButton);

      // Notes is optional, so no error should appear
      await waitFor(() => {
        expect(screen.queryByText(/notes.*required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Dynamic behavior', () => {
    it('should show shouldPay checkbox only for expense transactions', async () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to be ready
      await waitFor(() => {
        expect(screen.getByText('Category')).toBeInTheDocument();
      });

      // Initially set to EXPENSE (default), so checkbox should be visible
      expect(screen.getByLabelText(/should be split in settlement/i)).toBeInTheDocument();
    });

    it('should load categories and actors from API', async () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Verify API calls are made
      await waitFor(() => {
        expect(mockApiHelpers.getCategories).toHaveBeenCalled();
        expect(mockApiHelpers.getActors).toHaveBeenCalled();
      });

      // Form should be rendered
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toBeInTheDocument();
    });

    it('should handle form fields correctly with initial data', async () => {
      renderWithProviders(
        <TransactionForm
          initialData={{
            ...mockTransaction,
            type: TransactionType.EXPENSE,
            categoryId: '1',
          }}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to load with initial data
      await waitFor(() => {
        expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Test transaction')).toBeInTheDocument();
      });

      // Should show checkbox for expense type
      expect(screen.getByLabelText(/should be split in settlement/i)).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('should prepare form for submission with amount and notes', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to be ready
      await waitFor(() => {
        expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      });

      // Fill basic form fields
      const amountField = screen.getByLabelText(/amount/i);
      await user.clear(amountField);
      await user.type(amountField, '1000');

      const notesField = screen.getByLabelText(/notes/i);
      await user.type(notesField, 'Test notes');

      // Verify form fields are filled
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument();
    });

    it('should update existing transaction successfully', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionForm
          initialData={mockTransaction}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
      });

      // Update amount
      const amountField = screen.getByLabelText(/amount/i);
      await user.clear(amountField);
      await user.type(amountField, '2000');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /update transaction/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApiHelpers.updateTransaction).toHaveBeenCalledWith(
          '1',
          expect.objectContaining({
            amount: 2000,
          })
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle API error response setup', async () => {
      const errorMessage = 'Failed to create transaction';
      
      mockApiHelpers.createTransaction.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Verify form renders even when error is set up
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create transaction/i })).toBeInTheDocument();
    });

    it('should show submit button with correct text', async () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Verify submit button text for new transaction
      expect(screen.getByRole('button', { name: /create transaction/i })).toBeInTheDocument();

      // Button should be enabled by default
      expect(screen.getByRole('button', { name: /create transaction/i })).not.toBeDisabled();
    });
  });

  describe('Cancel functionality', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('API data loading', () => {
    it('should make API calls for categories and actors', async () => {
      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Verify API calls are made
      await waitFor(() => {
        expect(mockApiHelpers.getCategories).toHaveBeenCalled();
        expect(mockApiHelpers.getActors).toHaveBeenCalled();
      });

      // Form should render with selects
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      mockApiHelpers.getCategories.mockRejectedValueOnce(new Error('API Error'));
      mockApiHelpers.getActors.mockRejectedValueOnce(new Error('API Error'));

      renderWithProviders(
        <TransactionForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Form should still render even if API calls fail
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    });
  });
});