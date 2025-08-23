import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('Hello World! NestEgg API is running.')
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, name: 'Admin User' },
          { id: 2, name: 'Family Member 1' },
          { id: 3, name: 'Family Member 2' }
        ])
      });
  });

  it('renders headline', async () => {
    render(<App />);
    const headline = screen.getByText(/NestEgg - React Frontend/i);
    expect(headline).toBeInTheDocument();
    
    // Wait for API calls to complete
    await waitFor(() => {
      expect(screen.getByText(/Hello World! NestEgg API is running./)).toBeInTheDocument();
    });
  });
});