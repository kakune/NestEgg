import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import SignUpPage from '../page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock auth provider
jest.mock('@/components/providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const mockPush = jest.fn();
const mockRegister = jest.fn();

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('SignUpPage', () => {
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

    mockUseAuth.mockReturnValue({
      register: mockRegister,
      isLoading: false,
      isInitialized: true,
      isAuthenticated: false,
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    });
  });

  describe('Rendering', () => {
    it('should render the sign up form correctly', () => {
      render(<SignUpPage />);

      expect(screen.getByRole('heading', { name: 'NestEgg' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
      expect(screen.getByText('Set up your household financial settlement system')).toBeInTheDocument();
      
      expect(screen.getByLabelText('Full name')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
      
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const submitButton = screen.getByRole('button', { name: 'Create account' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
        expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('should show validation error for short name', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const nameInput = screen.getByLabelText('Full name');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      await user.type(nameInput, 'A');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
      });
    });

    it('should show validation error for mismatched passwords', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'different123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user starts typing', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const nameInput = screen.getByLabelText('Full name');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      // First, trigger validation error
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });

      // Then start typing to clear error
      await user.type(nameInput, 'John');

      await waitFor(() => {
        expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility for both password fields', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      const confirmPasswordInput = screen.getByLabelText('Confirm password') as HTMLInputElement;
      
      // Get toggle buttons (there should be two)
      const toggleButtons = screen.getAllByRole('button', { name: 'Show password' });
      expect(toggleButtons).toHaveLength(2);

      // Initially both passwords should be hidden
      expect(passwordInput.type).toBe('password');
      expect(confirmPasswordInput.type).toBe('password');

      // Click to show first password
      await user.click(toggleButtons[0]);
      expect(passwordInput.type).toBe('text');
      expect(confirmPasswordInput.type).toBe('password'); // Second should remain hidden

      // Click to show second password
      await user.click(toggleButtons[1]);
      expect(passwordInput.type).toBe('text');
      expect(confirmPasswordInput.type).toBe('text');
    });
  });

  describe('Form Submission', () => {
    it('should call register function with correct data', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValueOnce(undefined);

      render(<SignUpPage />);

      const nameInput = screen.getByLabelText('Full name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      await user.type(nameInput, 'John Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123@');
      await user.type(confirmPasswordInput, 'Password123@');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('john@example.com', 'johndoe', 'Password123@', 'John Doe');
      });
    });

    it('should show loading state during registration', async () => {
      const user = userEvent.setup();
      let resolveRegister: () => void;
      const registerPromise = new Promise<void>((resolve) => {
        resolveRegister = resolve;
      });
      mockRegister.mockReturnValueOnce(registerPromise);

      render(<SignUpPage />);

      const nameInput = screen.getByLabelText('Full name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      await user.type(nameInput, 'John Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123@');
      await user.type(confirmPasswordInput, 'Password123@');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Creating account...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Resolve registration
      resolveRegister!();
      await waitFor(() => {
        expect(screen.getByText('Create account')).toBeInTheDocument();
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should redirect to home page after successful registration', async () => {
      const user = userEvent.setup();
      mockRegister.mockResolvedValueOnce(undefined);

      render(<SignUpPage />);

      const nameInput = screen.getByLabelText('Full name');
      const usernameInput = screen.getByLabelText('Username');
      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      await user.type(nameInput, 'John Doe');
      await user.type(usernameInput, 'johndoe');
      await user.type(emailInput, 'john@example.com');
      await user.type(passwordInput, 'Password123@');
      await user.type(confirmPasswordInput, 'Password123@');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display generic error message for unknown errors', async () => {
      const user = userEvent.setup();
      mockRegister.mockRejectedValueOnce(new Error('Network error'));

      render(<SignUpPage />);

      await fillValidForm(user);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
      });
    });

    it('should display specific error message for 409 conflict (user exists)', async () => {
      const user = userEvent.setup();
      const error = {
        response: {
          status: 409,
          data: { message: 'User already exists' },
        },
      };
      mockRegister.mockRejectedValueOnce(error);

      render(<SignUpPage />);

      await fillValidForm(user);

      await waitFor(() => {
        expect(screen.getByText('An account with this email or username already exists. Please sign in instead.')).toBeInTheDocument();
      });
    });

    it('should display server error message when available', async () => {
      const user = userEvent.setup();
      const error = {
        response: {
          status: 500,
          data: { message: 'Server error occurred' },
        },
      };
      mockRegister.mockRejectedValueOnce(error);

      render(<SignUpPage />);

      await fillValidForm(user);

      await waitFor(() => {
        expect(screen.getByText('Server error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('Links', () => {
    it('should have correct link to sign in page', () => {
      render(<SignUpPage />);

      const signInLink = screen.getByRole('link', { name: 'Sign in to your account' });
      expect(signInLink).toHaveAttribute('href', '/auth/signin');
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and associations', () => {
      render(<SignUpPage />);

      const nameInput = screen.getByLabelText('Full name');
      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');

      expect(nameInput).toHaveAttribute('id', 'name');
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(passwordInput).toHaveAttribute('id', 'password');
      expect(confirmPasswordInput).toHaveAttribute('id', 'confirmPassword');
      
      expect(nameInput).toHaveAttribute('autoComplete', 'name');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(passwordInput).toHaveAttribute('autoComplete', 'new-password');
      expect(confirmPasswordInput).toHaveAttribute('autoComplete', 'new-password');
    });

    it('should have proper ARIA attributes for form validation', async () => {
      const user = userEvent.setup();
      render(<SignUpPage />);

      const nameInput = screen.getByLabelText('Full name');
      const submitButton = screen.getByRole('button', { name: 'Create account' });

      // Trigger validation
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
        expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');
      });
    });
  });

  // Helper function to fill out the form with valid data
  async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
    const nameInput = screen.getByLabelText('Full name');
    const usernameInput = screen.getByLabelText('Username');
    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm password');
    const submitButton = screen.getByRole('button', { name: 'Create account' });

    await user.type(nameInput, 'John Doe');
    await user.type(usernameInput, 'johndoe');
    await user.type(emailInput, 'john@example.com');
    await user.type(passwordInput, 'Password123@');
    await user.type(confirmPasswordInput, 'Password123@');
    await user.click(submitButton);
  }
});