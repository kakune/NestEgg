# NestEgg Testing Strategy

**Date:** 2025-08-23  
**Version:** 1.0  
**Scope:** Comprehensive testing strategy for household budget management application

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Pyramid](#testing-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [API Contract Testing](#api-contract-testing)
7. [Database Testing](#database-testing)
8. [Security Testing](#security-testing)
9. [Performance Testing](#performance-testing)
10. [Mock Service Worker](#mock-service-worker)
11. [Test Data Management](#test-data-management)
12. [CI/CD Pipeline](#cicd-pipeline)
13. [Testing Environments](#testing-environments)
14. [Coverage Requirements](#coverage-requirements)
15. [Testing Tools](#testing-tools)
16. [Business Logic Testing](#business-logic-testing)

---

## Testing Philosophy

### Core Principles

1. **Test-Driven Development (TDD):** Write tests before implementation for critical business logic
2. **Shift-Left Testing:** Catch issues early in the development cycle
3. **Fast Feedback Loops:** Tests should run quickly and provide immediate feedback
4. **Deterministic Tests:** All tests should be reproducible and consistent
5. **Pyramid Distribution:** Many unit tests, fewer integration tests, minimal E2E tests
6. **Real-World Scenarios:** Test data and scenarios should mirror production usage

### Testing Objectives

- **Financial Accuracy:** Ensure all monetary calculations are precise
- **Data Integrity:** Verify household isolation and audit trail completeness
- **API Reliability:** Guarantee consistent API behavior for external clients
- **Security Compliance:** Validate authentication, authorization, and data protection
- **Performance Benchmarks:** Maintain acceptable response times under load
- **Regression Prevention:** Catch breaking changes before deployment

---

## Testing Pyramid

### Distribution Strategy

```
                    ┌─────────────┐
                    │   E2E Tests │ ← 10% (Critical user journeys)
                    │    Manual   │
                  ┌─┴─────────────┴─┐
                  │ Integration     │ ← 20% (API endpoints, DB queries)
                  │ Tests          │
                ┌─┴─────────────────┴─┐
                │   Unit Tests        │ ← 70% (Business logic, utilities)
                │                     │
                └─────────────────────┘
```

### Test Categories

**Unit Tests (70%)**
- Business logic functions (settlement algorithm, apportionment)
- Utility functions (formatting, validation)
- React component behavior
- Service layer methods
- Data transformation logic

**Integration Tests (20%)**
- API endpoint functionality
- Database operations with real DB
- External service integrations
- Authentication flows
- File upload/import processes

**End-to-End Tests (10%)**
- Complete user workflows
- Cross-browser compatibility
- Critical business processes
- Data flow validation

---

## Unit Testing

### Backend Unit Testing (Jest + Supertest)

#### Business Logic Testing

```typescript
// src/services/settlement/settlement.service.spec.ts
describe('SettlementService', () => {
  describe('apportionExpenses', () => {
    test('distributes household expenses proportional to income', () => {
      const incomes = [
        { userId: 'user1', allocatableYen: 300000 },
        { userId: 'user2', allocatableYen: 200000 }
      ];
      const totalExpense = 50000;
      
      const result = apportionExpenses(totalExpense, incomes, 'ROUND');
      
      expect(result).toEqual([
        { userId: 'user1', shareYen: 30000 }, // 60% of 50000
        { userId: 'user2', shareYen: 20000 }  // 40% of 50000
      ]);
      
      // Verify total equals original expense
      const sum = result.reduce((total, share) => total + share.shareYen, 0);
      expect(sum).toBe(totalExpense);
    });

    test('handles rounding residuals correctly', () => {
      const incomes = [
        { userId: 'user1', allocatableYen: 333333 },
        { userId: 'user2', allocatableYen: 333333 },
        { userId: 'user3', allocatableYen: 333334 }
      ];
      const totalExpense = 100; // Small amount to force rounding issues
      
      const result = apportionExpenses(totalExpense, incomes, 'ROUND');
      
      // Verify sum still equals total (residual correction applied)
      const sum = result.reduce((total, share) => total + share.shareYen, 0);
      expect(sum).toBe(totalExpense);
      
      // Verify shares are reasonable (within 1 yen of expected)
      result.forEach(share => {
        expect(share.shareYen).toBeGreaterThan(0);
        expect(share.shareYen).toBeLessThanOrEqual(34); // Max possible share
      });
    });

    test('excludes zero-income users by default', () => {
      const incomes = [
        { userId: 'user1', allocatableYen: 100000 },
        { userId: 'user2', allocatableYen: 0 },
        { userId: 'user3', allocatableYen: 100000 }
      ];
      const totalExpense = 10000;
      const policy = { apportionmentZeroIncome: 'EXCLUDE' as const };
      
      const result = apportionExpenses(totalExpense, incomes, 'ROUND', policy);
      
      expect(result).toEqual([
        { userId: 'user1', shareYen: 5000 },
        { userId: 'user2', shareYen: 0 },
        { userId: 'user3', shareYen: 5000 }
      ]);
    });

    test('includes zero-income users with MIN_SHARE policy', () => {
      const incomes = [
        { userId: 'user1', allocatableYen: 100000 },
        { userId: 'user2', allocatableYen: 0 },
        { userId: 'user3', allocatableYen: 100000 }
      ];
      const totalExpense = 30000;
      const policy = { 
        apportionmentZeroIncome: 'MIN_SHARE' as const,
        minSharePercentage: 5 // 5% minimum
      };
      
      const result = apportionExpenses(totalExpense, incomes, 'ROUND', policy);
      
      // User2 should get minimum 5% = 1500
      expect(result.find(r => r.userId === 'user2')?.shareYen).toBe(1500);
      
      // Remaining 28500 split between user1 and user3
      const remainingShares = result.filter(r => r.userId !== 'user2');
      const remainingSum = remainingShares.reduce((sum, r) => sum + r.shareYen, 0);
      expect(remainingSum).toBe(28500);
    });
  });

  describe('greedyNetting', () => {
    test('minimizes transfer count in simple case', () => {
      const balances = new Map([
        ['user1', -10000], // owes 10000
        ['user2', 6000],   // receives 6000
        ['user3', 4000]    // receives 4000
      ]);
      
      const result = greedyNetting(balances);
      
      expect(result).toEqual([
        { fromUserId: 'user1', toUserId: 'user2', amountYen: 6000 },
        { fromUserId: 'user1', toUserId: 'user3', amountYen: 4000 }
      ]);
      expect(result).toHaveLength(2); // Minimal transfers
    });

    test('handles complex netting scenario', () => {
      const balances = new Map([
        ['user1', -15000], // owes 15000
        ['user2', -5000],  // owes 5000  
        ['user3', 12000],  // receives 12000
        ['user4', 8000]    // receives 8000
      ]);
      
      const result = greedyNetting(balances);
      
      // Verify all balances are settled
      const netBalances = new Map(balances);
      result.forEach(transfer => {
        netBalances.set(transfer.fromUserId, 
          netBalances.get(transfer.fromUserId)! + transfer.amountYen);
        netBalances.set(transfer.toUserId,
          netBalances.get(transfer.toUserId)! - transfer.amountYen);
      });
      
      // All balances should be zero
      netBalances.forEach(balance => {
        expect(balance).toBe(0);
      });
      
      // Should use minimal transfers (max 3 for 4 users)
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  describe('calculateSettlement', () => {
    test('produces idempotent results', async () => {
      const householdId = 'test-household';
      const month = '2025-08';
      
      // Run settlement twice
      const result1 = await settlementService.calculateSettlement(householdId, month);
      const result2 = await settlementService.calculateSettlement(householdId, month);
      
      // Results should be identical
      expect(result1.lines).toEqual(result2.lines);
      expect(result1.summary).toEqual(result2.summary);
    });
    
    test('handles month with no transactions', async () => {
      const householdId = 'test-household';
      const month = '2099-01'; // Future month with no data
      
      const result = await settlementService.calculateSettlement(householdId, month);
      
      expect(result.lines).toEqual([]);
      expect(result.summary.totalHouseholdExpensesYen).toBe(0);
    });
  });
});

// Property-based testing for critical calculations
describe('Settlement Property Tests', () => {
  test('apportionment always sums to total expense', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          userId: fc.uuid(),
          allocatableYen: fc.integer({ min: 0, max: 10000000 })
        }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 10000000 }),
        (incomes, totalExpense) => {
          const result = apportionExpenses(totalExpense, incomes, 'ROUND');
          const sum = result.reduce((total, share) => total + share.shareYen, 0);
          return sum === totalExpense;
        }
      )
    );
  });

  test('netting algorithm always balances to zero', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.uuid(), fc.integer({ min: -1000000, max: 1000000 }))
          .filter(dict => {
            const values = Object.values(dict);
            return values.length >= 2 && values.reduce((sum, val) => sum + val, 0) === 0;
          }),
        (balancesDict) => {
          const balances = new Map(Object.entries(balancesDict));
          const transfers = greedyNetting(balances);
          
          // Verify net result is zero for all users
          const finalBalances = new Map(balances);
          transfers.forEach(t => {
            finalBalances.set(t.fromUserId,
              finalBalances.get(t.fromUserId)! + t.amountYen);
            finalBalances.set(t.toUserId,
              finalBalances.get(t.toUserId)! - t.amountYen);
          });
          
          return Array.from(finalBalances.values()).every(balance => balance === 0);
        }
      )
    );
  });
});
```

#### Validation and Utility Testing

```typescript
// src/utils/validation.spec.ts
describe('Validation Utils', () => {
  describe('validateTransactionData', () => {
    test('accepts valid transaction data', () => {
      const validData = {
        type: 'EXPENSE',
        amountYen: 5000,
        occurredOn: '2025-08-23',
        categoryId: 'valid-uuid',
        payerActorId: 'valid-uuid',
        shouldPay: 'HOUSEHOLD',
        note: 'Valid transaction'
      };
      
      expect(() => validateTransactionData(validData)).not.toThrow();
    });

    test('rejects negative amounts', () => {
      const invalidData = {
        type: 'EXPENSE',
        amountYen: -1000,
        occurredOn: '2025-08-23',
        categoryId: 'valid-uuid',
        payerActorId: 'valid-uuid',
        shouldPay: 'HOUSEHOLD'
      };
      
      expect(() => validateTransactionData(invalidData))
        .toThrow('Amount must be positive');
    });

    test('requires should_pay_user_id when should_pay is USER', () => {
      const invalidData = {
        type: 'EXPENSE',
        amountYen: 1000,
        occurredOn: '2025-08-23',
        categoryId: 'valid-uuid',
        payerActorId: 'valid-uuid',
        shouldPay: 'USER'
        // Missing should_pay_user_id
      };
      
      expect(() => validateTransactionData(invalidData))
        .toThrow('should_pay_user_id required when should_pay is USER');
    });

    test('rejects future dates by default', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const invalidData = {
        type: 'EXPENSE',
        amountYen: 1000,
        occurredOn: futureDate.toISOString().split('T')[0],
        categoryId: 'valid-uuid',
        payerActorId: 'valid-uuid',
        shouldPay: 'HOUSEHOLD'
      };
      
      expect(() => validateTransactionData(invalidData))
        .toThrow('Transaction date cannot be in the future');
    });
  });

  describe('formatYenAmount', () => {
    test('formats amounts with Japanese locale', () => {
      expect(formatYenAmount(1500)).toBe('¥1,500');
      expect(formatYenAmount(123456)).toBe('¥123,456');
      expect(formatYenAmount(0)).toBe('¥0');
    });

    test('handles large amounts', () => {
      expect(formatYenAmount(1234567890)).toBe('¥1,234,567,890');
    });
  });
});
```

### Frontend Unit Testing (Vitest + Testing Library)

#### Component Testing

```typescript
// src/components/TransactionForm/TransactionForm.test.tsx
describe('TransactionForm', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'Groceries', type: 'EXPENSE' },
    { id: 'cat-2', name: 'Restaurants', type: 'EXPENSE' }
  ];

  const mockActors = [
    { id: 'actor-1', name: 'John Doe', kind: 'USER' },
    { id: 'actor-2', name: 'Family Card', kind: 'INSTRUMENT' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders all required fields', () => {
    render(
      <TransactionForm
        categories={mockCategories}
        actors={mockActors}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Amount (¥)')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Paid by')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    const onSubmit = vi.fn();
    render(
      <TransactionForm
        categories={mockCategories}
        actors={mockActors}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save Transaction' }));

    await waitFor(() => {
      expect(screen.getByText('Amount is required')).toBeInTheDocument();
      expect(screen.getByText('Category is required')).toBeInTheDocument();
      expect(screen.getByText('Payer is required')).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('validates amount is positive integer', async () => {
    render(
      <TransactionForm
        categories={mockCategories}
        actors={mockActors}
        onSubmit={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText('Amount (¥)');
    
    // Test negative amount
    fireEvent.change(amountInput, { target: { value: '-1000' } });
    fireEvent.blur(amountInput);

    await waitFor(() => {
      expect(screen.getByText('Amount must be positive')).toBeInTheDocument();
    });

    // Test decimal amount
    fireEvent.change(amountInput, { target: { value: '1500.50' } });
    fireEvent.blur(amountInput);

    await waitFor(() => {
      expect(screen.getByText('Amount must be a whole number')).toBeInTheDocument();
    });
  });

  test('shows should_pay_user field when should_pay is USER', async () => {
    const mockUsers = [
      { id: 'user-1', name: 'John Doe' },
      { id: 'user-2', name: 'Jane Doe' }
    ];

    render(
      <TransactionForm
        categories={mockCategories}
        actors={mockActors}
        users={mockUsers}
        onSubmit={vi.fn()}
      />
    );

    // Initially hidden
    expect(screen.queryByLabelText('Who should pay?')).not.toBeInTheDocument();

    // Select "Personal Expense"
    fireEvent.click(screen.getByLabelText('Personal Expense'));

    // Now should be visible
    await waitFor(() => {
      expect(screen.getByLabelText('Who should pay?')).toBeInTheDocument();
    });
  });

  test('submits form with correct data', async () => {
    const onSubmit = vi.fn();
    const mockUsers = [{ id: 'user-1', name: 'John Doe' }];

    render(
      <TransactionForm
        categories={mockCategories}
        actors={mockActors}
        users={mockUsers}
        onSubmit={onSubmit}
      />
    );

    // Fill form
    fireEvent.change(screen.getByLabelText('Amount (¥)'), { 
      target: { value: '1500' } 
    });
    fireEvent.change(screen.getByLabelText('Date'), { 
      target: { value: '2025-08-23' } 
    });
    fireEvent.change(screen.getByLabelText('Category'), { 
      target: { value: 'cat-1' } 
    });
    fireEvent.change(screen.getByLabelText('Paid by'), { 
      target: { value: 'actor-1' } 
    });
    fireEvent.change(screen.getByLabelText('Note'), { 
      target: { value: 'Test transaction' } 
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Save Transaction' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        type: 'EXPENSE',
        amountYen: 1500,
        occurredOn: '2025-08-23',
        categoryId: 'cat-1',
        payerActorId: 'actor-1',
        shouldPay: 'HOUSEHOLD',
        shouldPayUserId: null,
        note: 'Test transaction',
        tags: []
      });
    });
  });

  test('supports keyboard navigation', async () => {
    render(
      <TransactionForm
        categories={mockCategories}
        actors={mockActors}
        onSubmit={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText('Amount (¥)');
    amountInput.focus();

    // Tab through form fields
    userEvent.tab();
    expect(screen.getByLabelText('Date')).toHaveFocus();

    userEvent.tab();
    expect(screen.getByLabelText('Category')).toHaveFocus();

    userEvent.tab();
    expect(screen.getByLabelText('Paid by')).toHaveFocus();

    // Keyboard shortcut for save (Ctrl+Enter)
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    
    // Should attempt to submit (will fail validation)
    await waitFor(() => {
      expect(screen.getByText('Amount is required')).toBeInTheDocument();
    });
  });
});

// Hook testing
describe('useTransactionForm', () => {
  test('provides form state and validation', () => {
    const { result } = renderHook(() => useTransactionForm({
      categories: mockCategories,
      actors: mockActors
    }));

    expect(result.current.formData).toEqual({
      type: 'EXPENSE',
      amountYen: '',
      occurredOn: expect.any(String), // Today's date
      categoryId: '',
      payerActorId: '',
      shouldPay: 'HOUSEHOLD',
      shouldPayUserId: null,
      note: '',
      tags: []
    });

    expect(result.current.errors).toEqual({});
    expect(typeof result.current.handleChange).toBe('function');
    expect(typeof result.current.handleSubmit).toBe('function');
  });

  test('validates form data on submit', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useTransactionForm({
      categories: mockCategories,
      actors: mockActors,
      onSubmit
    }));

    // Submit empty form
    act(() => {
      result.current.handleSubmit();
    });

    expect(result.current.errors).toEqual({
      amountYen: 'Amount is required',
      categoryId: 'Category is required',
      payerActorId: 'Payer is required'
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

#### Custom Hook Testing

```typescript
// src/hooks/useSettlement.test.ts
describe('useSettlement', () => {
  test('fetches settlement data', async () => {
    const mockSettlement = {
      id: 'settlement-1',
      month: '2025-08-01',
      status: 'DRAFT',
      lines: []
    };

    server.use(
      http.get('/api/v1/settlements/2025-08', () => {
        return HttpResponse.json({ data: mockSettlement });
      })
    );

    const { result } = renderHook(() => useSettlement('2025-08'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settlement).toEqual(mockSettlement);
    expect(result.current.error).toBeNull();
  });

  test('handles settlement run', async () => {
    server.use(
      http.post('/api/v1/settlements/2025-08/run', () => {
        return HttpResponse.json({ data: { id: 'new-settlement' } });
      })
    );

    const { result } = renderHook(() => useSettlement('2025-08'));

    await act(async () => {
      await result.current.runSettlement();
    });

    expect(result.current.isRunning).toBe(false);
    // Verify refetch was triggered
    expect(result.current.settlement?.id).toBe('new-settlement');
  });

  test('handles errors gracefully', async () => {
    server.use(
      http.get('/api/v1/settlements/2025-08', () => {
        return HttpResponse.json(
          { error: { message: 'Settlement not found' } },
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useSettlement('2025-08'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.settlement).toBeNull();
  });
});
```

---

## Integration Testing

### API Integration Tests

```typescript
// test/integration/transactions.integration.test.ts
describe('Transactions API Integration', () => {
  let app: NestApplication;
  let prisma: PrismaService;
  let testHousehold: Household;
  let testUser: User;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();
    
    // Create test data
    testHousehold = await prisma.household.create({
      data: { name: 'Test Household' }
    });

    testUser = await prisma.user.create({
      data: {
        householdId: testHousehold.id,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        passwordHash: await bcrypt.hash('password', 10)
      }
    });

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(200);

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.household.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up transactions between tests
    await prisma.transaction.deleteMany({
      where: { householdId: testHousehold.id }
    });
  });

  describe('POST /transactions', () => {
    test('creates new transaction with valid data', async () => {
      const category = await prisma.category.create({
        data: {
          householdId: testHousehold.id,
          name: 'Groceries',
          type: 'EXPENSE'
        }
      });

      const actor = await prisma.actor.create({
        data: {
          householdId: testHousehold.id,
          kind: 'USER',
          userId: testUser.id,
          name: testUser.name
        }
      });

      const transactionData = {
        type: 'EXPENSE',
        amountYen: 5000,
        occurredOn: '2025-08-23',
        categoryId: category.id,
        payerActorId: actor.id,
        shouldPay: 'HOUSEHOLD',
        note: 'Test transaction',
        tags: ['test', 'groceries']
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        type: 'EXPENSE',
        amountYen: 5000,
        occurredOn: '2025-08-23',
        note: 'Test transaction',
        tags: ['test', 'groceries']
      });

      // Verify in database
      const dbTransaction = await prisma.transaction.findUnique({
        where: { id: response.body.data.id }
      });
      expect(dbTransaction).toBeTruthy();
      expect(dbTransaction!.householdId).toBe(testHousehold.id);
    });

    test('enforces household isolation', async () => {
      // Create another household's data
      const otherHousehold = await prisma.household.create({
        data: { name: 'Other Household' }
      });

      const otherCategory = await prisma.category.create({
        data: {
          householdId: otherHousehold.id,
          name: 'Other Category',
          type: 'EXPENSE'
        }
      });

      const transactionData = {
        type: 'EXPENSE',
        amountYen: 5000,
        occurredOn: '2025-08-23',
        categoryId: otherCategory.id, // Different household!
        payerActorId: 'invalid-actor',
        shouldPay: 'HOUSEHOLD'
      };

      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(403); // Should be forbidden due to RLS
    });

    test('validates business rules', async () => {
      const transactionData = {
        type: 'EXPENSE',
        amountYen: -1000, // Invalid: negative amount
        occurredOn: '2025-08-23',
        categoryId: 'invalid-uuid',
        payerActorId: 'invalid-uuid',
        shouldPay: 'HOUSEHOLD'
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContainEqual(
        expect.objectContaining({
          field: 'amountYen',
          message: expect.stringContaining('positive')
        })
      );
    });

    test('supports idempotency', async () => {
      const category = await prisma.category.create({
        data: {
          householdId: testHousehold.id,
          name: 'Groceries',
          type: 'EXPENSE'
        }
      });

      const actor = await prisma.actor.create({
        data: {
          householdId: testHousehold.id,
          kind: 'USER',
          userId: testUser.id,
          name: testUser.name
        }
      });

      const transactionData = {
        type: 'EXPENSE',
        amountYen: 5000,
        occurredOn: '2025-08-23',
        categoryId: category.id,
        payerActorId: actor.id,
        shouldPay: 'HOUSEHOLD'
      };

      const idempotencyKey = 'test-key-123';

      // First request
      const response1 = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(transactionData)
        .expect(201);

      // Second request with same idempotency key
      const response2 = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(transactionData)
        .expect(200); // Should return existing

      expect(response1.body.data.id).toBe(response2.body.data.id);

      // Verify only one transaction in database
      const count = await prisma.transaction.count({
        where: { householdId: testHousehold.id }
      });
      expect(count).toBe(1);
    });
  });

  describe('GET /transactions', () => {
    test('returns household transactions only', async () => {
      // Create test data
      const category = await prisma.category.create({
        data: {
          householdId: testHousehold.id,
          name: 'Test Category',
          type: 'EXPENSE'
        }
      });

      const actor = await prisma.actor.create({
        data: {
          householdId: testHousehold.id,
          kind: 'USER',
          userId: testUser.id,
          name: testUser.name
        }
      });

      await prisma.transaction.create({
        data: {
          householdId: testHousehold.id,
          type: 'EXPENSE',
          amountYen: 5000,
          occurredOn: new Date('2025-08-15'),
          categoryId: category.id,
          payerActorId: actor.id,
          shouldPay: 'HOUSEHOLD'
        }
      });

      // Create transaction for different household
      const otherHousehold = await prisma.household.create({
        data: { name: 'Other Household' }
      });

      const otherCategory = await prisma.category.create({
        data: {
          householdId: otherHousehold.id,
          name: 'Other Category',
          type: 'EXPENSE'
        }
      });

      const otherActor = await prisma.actor.create({
        data: {
          householdId: otherHousehold.id,
          kind: 'INSTRUMENT',
          name: 'Other Actor'
        }
      });

      await prisma.transaction.create({
        data: {
          householdId: otherHousehold.id,
          type: 'EXPENSE',
          amountYen: 3000,
          occurredOn: new Date('2025-08-15'),
          categoryId: otherCategory.id,
          payerActorId: otherActor.id,
          shouldPay: 'HOUSEHOLD'
        }
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].amountYen).toBe(5000);
    });

    test('filters by date range', async () => {
      const category = await prisma.category.create({
        data: {
          householdId: testHousehold.id,
          name: 'Test Category',
          type: 'EXPENSE'
        }
      });

      const actor = await prisma.actor.create({
        data: {
          householdId: testHousehold.id,
          kind: 'USER',
          userId: testUser.id,
          name: testUser.name
        }
      });

      // Create transactions on different dates
      await prisma.transaction.createMany({
        data: [
          {
            householdId: testHousehold.id,
            type: 'EXPENSE',
            amountYen: 1000,
            occurredOn: new Date('2025-08-01'),
            categoryId: category.id,
            payerActorId: actor.id,
            shouldPay: 'HOUSEHOLD'
          },
          {
            householdId: testHousehold.id,
            type: 'EXPENSE',
            amountYen: 2000,
            occurredOn: new Date('2025-08-15'),
            categoryId: category.id,
            payerActorId: actor.id,
            shouldPay: 'HOUSEHOLD'
          },
          {
            householdId: testHousehold.id,
            type: 'EXPENSE',
            amountYen: 3000,
            occurredOn: new Date('2025-09-01'),
            categoryId: category.id,
            payerActorId: actor.id,
            shouldPay: 'HOUSEHOLD'
          }
        ]
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions')
        .query({
          from: '2025-08-01',
          to: '2025-08-31'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map(t => t.amountYen)).toEqual([2000, 1000]); // DESC order
    });

    test('paginates large result sets', async () => {
      const category = await prisma.category.create({
        data: {
          householdId: testHousehold.id,
          name: 'Test Category',
          type: 'EXPENSE'
        }
      });

      const actor = await prisma.actor.create({
        data: {
          householdId: testHousehold.id,
          kind: 'USER',
          userId: testUser.id,
          name: testUser.name
        }
      });

      // Create 25 transactions
      const transactions = Array.from({ length: 25 }, (_, i) => ({
        householdId: testHousehold.id,
        type: 'EXPENSE' as const,
        amountYen: BigInt(1000 + i),
        occurredOn: new Date('2025-08-15'),
        categoryId: category.id,
        payerActorId: actor.id,
        shouldPay: 'HOUSEHOLD' as const
      }));

      await prisma.transaction.createMany({ data: transactions });

      // First page
      const page1 = await request(app.getHttpServer())
        .get('/api/v1/transactions')
        .query({ limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page1.body.data).toHaveLength(10);
      expect(page1.body.meta.hasMore).toBe(true);
      expect(page1.body.meta.nextCursor).toBeTruthy();

      // Second page
      const page2 = await request(app.getHttpServer())
        .get('/api/v1/transactions')
        .query({ 
          limit: 10,
          cursor: page1.body.meta.nextCursor
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page2.body.data).toHaveLength(10);
      expect(page2.body.meta.hasMore).toBe(true);

      // Third page
      const page3 = await request(app.getHttpServer())
        .get('/api/v1/transactions')
        .query({ 
          limit: 10,
          cursor: page2.body.meta.nextCursor
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page3.body.data).toHaveLength(5);
      expect(page3.body.meta.hasMore).toBe(false);
    });
  });
});
```

### Database Integration Tests

```typescript
// test/integration/database.integration.test.ts
describe('Database Integration', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Row Level Security', () => {
    test('isolates household data', async () => {
      const household1 = await prisma.household.create({
        data: { name: 'Household 1' }
      });

      const household2 = await prisma.household.create({
        data: { name: 'Household 2' }
      });

      const user1 = await prisma.user.create({
        data: {
          householdId: household1.id,
          email: 'user1@example.com',
          name: 'User 1',
          passwordHash: 'hash1'
        }
      });

      const user2 = await prisma.user.create({
        data: {
          householdId: household2.id,
          email: 'user2@example.com',
          name: 'User 2',
          passwordHash: 'hash2'
        }
      });

      // Set session for household 1
      await prisma.$executeRaw`
        SELECT set_config('app.household_id', ${household1.id}::text, true)
      `;

      // Should only see household 1 users
      const users = await prisma.user.findMany();
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe(user1.id);

      // Switch to household 2
      await prisma.$executeRaw`
        SELECT set_config('app.household_id', ${household2.id}::text, true)
      `;

      const users2 = await prisma.user.findMany();
      expect(users2).toHaveLength(1);
      expect(users2[0].id).toBe(user2.id);
    });

    test('prevents cross-household access', async () => {
      const household1 = await prisma.household.create({
        data: { name: 'Household 1' }
      });

      const household2 = await prisma.household.create({
        data: { name: 'Household 2' }
      });

      const user2 = await prisma.user.create({
        data: {
          householdId: household2.id,
          email: 'user2@example.com',
          name: 'User 2',
          passwordHash: 'hash2'
        }
      });

      // Set session for household 1
      await prisma.$executeRaw`
        SELECT set_config('app.household_id', ${household1.id}::text, true)
      `;

      // Try to access household 2 user directly
      const user = await prisma.user.findUnique({
        where: { id: user2.id }
      });

      expect(user).toBeNull(); // Should be hidden by RLS
    });
  });

  describe('Constraints and Triggers', () => {
    test('enforces unique email per household', async () => {
      const household = await prisma.household.create({
        data: { name: 'Test Household' }
      });

      await prisma.user.create({
        data: {
          householdId: household.id,
          email: 'test@example.com',
          name: 'User 1',
          passwordHash: 'hash1'
        }
      });

      // Try to create another user with same email
      await expect(
        prisma.user.create({
          data: {
            householdId: household.id,
            email: 'test@example.com', // Duplicate email
            name: 'User 2',
            passwordHash: 'hash2'
          }
        })
      ).rejects.toThrow(/unique constraint/i);
    });

    test('auto-creates user actor on user creation', async () => {
      const household = await prisma.household.create({
        data: { name: 'Test Household' }
      });

      const user = await prisma.user.create({
        data: {
          householdId: household.id,
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hash'
        }
      });

      // Check that user actor was created
      const actor = await prisma.actor.findFirst({
        where: {
          userId: user.id,
          kind: 'USER'
        }
      });

      expect(actor).toBeTruthy();
      expect(actor!.name).toBe(user.name);
    });

    test('updates user actor name when user name changes', async () => {
      const household = await prisma.household.create({
        data: { name: 'Test Household' }
      });

      const user = await prisma.user.create({
        data: {
          householdId: household.id,
          email: 'test@example.com',
          name: 'Original Name',
          passwordHash: 'hash'
        }
      });

      // Update user name
      await prisma.user.update({
        where: { id: user.id },
        data: { name: 'Updated Name' }
      });

      // Check that actor name was updated
      const actor = await prisma.actor.findFirst({
        where: {
          userId: user.id,
          kind: 'USER'
        }
      });

      expect(actor!.name).toBe('Updated Name');
    });

    test('prevents finalized settlement deletion', async () => {
      const household = await prisma.household.create({
        data: { name: 'Test Household' }
      });

      const user = await prisma.user.create({
        data: {
          householdId: household.id,
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hash'
        }
      });

      const settlement = await prisma.settlement.create({
        data: {
          householdId: household.id,
          month: new Date('2025-08-01'),
          status: 'FINALIZED',
          finalizedBy: user.id,
          finalizedAt: new Date()
        }
      });

      // Try to delete finalized settlement
      await expect(
        prisma.settlement.delete({
          where: { id: settlement.id }
        })
      ).rejects.toThrow(/cannot delete finalized settlement/i);
    });
  });

  describe('Settlement Calculations', () => {
    test('handles complex settlement scenario', async () => {
      // Setup test household
      const household = await prisma.household.create({
        data: { name: 'Test Family' }
      });

      const users = await Promise.all([
        prisma.user.create({
          data: {
            householdId: household.id,
            email: 'alice@example.com',
            name: 'Alice',
            passwordHash: 'hash1'
          }
        }),
        prisma.user.create({
          data: {
            householdId: household.id,
            email: 'bob@example.com',
            name: 'Bob',
            passwordHash: 'hash2'
          }
        })
      ]);

      // Create incomes
      await prisma.income.createMany({
        data: [
          {
            householdId: household.id,
            userId: users[0].id,
            month: new Date('2025-08-01'),
            grossYen: BigInt(400000),
            deductionTaxYen: BigInt(80000),
            deductionSocialYen: BigInt(60000),
            allocatableYen: BigInt(260000)
          },
          {
            householdId: household.id,
            userId: users[1].id,
            month: new Date('2025-08-01'),
            grossYen: BigInt(300000),
            deductionTaxYen: BigInt(60000),
            deductionSocialYen: BigInt(45000),
            allocatableYen: BigInt(195000)
          }
        ]
      });

      // Create categories and actors
      const category = await prisma.category.create({
        data: {
          householdId: household.id,
          name: 'Groceries',
          type: 'EXPENSE'
        }
      });

      const actors = await Promise.all([
        prisma.actor.findFirst({
          where: { userId: users[0].id, kind: 'USER' }
        }),
        prisma.actor.findFirst({
          where: { userId: users[1].id, kind: 'USER' }
        })
      ]);

      // Create household expenses
      await prisma.transaction.createMany({
        data: [
          {
            householdId: household.id,
            type: 'EXPENSE',
            amountYen: BigInt(30000), // Alice paid
            occurredOn: new Date('2025-08-15'),
            categoryId: category.id,
            payerActorId: actors[0]!.id,
            shouldPay: 'HOUSEHOLD'
          },
          {
            householdId: household.id,
            type: 'EXPENSE',
            amountYen: BigInt(20000), // Bob paid
            occurredOn: new Date('2025-08-16'),
            categoryId: category.id,
            payerActorId: actors[1]!.id,
            shouldPay: 'HOUSEHOLD'
          }
        ]
      });

      // Total household expenses: 50000
      // Alice share (57.14%): 28571
      // Bob share (42.86%): 21429
      // Alice paid: 30000, should pay: 28571 → net: +1429
      // Bob paid: 20000, should pay: 21429 → net: -1429
      // Settlement: Bob owes Alice 1429

      // Set session context
      await prisma.$executeRaw`
        SELECT set_config('app.household_id', ${household.id}::text, true)
      `;

      // Run settlement calculation (would be done by service)
      const settlementData = await calculateSettlement(household.id, '2025-08');

      expect(settlementData.lines).toHaveLength(1);
      expect(settlementData.lines[0]).toMatchObject({
        fromUserId: users[1].id, // Bob
        toUserId: users[0].id,   // Alice
        amountYen: expect.any(Number)
      });
      
      // Amount should be close to 1429 (exact depends on rounding)
      expect(settlementData.lines[0].amountYen).toBeCloseTo(1429, 0);
    });
  });

  describe('Audit Logging', () => {
    test('logs all data changes', async () => {
      const household = await prisma.household.create({
        data: { name: 'Test Household' }
      });

      const user = await prisma.user.create({
        data: {
          householdId: household.id,
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hash'
        }
      });

      // Set session context
      await prisma.$executeRaw`
        SELECT set_config('app.household_id', ${household.id}::text, true),
               set_config('app.user_id', ${user.id}::text, true)
      `;

      // Create category (should trigger audit)
      const category = await prisma.category.create({
        data: {
          householdId: household.id,
          name: 'Test Category',
          type: 'EXPENSE'
        }
      });

      // Check audit log
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          householdId: household.id,
          action: 'categories_CREATE'
        }
      });

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].userId).toBe(user.id);
      expect(auditLogs[0].detail).toMatchObject({
        new: expect.objectContaining({
          id: category.id,
          name: 'Test Category'
        })
      });
    });
  });
});
```

---

## End-to-End Testing

### Playwright E2E Tests

```typescript
// tests/e2e/transaction-workflow.spec.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Transaction Management Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');
  });

  test('complete expense entry workflow', async () => {
    // Navigate to transactions
    await page.click('[data-testid=nav-transactions]');
    await expect(page).toHaveURL('/transactions');

    // Add new transaction
    await page.click('[data-testid=add-transaction-button]');
    await expect(page.locator('[data-testid=transaction-form]')).toBeVisible();

    // Fill form
    await page.fill('[data-testid=amount-input]', '15000');
    await page.selectOption('[data-testid=category-select]', { label: 'Groceries' });
    await page.selectOption('[data-testid=payer-select]', { label: 'Family Card' });
    await page.fill('[data-testid=note-input]', 'Weekly grocery shopping');
    await page.fill('[data-testid=tags-input]', 'groceries, weekly');

    // Submit form
    await page.click('[data-testid=save-button]');

    // Verify success message
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
    await expect(page.locator('[data-testid=success-message]')).toContainText('Transaction saved');

    // Verify transaction appears in list
    await expect(page.locator('[data-testid=transaction-list]')).toContainText('¥15,000');
    await expect(page.locator('[data-testid=transaction-list]')).toContainText('Groceries');
    await expect(page.locator('[data-testid=transaction-list]')).toContainText('Weekly grocery shopping');

    // Verify transaction details
    const transactionRow = page.locator('[data-testid=transaction-item]').first();
    await expect(transactionRow).toContainText('¥15,000');
    await expect(transactionRow).toContainText('Groceries');
    await expect(transactionRow).toContainText('Family Card');
    await expect(transactionRow).toContainText('Household');
  });

  test('edit existing transaction', async () => {
    // Assume we have existing transaction
    await page.goto('/transactions');
    await page.click('[data-testid=transaction-item]:first-child [data-testid=edit-button]');

    // Modify amount
    await page.fill('[data-testid=amount-input]', '16000');
    await page.fill('[data-testid=note-input]', 'Weekly grocery shopping - updated');
    
    // Save changes
    await page.click('[data-testid=save-button]');

    // Verify update
    await expect(page.locator('[data-testid=success-message]')).toContainText('Transaction updated');
    await expect(page.locator('[data-testid=transaction-list]')).toContainText('¥16,000');
    await expect(page.locator('[data-testid=transaction-list]')).toContainText('updated');
  });

  test('delete transaction with confirmation', async () => {
    await page.goto('/transactions');
    
    // Count initial transactions
    const initialCount = await page.locator('[data-testid=transaction-item]').count();
    
    // Delete first transaction
    await page.click('[data-testid=transaction-item]:first-child [data-testid=delete-button]');
    
    // Confirm deletion
    await expect(page.locator('[data-testid=confirm-dialog]')).toBeVisible();
    await expect(page.locator('[data-testid=confirm-dialog]')).toContainText('delete this transaction');
    await page.click('[data-testid=confirm-delete]');

    // Verify deletion
    await expect(page.locator('[data-testid=success-message]')).toContainText('Transaction deleted');
    
    // Verify count decreased
    const newCount = await page.locator('[data-testid=transaction-item]').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('keyboard navigation and shortcuts', async () => {
    await page.goto('/transactions');
    
    // Use keyboard shortcut to add transaction (Ctrl+N)
    await page.keyboard.press('Control+KeyN');
    await expect(page.locator('[data-testid=transaction-form]')).toBeVisible();

    // Tab through form fields
    await page.keyboard.press('Tab'); // Amount
    await page.keyboard.type('5000');
    
    await page.keyboard.press('Tab'); // Date (should be pre-filled with today)
    await page.keyboard.press('Tab'); // Category
    await page.keyboard.press('Space'); // Open dropdown
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    await page.keyboard.press('Tab'); // Payer
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    await page.keyboard.press('Tab'); // Note
    await page.keyboard.type('Keyboard test');

    // Save with Ctrl+Enter
    await page.keyboard.press('Control+Enter');
    
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
  });

  test('form validation errors', async () => {
    await page.goto('/transactions');
    await page.click('[data-testid=add-transaction-button]');

    // Try to save empty form
    await page.click('[data-testid=save-button]');

    // Check validation errors
    await expect(page.locator('[data-testid=amount-error]')).toContainText('Amount is required');
    await expect(page.locator('[data-testid=category-error]')).toContainText('Category is required');
    await expect(page.locator('[data-testid=payer-error]')).toContainText('Payer is required');

    // Fix errors one by one
    await page.fill('[data-testid=amount-input]', '1500');
    await expect(page.locator('[data-testid=amount-error]')).not.toBeVisible();

    await page.selectOption('[data-testid=category-select]', { label: 'Groceries' });
    await expect(page.locator('[data-testid=category-error]')).not.toBeVisible();

    await page.selectOption('[data-testid=payer-select]', { label: 'Family Card' });
    await expect(page.locator('[data-testid=payer-error]')).not.toBeVisible();

    // Now should be able to save
    await page.click('[data-testid=save-button]');
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
  });

  test('responsive design on mobile', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await page.goto('/transactions');

    // Mobile-specific UI elements
    await expect(page.locator('[data-testid=mobile-menu-button]')).toBeVisible();
    await expect(page.locator('[data-testid=desktop-sidebar]')).not.toBeVisible();

    // Add transaction on mobile
    await page.click('[data-testid=mobile-add-button]'); // Floating action button
    
    // Form should open as bottom sheet
    await expect(page.locator('[data-testid=mobile-form-sheet]')).toBeVisible();
    
    // Fill form
    await page.fill('[data-testid=amount-input]', '2500');
    await page.selectOption('[data-testid=category-select]', { label: 'Restaurants' });
    await page.selectOption('[data-testid=payer-select]', { label: 'Cash' });
    
    // Save
    await page.click('[data-testid=save-button]');
    
    // Verify transaction appears in mobile list
    await expect(page.locator('[data-testid=mobile-transaction-card]')).toContainText('¥2,500');
    await expect(page.locator('[data-testid=mobile-transaction-card]')).toContainText('Restaurants');
  });
});

test.describe('Settlement Workflow', () => {
  test('run monthly settlement', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'admin@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // Navigate to settlements
    await page.click('[data-testid=nav-settlements]');
    await expect(page).toHaveURL('/settlements');

    // Select month
    await page.selectOption('[data-testid=month-select]', '2025-08');

    // Run settlement
    await page.click('[data-testid=run-settlement-button]');
    
    // Wait for computation
    await expect(page.locator('[data-testid=loading-spinner]')).toBeVisible();
    await expect(page.locator('[data-testid=loading-spinner]')).not.toBeVisible({ timeout: 10000 });

    // Verify settlement results
    await expect(page.locator('[data-testid=settlement-status]')).toContainText('DRAFT');
    await expect(page.locator('[data-testid=settlement-summary]')).toBeVisible();
    
    // Check settlement lines
    const settlementLines = page.locator('[data-testid=settlement-line]');
    const lineCount = await settlementLines.count();
    expect(lineCount).toBeGreaterThan(0);

    // Verify line details
    const firstLine = settlementLines.first();
    await expect(firstLine).toContainText('¥'); // Amount
    await expect(firstLine).toContainText('→'); // Arrow indicator
  });

  test('finalize settlement', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'admin@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');

    await page.goto('/settlements');
    await page.selectOption('[data-testid=month-select]', '2025-08');

    // Assume settlement is already in DRAFT status
    await expect(page.locator('[data-testid=settlement-status]')).toContainText('DRAFT');
    
    // Finalize settlement
    await page.click('[data-testid=finalize-button]');
    
    // Confirm finalization
    await expect(page.locator('[data-testid=finalize-dialog]')).toBeVisible();
    await page.fill('[data-testid=finalize-notes]', 'Settlement approved by all parties');
    await page.click('[data-testid=confirm-finalize]');

    // Verify finalization
    await expect(page.locator('[data-testid=success-message]')).toContainText('Settlement finalized');
    await expect(page.locator('[data-testid=settlement-status]')).toContainText('FINALIZED');
    
    // Verify finalize button is disabled
    await expect(page.locator('[data-testid=finalize-button]')).toBeDisabled();
  });

  test('settlement breakdown visualization', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');

    await page.goto('/settlements');
    await page.selectOption('[data-testid=month-select]', '2025-08');

    // View detailed breakdown
    await page.click('[data-testid=view-details-button]');

    // Verify breakdown sections
    await expect(page.locator('[data-testid=income-breakdown]')).toBeVisible();
    await expect(page.locator('[data-testid=expense-breakdown]')).toBeVisible();
    await expect(page.locator('[data-testid=balance-breakdown]')).toBeVisible();

    // Check charts
    await expect(page.locator('[data-testid=income-chart]')).toBeVisible();
    await expect(page.locator('[data-testid=expense-chart]')).toBeVisible();

    // Verify user details
    const userCards = page.locator('[data-testid=user-balance-card]');
    const userCount = await userCards.count();
    expect(userCount).toBeGreaterThan(0);

    // Check first user card
    const firstUserCard = userCards.first();
    await expect(firstUserCard).toContainText('Income:');
    await expect(firstUserCard).toContainText('Expenses:');
    await expect(firstUserCard).toContainText('Net Balance:');
  });
});

test.describe('Data Import/Export', () => {
  test('import CSV transactions', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'admin@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');

    await page.goto('/import');

    // Upload CSV file
    const fileInput = page.locator('[data-testid=file-input]');
    await fileInput.setInputFiles('./test-data/sample-transactions.csv');

    // Wait for file analysis
    await expect(page.locator('[data-testid=file-analysis]')).toBeVisible();
    await expect(page.locator('[data-testid=detected-rows]')).toContainText('10 rows detected');

    // Configure mapping
    await page.selectOption('[data-testid=date-column-select]', 'Date');
    await page.selectOption('[data-testid=amount-column-select]', 'Amount');
    await page.selectOption('[data-testid=description-column-select]', 'Description');
    await page.selectOption('[data-testid=default-category-select]', { label: 'Miscellaneous' });
    await page.selectOption('[data-testid=default-payer-select]', { label: 'Family Card' });

    // Preview import
    await page.click('[data-testid=preview-button]');
    
    await expect(page.locator('[data-testid=import-preview]')).toBeVisible();
    await expect(page.locator('[data-testid=preview-valid-rows]')).toContainText('8 valid');
    await expect(page.locator('[data-testid=preview-error-rows]')).toContainText('2 errors');

    // Execute import
    await page.click('[data-testid=execute-import-button]');
    
    // Wait for import completion
    await expect(page.locator('[data-testid=import-progress]')).toBeVisible();
    await expect(page.locator('[data-testid=import-complete]')).toBeVisible({ timeout: 30000 });

    // Verify results
    await expect(page.locator('[data-testid=import-results]')).toContainText('8 transactions imported');
    await expect(page.locator('[data-testid=import-results]')).toContainText('2 rows skipped');
    
    // Navigate to transactions to verify
    await page.click('[data-testid=view-transactions-button]');
    await expect(page).toHaveURL('/transactions');
    
    const transactionCount = await page.locator('[data-testid=transaction-item]').count();
    expect(transactionCount).toBeGreaterThanOrEqual(8);
  });

  test('export transactions to CSV', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');

    await page.goto('/export');

    // Configure export
    await page.selectOption('[data-testid=export-type-select]', 'transactions');
    await page.selectOption('[data-testid=export-format-select]', 'csv');
    await page.fill('[data-testid=date-from-input]', '2025-01-01');
    await page.fill('[data-testid=date-to-input]', '2025-12-31');

    // Select fields
    await page.check('[data-testid=field-date]');
    await page.check('[data-testid=field-amount]');
    await page.check('[data-testid=field-category]');
    await page.check('[data-testid=field-note]');

    // Generate export
    await page.click('[data-testid=generate-export-button]');
    
    // Wait for generation
    await expect(page.locator('[data-testid=export-progress]')).toBeVisible();
    await expect(page.locator('[data-testid=download-ready]')).toBeVisible({ timeout: 30000 });

    // Download file
    const downloadPromise = page.waitForDownload();
    await page.click('[data-testid=download-button]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/transactions.*\.csv$/);
    
    // Verify file content
    const path = await download.path();
    const content = await require('fs').promises.readFile(path, 'utf-8');
    expect(content).toContain('Date,Amount,Category,Note');
    expect(content.split('\n').length).toBeGreaterThan(1); // Header + data
  });
});

test.describe('Error Handling', () => {
  test('handles network failures gracefully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');

    await page.goto('/transactions');

    // Simulate network failure
    await page.route('**/api/v1/transactions', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Server temporarily unavailable'
          }
        })
      });
    });

    // Try to add transaction
    await page.click('[data-testid=add-transaction-button]');
    await page.fill('[data-testid=amount-input]', '1000');
    await page.selectOption('[data-testid=category-select]', { label: 'Groceries' });
    await page.selectOption('[data-testid=payer-select]', { label: 'Cash' });
    await page.click('[data-testid=save-button]');

    // Check error handling
    await expect(page.locator('[data-testid=error-message]')).toBeVisible();
    await expect(page.locator('[data-testid=error-message]')).toContainText('Server temporarily unavailable');
    
    // Verify retry button is available
    await expect(page.locator('[data-testid=retry-button]')).toBeVisible();
  });

  test('handles session expiration', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // Simulate session expiration
    await page.route('**/api/v1/**', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Your session has expired'
          }
        })
      });
    });

    // Try to navigate to transactions
    await page.click('[data-testid=nav-transactions]');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid=session-expired-message]')).toContainText('session has expired');
  });

  test('validates form constraints', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.click('[data-testid=login-button]');

    await page.goto('/transactions');
    await page.click('[data-testid=add-transaction-button]');

    // Test invalid amount (negative)
    await page.fill('[data-testid=amount-input]', '-1000');
    await page.blur('[data-testid=amount-input]');
    await expect(page.locator('[data-testid=amount-error]')).toContainText('must be positive');

    // Test invalid amount (decimal)
    await page.fill('[data-testid=amount-input]', '1500.50');
    await page.blur('[data-testid=amount-input]');
    await expect(page.locator('[data-testid=amount-error]')).toContainText('whole number');

    // Test future date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    await page.fill('[data-testid=date-input]', futureDateStr);
    await page.blur('[data-testid=date-input]');
    await expect(page.locator('[data-testid=date-error]')).toContainText('cannot be in the future');

    // Test note too long
    const longNote = 'A'.repeat(501);
    await page.fill('[data-testid=note-input]', longNote);
    await page.blur('[data-testid=note-input]');
    await expect(page.locator('[data-testid=note-error]')).toContainText('500 characters');
  });
});
```

---

## API Contract Testing

### OpenAPI Contract Validation

```typescript
// tests/contract/api-contract.test.ts
import { OpenAPIV3 } from 'openapi-types';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('API Contract Tests', () => {
  let openApiSpec: OpenAPIV3.Document;
  let ajv: Ajv;

  beforeAll(async () => {
    // Load OpenAPI specification
    openApiSpec = await SwaggerParser.dereference('./docs/openapi.json') as OpenAPIV3.Document;
    
    ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
  });

  describe('Transaction Endpoints', () => {
    test('POST /transactions request matches schema', async () => {
      const requestSchema = openApiSpec.paths['/transactions']?.post?.requestBody?.content?.['application/json']?.schema;
      expect(requestSchema).toBeDefined();

      const validator = ajv.compile(requestSchema!);
      
      const validRequest = {
        type: 'EXPENSE',
        amountYen: 5000,
        occurredOn: '2025-08-23',
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
        payerActorId: '550e8400-e29b-41d4-a716-446655440001',
        shouldPay: 'HOUSEHOLD',
        note: 'Test transaction',
        tags: ['test']
      };

      const isValid = validator(validRequest);
      if (!isValid) {
        console.log('Validation errors:', validator.errors);
      }
      expect(isValid).toBe(true);
    });

    test('POST /transactions response matches schema', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validTransactionData)
        .expect(201);

      const responseSchema = openApiSpec.paths['/transactions']?.post?.responses?.['201']?.content?.['application/json']?.schema;
      expect(responseSchema).toBeDefined();

      const validator = ajv.compile(responseSchema!);
      const isValid = validator(response.body);
      
      if (!isValid) {
        console.log('Response validation errors:', validator.errors);
      }
      expect(isValid).toBe(true);
    });

    test('GET /transactions response matches schema', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const responseSchema = openApiSpec.paths['/transactions']?.get?.responses?.['200']?.content?.['application/json']?.schema;
      expect(responseSchema).toBeDefined();

      const validator = ajv.compile(responseSchema!);
      const isValid = validator(response.body);
      
      expect(isValid).toBe(true);
    });

    test('error responses match schema', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ type: 'INVALID' }) // Invalid data
        .expect(400);

      const errorSchema = openApiSpec.components?.schemas?.ErrorResponse;
      expect(errorSchema).toBeDefined();

      const validator = ajv.compile(errorSchema!);
      const isValid = validator(response.body);
      
      expect(isValid).toBe(true);
      expect(response.body).toMatchObject({
        error: {
          code: expect.any(String),
          message: expect.any(String)
        }
      });
    });
  });

  describe('Settlement Endpoints', () => {
    test('POST /settlements/{month}/run response matches schema', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/settlements/2025-08/run')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const responseSchema = openApiSpec.paths['/settlements/{month}/run']?.post?.responses?.['200']?.content?.['application/json']?.schema;
      expect(responseSchema).toBeDefined();

      const validator = ajv.compile(responseSchema!);
      const isValid = validator(response.body);
      
      if (!isValid) {
        console.log('Settlement response validation errors:', validator.errors);
      }
      expect(isValid).toBe(true);

      // Verify specific structure
      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        month: '2025-08-01',
        status: 'DRAFT',
        lines: expect.any(Array),
        summary: expect.any(Object)
      });
    });
  });

  describe('Pagination Schema Compliance', () => {
    test('paginated responses include correct metadata', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/transactions?limit=5')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      
      expect(response.body.meta).toMatchObject({
        hasMore: expect.any(Boolean),
        count: expect.any(Number)
      });

      if (response.body.meta.hasMore) {
        expect(response.body.meta).toHaveProperty('nextCursor');
      }
    });
  });

  describe('Authentication Schema', () => {
    test('login response matches schema', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      const responseSchema = openApiSpec.paths['/auth/login']?.post?.responses?.['200']?.content?.['application/json']?.schema;
      expect(responseSchema).toBeDefined();

      const validator = ajv.compile(responseSchema!);
      const isValid = validator(response.body);
      
      expect(isValid).toBe(true);
    });

    test('token creation response matches schema', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/tokens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Token',
          scopes: ['transactions:read', 'transactions:write']
        })
        .expect(201);

      const responseSchema = openApiSpec.paths['/auth/tokens']?.post?.responses?.['201']?.content?.['application/json']?.schema;
      expect(responseSchema).toBeDefined();

      const validator = ajv.compile(responseSchema!);
      const isValid = validator(response.body);
      
      expect(isValid).toBe(true);
      
      // Verify token structure
      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        name: 'Test Token',
        token: expect.stringMatching(/^nestegg_pat_/),
        scopes: ['transactions:read', 'transactions:write'],
        createdAt: expect.any(String)
      });
    });
  });

  test('OpenAPI specification is valid', async () => {
    // Validate the OpenAPI spec itself
    const validator = await SwaggerParser.validate(openApiSpec);
    expect(validator).toBeTruthy();
  });

  test('all endpoints have proper error responses defined', () => {
    const paths = openApiSpec.paths;
    
    for (const [path, methods] of Object.entries(paths || {})) {
      for (const [method, operation] of Object.entries(methods || {})) {
        if (typeof operation === 'object' && operation.responses) {
          // Should have at least 400 and 500 error responses
          expect(operation.responses).toHaveProperty('400');
          expect(operation.responses).toHaveProperty('500');
          
          // Check 400 response structure
          const badRequestResponse = operation.responses['400'];
          if (badRequestResponse && typeof badRequestResponse === 'object' && 'content' in badRequestResponse) {
            expect(badRequestResponse.content).toHaveProperty('application/json');
          }
        }
      }
    }
  });

  test('all POST endpoints require authentication', () => {
    const paths = openApiSpec.paths;
    
    for (const [path, methods] of Object.entries(paths || {})) {
      if (methods?.post && path !== '/auth/login') {
        expect(methods.post.security).toBeDefined();
        expect(methods.post.security).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              BearerAuth: expect.any(Array)
            })
          ])
        );
      }
    }
  });
});

