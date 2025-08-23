import { test, expect } from '@playwright/test';

test.describe('Transactions (Placeholder)', () => {
  test('should display application page', async ({ page }) => {
    await page.goto('/');
    
    // Just verify the app loads with NestEgg title
    await expect(page.locator('h1')).toContainText('NestEgg - React Frontend');
  });
});