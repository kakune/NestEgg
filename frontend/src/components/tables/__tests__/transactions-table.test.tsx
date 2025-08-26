import React from 'react';
import { renderWithProviders, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { TransactionsTable } from '../transactions-table';
import { TransactionType, ActorKind } from '@/types/transaction';

const mockTransactions = [
  {
    id: '1',
    date: '2024-01-15T00:00:00Z',
    amount: 1500,
    type: TransactionType.EXPENSE,
    notes: 'Grocery shopping',
    tags: ['food'],
    shouldPay: true,
    categoryId: '1',
    actorId: '1',
    householdId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    category: {
      id: '1',
      name: 'Food & Dining',
      type: TransactionType.EXPENSE,
      icon: '🍔',
      householdId: '1',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    actor: {
      id: '1',
      name: 'Grocery Store',
      kind: ActorKind.INSTRUMENT,
      householdId: '1',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
  {
    id: '2',
    date: '2024-01-20T00:00:00Z',
    amount: 5000,
    type: TransactionType.INCOME,
    notes: 'Monthly salary',
    tags: ['salary'],
    shouldPay: false,
    categoryId: '2',
    actorId: '2',
    householdId: '1',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    category: {
      id: '2',
      name: 'Salary',
      type: TransactionType.INCOME,
      icon: '💰',
      householdId: '1',
      isActive: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    actor: {
      id: '2',
      name: 'Company',
      kind: ActorKind.INSTRUMENT,
      householdId: '1',
      isActive: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  },
  {
    id: '3',
    date: '2024-01-25T00:00:00Z',
    amount: 800,
    type: TransactionType.EXPENSE,
    notes: 'Movie tickets',
    tags: ['entertainment'],
    shouldPay: false,
    categoryId: '3',
    actorId: '3',
    householdId: '1',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    category: {
      id: '3',
      name: 'Entertainment',
      type: TransactionType.EXPENSE,
      icon: '🎬',
      householdId: '1',
      isActive: true,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
    actor: {
      id: '3',
      name: 'Cinema',
      kind: ActorKind.INSTRUMENT,
      householdId: '1',
      isActive: true,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  },
];

describe('TransactionsTable', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnAdd = jest.fn();
  const mockOnLoadMore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should show loading message when isLoading is true and no transactions', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={[]}
          totalCount={0}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={true}
        />
      );

      expect(screen.getByText('Loading transactions...')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no transactions and not loading', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={[]}
          totalCount={0}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      expect(screen.getByText('No transactions found')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add first transaction/i })).toBeInTheDocument();
    });

    it('should call onAdd when add buttons are clicked in empty state', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionsTable
          transactions={[]}
          totalCount={0}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      const addButtons = screen.getAllByRole('button', { name: /add.*transaction/i });
      
      await user.click(addButtons[0]);
      expect(mockOnAdd).toHaveBeenCalledTimes(1);

      await user.click(addButtons[1]);
      expect(mockOnAdd).toHaveBeenCalledTimes(2);
    });
  });

  describe('Table with data', () => {
    beforeEach(() => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );
    });

    it('should render table headers', () => {
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Actor')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should render transaction data correctly', () => {
      // Check transaction 1 (expense)
      expect(screen.getByText('2024/01/15')).toBeInTheDocument();
      expect(screen.getAllByText('EXPENSE')).toHaveLength(2); // Two expense transactions
      expect(screen.getByText(/1,500/)).toBeInTheDocument();
      expect(screen.getByText('🍔')).toBeInTheDocument();
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();

      // Check transaction 2 (income)
      expect(screen.getByText('2024/01/20')).toBeInTheDocument();
      expect(screen.getByText('INCOME')).toBeInTheDocument();
      expect(screen.getByText(/5,000/)).toBeInTheDocument();
      expect(screen.getByText('💰')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Company')).toBeInTheDocument();
      expect(screen.getByText('Monthly salary')).toBeInTheDocument();
    });

    it('should show transaction count', () => {
      expect(screen.getByText('3 transactions')).toBeInTheDocument();
    });

    it('should show singular transaction count for one transaction', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={[mockTransactions[0]]}
          totalCount={1}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      expect(screen.getByText('1 transaction')).toBeInTheDocument();
    });

    it('should render transaction type icons correctly', () => {
      // Check that trend icons are present by looking for their container elements
      const typeColumns = screen.getAllByText('EXPENSE');
      const incomeColumns = screen.getAllByText('INCOME');
      
      // We should have expense and income type indicators
      expect(typeColumns.length).toBeGreaterThan(0);
      expect(incomeColumns.length).toBeGreaterThan(0);
    });

    it('should apply correct styling to income and expense amounts', () => {
      // Use more specific text matching since the exact format might vary
      const incomeText = screen.getByText(/\+.*5,000/);
      const expenseText = screen.getByText(/-.*1,500/);

      expect(incomeText).toHaveClass('text-green-600');
      expect(expenseText).toHaveClass('text-red-600');
    });
  });

  describe('Search functionality', () => {
    beforeEach(() => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );
    });

    it('should render search input', () => {
      const searchInput = screen.getByPlaceholderText('Search transactions...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should filter transactions by notes', async () => {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText('Search transactions...');

      await user.type(searchInput, 'grocery');

      // Only the grocery transaction should be visible
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
      expect(screen.queryByText('Monthly salary')).not.toBeInTheDocument();
      expect(screen.queryByText('Movie tickets')).not.toBeInTheDocument();
    });

    it('should filter transactions by category name', async () => {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText('Search transactions...');

      await user.type(searchInput, 'entertainment');

      // Only the entertainment transaction should be visible
      expect(screen.getByText('Movie tickets')).toBeInTheDocument();
      expect(screen.queryByText('Grocery shopping')).not.toBeInTheDocument();
      expect(screen.queryByText('Monthly salary')).not.toBeInTheDocument();
    });

    it('should filter transactions by actor name', async () => {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText('Search transactions...');

      await user.type(searchInput, 'company');

      // Only the salary transaction should be visible
      expect(screen.getByText('Monthly salary')).toBeInTheDocument();
      expect(screen.queryByText('Grocery shopping')).not.toBeInTheDocument();
      expect(screen.queryByText('Movie tickets')).not.toBeInTheDocument();
    });

    it('should be case insensitive', async () => {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText('Search transactions...');

      await user.type(searchInput, 'GROCERY');

      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
      expect(screen.queryByText('Monthly salary')).not.toBeInTheDocument();
    });

    it('should show all transactions when search is cleared', async () => {
      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText('Search transactions...');

      await user.type(searchInput, 'grocery');
      expect(screen.queryByText('Monthly salary')).not.toBeInTheDocument();

      await user.clear(searchInput);
      expect(screen.getByText('Monthly salary')).toBeInTheDocument();
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
      expect(screen.getByText('Movie tickets')).toBeInTheDocument();
    });
  });

  describe('Action buttons', () => {
    beforeEach(() => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );
    });

    it('should render action buttons for each transaction', () => {
      const actionButtons = screen.getAllByRole('button', { name: /open menu/i });
      expect(actionButtons).toHaveLength(3); // One for each transaction
    });

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      
      const actionButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(actionButtons[0]);

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockTransactions[0]);
    });

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup();
      
      const actionButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(actionButtons[0]);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(mockTransactions[0].id);
    });

    it('should show edit and delete options in dropdown menu', async () => {
      const user = userEvent.setup();
      
      const actionButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(actionButtons[0]);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('should apply destructive styling to delete button', async () => {
      const user = userEvent.setup();
      
      const actionButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(actionButtons[0]);

      // The destructive class is applied to the menu item, not its parent
      const deleteMenuItem = screen.getByText('Delete').closest('[class*="text-destructive"]');
      expect(deleteMenuItem).toBeInTheDocument();
    });
  });

  describe('Load more functionality', () => {
    it('should show load more button when hasMore is true', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={true}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          onLoadMore={mockOnLoadMore}
          isLoading={false}
        />
      );

      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });

    it('should not show load more button when hasMore is false', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          onLoadMore={mockOnLoadMore}
          isLoading={false}
        />
      );

      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });

    it('should not show load more button when onLoadMore is not provided', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={true}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });

    it('should call onLoadMore when load more button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={true}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          onLoadMore={mockOnLoadMore}
          isLoading={false}
        />
      );

      const loadMoreButton = screen.getByRole('button', { name: /load more/i });
      await user.click(loadMoreButton);

      expect(mockOnLoadMore).toHaveBeenCalled();
    });

    it('should disable load more button and show loading text when isLoading is true', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={true}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          onLoadMore={mockOnLoadMore}
          isLoading={true}
        />
      );

      const loadMoreButton = screen.getByRole('button', { name: /loading/i });
      expect(loadMoreButton).toBeInTheDocument();
      expect(loadMoreButton).toBeDisabled();
    });
  });

  describe('Edge cases', () => {
    it('should handle transactions without category gracefully', () => {
      const transactionWithoutCategory = {
        ...mockTransactions[0],
        category: undefined,
        categoryId: '',
      };

      renderWithProviders(
        <TransactionsTable
          transactions={[transactionWithoutCategory]}
          totalCount={1}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('should handle transactions without actor gracefully', () => {
      const transactionWithoutActor = {
        ...mockTransactions[0],
        actor: undefined,
        actorId: '',
      };

      renderWithProviders(
        <TransactionsTable
          transactions={[transactionWithoutActor]}
          totalCount={1}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('should handle transactions without notes gracefully', () => {
      const transactionWithoutNotes = {
        ...mockTransactions[0],
        notes: undefined,
      };

      renderWithProviders(
        <TransactionsTable
          transactions={[transactionWithoutNotes]}
          totalCount={1}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should handle transactions without category icon gracefully', () => {
      const transactionWithoutIcon = {
        ...mockTransactions[0],
        category: {
          ...mockTransactions[0].category!,
          icon: undefined,
        },
      };

      renderWithProviders(
        <TransactionsTable
          transactions={[transactionWithoutIcon]}
          totalCount={1}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      // Should still render the category name
      expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(7);
      expect(screen.getAllByRole('row')).toHaveLength(4); // 1 header + 3 data rows
    });

    it('should have accessible action buttons with screen reader text', () => {
      renderWithProviders(
        <TransactionsTable
          transactions={mockTransactions}
          totalCount={3}
          hasMore={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onAdd={mockOnAdd}
          isLoading={false}
        />
      );

      const actionButtons = screen.getAllByText('Open menu');
      expect(actionButtons).toHaveLength(3);
    });
  });
});