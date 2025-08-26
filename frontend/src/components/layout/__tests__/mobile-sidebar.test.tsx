import React from 'react';
import { renderWithProviders, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { MobileSidebar } from '../mobile-sidebar';

// Mock Next.js navigation hooks
const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock('next/link', () => {
  return function MockLink({ 
    children, 
    href, 
    className,
    onClick,
    ...props 
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    onClick?: () => void;
  }) {
    return (
      <a 
        href={href} 
        className={className} 
        onClick={onClick}
        {...props}
      >
        {children}
      </a>
    );
  };
});

describe('MobileSidebar', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
  });

  it('should render the NestEgg logo', () => {
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    expect(screen.getByText('NestEgg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nestegg/i })).toHaveAttribute('href', '/');
  });

  it('should call onClose when logo is clicked', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const logoLink = screen.getByRole('link', { name: /nestegg/i });
    await user.click(logoLink);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should render all navigation groups', () => {
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('should render all navigation items', () => {
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

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

  it('should call onClose when any navigation link is clicked', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const transactionsLink = screen.getByRole('link', { name: /transactions/i });
    await user.click(transactionsLink);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should highlight active navigation item', () => {
    // Mock usePathname to return a specific path
    mockUsePathname.mockReturnValue('/transactions');

    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const transactionsLink = screen.getByRole('link', { name: /transactions/i });
    expect(transactionsLink).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should not highlight inactive navigation items', () => {
    // Mock usePathname to return a specific path
    mockUsePathname.mockReturnValue('/transactions');

    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveClass('bg-primary', 'text-primary-foreground');
    expect(dashboardLink).toHaveClass('text-foreground');
  });

  it('should have correct href attributes for all navigation links', () => {
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

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

  it('should render navigation icons', () => {
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

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
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const navigation = screen.getByRole('navigation');
    expect(navigation).toBeInTheDocument();

    const lists = screen.getAllByRole('list');
    expect(lists.length).toBeGreaterThan(0);
  });

  it('should apply mobile-specific styling', () => {
    const { container } = renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const sidebar = container.firstChild;
    expect(sidebar).toHaveClass('flex', 'grow', 'flex-col', 'gap-y-5', 'overflow-y-auto');
  });

  it('should call onClose multiple times for multiple link clicks', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const transactionsLink = screen.getByRole('link', { name: /transactions/i });

    await user.click(dashboardLink);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    await user.click(transactionsLink);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  it('should test active state changes with different paths', () => {
    // Test dashboard active
    mockUsePathname.mockReturnValue('/');
    const { rerender } = renderWithProviders(<MobileSidebar onClose={mockOnClose} />);
    
    let dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveClass('bg-primary', 'text-primary-foreground');

    // Test categories active
    mockUsePathname.mockReturnValue('/categories');
    rerender(<MobileSidebar onClose={mockOnClose} />);
    
    dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const categoriesLink = screen.getByRole('link', { name: /categories/i });
    
    expect(dashboardLink).not.toHaveClass('bg-primary', 'text-primary-foreground');
    expect(categoriesLink).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should render group headings with correct styling', () => {
    renderWithProviders(<MobileSidebar onClose={mockOnClose} />);

    const overviewHeading = screen.getByText('Overview');
    const managementHeading = screen.getByText('Management');
    const administrationHeading = screen.getByText('Administration');

    expect(overviewHeading).toHaveClass('text-xs', 'font-semibold', 'leading-6', 'text-muted-foreground');
    expect(managementHeading).toHaveClass('text-xs', 'font-semibold', 'leading-6', 'text-muted-foreground');
    expect(administrationHeading).toHaveClass('text-xs', 'font-semibold', 'leading-6', 'text-muted-foreground');
  });
});