// Prism mock server integration test
describe('Prism Mock Server', () => {
  test('mock server responses match OpenAPI spec', async () => {
    // Start Prism mock server
    const prismProcess = spawn('prism', ['mock', './docs/openapi.json', '--port', '4010'], {
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Test against mock server
      const mockResponse = await fetch('http://localhost:4010/api/v1/transactions', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      });

      expect(mockResponse.status).toBe(200);
      
      const mockData = await mockResponse.json();
      
      // Mock response should match schema structure
      expect(mockData).toHaveProperty('data');
      expect(mockData).toHaveProperty('meta');
      expect(Array.isArray(mockData.data)).toBe(true);
      
    } finally {
      prismProcess.kill();
    }
  });
});
```

---

## Mock Service Worker

### MSW Setup and Handlers

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';

// Mock data generators
const generateMockTransaction = (overrides = {}) => ({
  id: crypto.randomUUID(),
  householdId: 'mock-household',
  type: 'EXPENSE',
  amountYen: 5000,
  occurredOn: '2025-08-23',
  bookedAt: '2025-08-23T10:00:00Z',
  category: {
    id: 'cat-groceries',
    name: 'Groceries'
  },
  payerActor: {
    id: 'actor-family-card',
    name: 'Family Card',
    kind: 'INSTRUMENT'
  },
  payerUser: {
    id: 'user-john',
    name: 'John Doe'
  },
  shouldPay: 'HOUSEHOLD',
  shouldPayUser: null,
  note: 'Weekly groceries',
  tags: ['groceries', 'weekly'],
  createdAt: '2025-08-23T10:00:00Z',
  updatedAt: '2025-08-23T10:00:00Z',
  deletedAt: null,
  ...overrides
});

const generateMockSettlement = (overrides = {}) => ({
  id: crypto.randomUUID(),
  householdId: 'mock-household',
  month: '2025-08-01',
  status: 'DRAFT',
  computedAt: '2025-09-01T02:00:00Z',
  summary: {
    totalHouseholdExpensesYen: 150000,
    totalPersonalExpensesYen: 5000,
    participantCount: 2,
    transferCount: 1
  },
  lines: [
    {
      id: crypto.randomUUID(),
      fromUser: {
        id: 'user-jane',
        name: 'Jane Doe'
      },
      toUser: {
        id: 'user-john',
        name: 'John Doe'
      },
      amountYen: 25000,
      description: 'Net settlement for August 2025'
    }
  ],
  userDetails: [
    {
      user: {
        id: 'user-john',
        name: 'John Doe'
      },
      incomeAllocationYen: 300000,
      householdShareYen: 90000,
      householdPaidYen: 100000,
      personalNetYen: -5000,
      finalBalanceYen: 5000
    },
    {
      user: {
        id: 'user-jane',
        name: 'Jane Doe'
      },
      incomeAllocationYen: 200000,
      householdShareYen: 60000,
      householdPaidYen: 50000,
      personalNetYen: 0,
      finalBalanceYen: -10000
    }
  ],
  ...overrides
});

// Request handlers
export const handlers = [
  // Authentication
  http.post('/api/v1/auth/login', async ({ request }) => {
    await delay(500); // Simulate network delay
    
    const { email, password } = await request.json() as any;
    
    if (email === 'admin@example.com' && password === 'password123') {
      return HttpResponse.json({
        user: {
          id: 'user-admin',
          name: 'Admin User',
          email: 'admin@example.com',
          role: 'admin',
          household: {
            id: 'mock-household',
            name: 'Mock Family'
          }
        },
        token: 'mock-admin-token',
        expiresAt: '2025-08-24T10:00:00Z'
      });
    }
    
    if (email === 'test@example.com' && password === 'password123') {
      return HttpResponse.json({
        user: {
          id: 'user-john',
          name: 'John Doe',
          email: 'test@example.com',
          role: 'member',
          household: {
            id: 'mock-household',
            name: 'Mock Family'
          }
        },
        token: 'mock-user-token',
        expiresAt: '2025-08-24T10:00:00Z'
      });
    }
    
    return HttpResponse.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      },
      { status: 401 }
    );
  }),

  http.post('/api/v1/auth/logout', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Transactions
  http.get('/api/v1/transactions', ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const cursor = url.searchParams.get('cursor');

    // Generate mock transactions
    let transactions = Array.from({ length: 25 }, (_, i) => 
      generateMockTransaction({
        amountYen: 1000 + i * 500,
        occurredOn: `2025-08-${String(Math.floor(i / 3) + 1).padStart(2, '0')}`,
        type: i % 4 === 0 ? 'INCOME' : 'EXPENSE',
        note: `Mock transaction ${i + 1}`
      })
    );

    // Apply filters
    if (from) {
      transactions = transactions.filter(t => t.occurredOn >= from);
    }
    if (to) {
      transactions = transactions.filter(t => t.occurredOn <= to);
    }
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }

    // Apply pagination
    let startIndex = 0;
    if (cursor) {
      const cursorData = JSON.parse(atob(cursor));
      startIndex = cursorData.offset || 0;
    }

    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < transactions.length;
    const nextCursor = hasMore ? btoa(JSON.stringify({ offset: startIndex + limit })) : null;

    return HttpResponse.json({
      data: paginatedTransactions,
      meta: {
        hasMore,
        nextCursor,
        count: paginatedTransactions.length,
        totalAmountYen: paginatedTransactions.reduce((sum, t) => 
          t.type === 'EXPENSE' ? sum + t.amountYen : sum, 0
        )
      }
    });
  }),

  http.post('/api/v1/transactions', async ({ request }) => {
    await delay(300);
    
    const transactionData = await request.json() as any;
    
    // Validate required fields
    if (!transactionData.amountYen || transactionData.amountYen <= 0) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: [{
              field: 'amountYen',
              code: 'POSITIVE_NUMBER_REQUIRED',
              message: 'Amount must be a positive number'
            }]
          }
        },
        { status: 400 }
      );
    }

    // Create mock transaction
    const newTransaction = generateMockTransaction({
      ...transactionData,
      bookedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return HttpResponse.json({ data: newTransaction }, { status: 201 });
  }),

  http.patch('/api/v1/transactions/:id', async ({ params, request }) => {
    await delay(200);
    
    const { id } = params;
    const updates = await request.json() as any;
    
    const updatedTransaction = generateMockTransaction({
      id: id as string,
      ...updates,
      updatedAt: new Date().toISOString()
    });

    return HttpResponse.json({ data: updatedTransaction });
  }),

  http.delete('/api/v1/transactions/:id', async ({ params }) => {
    await delay(200);
    // Soft delete - just return 204
    return new HttpResponse(null, { status: 204 });
  }),

  // Categories
  http.get('/api/v1/categories', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    
    let categories = [
      {
        id: 'cat-food',
        name: 'Food & Dining',
        type: 'EXPENSE',
        parentId: null,
        children: [
          { id: 'cat-groceries', name: 'Groceries', type: 'EXPENSE', parentId: 'cat-food' },
          { id: 'cat-restaurants', name: 'Restaurants', type: 'EXPENSE', parentId: 'cat-food' }
        ]
      },
      {
        id: 'cat-transport',
        name: 'Transportation',
        type: 'EXPENSE',
        parentId: null,
        children: []
      },
      {
        id: 'cat-salary',
        name: 'Salary',
        type: 'INCOME',
        parentId: null,
        children: []
      }
    ];

    if (type) {
      categories = categories.filter(c => c.type === type);
    }

    return HttpResponse.json({ data: categories });
  }),

  // Actors
  http.get('/api/v1/actors', () => {
    const actors = [
      {
        id: 'actor-john',
        kind: 'USER',
        userId: 'user-john',
        name: 'John Doe',
        isActive: true
      },
      {
        id: 'actor-jane',
        kind: 'USER',
        userId: 'user-jane', 
        name: 'Jane Doe',
        isActive: true
      },
      {
        id: 'actor-family-card',
        kind: 'INSTRUMENT',
        userId: null,
        name: 'Family Credit Card',
        isActive: true
      },
      {
        id: 'actor-cash',
        kind: 'INSTRUMENT',
        userId: null,
        name: 'Cash',
        isActive: true
      }
    ];

    return HttpResponse.json({ data: actors });
  }),

  // Settlements
  http.get('/api/v1/settlements/:month', ({ params }) => {
    const { month } = params;
    
    const settlement = generateMockSettlement({
      month: `${month}-01`
    });

    return HttpResponse.json({ data: settlement });
  }),

  http.post('/api/v1/settlements/:month/run', async ({ params }) => {
    await delay(2000); // Simulate settlement computation time
    
    const { month } = params;
    
    const settlement = generateMockSettlement({
      month: `${month}-01`,
      status: 'DRAFT',
      computedAt: new Date().toISOString()
    });

    return HttpResponse.json({ data: settlement });
  }),

  http.post('/api/v1/settlements/:id/finalize', async ({ params, request }) => {
    await delay(500);
    
    const { id } = params;
    const { notes } = await request.json() as any;
    
    return HttpResponse.json({
      data: {
        id: id as string,
        status: 'FINALIZED',
        finalizedAt: new Date().toISOString(),
        finalizedBy: {
          id: 'user-admin',
          name: 'Admin User'
        },
        notes
      }
    });
  }),

  // Reports
  http.get('/api/v1/reports/summary', ({ request }) => {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    
    return HttpResponse.json({
      data: {
        month: `${month}-01`,
        householdId: 'mock-household',
        summary: {
          totalIncomeYen: 750000,
          totalExpensesYen: 425000,
          netIncomeYen: 325000,
          transactionCount: 87,
          avgTransactionYen: 4885
        },
        byType: {
          EXPENSE: {
            totalYen: 425000,
            count: 75,
            avgYen: 5667
          },
          INCOME: {
            totalYen: 750000,
            count: 12,
            avgYen: 62500
          }
        },
        byShouldPay: {
          HOUSEHOLD: {
            totalYen: 380000,
            count: 68
          },
          USER: {
            totalYen: 45000,
            count: 7
          }
        },
        topCategories: [
          {
            category: {
              id: 'cat-groceries',
              name: 'Groceries'
            },
            totalYen: 85000,
            count: 12,
            percentage: 20.0
          },
          {
            category: {
              id: 'cat-restaurants',
              name: 'Restaurants'
            },
            totalYen: 45000,
            count: 8,
            percentage: 10.6
          }
        ]
      }
    });
  }),

  // Error scenarios for testing
  http.get('/api/v1/transactions/error', () => {
    return HttpResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong',
          requestId: 'mock-request-id'
        }
      },
      { status: 500 }
    );
  }),

  // Network timeout simulation
  http.get('/api/v1/transactions/timeout', async () => {
    await delay(30000); // Simulate timeout
    return HttpResponse.json({ data: [] });
  }),

  // Rate limit simulation
  http.get('/api/v1/transactions/rate-limit', () => {
    return HttpResponse.json(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          details: {
            limit: 1000,
            window: '1 hour',
            resetAt: '2025-08-23T16:00:00Z'
          }
        }
      },
      { 
        status: 429,
        headers: {
          'Retry-After': '3600'
        }
      }
    );
  })
];

// Browser setup
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Node.js setup for testing
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Test Integration

```typescript
// src/setupTests.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

