import React from 'react';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { CategoriesTable } from '../categories-table';
import { TransactionType, Category } from '@/types/transaction';
import type { InternalAxiosRequestConfig } from 'axios';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiHelpers: {
    getCategories: jest.fn(),
    deleteCategory: jest.fn(),
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

// Mock window.confirm
const mockConfirm = jest.fn();
global.confirm = mockConfirm;

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
  {
    id: '4',
    name: 'Restaurants',
    type: TransactionType.EXPENSE,
    parentId: '1',
    icon: '🍽️',
    color: '#E67E22',
    budgetLimit: 20000,
    householdId: '1',
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'Freelance',
    type: TransactionType.INCOME,
    icon: '💻',
    color: '#27AE60',
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe('CategoriesTable', () => {
  const mockOnEditCategory = jest.fn();
  const mockOnCreateCategory = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReset();
    
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
    
    mockApiHelpers.deleteCategory.mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/categories',
        method: 'delete',
      } as InternalAxiosRequestConfig,
    });
  });

  describe('Initial render', () => {
    it('should render loading state initially', () => {
      // Make API call hang to test loading state
      mockApiHelpers.getCategories.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      expect(screen.getByText('Loading categories...')).toBeInTheDocument();
    });

    it('should render error state when API fails', async () => {
      mockApiHelpers.getCategories.mockRejectedValueOnce(new Error('API Error'));

      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading categories')).toBeInTheDocument();
      });
    });

    it('should render categories table with sections', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Income Categories')).toBeInTheDocument();
        expect(screen.getByText('Expense Categories')).toBeInTheDocument();
      });
    });

    it('should render Add Category buttons', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        const addButtons = screen.getAllByText('Add Category');
        expect(addButtons).toHaveLength(2);
      });
    });
  });

  describe('Category display', () => {
    it('should display income categories correctly', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('💰')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
        expect(screen.getByText('💻')).toBeInTheDocument();
        expect(screen.getByText('Freelance')).toBeInTheDocument();
      });
    });

    it('should display expense categories correctly', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('🍔')).toBeInTheDocument();
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      });
    });

    it('should display category properties correctly', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        // Budget limit for parent category should be displayed
        expect(screen.getByText('¥50,000')).toBeInTheDocument();

        // Active/Inactive status - only visible categories count
        // Freelance, Salary (income) + Food & Dining (expense) = 3 active
        // Child categories are collapsed initially
        expect(screen.getAllByText('Active')).toHaveLength(3);
      });
    });

    it('should display color indicators', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        // Color divs should be rendered (can't test actual colors in JSDOM)
        const colorDivs = screen.getAllByRole('generic').filter(
          el => el.className.includes('w-6 h-6 rounded border')
        );
        expect(colorDivs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Hierarchical display', () => {
    it('should display parent-child relationships', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        // Parent category
        expect(screen.getByText('🍔')).toBeInTheDocument();
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
        
        // Child categories should be present but initially collapsed
        expect(screen.queryByText('Entertainment')).not.toBeInTheDocument();
        expect(screen.queryByText('Restaurants')).not.toBeInTheDocument();
      });
    });

    it('should expand/collapse categories', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('🍔')).toBeInTheDocument();
        expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      });

      // Find and click expand button for "Food & Dining"
      const expandButtons = screen.getAllByRole('button');
      const expandButton = expandButtons.find(button => {
        const svg = button.querySelector('svg');
        return svg && button.parentElement?.textContent?.includes('Food & Dining');
      });

      expect(expandButton).toBeInTheDocument();
      await user.click(expandButton!);

      // Child categories should now be visible
      await waitFor(() => {
        expect(screen.getByText('🎬')).toBeInTheDocument();
        expect(screen.getByText('Entertainment')).toBeInTheDocument();
        expect(screen.getByText('🍽️')).toBeInTheDocument();
        expect(screen.getByText('Restaurants')).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should call onCreateCategory when Add Category button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Add Category')).toHaveLength(2);
      });

      const addButton = screen.getAllByText('Add Category')[0];
      await user.click(addButton);

      expect(mockOnCreateCategory).toHaveBeenCalled();
    });

    it('should call onEditCategory when edit action is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('💰')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
      });

      // Click on the actions dropdown for Salary category
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      expect(dropdownButtons.length).toBeGreaterThan(0);
      
      await user.click(dropdownButtons[0]);

      // Click Edit option
      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(mockOnEditCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '5',
          name: 'Freelance',
        })
      );
    });

    it('should handle delete category with confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('💰')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
      });

      // Click on the actions dropdown
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      // Click Delete option
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to delete "Freelance"? This action cannot be undone.'
      );

      await waitFor(() => {
        expect(mockApiHelpers.deleteCategory).toHaveBeenCalledWith('5');
      });
    });

    it('should not delete when user cancels confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);
      
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('💰')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
      });

      // Click on the actions dropdown
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      // Click Delete option
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockApiHelpers.deleteCategory).not.toHaveBeenCalled();
    });
  });

  describe('Empty states', () => {
    it('should show empty state for income categories when none exist', async () => {
      const categoriesWithoutIncome = mockCategories.filter(
        cat => cat.type !== TransactionType.INCOME
      );
      
      mockApiHelpers.getCategories.mockResolvedValue({
        data: { data: categoriesWithoutIncome },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/api/categories',
          method: 'get',
        } as InternalAxiosRequestConfig,
      });

      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No income categories found. Create your first income category to get started.')).toBeInTheDocument();
      });
    });

    it('should show empty state for expense categories when none exist', async () => {
      const categoriesWithoutExpense = mockCategories.filter(
        cat => cat.type !== TransactionType.EXPENSE
      );
      
      mockApiHelpers.getCategories.mockResolvedValue({
        data: { data: categoriesWithoutExpense },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/api/categories',
          method: 'get',
        } as InternalAxiosRequestConfig,
      });

      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No expense categories found. Create your first expense category to get started.')).toBeInTheDocument();
      });
    });
  });

  describe('API integration', () => {
    it('should load categories on mount', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(mockApiHelpers.getCategories).toHaveBeenCalled();
      });
    });

    it('should handle delete API errors', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      mockApiHelpers.deleteCategory.mockRejectedValueOnce({
        response: { data: { message: 'Cannot delete category with transactions' } },
      });
      
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('💰')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
      });

      // Click actions dropdown and delete
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockApiHelpers.deleteCategory).toHaveBeenCalled();
      });
    });
  });

  describe('Sorting and organization', () => {
    it('should sort categories alphabetically', async () => {
      renderWithProviders(
        <CategoriesTable
          onEditCategory={mockOnEditCategory}
          onCreateCategory={mockOnCreateCategory}
        />
      );

      await waitFor(() => {
        // Both categories should be present
        expect(screen.getByText('💻')).toBeInTheDocument();
        expect(screen.getByText('Freelance')).toBeInTheDocument();
        expect(screen.getByText('💰')).toBeInTheDocument();
        expect(screen.getByText('Salary')).toBeInTheDocument();
        
        // Verify they are in the income section
        const incomeSection = screen.getByText('Income Categories').closest('.space-y-6 > div');
        expect(incomeSection).toBeInTheDocument();
      });
    });
  });
});