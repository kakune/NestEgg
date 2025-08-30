import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionType, ActorKind } from '@/types/transaction';

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

function AllTheProviders({ 
  children, 
  queryClient = createTestQueryClient() 
}: { 
  children: React.ReactNode;
  queryClient?: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { queryClient, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: queryClient || createTestQueryClient(),
  };
}

// Mock data factories
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER' as const,
  householdId: '1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockTransaction = {
  id: '1',
  date: '2024-01-01',
  amount: 1000,
  type: TransactionType.EXPENSE,
  categoryId: '1',
  actorId: '1',
  householdId: '1',
  notes: 'Test transaction',
  tags: ['test'],
  shouldPay: true,
  category: {
    id: '1',
    name: 'Food',
    type: TransactionType.EXPENSE,
    icon: '🍕',
    color: '#ff0000',
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  actor: {
    id: '1',
    name: 'Test Actor',
    kind: ActorKind.USER,
    householdId: '1',
    isActive: true,
    userId: '1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockCategory = {
  id: '1',
  name: 'Food',
  type: TransactionType.EXPENSE,
  icon: '🍕',
  color: '#ff0000',
  budgetLimit: undefined,
  parentId: undefined,
  householdId: '1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockActor = {
  id: '1',
  name: 'Test Actor',
  kind: ActorKind.USER,
  isActive: true,
  userId: '1',
  householdId: '1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// Enhanced test data factories for different scenarios
export const createMockUser = (overrides: Partial<typeof mockUser> = {}) => ({
  ...mockUser,
  ...overrides,
});

export const createMockTransaction = (overrides: Partial<typeof mockTransaction> = {}) => ({
  ...mockTransaction,
  ...overrides,
});

export const createMockCategory = (overrides: Partial<typeof mockCategory> = {}) => ({
  ...mockCategory,
  ...overrides,
});

export const createMockActor = (overrides: Partial<typeof mockActor> = {}) => ({
  ...mockActor,
  ...overrides,
});

// Scenario-based factories
export const mockIncomeTransaction = createMockTransaction({
  type: TransactionType.INCOME,
  amount: 5000,
  notes: 'Salary payment',
  tags: ['salary', 'income'],
  shouldPay: false,
  category: {
    id: '2',
    name: 'Salary',
    type: TransactionType.INCOME,
    icon: '💰',
    color: '#00ff00',
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
});

export const mockExpenseTransaction = createMockTransaction({
  type: TransactionType.EXPENSE,
  amount: 1500,
  notes: 'Grocery shopping',
  tags: ['groceries', 'food'],
  shouldPay: true,
});

export const mockLargeTransaction = createMockTransaction({
  amount: 150000,
  notes: 'Rent payment',
  tags: ['rent', 'housing'],
});

export const mockRecentTransaction = createMockTransaction({
  date: new Date().toISOString().split('T')[0],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const mockOldTransaction = createMockTransaction({
  date: '2023-01-01',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
});

// Multiple entities for list scenarios
export const createMockTransactions = (count: number = 5) =>
  Array.from({ length: count }, (_, index) =>
    createMockTransaction({
      id: String(index + 1),
      amount: (index + 1) * 1000,
      notes: `Test transaction ${index + 1}`,
      date: new Date(2024, 0, index + 1).toISOString().split('T')[0],
    })
  );

export const createMockCategories = (count: number = 3) =>
  Array.from({ length: count }, (_, index) =>
    createMockCategory({
      id: String(index + 1),
      name: ['Food', 'Transportation', 'Entertainment'][index] || `Category ${index + 1}`,
      type: index < 2 ? TransactionType.EXPENSE : TransactionType.INCOME,
      icon: ['🍕', '🚗', '🎬'][index] || '📁',
      color: ['#ff0000', '#0000ff', '#00ff00'][index] || '#000000',
    })
  );

export const createMockActors = (count: number = 3) =>
  Array.from({ length: count }, (_, index) =>
    createMockActor({
      id: String(index + 1),
      name: ['John Doe', 'Jane Smith', 'Credit Card'][index] || `Actor ${index + 1}`,
      kind: index < 2 ? ActorKind.USER : ActorKind.INSTRUMENT,
      userId: index < 2 ? String(index + 1) : undefined,
    })
  );

// Settlement mock data
export const mockSettlement = {
  id: 'settlement-1',
  household_id: '1',
  month: '2024-01-01',
  status: 'DRAFT' as const,
  computed_at: '2024-02-01T00:00:00Z',
  summary: {
    total_household_expenses_yen: 100000,
    total_personal_expenses_yen: 20000,
    participant_count: 2,
    transfer_count: 1,
  },
  lines: [
    {
      id: 'line-1',
      from_user: mockUser,
      to_user: createMockUser({ id: '2', name: 'Jane Doe' }),
      amount_yen: 25000,
      description: 'Settlement transfer',
    },
  ],
  user_details: [
    {
      user: mockUser,
      income_allocation_yen: 60000,
      household_share_yen: 50000,
      household_paid_yen: 40000,
      personal_net_yen: -5000,
      final_balance_yen: -15000,
    },
  ],
  created_at: '2024-02-01T00:00:00Z',
  updated_at: '2024-02-01T00:00:00Z',
};

export const createMockSettlement = (overrides: Partial<typeof mockSettlement> = {}) => ({
  ...mockSettlement,
  ...overrides,
});

// Helper to wait for queries to settle
export const waitForQueryToSettle = async (queryClient: QueryClient) => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return queryClient.getQueryCache().getAll();
};

// Re-export everything from testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';