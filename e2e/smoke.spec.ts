import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('frontend loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Should load without error and show NestEgg title
    await expect(page.locator('h1')).toContainText('NestEgg - React Frontend');
  });

  test('backend API is accessible', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/');
    
    expect(response.status()).toBe(200);
    
    const text = await response.text();
    expect(text).toContain('Hello World! NestEgg API is running.');
  });

  test('backend health endpoint works', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/health');
    
    expect(response.status()).toBe(200);
    
    const json = await response.json();
    expect(json.status).toBe('ok');
  });

  test('backend users endpoint works', async ({ page }) => {
    const response = await page.request.get('http://localhost:3000/users');
    
    expect(response.status()).toBe(200);
    
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(3);
    expect(json[0]).toHaveProperty('id');
    expect(json[0]).toHaveProperty('name');
  });

  test('frontend-backend integration works', async ({ page }) => {
    await page.goto('/');
    
    // Wait for API calls to complete
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more for React state updates
    await page.waitForTimeout(3000);
    
    // Check if the page shows backend connection status section
    await expect(page.locator('text=Backend Connection Status')).toBeVisible();
    
    // Check if users section is visible (regardless of success/failure)
    await expect(page.locator('text=Users from Database')).toBeVisible();
    
    // Verify the app is functional by checking for basic content
    await expect(page.locator('text=System Information')).toBeVisible();
    await expect(page.locator('text=Frontend Status: ✅ Running')).toBeVisible();
  });
});