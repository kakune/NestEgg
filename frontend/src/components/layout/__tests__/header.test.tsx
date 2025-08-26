import React from 'react';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { Header } from '../header';

// Mock the MobileSidebar component
jest.mock('../mobile-sidebar', () => ({
  MobileSidebar: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mobile-sidebar">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock the useAuth hook
const mockUseAuth = jest.fn();
jest.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('When user is authenticated', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          householdId: '1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
      });
    });

    it('should render user avatar with initials', () => {
      renderWithProviders(<Header />);

      const avatar = screen.getByText('TU'); // Test User initials
      expect(avatar).toBeInTheDocument();
    });

    it('should show user dropdown menu when avatar is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(<Header />);

      const avatarButton = screen.getByRole('button', { name: 'TU' });
      await user.click(avatarButton);

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Log out')).toBeInTheDocument();
    });

    it('should call logout when logout menu item is clicked', async () => {
      const mockLogout = jest.fn();
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          householdId: '1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: mockLogout,
        refreshUser: jest.fn(),
      });

      const user = userEvent.setup();
      
      renderWithProviders(<Header />);

      // Open dropdown
      const avatarButton = screen.getByRole('button', { name: 'TU' });
      await user.click(avatarButton);

      // Click logout
      const logoutButton = screen.getByText('Log out');
      await user.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('should generate correct initials for single name', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Alice',
          role: 'USER',
          householdId: '1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
      });

      renderWithProviders(<Header />);

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should generate correct initials for multiple names', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'John Doe Smith',
          role: 'USER',
          householdId: '1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
      });

      renderWithProviders(<Header />);

      expect(screen.getByText('JD')).toBeInTheDocument(); // Should only take first 2 initials
    });
  });

  describe('When user is not authenticated', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
      });
    });

    it('should render sign in button', () => {
      renderWithProviders(<Header />);

      const signInButton = screen.getByRole('button', { name: 'Sign In' });
      expect(signInButton).toBeInTheDocument();
    });

    it('should not render user avatar', () => {
      renderWithProviders(<Header />);

      // Avatar should not be present
      expect(screen.queryByText('TU')).not.toBeInTheDocument();
    });
  });

  describe('Mobile menu functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          householdId: '1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
      });
    });

    it('should render mobile menu button', () => {
      renderWithProviders(<Header />);

      const mobileMenuButton = screen.getByRole('button', { name: 'Open sidebar' });
      expect(mobileMenuButton).toBeInTheDocument();
    });

    it('should open mobile sidebar when mobile menu button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(<Header />);

      const mobileMenuButton = screen.getByRole('button', { name: 'Open sidebar' });
      await user.click(mobileMenuButton);

      expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
    });

    it('should close mobile sidebar when close is called', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(<Header />);

      // Open mobile menu
      const mobileMenuButton = screen.getByRole('button', { name: 'Open sidebar' });
      await user.click(mobileMenuButton);

      expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();

      // Close mobile menu using the mocked close button from our test mock
      const closeButton = screen.getByTestId('mobile-sidebar').querySelector('button');
      expect(closeButton).toBeInTheDocument();
      await user.click(closeButton!);

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-sidebar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          householdId: '1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
      });
    });

    it('should have proper ARIA labels', () => {
      renderWithProviders(<Header />);

      expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should have proper semantic structure', () => {
      renderWithProviders(<Header />);

      const header = screen.getByRole('banner');
      expect(header).toHaveClass('sticky', 'top-0');
    });
  });

  describe('Visual elements', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          householdId: '1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        isLoading: false,
        isAuthenticated: true,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
      });
    });

    it('should render separator for mobile layout', () => {
      const { container } = renderWithProviders(<Header />);

      const separator = container.querySelector('div[aria-hidden="true"].h-6.w-px.bg-border.lg\\:hidden');
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass('h-6', 'w-px', 'bg-border', 'lg:hidden');
    });

    it('should render menu icon', () => {
      const { container } = renderWithProviders(<Header />);

      const menuIcon = container.querySelector('svg[aria-hidden="true"]');
      expect(menuIcon).toBeInTheDocument();
      expect(menuIcon).toHaveClass('h-6', 'w-6');
    });
  });
});