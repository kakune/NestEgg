import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { handlers } from '../mocks/handlers';
import { errorHandlers, networkHandlers, loadTestHandlers } from '../mocks/error-handlers';

// Set up MSW server for testing
export const server = setupServer(...handlers);

// Helper function to set up MSW in test files
export function setupMSW() {
  // Start server before all tests
  beforeAll(() => {
    server.listen({
      onUnhandledRequest: 'warn',
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

// Test scenario helpers
export const testScenarios = {
  // Use error handlers for all endpoints
  useErrorHandlers: () => {
    server.use(...errorHandlers);
  },

  // Use network simulation handlers
  useNetworkHandlers: () => {
    server.use(...networkHandlers);
  },

  // Use load testing handlers
  useLoadTestHandlers: () => {
    server.use(...loadTestHandlers);
  },

  // Reset to default handlers
  useDefaultHandlers: () => {
    server.resetHandlers();
    server.use(...handlers);
  },

  // Use specific error for a specific endpoint
  useErrorForEndpoint: (method: 'get' | 'post' | 'patch' | 'delete', url: string, status: number = 500, message = 'Server Error') => {
    const httpMethod = method === 'get' ? 'get' : 
                       method === 'post' ? 'post' :
                       method === 'patch' ? 'patch' : 'delete';
    
    server.use(
      // Use imported MSW methods
      http[httpMethod](url, () => {
        return HttpResponse.json(
          { error: { message, code: 'TEST_ERROR' } },
          { status }
        );
      })
    );
  },

  // Use custom handler
  useCustomHandler: (handler: Parameters<typeof server.use>[0]) => {
    server.use(handler);
  },

  // Check if request was made
  getRequestHistory: () => {
    // Note: This would require additional setup to track requests
    // For now, we can add this functionality if needed
    console.warn('Request history tracking not yet implemented');
    return [];
  },
};

// MSW integration with React Testing Library
export const mswRenderOptions = {
  // Helper to render component with MSW server ready
  withMSW: (scenario?: keyof typeof testScenarios) => {
    if (scenario && testScenarios[scenario]) {
      (testScenarios[scenario] as () => void)();
    }
    
    return {
      // Additional render options can be added here
      wrapper: undefined, // Could add MSW-specific wrapper if needed
    };
  },
};