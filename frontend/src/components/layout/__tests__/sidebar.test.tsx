import React from 'react';
import { renderWithProviders, screen } from '@/test-utils';
import { Sidebar } from '../sidebar';

// Mock Next.js navigation hooks
const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock('next/link', () => {
  return function MockLink({ 
    children, 
    href, 
    className,
    ...props 
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) {
    return (
      <a href={href} className={className} {...props}>
        {children}
      </a>
    );
  };
});

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
  });

  it('should render the NestEgg logo', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('NestEgg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nestegg/i })).toHaveAttribute('href', '/');
  });

  it('should render all navigation groups', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should render all navigation items', () => {
    renderWithProviders(<Sidebar />);

    // Overview items
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();

    // Management items
    expect(screen.getByRole('link', { name: /transactions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /categories/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /actors/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /income/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settlements/i })).toBeInTheDocument();

    // Administration items
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /import\/export/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('should have correct href attributes for navigation links', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /transactions/i })).toHaveAttribute('href', '/transactions');
    expect(screen.getByRole('link', { name: /categories/i })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('link', { name: /actors/i })).toHaveAttribute('href', '/actors');
    expect(screen.getByRole('link', { name: /income/i })).toHaveAttribute('href', '/incomes');
    expect(screen.getByRole('link', { name: /settlements/i })).toHaveAttribute('href', '/settlements');
    expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/users');
    expect(screen.getByRole('link', { name: /import\/export/i })).toHaveAttribute('href', '/csv');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
  });

  it('should highlight active navigation item', () => {
    // Mock usePathname to return a specific path
    mockUsePathname.mockReturnValue('/transactions');

    renderWithProviders(<Sidebar />);

    const transactionsLink = screen.getByRole('link', { name: /transactions/i });
    expect(transactionsLink).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should not highlight inactive navigation items', () => {
    // Mock usePathname to return a specific path
    mockUsePathname.mockReturnValue('/transactions');

    renderWithProviders(<Sidebar />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveClass('bg-primary', 'text-primary-foreground');
    expect(dashboardLink).toHaveClass('text-foreground');
  });

  it('should render monthly summary card', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Monthly Summary')).toBeInTheDocument();
    
    // Use more specific selectors to avoid conflicts with navigation items
    const summaryCard = screen.getByText('Monthly Summary').closest('.rounded-lg');
    expect(summaryCard).toHaveTextContent('Income');
    expect(summaryCard).toHaveTextContent('Expenses');
    expect(summaryCard).toHaveTextContent('Balance');
  });

  it('should show default values in monthly summary', () => {
    renderWithProviders(<Sidebar />);

    const incomeValues = screen.getAllByText('+¥0');
    const expenseValues = screen.getAllByText('-¥0');
    const balanceValues = screen.getAllByText('¥0');

    expect(incomeValues).toHaveLength(1);
    expect(expenseValues).toHaveLength(1);
    expect(balanceValues).toHaveLength(1);
  });

  it('should render navigation icons', () => {
    renderWithProviders(<Sidebar />);

    // Check that all navigation items have their icons
    const links = screen.getAllByRole('link');
    const navigationLinks = links.filter(link => 
      link.getAttribute('href') !== '/' || link.textContent?.includes('Dashboard')
    );

    // Each navigation link should have an icon (svg element)
    navigationLinks.forEach(link => {
      const icon = link.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-5', 'w-5', 'shrink-0');
    });
  });

  it('should have proper semantic structure', () => {
    renderWithProviders(<Sidebar />);

    const navigation = screen.getByRole('navigation');
    expect(navigation).toBeInTheDocument();

    const lists = screen.getAllByRole('list');
    expect(lists.length).toBeGreaterThan(0);
  });

  it('should apply correct styling for desktop layout', () => {
    const { container } = renderWithProviders(<Sidebar />);

    const sidebar = container.firstChild;
    expect(sidebar).toHaveClass('hidden', 'lg:fixed', 'lg:inset-y-0', 'lg:flex', 'lg:w-64', 'lg:flex-col');
  });

  it('should render group headings with correct styling', () => {
    renderWithProviders(<Sidebar />);

    const overviewHeading = screen.getByText('Overview');
    const managementHeading = screen.getByText('Management');
    const administrationHeading = screen.getByText('Administration');

    expect(overviewHeading).toHaveClass('text-xs', 'font-semibold', 'leading-6', 'text-muted-foreground');
    expect(managementHeading).toHaveClass('text-xs', 'font-semibold', 'leading-6', 'text-muted-foreground');
    expect(administrationHeading).toHaveClass('text-xs', 'font-semibold', 'leading-6', 'text-muted-foreground');
  });

  it('should test active state changes with different paths', () => {
    // Test dashboard active
    mockUsePathname.mockReturnValue('/');
    const { rerender } = renderWithProviders(<Sidebar />);
    
    let dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveClass('bg-primary', 'text-primary-foreground');

    // Test categories active
    mockUsePathname.mockReturnValue('/categories');
    rerender(<Sidebar />);
    
    dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const categoriesLink = screen.getByRole('link', { name: /categories/i });
    
    expect(dashboardLink).not.toHaveClass('bg-primary', 'text-primary-foreground');
    expect(categoriesLink).toHaveClass('bg-primary', 'text-primary-foreground');
  });
});