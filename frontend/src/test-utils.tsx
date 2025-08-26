import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
  type: 'EXPENSE' as const,
  notes: 'Test transaction',
  tags: ['test'],
  shouldPay: true,
  category: {
    id: '1',
    name: 'Food',
    type: 'EXPENSE' as const,
    icon: '🍕',
    color: '#ff0000',
  },
  actor: {
    id: '1',
    name: 'Test Actor',
    kind: 'USER' as const,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockCategory = {
  id: '1',
  name: 'Food',
  type: 'EXPENSE' as const,
  icon: '🍕',
  color: '#ff0000',
  budgetLimit: null,
  parentId: null,
  householdId: '1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

export const mockActor = {
  id: '1',
  name: 'Test Actor',
  kind: 'USER' as const,
  isActive: true,
  userId: '1',
  householdId: '1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// Helper to wait for queries to settle
export const waitForQueryToSettle = async (queryClient: QueryClient) => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return queryClient.getQueryCache().getAll();
};

// Re-export everything from testing-library/react
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';