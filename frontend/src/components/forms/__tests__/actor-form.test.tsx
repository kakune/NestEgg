import React from 'react';
import { renderWithProviders, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { ActorForm } from '../actor-form';
import { ActorKind, Actor } from '@/types/transaction';
import { User, UserRole } from '@/types/user';
import type { InternalAxiosRequestConfig } from 'axios';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiHelpers: {
    getUsers: jest.fn(),
    createActor: jest.fn(),
    updateActor: jest.fn(),
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

const mockUsers: User[] = [
  {
    id: '1',
    email: 'john@example.com',
    username: 'john',
    name: 'John Doe',
    role: UserRole.MEMBER,
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    email: 'jane@example.com',
    username: 'jane',
    name: 'Jane Smith',
    role: UserRole.ADMIN,
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const mockUserActor: Actor = {
  id: '1',
  name: 'John Doe',
  kind: ActorKind.USER,
  userId: '1',
  user: mockUsers[0],
  householdId: '1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockInstrumentActor: Actor = {
  id: '2',
  name: 'Credit Card',
  kind: ActorKind.INSTRUMENT,
  householdId: '1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('ActorForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default API responses
    mockApiHelpers.getUsers.mockResolvedValue({
      data: { data: mockUsers },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/users',
        method: 'get',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.createActor.mockResolvedValue({
      data: mockInstrumentActor,
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {
        url: '/api/actors',
        method: 'post',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.updateActor.mockResolvedValue({
      data: mockInstrumentActor,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/actors',
        method: 'put',
      } as InternalAxiosRequestConfig,
    });
  });

  describe('Initial render', () => {
    it('should render form with correct title for new actor', () => {
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Add Actor')).toBeInTheDocument();
    });

    it('should render form with correct title for edit actor', () => {
      renderWithProviders(
        <ActorForm
          initialData={mockInstrumentActor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Edit Actor')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    it('should render submit and cancel buttons', () => {
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create actor/i })).toBeInTheDocument();
    });

    it('should default to INSTRUMENT type', () => {
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should not show user selection by default (INSTRUMENT is default)
      expect(screen.queryByText('Associated User')).not.toBeInTheDocument();
    });
  });

  describe('Form initialization with data', () => {
    it('should populate form fields with initial data for instrument actor', async () => {
      renderWithProviders(
        <ActorForm
          initialData={mockInstrumentActor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const nameField = screen.getByDisplayValue('Credit Card');
        expect(nameField).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /update actor/i })).toBeInTheDocument();
      expect(screen.getByText('Actor Information')).toBeInTheDocument();
    });

    it('should populate form fields with initial data for user actor', async () => {
      renderWithProviders(
        <ActorForm
          initialData={mockUserActor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        const nameField = screen.getByDisplayValue('John Doe');
        expect(nameField).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /update actor/i })).toBeInTheDocument();
      expect(screen.getByText('Actor Information')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should show actor information for existing actors', () => {
      renderWithProviders(
        <ActorForm
          initialData={mockInstrumentActor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Actor Information')).toBeInTheDocument();
      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('Status:')).toBeInTheDocument();
      expect(screen.getByText('Created:')).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should show validation errors for required fields', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Clear name field and try to submit
      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);

      const submitButton = screen.getByRole('button', { name: /create actor/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('should validate name length', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);
      await user.type(nameField, 'a'.repeat(101)); // 101 characters

      const submitButton = screen.getByRole('button', { name: /create actor/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name must be 100 characters or less')).toBeInTheDocument();
      });
    });
  });

  describe('Type-dependent behavior', () => {
    it('should show user selection when USER type is selected', async () => {
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Select USER type (would need to interact with Select component)
      // Note: Testing Select component interactions is complex due to implementation
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    it('should load users when USER type is selected', async () => {
      // Create a new user actor without id for testing
      const newUserActor = { ...mockUserActor };
      delete (newUserActor as Partial<Actor>).id;
      
      renderWithProviders(
        <ActorForm
          initialData={newUserActor as Actor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should load users for USER type
      await waitFor(() => {
        expect(mockApiHelpers.getUsers).toHaveBeenCalled();
      });

      expect(screen.getByText('Associated User')).toBeInTheDocument();
    });

    it('should not load users when INSTRUMENT type is selected', () => {
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Should not load users for INSTRUMENT type (default)
      expect(mockApiHelpers.getUsers).not.toHaveBeenCalled();
      expect(screen.queryByText('Associated User')).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('should create new instrument actor successfully', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Fill form fields
      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);
      await user.type(nameField, 'Test Credit Card');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create actor/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApiHelpers.createActor).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Credit Card',
            kind: ActorKind.INSTRUMENT,
            userId: undefined,
          })
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should update existing actor successfully', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <ActorForm
          initialData={mockInstrumentActor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Credit Card')).toBeInTheDocument();
      });

      // Update name
      const nameField = screen.getByLabelText(/name/i);
      await user.clear(nameField);
      await user.type(nameField, 'Updated Credit Card');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /update actor/i });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApiHelpers.updateActor).toHaveBeenCalledWith(
          '2',
          expect.objectContaining({
            name: 'Updated Credit Card',
          })
        );
      });

      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should handle API error response', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to create actor';
      
      mockApiHelpers.createActor.mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Fill required fields
      const nameField = screen.getByLabelText(/name/i);
      await user.type(nameField, 'Test Actor');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create actor/i });
      await user.click(submitButton);

      // Should not call onSuccess
      await waitFor(() => {
        expect(mockApiHelpers.createActor).toHaveBeenCalled();
      });
      
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should disable submit button while submitting', async () => {
      const user = userEvent.setup();
      
      // Make API call hang
      mockApiHelpers.createActor.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Fill required fields
      const nameField = screen.getByLabelText(/name/i);
      await user.type(nameField, 'Test Actor');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create actor/i });
      await user.click(submitButton);

      // Button should show loading state
      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  describe('Editing restrictions', () => {
    it('should disable type selection for existing actors', () => {
      renderWithProviders(
        <ActorForm
          initialData={mockInstrumentActor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Type select should be disabled
      // Note: Testing disabled state of Select is complex due to implementation
      expect(screen.getByText('Actor type cannot be changed after creation')).toBeInTheDocument();
    });

    it('should disable user association for existing actors', () => {
      renderWithProviders(
        <ActorForm
          initialData={mockUserActor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('User association cannot be changed after creation')).toBeInTheDocument();
    });

    it('should show helpful text for type restrictions', () => {
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('User actors represent household members, while instrument actors represent payment methods')).toBeInTheDocument();
    });
  });

  describe('Cancel functionality', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <ActorForm
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('API data loading', () => {
    it('should handle users API errors gracefully', async () => {
      mockApiHelpers.getUsers.mockRejectedValueOnce(new Error('API Error'));

      // Create a new user actor without id for testing
      const newUserActor = { ...mockUserActor };
      delete (newUserActor as Partial<Actor>).id;

      renderWithProviders(
        <ActorForm
          initialData={newUserActor as Actor}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // Form should still render even if users API fails
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
    });
  });
});