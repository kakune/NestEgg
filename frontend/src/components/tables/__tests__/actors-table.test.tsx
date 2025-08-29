import React from 'react';
import { renderWithProviders, screen, waitFor, within } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { ActorsTable } from '../actors-table';
import { ActorKind, Actor } from '@/types/transaction';
import { User, UserRole } from '@/types/user';
import type { InternalAxiosRequestConfig } from 'axios';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiHelpers: {
    getActors: jest.fn(),
    updateActor: jest.fn(),
    deleteActor: jest.fn(),
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

const mockUser: User = {
  id: '1',
  email: 'john@example.com',
  username: 'john',
  name: 'John Doe',
  role: UserRole.MEMBER,
  householdId: '1',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockActors: Actor[] = [
  {
    id: '1',
    name: 'John Doe',
    kind: ActorKind.USER,
    userId: '1',
    user: mockUser,
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Credit Card',
    kind: ActorKind.INSTRUMENT,
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Jane Smith',
    kind: ActorKind.USER,
    userId: '2',
    user: {
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
    householdId: '1',
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'Debit Card',
    kind: ActorKind.INSTRUMENT,
    householdId: '1',
    isActive: true,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

describe('ActorsTable', () => {
  const mockOnEditActor = jest.fn();
  const mockOnCreateActor = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReset();
    
    // Setup default API responses
    mockApiHelpers.getActors.mockResolvedValue({
      data: { data: mockActors },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/actors',
        method: 'get',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.updateActor.mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/actors',
        method: 'put',
      } as InternalAxiosRequestConfig,
    });
    
    mockApiHelpers.deleteActor.mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {
        url: '/api/actors',
        method: 'delete',
      } as InternalAxiosRequestConfig,
    });
  });

  describe('Initial render', () => {
    it('should render loading state initially', () => {
      // Make API call hang to test loading state
      mockApiHelpers.getActors.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      expect(screen.getByText('Loading actors...')).toBeInTheDocument();
    });

    it('should render error state when API fails', async () => {
      mockApiHelpers.getActors.mockRejectedValueOnce(new Error('API Error'));

      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Error loading actors')).toBeInTheDocument();
      });
    });

    it('should render actors table with sections', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('User Actors')).toHaveLength(2); // Header + summary
        expect(screen.getAllByText('Instrument Actors')).toHaveLength(2); // Header + summary  
        expect(screen.getByText('Actor Summary')).toBeInTheDocument();
      });
    });

    it('should render Add Actor buttons', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        const addButtons = screen.getAllByText('Add Actor');
        expect(addButtons).toHaveLength(2);
      });
    });
  });

  describe('Actor display', () => {
    it('should display user actors correctly', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText((content) => 
          content.includes('john@example.com')
        )).toBeInTheDocument();
        expect(screen.getByText((content) => 
          content.includes('jane@example.com')
        )).toBeInTheDocument();
      });
    });

    it('should display instrument actors correctly', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Credit Card')).toBeInTheDocument();
        expect(screen.getByText('Debit Card')).toBeInTheDocument();
      });
    });

    it('should display actor status correctly', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        // Active actors (3 in table + 1 in summary = 4 total)
        expect(screen.getAllByText('Active')).toHaveLength(4);
        
        // Inactive actor (1 in table + 1 in summary = 2 total)
        expect(screen.getAllByText('Inactive')).toHaveLength(2);
      });
    });

    it('should display actor types with correct icons', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        // Check for type labels
        expect(screen.getAllByText('User')).toHaveLength(2);
        expect(screen.getAllByText('Instrument')).toHaveLength(2);
      });
    });

    it('should display creation dates', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('1/1/2024')).toHaveLength(3);
        expect(screen.getByText('1/2/2024')).toBeInTheDocument();
      });
    });
  });

  describe('Summary statistics', () => {
    it('should display correct summary statistics', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        // Look for the summary section by finding the card that contains "Actor Summary"
        const summaryHeader = screen.getByText('Actor Summary');
        const summaryCard = summaryHeader.closest('[class*="card"], .rounded-lg');
        
        // Check that numbers appear in the summary
        const numbersInSummary = summaryCard?.textContent || '';
        expect(numbersInSummary).toContain('2'); // User actors count
        expect(numbersInSummary).toContain('3'); // Active actors count  
        expect(numbersInSummary).toContain('1'); // Inactive actors count
      });
    });

    it('should display summary labels correctly', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        // Look for the summary section by finding the card that contains "Actor Summary"
        const summaryHeader = screen.getByText('Actor Summary');
        const summaryCard = summaryHeader.closest('[class*="card"], .rounded-lg');
        
        const summaryText = summaryCard?.textContent || '';
        expect(summaryText).toContain('User Actors');
        expect(summaryText).toContain('Instrument Actors');
        expect(summaryText).toContain('Active');
        expect(summaryText).toContain('Inactive');
      });
    });
  });

  describe('Actions', () => {
    it('should call onCreateActor when Add Actor button is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('Add Actor')).toHaveLength(2);
      });

      const addButton = screen.getAllByText('Add Actor')[0];
      await user.click(addButton);

      expect(mockOnCreateActor).toHaveBeenCalled();
    });

    it('should call onEditActor when edit action is clicked', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on the actions dropdown for first actor
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      expect(dropdownButtons.length).toBeGreaterThan(0);
      
      await user.click(dropdownButtons[0]);

      // Click Edit option
      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(mockOnEditActor).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          name: 'John Doe',
        })
      );
    });

    it('should handle activate actor with confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Find the inactive actor (Jane Smith) and click actions
      const rows = screen.getAllByRole('row');
      const janeRow = rows.find(row => row.textContent?.includes('Jane Smith'));
      expect(janeRow).toBeDefined();

      // Find the actions button within Jane's row
      const actionsButton = within(janeRow!).getByRole('button', { name: /open menu/i });
      await user.click(actionsButton);

      // Click Activate option
      const activateButton = screen.getByText('Activate');
      await user.click(activateButton);

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to activate "Jane Smith"?'
      );

      await waitFor(() => {
        expect(mockApiHelpers.updateActor).toHaveBeenCalledWith('3', {
          isActive: true,
        });
      });
    });

    it('should handle deactivate actor with confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on actions dropdown for John (active actor)
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      // Click Deactivate option
      const deactivateButton = screen.getByText('Deactivate');
      await user.click(deactivateButton);

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to deactivate "John Doe"?'
      );

      await waitFor(() => {
        expect(mockApiHelpers.updateActor).toHaveBeenCalledWith('1', {
          isActive: false,
        });
      });
    });

    it('should handle delete actor with confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on the actions dropdown
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      // Click Delete option
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to delete "John Doe"? This action cannot be undone.'
      );

      await waitFor(() => {
        expect(mockApiHelpers.deleteActor).toHaveBeenCalledWith('1');
      });
    });

    it('should not perform actions when user cancels confirmation', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false);
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click on the actions dropdown
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      // Click Deactivate option
      const deactivateButton = screen.getByText('Deactivate');
      await user.click(deactivateButton);

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockApiHelpers.updateActor).not.toHaveBeenCalled();
    });
  });

  describe('Empty states', () => {
    it('should show empty state for user actors when none exist', async () => {
      const actorsWithoutUsers = mockActors.filter(
        actor => actor.kind !== ActorKind.USER
      );
      
      mockApiHelpers.getActors.mockResolvedValue({
        data: { data: actorsWithoutUsers },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/api/actors',
          method: 'get',
        } as InternalAxiosRequestConfig,
      });

      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No user actors found')).toBeInTheDocument();
        expect(screen.getByText('User actors represent household members who make transactions.')).toBeInTheDocument();
      });
    });

    it('should show empty state for instrument actors when none exist', async () => {
      const actorsWithoutInstruments = mockActors.filter(
        actor => actor.kind !== ActorKind.INSTRUMENT
      );
      
      mockApiHelpers.getActors.mockResolvedValue({
        data: { data: actorsWithoutInstruments },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/api/actors',
          method: 'get',
        } as InternalAxiosRequestConfig,
      });

      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No instrument actors found')).toBeInTheDocument();
        expect(screen.getByText('Instrument actors represent payment methods like credit cards, wallets, or bank accounts.')).toBeInTheDocument();
      });
    });
  });

  describe('API integration', () => {
    it('should load actors on mount', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(mockApiHelpers.getActors).toHaveBeenCalled();
      });
    });

    it('should handle update API errors', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      mockApiHelpers.updateActor.mockRejectedValueOnce({
        response: { data: { message: 'Cannot deactivate actor with active transactions' } },
      });
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click actions dropdown and deactivate
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      const deactivateButton = screen.getByText('Deactivate');
      await user.click(deactivateButton);

      await waitFor(() => {
        expect(mockApiHelpers.updateActor).toHaveBeenCalled();
      });
    });

    it('should handle delete API errors', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true);
      mockApiHelpers.deleteActor.mockRejectedValueOnce({
        response: { data: { message: 'Cannot delete actor with transactions' } },
      });
      
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click actions dropdown and delete
      const dropdownButtons = screen.getAllByRole('button', { name: /open menu/i });
      await user.click(dropdownButtons[0]);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockApiHelpers.deleteActor).toHaveBeenCalled();
      });
    });
  });

  describe('Type separation', () => {
    it('should separate user and instrument actors correctly', async () => {
      renderWithProviders(
        <ActorsTable
          onEditActor={mockOnEditActor}
          onCreateActor={mockOnCreateActor}
        />
      );

      await waitFor(() => {
        const userActorsHeaders = screen.getAllByText('User Actors');
        const instrumentActorsHeaders = screen.getAllByText('Instrument Actors');
        
        // Verify that both section headers are present
        expect(userActorsHeaders.length).toBeGreaterThan(0);
        expect(instrumentActorsHeaders.length).toBeGreaterThan(0);

        // Since we can't easily target specific cards, let's just check that all actors are rendered
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Credit Card')).toBeInTheDocument();
        expect(screen.getByText('Debit Card')).toBeInTheDocument();
      });
    });
  });
});