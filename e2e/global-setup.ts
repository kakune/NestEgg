import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');
  
  // Launch a browser to check if services are ready
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const baseURL = config.use?.baseURL || 'http://localhost:5173';
  console.log(`📍 Testing connection to: ${baseURL}`);
  
  // Wait for frontend to be ready
  let retries = 60; // 60 seconds timeout
  while (retries > 0) {
    try {
      const response = await page.goto(baseURL, { 
        waitUntil: 'networkidle',
        timeout: 5000 
      });
      
      if (response && response.status() < 400) {
        console.log('✅ Frontend is ready');
        break;
      }
    } catch (error) {
      console.log(`⏳ Waiting for frontend... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries--;
    }
  }
  
  if (retries === 0) {
    throw new Error('❌ Frontend failed to start within timeout period');
  }
  
  // Check if backend API is ready
  try {
    const apiBaseUrl = baseURL.replace('5173', '3000');
    const healthResponse = await page.request.get(`${apiBaseUrl}/`);
    if (healthResponse.status() === 200) {
      console.log('✅ Backend API is ready');
    } else {
      console.log('⚠️  Backend API might not be fully ready, but continuing with tests...');
    }
  } catch (error) {
    console.log('⚠️  Could not verify backend API health, but continuing with tests...');
  }
  
  await browser.close();
  console.log('🎯 E2E test setup completed');
}

export default globalSetup;