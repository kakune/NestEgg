import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test teardown...');
  
  // Perform any cleanup operations here
  // For example, clear test data, reset database state, etc.
  
  console.log('✨ E2E test teardown completed');
}

export default globalTeardown;