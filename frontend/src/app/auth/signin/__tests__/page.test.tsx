import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import SignInPage from '../page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock auth provider
jest.mock('@/components/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const mockPush = jest.fn();
const mockLogin = jest.fn();

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('SignInPage', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    });

    mockUseSearchParams.mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    } as unknown as ReturnType<typeof useSearchParams>);

    mockUseAuth.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      isAuthenticated: false,
      user: null,
      register: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });
  });

  describe('Rendering', () => {
    it('should render the sign in form correctly', () => {
      render(<SignInPage />);

      expect(screen.getByRole('heading', { name: 'NestEgg' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
      expect(screen.getByText('Enter your email and password to access your household')).toBeInTheDocument();
      
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
      
      expect(screen.getByText('Create an account')).toBeInTheDocument();
    });

    it('should show development credentials in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

      render(<SignInPage />);

      expect(screen.getByText('Development Mode')).toBeInTheDocument();
      expect(screen.getByText('Email: test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Password: password')).toBeInTheDocument();

      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
    });

    it('should not show development credentials in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });

      render(<SignInPage />);

      expect(screen.queryByText('Development Mode')).not.toBeInTheDocument();

      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should show validation error for invalid email', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should show validation error for password too short', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(passwordInput, '123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user starts typing', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      // First, trigger validation error
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });

      // Then start typing to clear error
      await user.type(emailInput, 'test');

      await waitFor(() => {
        expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility when eye icon is clicked', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      const toggleButton = screen.getByRole('button', { name: 'Show password' });

      // Initially password should be hidden
      expect(passwordInput.type).toBe('password');

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('text');
      expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

      // Click again to hide password
      await user.click(toggleButton);
      expect(passwordInput.type).toBe('password');
      expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call login function with correct credentials', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should show loading state during login', async () => {
      const user = userEvent.setup();
      let resolveLogin: () => void;
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve;
      });
      mockLogin.mockReturnValueOnce(loginPromise);

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Resolve login
      resolveLogin!();
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should redirect to home page after successful login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should redirect to specified redirect URL after successful login', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('/transactions'),
      } as unknown as ReturnType<typeof useSearchParams>);

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/transactions');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display generic error message for unknown errors', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValueOnce(new Error('Network error'));

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
      });
    });

    it('should display specific error message for 401 unauthorized', async () => {
      const user = userEvent.setup();
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      };
      mockLogin.mockRejectedValueOnce(error);

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password. Please check your credentials and try again.')).toBeInTheDocument();
      });
    });

    it('should display server error message when available', async () => {
      const user = userEvent.setup();
      const error = {
        response: {
          status: 500,
          data: { message: 'Server temporarily unavailable' },
        },
      };
      mockLogin.mockRejectedValueOnce(error);

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Server temporarily unavailable')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and associations', () => {
      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toHaveAttribute('id', 'email');
      expect(passwordInput).toHaveAttribute('id', 'password');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });

    it('should have proper ARIA attributes for form validation', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      // Trigger validation
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
      });
    });

    it('should have proper role and aria-live attributes for error messages', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const submitButton = screen.getByRole('button', { name: 'Sign in' });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText('Email is required');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      mockLogin.mockRejectedValueOnce(new Error('Login failed'));

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign in' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        const alertElement = screen.getByRole('alert');
        expect(alertElement).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Links', () => {
    it('should have correct link to sign up page', () => {
      render(<SignInPage />);

      const signUpLink = screen.getByRole('link', { name: 'Create an account' });
      expect(signUpLink).toHaveAttribute('href', '/auth/signup');
    });
  });

  describe('Form Behavior', () => {
    it('should submit form when Enter key is pressed', async () => {
      const user = userEvent.setup();
      mockLogin.mockResolvedValueOnce(undefined);

      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should not submit form with invalid data when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<SignInPage />);

      const emailInput = screen.getByLabelText('Email address');
      
      await user.type(emailInput, 'invalid-email');
      await user.keyboard('{Enter}');

      // Should show validation errors but not call login
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
      
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });
});