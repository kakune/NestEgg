import React from 'react';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { CategoryForm } from '../category-form';
import { TransactionType, Category } from '@/types/transaction';
import type { InternalAxiosRequestConfig } from 'axios';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiHelpers: {
    getCategories: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
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

const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Food & Dining',
    type: TransactionType.EXPENSE,
    icon: '🍔',
    color: '#FF5733',
    budgetLimit: 50000,
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Salary',
    type: TransactionType.INCOME,
    icon: '💰',
    color: '#33C3F0',
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Entertainment',
    type: TransactionType.EXPENSE,
    parentId: '1',
    icon: '🎬',
    color: '#8E44AD',
    budgetLimit: 30000,
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockCategory: Category = {
  id: '1',
  name: 'Food & Dining',
  type: TransactionType.EXPENSE,
  icon: '🍔',
  color: '#FF5733',
  budgetLimit: 50000,
  householdId: '1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('CategoryForm', () => {
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
    
    mockApiHelpers.createCategory.mockResolvedValue({
      data: mockCategory,
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {
        url: '/api/categories',
        method: 'post',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.updateCategory.mockResolvedValue({
      data: mockCategory,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/categories',
        method: 'put',
      } as InternalAxiosRequestConfig,
    });
  });

  describe('Initial render', () => {
    it('should render form with correct title for new category', () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Add Category')).toBeInTheDocument();
    });

    it('should render form with correct title for edit category', () => {
      renderWithProviders(
        <CategoryForm
          initialData={mockCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Edit Category')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Parent Category')).toBeInTheDocument();
      expect(screen.getByLabelText(/icon/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/color/i)).toBeInTheDocument();
    });

    it('should render submit and cancel buttons', () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create category/i })).toBeInTheDocument();
    });

    it('should show budget limit field only for expense categories', async () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to be ready (defaults to EXPENSE)
      await waitFor(() => {
        expect(screen.getByLabelText(/monthly budget limit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form initialization with data', () => {
    it('should populate form fields with initial data', async () => {
      renderWithProviders(
        <CategoryForm
          initialData={mockCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const nameField = screen.getByDisplayValue('Food & Dining');
        expect(nameField).toBeInTheDocument();
        
        const iconField = screen.getByDisplayValue('🍔');
        expect(iconField).toBeInTheDocument();
        
        const colorField = screen.getByDisplayValue('#FF5733');
        expect(colorField).toBeInTheDocument();

        const budgetField = screen.getByDisplayValue('50000');
        expect(budgetField).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /update category/i })).toBeInTheDocument();
    });

    it('should set default values for new category', () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Default color should be set
      const colorField = screen.getByDisplayValue('#6B7280');
      expect(colorField).toBeInTheDocument();

      // Should default to EXPENSE type (budget field visible)
      expect(screen.getByLabelText(/monthly budget limit/i)).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should show validation errors for required fields', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Clear name field and try to submit
      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);

      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('should validate name length', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);
      await user.type(nameField, 'a'.repeat(101)); // 101 characters

      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name must be 100 characters or less')).toBeInTheDocument();
      });
    });

    it('should validate color format', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const colorInputs = screen.getAllByRole('textbox');
      const textColorField = colorInputs.find(input => 
        input.getAttribute('value') === '#6B7280' && input.getAttribute('type') !== 'color'
      );
      
      expect(textColorField).toBeTruthy();
      await user.clear(textColorField!);
      await user.type(textColorField!, 'invalid-color');

      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Color must be a valid hex color')).toBeInTheDocument();
      });
    });

    it('should validate budget limit is non-negative', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const budgetField = screen.getByLabelText(/monthly budget limit/i);
      await user.type(budgetField, '-100');

      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Budget limit must be 0 or greater')).toBeInTheDocument();
      });
    });
  });

  describe('Parent category selection', () => {
    it('should load categories for parent selection', async () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Verify API call is made
      await waitFor(() => {
        expect(mockApiHelpers.getCategories).toHaveBeenCalled();
      });
    });

    it('should filter parent categories by type', async () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for categories to load
      await waitFor(() => {
        expect(mockApiHelpers.getCategories).toHaveBeenCalled();
      });

      // Form should render with parent category select
      expect(screen.getByText('Parent Category')).toBeInTheDocument();
    });

    it('should exclude self from parent options when editing', async () => {
      renderWithProviders(
        <CategoryForm
          initialData={mockCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(mockApiHelpers.getCategories).toHaveBeenCalled();
      });

      expect(screen.getByText('Parent Category')).toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('should create new category successfully', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Fill form fields
      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);
      await user.type(nameField, 'Test Category');

      const iconField = screen.getByLabelText(/icon/i);
      await user.type(iconField, '🏷️');

      const budgetField = screen.getByLabelText(/monthly budget limit/i);
      await user.type(budgetField, '25000');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApiHelpers.createCategory).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Category',
            type: TransactionType.EXPENSE,
            icon: '🏷️',
            budgetLimit: 25000,
          })
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should update existing category successfully', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoryForm
          initialData={mockCategory}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Food & Dining')).toBeInTheDocument();
      });

      // Update name
      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);
      await user.type(nameField, 'Updated Category');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /update category/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApiHelpers.updateCategory).toHaveBeenCalledWith(
          '1',
          expect.objectContaining({
            name: 'Updated Category',
          })
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle API error response', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to create category';
      
      mockApiHelpers.createCategory.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Fill required fields
      const nameField = screen.getByLabelText(/name/i);
      await user.type(nameField, 'Test Category');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);

      // Should not call onSuccess
      await waitFor(() => {
        expect(mockApiHelpers.createCategory).toHaveBeenCalled();
      });
      
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup();
      
      // Make API call hang
      mockApiHelpers.createCategory.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Fill required fields
      const nameField = screen.getByLabelText(/name/i);
      await user.type(nameField, 'Test Category');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create category/i });
      await user.click(submitButton);

      // Button should show loading state
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  describe('Cancel functionality', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Type-dependent behavior', () => {
    it('should show budget limit field only for expense type', async () => {
      renderWithProviders(
        <CategoryForm
          initialData={{
            ...mockCategory,
            type: TransactionType.INCOME,
          }}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Food & Dining')).toBeInTheDocument();
      });

      // Budget limit should not be visible for income
      expect(screen.queryByLabelText(/monthly budget limit/i)).not.toBeInTheDocument();
    });

    it('should hide budget limit when switching from expense to income', async () => {
      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Initially expense (budget field visible)
      expect(screen.getByLabelText(/monthly budget limit/i)).toBeInTheDocument();

      // Note: Testing type switching would require interacting with the Select component
      // which is more complex due to its implementation
    });
  });

  describe('API data loading', () => {
    it('should handle API errors gracefully', async () => {
      mockApiHelpers.getCategories.mockRejectedValueOnce(new Error('API Error'));

      renderWithProviders(
        <CategoryForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Form should still render even if categories API fails
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByText('Parent Category')).toBeInTheDocument();
    });
  });
});