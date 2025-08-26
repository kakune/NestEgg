import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';

// Set up MSW server for testing
export const server = setupServer(...handlers);

// Helper function to set up MSW in test files
export function setupMSW() {
  // Start server before all tests
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'error',
    });
  });

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers();
  });

  // Close server after all tests
  afterAll(() => {
    server.close();
  });

  return server;
}