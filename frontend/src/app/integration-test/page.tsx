'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiHelpers } from '@/lib/api-client';
import { TransactionType, ActorKind } from '@/types/transaction';
import { toast } from 'sonner';

interface TestResults {
  [key: string]: {
    status: 'pending' | 'success' | 'error';
    message: string;
    data?: unknown;
  };
}

export default function IntegrationTestPage() {
  const [results, setResults] = useState<TestResults>({});
  const [isRunning, setIsRunning] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');

  const updateResult = (testName: string, status: 'pending' | 'success' | 'error', message: string, data?: unknown) => {
    setResults(prev => ({
      ...prev,
      [testName]: { status, message, data }
    }));
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    updateResult(testName, 'pending', 'Running...');
    try {
      await testFn();
      updateResult(testName, 'success', 'Passed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      updateResult(testName, 'error', message, error);
    }
  };

  const testHealthCheck = async () => {
    const response = await fetch('http://localhost:3001/health');
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    const data = await response.json();
    updateResult('health', 'success', 'Backend is healthy', data);
  };

  const testAuthentication = async () => {
    const testUser = {
      email: `integration-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Integration Test User',
    };

    try {
      // Try to register a new user
      const registerResponse = await apiHelpers.register({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
        householdName: 'Test Household',
      });

      if (registerResponse.status === 201) {
        const { accessToken } = registerResponse.data.data;
        setAuthToken(accessToken);
        updateResult('auth', 'success', 'Registration successful', registerResponse.data);
        
        // Test getting current user
        const meResponse = await apiHelpers.getMe();
        updateResult('me', 'success', 'User fetch successful', meResponse.data);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('409')) {
        updateResult('auth', 'error', 'User already exists - try different email');
      } else {
        throw error;
      }
    }
  };

  const testCategoriesCRUD = async () => {
    // Create category
    const createResponse = await apiHelpers.createCategory({
      name: `Test Category ${Date.now()}`,
      type: TransactionType.EXPENSE,
      icon: '🧪',
      color: '#FF5733',
    });

    const categoryId = createResponse.data.data.id;
    updateResult('categories-create', 'success', 'Category created', createResponse.data);

    // Get all categories
    const getResponse = await apiHelpers.getCategories();
    updateResult('categories-get', 'success', `Found ${getResponse.data.data.length} categories`, getResponse.data);

    // Update category
    const updateResponse = await apiHelpers.updateCategory(categoryId, {
      name: 'Updated Test Category',
      color: '#00FF00',
    });
    updateResult('categories-update', 'success', 'Category updated', updateResponse.data);

    // Delete category
    const deleteResponse = await apiHelpers.deleteCategory(categoryId);
    updateResult('categories-delete', 'success', 'Category deleted', deleteResponse.data);
  };

  const testActorsCRUD = async () => {
    // Get all actors
    const getResponse = await apiHelpers.getActors();
    updateResult('actors-get', 'success', `Found ${getResponse.data.data.length} actors`, getResponse.data);

    // Create instrument actor
    const createResponse = await apiHelpers.createActor({
      name: `Test Instrument ${Date.now()}`,
      kind: ActorKind.INSTRUMENT,
    });

    const actorId = createResponse.data.data.id;
    updateResult('actors-create', 'success', 'Actor created', createResponse.data);

    // Update actor
    const updateResponse = await apiHelpers.updateActor(actorId, {
      name: 'Updated Test Instrument',
      isActive: false,
    });
    updateResult('actors-update', 'success', 'Actor updated', updateResponse.data);
  };

  const testTransactionsCRUD = async () => {
    // Get required data first
    const [categoriesResponse, actorsResponse] = await Promise.all([
      apiHelpers.getCategories(),
      apiHelpers.getActors(),
    ]);

    let categoryId = categoriesResponse.data.data[0]?.id;
    let actorId = actorsResponse.data.data[0]?.id;

    // Create category if none exists
    if (!categoryId) {
      const createCatResponse = await apiHelpers.createCategory({
        name: 'Transaction Test Category',
        type: TransactionType.EXPENSE,
      });
      categoryId = createCatResponse.data.data.id;
    }

    // Create actor if none exists
    if (!actorId) {
      const createActorResponse = await apiHelpers.createActor({
        name: 'Transaction Test Actor',
        kind: ActorKind.INSTRUMENT,
      });
      actorId = createActorResponse.data.data.id;
    }

    // Create transaction
    const createResponse = await apiHelpers.createTransaction({
      date: new Date().toISOString().split('T')[0],
      amount: 5000,
      type: TransactionType.EXPENSE,
      categoryId,
      actorId,
      notes: 'Integration test transaction',
      tags: ['test', 'integration'],
      shouldPay: true,
    });

    const transactionId = createResponse.data.data.id;
    updateResult('transactions-create', 'success', 'Transaction created', createResponse.data);

    // Get all transactions
    const getResponse = await apiHelpers.getTransactions();
    updateResult('transactions-get', 'success', `Found ${getResponse.data.data.length} transactions`, getResponse.data);

    // Update transaction
    const updateResponse = await apiHelpers.updateTransaction(transactionId, {
      amount: 7500,
      notes: 'Updated integration test transaction',
    });
    updateResult('transactions-update', 'success', 'Transaction updated', updateResponse.data);

    // Delete transaction
    const deleteResponse = await apiHelpers.deleteTransaction(transactionId);
    updateResult('transactions-delete', 'success', 'Transaction deleted', deleteResponse.data);
  };

  const testSettlements = async () => {
    const currentDate = new Date();
    
    // Run settlement
    const runResponse = await apiHelpers.runSettlement(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1
    );
    updateResult('settlements-run', 'success', 'Settlement created', runResponse.data);

    // Get all settlements
    const getResponse = await apiHelpers.getSettlements();
    updateResult('settlements-get', 'success', `Found ${getResponse.data.data.length} settlements`, getResponse.data);
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults({});

    const tests = [
      { name: 'health', fn: testHealthCheck },
      { name: 'authentication', fn: testAuthentication },
      { name: 'categories', fn: testCategoriesCRUD },
      { name: 'actors', fn: testActorsCRUD },
      { name: 'transactions', fn: testTransactionsCRUD },
      { name: 'settlements', fn: testSettlements },
    ];

    for (const test of tests) {
      await runTest(test.name, test.fn);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
    
    const allPassed = Object.values(results).every(result => result.status === 'success');
    if (allPassed) {
      toast.success('All integration tests passed!');
    } else {
      toast.error('Some integration tests failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '⚪';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Frontend-Backend Integration Tests</h1>
          <p className="text-muted-foreground">
            Test the communication between frontend and backend systems
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>Backend must be running on http://localhost:3001</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={runAllTests} 
                disabled={isRunning}
                className="w-full"
              >
                {isRunning ? 'Running Tests...' : 'Run All Integration Tests'}
              </Button>
            </div>
            
            {authToken && (
              <div className="space-y-2">
                <Label>Auth Token (first 50 chars)</Label>
                <Input 
                  value={authToken.substring(0, 50) + '...'} 
                  readOnly 
                  className="font-mono text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(results).map(([testName, result]) => (
            <Card key={testName} className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>{getStatusIcon(result.status)}</span>
                  <span className={getStatusColor(result.status)}>
                    {testName.charAt(0).toUpperCase() + testName.slice(1)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {result.data ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      View Response Data
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {Object.keys(results).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {Object.values(results).filter(r => r.status === 'success').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {Object.values(results).filter(r => r.status === 'error').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {Object.values(results).filter(r => r.status === 'pending').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Running</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}