// Establish API mocking before all tests
beforeAll(() => server.listen());

// Reset any request handlers between tests
afterEach(() => server.resetHandlers());

// Clean up after tests are finished
afterAll(() => server.close());

// Mock intersectionObserver for testing
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver for chart components
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  })
});
```

### Scenario-Based Testing

```typescript
// src/mocks/scenarios.ts
import { http, HttpResponse } from 'msw';

export const errorScenarios = [
  // Network failure
  http.get('/api/v1/transactions', () => {
    return HttpResponse.error();
  }),

  // Server error
  http.post('/api/v1/transactions', () => {
    return HttpResponse.json(
      {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database connection failed'
        }
      },
      { status: 500 }
    );
  }),

  // Validation error
  http.post('/api/v1/transactions', () => {
    return HttpResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: [
            {
              field: 'amountYen',
              code: 'REQUIRED',
              message: 'Amount is required'
            }
          ]
        }
      },
      { status: 400 }
    );
  })
];

export const loadingScenarios = [
  // Slow response
  http.get('/api/v1/transactions', async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return HttpResponse.json({ data: [] });
  })
];

export const emptyDataScenarios = [
  // No transactions
  http.get('/api/v1/transactions', () => {
    return HttpResponse.json({
      data: [],
      meta: {
        hasMore: false,
        nextCursor: null,
        count: 0
      }
    });
  }),

  // No categories
  http.get('/api/v1/categories', () => {
    return HttpResponse.json({ data: [] });
  })
];

// Usage in tests
describe('Error Handling', () => {
  test('handles network failure', async () => {
    server.use(...errorScenarios);
    
    render(<TransactionList />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to load transactions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  test('shows loading state', async () => {
    server.use(...loadingScenarios);
    
    render(<TransactionList />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('handles empty state', async () => {
    server.use(...emptyDataScenarios);
    
    render(<TransactionList />);
    
    await waitFor(() => {
      expect(screen.getByText('No transactions found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeInTheDocument();
    });
  });
});
```

---

## TodoWrite

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Create the main design document", "status": "completed", "activeForm": "Creating the main design document"}, {"content": "Create API specification document", "status": "completed", "activeForm": "Creating API specification document"}, {"content": "Create database schema document", "status": "completed", "activeForm": "Creating database schema document"}, {"content": "Create testing strategy document", "status": "completed", "activeForm": "Creating testing strategy document"}]