import { test, expect } from '@playwright/test';

test.describe('Application', () => {
  test('should display NestEgg frontend page', async ({ page }) => {
    await page.goto('/');
    
    // Should show NestEgg frontend
    await expect(page.locator('h1')).toContainText('NestEgg - React Frontend');
    await expect(page.locator('text=Household Budget Management System')).toBeVisible();
  });
});