# NestEgg: Household Budgeting Web Application - Design Document

**Date:** 2025-08-23  
**Version:** 1.0  
**Audience:** Developers, maintainers  
**Language:** English (JPY-only, self-hosted, frontend/backend separated)

---

## Table of Contents

1. [Goals & Scope](#1-goals--scope)
2. [Architecture Overview](#2-architecture-overview)
3. [Security & Access Control](#3-security--access-control)
4. [Data Model](#4-data-model)
5. [Business Rules](#5-business-rules)
6. [JSON Web API](#6-json-web-api)
7. [Month-End Settlement Algorithm](#7-month-end-settlement-algorithm)
8. [Validation & Consistency](#8-validation--consistency)
9. [Testing Strategy](#9-testing-strategy)
10. [Observability & Operations](#10-observability--operations)
11. [Deployment](#11-deployment)
12. [UI/UX Guidelines](#12-uiux-guidelines)
13. [Example Workflows](#13-example-workflows)
14. [Design Decisions](#14-design-decisions)

---

## 1. Goals & Scope

### 1.1 Primary Goal
Record household expenses and incomes with "who should pay" semantics, producing an idempotent month-end settlement that nets reimbursements and household-shared costs. Provide a JSON Web API for external clients beyond the web UI.

### 1.2 In Scope
- ✅ Self-hosted on home server (LAN; optionally reachable over VPN/HTTPS)
- ✅ Frontend and backend fully separated; API over HTTPS (JSON only)
- ✅ Register expenses/incomes per person with non-user payment actors support (e.g., family card)
- ✅ Define "who should pay" as **HOUSEHOLD** or **USER** with month-end settlement
- ✅ JPY only (integer yen) - no multi-currency support
- ✅ Visualization dashboards and downloadable exports
- ✅ Soft deletion with full audit trail
- ✅ External API access via Personal Access Tokens (PAT)

### 1.3 Out of Scope
- ❌ Multi-currency/FX support
- ❌ OCR receipt processing
- ❌ Budget alerts and notifications
- ❌ Bank account integration (may come later)

---

## 2. Architecture Overview

```
┌─────────────────────┐    HTTPS/JSON    ┌─────────────────────┐    SQL    ┌─────────────────┐
│  React Frontend     │ ◄─────────────── │  Backend API        │ ◄──────── │   PostgreSQL    │
│  (TypeScript)       │                  │  (NestJS/TypeScript)│           │                 │
└─────────────────────┘                  └─────────────────────┘           └─────────────────┘
          ▲                                        │
          │                                        ▼
┌─────────────────────┐                  ┌─────────────────────┐
│  Reverse Proxy      │                  │  Month-End Job      │
│  (Nginx/Caddy)      │                  │  (Cron, Asia/Tokyo) │
└─────────────────────┘                  └─────────────────────┘
```

### 2.1 Technology Stack
- **Backend:** NestJS with TypeScript
- **Database:** PostgreSQL 15+
- **ORM:** Prisma
- **Validation:** class-validator, class-transformer
- **Frontend:** React 19 with TypeScript
- **Build Tool:** Vite
- **Data Fetching:** React Query (TanStack Query)
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Testing:** Jest (backend), Vitest (frontend), Playwright (E2E)
- **Timezone:** Asia/Tokyo end-to-end

---

## 3. Security & Access Control

### 3.1 Authentication Modes
1. **Web Session:** HttpOnly cookies (Secure, SameSite=Lax/Strict)
2. **External API:** Personal Access Token (PAT) via Bearer authentication
3. **API Keys:** Revocable and scoped tokens for external clients

### 3.2 Authorization Strategy
- **Row-Level Security (RLS):** All data queries constrained by `household_id`
- **Role-Based Access:** Admin and member roles per household
- **Token Scopes:** Fine-grained permissions for API tokens

### 3.3 Security Measures
- **CORS:** Allowlisted origins for external JSON clients
- **CSRF Protection:** Double-submit cookies for session-based auth
- **Audit Logging:** All mutations recorded with who/when/what
- **Soft Deletion:** No hard deletes, full audit trail maintained
- **Idempotency:** `Idempotency-Key` header support for POST operations

---

## 4. Data Model

### 4.1 Core Entities

All monetary amounts stored as **integer yen** using `BIGINT` (`amount_yen`).

```sql
-- Household isolation
households(id, name, created_at, updated_at)

-- Users within household
users(id, household_id, email, name, role, password_hash, created_at, updated_at, deleted_at)

-- Payment actors (users or instruments like family cards)
actors(id, household_id, kind, user_id?, name, is_active)
  -- kind: 'USER' | 'INSTRUMENT'
  -- user_id: present if kind='USER'

-- Hierarchical categories
categories(id, household_id, name, parent_id?, type)
  -- type: 'EXPENSE' | 'INCOME'

-- Main transaction record
transactions(
  id, household_id, type, amount_yen, occurred_on, booked_at,
  category_id, payer_actor_id, payer_user_id?,
  should_pay, should_pay_user_id?,
  note, tags[], source_hash?, deleted_at?
)
  -- should_pay: 'HOUSEHOLD' | 'USER'
  -- should_pay_user_id: required if should_pay='USER'

-- Monthly income records
incomes(
  id, household_id, user_id, month,
  gross_yen, deduction_tax_yen, deduction_social_yen, deduction_other_yen,
  allocatable_yen -- computed column
)

-- Month-end settlements
settlements(id, household_id, month, status, computed_at)
  -- status: 'DRAFT' | 'FINALIZED'

settlement_lines(id, settlement_id, from_user_id, to_user_id, amount_yen)

-- Household policies
policy(household_id, apportionment_zero_income, rounding)
  -- apportionment_zero_income: 'EXCLUDE' | 'MIN_SHARE'
  -- rounding: 'BANKERS' | 'ROUND' | 'FLOOR'

-- Audit trail
audit_log(id, household_id, user_id?, at, action, detail)
```

### 4.2 Row-Level Security (RLS)
Every table includes `household_id` with RLS policy:
```sql
CREATE POLICY household_isolation ON transactions
  FOR ALL TO app_role
  USING (household_id = current_setting('app.household_id')::uuid);
```

Backend sets `SET app.household_id = '<uuid>'` per authenticated request.

---

## 5. Business Rules

### 5.1 Household Expense Apportionment

**Scope:** `transactions.type='EXPENSE' AND should_pay='HOUSEHOLD'` for month **M**

**Algorithm:**
1. Calculate total allocatable income per user: `I_u = incomes.allocatable_yen` for month **M**
2. Compute weights: `w_u = I_u / Σ I_u`
3. Handle zero income users per policy:
   - `EXCLUDE` (default): Exclude from denominator
   - `MIN_SHARE`: Assign minimal equal weight
4. Calculate shares: `share_u = round(E * w_u)` where `E = Σ amount_yen`
5. Apply residual correction to ensure `Σ share_u = E`

### 5.2 Personal Reimbursements

For `should_pay='USER'` transactions:
- If `payer_actor_id` belongs to **user A** and `should_pay_user_id` is **user B**
- Then **user B owes user A** the `amount_yen`

### 5.3 Month-End Net Settlement (Idempotent)

**Steps:**
1. Load all transactions for target month **M**
2. Calculate household expense shares per user
3. Calculate actual household payments per user
4. Compute household balance deltas: `delta_u = paid_u - share_u`
5. Build reimbursement matrix from personal expenses
6. Merge deltas and reimbursements into net balances
7. Apply greedy netting algorithm to minimize transfer count
8. Persist as `settlement_lines` with status `DRAFT`

**Idempotency:** Re-running same month replaces existing `DRAFT`. `FINALIZED` settlements require explicit versioning.

### 5.4 Settlement and Transaction Integrity

- Soft-deleted transactions affect settlements if in a `FINALIZED` month
- Editing transactions in `FINALIZED` months requires creating new settlement version
- All changes maintain full audit trail

---

## 6. JSON Web API

**Base URL:** `/api/v1` (JSON only)

### 6.1 Authentication Endpoints

```http
POST /api/v1/auth/login
Content-Type: application/json
{ "email": "user@example.com", "password": "secret" }

POST /api/v1/auth/tokens  # Create PAT (admin only)
Authorization: Bearer <token>
{ "name": "My API Client", "scopes": ["transactions:read", "transactions:write"] }

GET /api/v1/auth/tokens   # List PATs
DELETE /api/v1/auth/tokens/:id  # Revoke PAT
```

### 6.2 Core Resource Endpoints

**Users & Actors:**
```http
GET /api/v1/me
GET /api/v1/users
GET /api/v1/actors
POST /api/v1/actors
{ "kind": "INSTRUMENT", "name": "Family Card" }
PATCH /api/v1/actors/:id
{ "name": "Updated Name", "is_active": false }
```

**Categories:**
```http
GET /api/v1/categories?type=EXPENSE
POST /api/v1/categories
{ "name": "Groceries", "parent_id": "uuid-food", "type": "EXPENSE" }
```

**Transactions:**
```http
GET /api/v1/transactions?from=2025-08-01&to=2025-08-31&type=EXPENSE
POST /api/v1/transactions
{
  "type": "EXPENSE",
  "amount_yen": 4200,
  "occurred_on": "2025-08-18",
  "category_id": "uuid-groceries",
  "payer_actor_id": "uuid-family-card",
  "should_pay": "HOUSEHOLD",
  "note": "Weekly groceries",
  "tags": ["supermarket", "food"]
}
PATCH /api/v1/transactions/:id
DELETE /api/v1/transactions/:id  # Soft delete
```

**Settlements:**
```http
POST /api/v1/settlements/2025-08/run  # Idempotent settlement computation
GET /api/v1/settlements/2025-08
POST /api/v1/settlements/:id/finalize
```

### 6.3 Error Handling & Conventions

**Error Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid transaction data",
    "details": {
      "field": "amount_yen",
      "reason": "Must be positive integer"
    }
  }
}
```

**Features:**
- Cursor-based pagination for large datasets
- Idempotency key support: `Idempotency-Key: <uuid>`
- Rate limiting per token/IP
- Comprehensive OpenAPI 3.0 specification

---

## 7. Month-End Settlement Algorithm

### 7.1 Cron Job Configuration
- **Schedule:** `0 2 1 * *` (02:00 JST on 1st of each month)
- **On-demand:** Via API endpoint
- **Concurrency:** PostgreSQL advisory locks per `(household_id, month)`

### 7.2 Algorithm Implementation

```typescript
async function runSettlement(householdId: string, month: YearMonth): Promise<Settlement> {
  return withAdvisoryLock(householdId, month, async () => {
    // 1. Load data
    const transactions = await loadMonthTransactions(householdId, month);
    const incomes = await loadMonthIncomes(householdId, month);
    const policy = await getHouseholdPolicy(householdId);
    
    // 2. Compute household expense apportionment
    const householdExpenses = transactions.filter(t => 
      t.type === 'EXPENSE' && t.shouldPay === 'HOUSEHOLD'
    );
    const weights = computeIncomeWeights(incomes, policy);
    const shares = apportionExpenses(householdExpenses, weights, policy.rounding);
    
    // 3. Calculate actual payments per user
    const actualPayments = calculateActualPayments(householdExpenses);
    const householdDeltas = computeDeltas(actualPayments, shares);
    
    // 4. Build reimbursement matrix
    const personalExpenses = transactions.filter(t => 
      t.type === 'EXPENSE' && t.shouldPay === 'USER'
    );
    const reimbursements = buildReimbursementMatrix(personalExpenses);
    
    // 5. Net settlement with greedy algorithm
    const balances = mergeBalances(householdDeltas, reimbursements);
    const settlementLines = greedyNetting(balances);
    
    // 6. Persist results
    const settlement = await upsertDraftSettlement(householdId, month, settlementLines);
    await auditLog('SETTLEMENT_RUN', { month, lineCount: settlementLines.length });
    
    return settlement;
  });
}
```

### 7.3 Greedy Netting Algorithm

```typescript
function greedyNetting(balances: Map<UserId, number>): SettlementLine[] {
  const payers = Array.from(balances.entries())
    .filter(([_, balance]) => balance < 0)
    .sort((a, b) => a[1] - b[1]); // Most negative first
    
  const receivers = Array.from(balances.entries())
    .filter(([_, balance]) => balance > 0)
    .sort((a, b) => b[1] - a[1]); // Most positive first
    
  const lines: SettlementLine[] = [];
  
  for (const [payerId, payerBalance] of payers) {
    let remaining = Math.abs(payerBalance);
    
    for (const [receiverId, receiverBalance] of receivers) {
      if (remaining === 0 || receiverBalance === 0) continue;
      
      const transferAmount = Math.min(remaining, receiverBalance);
      
      lines.push({
        fromUserId: payerId,
        toUserId: receiverId,
        amountYen: transferAmount
      });
      
      remaining -= transferAmount;
      balances.set(receiverId, receiverBalance - transferAmount);
    }
  }
  
  return lines;
}
```

---

## 8. Validation & Consistency

### 8.1 Data Validation Rules

**Transaction Validation:**
```typescript
class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: 'EXPENSE' | 'INCOME';
  
  @IsInt()
  @Min(1)
  amount_yen: number; // Must be positive integer
  
  @IsDateString()
  occurred_on: string; // Cannot be future date
  
  @IsUUID()
  category_id: string;
  
  @IsUUID()
  payer_actor_id: string; // Must belong to household
  
  @IsEnum(['HOUSEHOLD', 'USER'])
  should_pay: 'HOUSEHOLD' | 'USER';
  
  @ValidateIf(o => o.should_pay === 'USER')
  @IsUUID()
  should_pay_user_id?: string; // Required when should_pay='USER'
  
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
  
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

### 8.2 Business Rule Constraints

1. **Actor Validation:** `payer_actor_id` must belong to same household
2. **User Assignment:** `should_pay_user_id` must be household member when specified
3. **Category Matching:** Transaction type must match category type
4. **Settlement Protection:** Cannot edit transactions in `FINALIZED` settlement months without versioning
5. **Date Constraints:** `occurred_on` cannot exceed current date + grace period

### 8.3 Database Constraints

```sql
-- Ensure positive amounts
ALTER TABLE transactions ADD CONSTRAINT positive_amount 
  CHECK (amount_yen > 0);

-- Ensure should_pay_user_id when should_pay='USER'
ALTER TABLE transactions ADD CONSTRAINT user_assignment
  CHECK (
    (should_pay = 'HOUSEHOLD' AND should_pay_user_id IS NULL) OR
    (should_pay = 'USER' AND should_pay_user_id IS NOT NULL)
  );

-- Unique settlement per household per month
ALTER TABLE settlements ADD CONSTRAINT unique_household_month
  UNIQUE (household_id, month);
```

---

## 9. Testing Strategy

### 9.1 Test Pyramid

```
    ┌─────────────────┐
    │   E2E Tests     │  ← Playwright (critical user journeys)
    │   (Slow, Few)   │
    ├─────────────────┤
    │ Integration     │  ← API contracts, DB integration
    │ Tests (Medium)  │
    ├─────────────────┤
    │  Unit Tests     │  ← Business logic, utilities
    │  (Fast, Many)   │
    └─────────────────┘
```

### 9.2 Unit Testing Focus

**Backend (Jest + Supertest):**
```typescript
describe('Settlement Algorithm', () => {
  test('apportions expenses by income ratio', () => {
    const incomes = [
      { userId: 'user1', allocatableYen: 300000 },
      { userId: 'user2', allocatableYen: 200000 }
    ];
    const totalExpense = 50000;
    
    const shares = apportionExpenses(totalExpense, incomes, 'ROUND');
    
    expect(shares).toEqual([
      { userId: 'user1', shareYen: 30000 }, // 60% of 50000
      { userId: 'user2', shareYen: 20000 }  // 40% of 50000
    ]);
  });
  
  test('handles residual correction for rounding', () => {
    // Property test: sum of shares always equals total expense
    expect(shares.reduce((sum, s) => sum + s.shareYen, 0)).toBe(totalExpense);
  });
});
```

**Frontend (Vitest + Testing Library):**
```typescript
describe('TransactionForm', () => {
  test('validates required fields', async () => {
    render(<TransactionForm />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    
    await waitFor(() => {
      expect(screen.getByText('Amount is required')).toBeInTheDocument();
      expect(screen.getByText('Category is required')).toBeInTheDocument();
    });
  });
});
```

### 9.3 Mock Service Worker (MSW) Setup

**Frontend API Mocking:**
```typescript
// src/mocks/handlers.ts
export const handlers = [
  http.get('/api/v1/transactions', ({ request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    
    return HttpResponse.json({
      data: mockTransactions.filter(t => 
        t.occurred_on >= from && t.occurred_on <= to
      ),
      pagination: { next_cursor: null }
    });
  }),
  
  http.post('/api/v1/transactions', async ({ request }) => {
    const newTransaction = await request.json();
    const created = { ...newTransaction, id: uuid() };
    mockTransactions.push(created);
    return HttpResponse.json(created, { status: 201 });
  })
];
```

### 9.4 Contract Testing

**OpenAPI Validation:**
```typescript
// Ensure API responses match OpenAPI spec
import { OpenAPIV3 } from 'openapi-types';
import Ajv from 'ajv';

describe('API Contract Tests', () => {
  test('GET /transactions matches OpenAPI schema', async () => {
    const response = await request(app).get('/api/v1/transactions');
    const validator = ajv.compile(openApiSpec.paths['/transactions'].get.responses['200'].content['application/json'].schema);
    
    expect(validator(response.body)).toBe(true);
  });
});
```

### 9.5 E2E Testing with Playwright

**Critical User Journey:**
```typescript
test('complete expense tracking workflow', async ({ page }) => {
  // Setup: Login and navigate
  await page.goto('/login');
  await page.fill('[data-testid=email]', 'test@example.com');
  await page.fill('[data-testid=password]', 'password');
  await page.click('[data-testid=login-button]');
  
  // Add new expense
  await page.goto('/transactions');
  await page.click('[data-testid=add-transaction]');
  await page.fill('[data-testid=amount]', '1500');
  await page.selectOption('[data-testid=category]', 'groceries');
  await page.selectOption('[data-testid=payer]', 'family-card');
  await page.check('[data-testid=household-expense]');
  await page.fill('[data-testid=note]', 'Weekly groceries');
  await page.click('[data-testid=save]');
  
  // Verify transaction appears in list
  await expect(page.locator('[data-testid=transaction-item]')).toContainText('¥1,500');
  await expect(page.locator('[data-testid=transaction-item]')).toContainText('Weekly groceries');
  
  // Run settlement
  await page.goto('/settlements');
  await page.click('[data-testid=run-settlement]');
  await expect(page.locator('[data-testid=settlement-status]')).toContainText('DRAFT');
  
  // Finalize settlement
  await page.click('[data-testid=finalize-settlement]');
  await expect(page.locator('[data-testid=settlement-status]')).toContainText('FINALIZED');
});
```

### 9.6 Test Data Management

**Deterministic Fixtures:**
```typescript
export const testHousehold = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test Household',
  users: [
    { id: 'user1', name: 'Alice', email: 'alice@test.com' },
    { id: 'user2', name: 'Bob', email: 'bob@test.com' }
  ]
};

export const testTransactions = [
  {
    id: 'tx1',
    type: 'EXPENSE',
    amount_yen: 5000,
    occurred_on: '2025-08-15',
    category_id: 'cat-groceries',
    payer_actor_id: 'actor-alice',
    should_pay: 'HOUSEHOLD'
  }
  // ... more test data
];
```

---

## 10. Observability & Operations

### 10.1 Health Monitoring

**Health Check Endpoint:**
```typescript
@Get('/healthz')
async healthCheck(): Promise<HealthStatus> {
  const checks = await Promise.all([
    this.databaseService.checkConnection(),
    this.migrationService.checkStatus(),
    this.redisService.checkConnection() // if using Redis for sessions
  ]);
  
  return {
    status: checks.every(c => c.healthy) ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: checks[0],
      migrations: checks[1],
      cache: checks[2]
    }
  };
}
```

### 10.2 Structured Logging

**Log Configuration (Pino):**
```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: 'nestegg-api'
    })
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err
  }
});
```

**Key Events to Log:**
- Authentication attempts (success/failure)
- API requests with duration
- Settlement computations
- Database migrations
- Error conditions with full context
- Audit events (mirrored to audit_log table)

### 10.3 Metrics & Monitoring

**Custom Metrics:**
```typescript
import { Registry, Counter, Histogram } from 'prom-client';

const transactionCounter = new Counter({
  name: 'nestegg_transactions_total',
  help: 'Total number of transactions created',
  labelNames: ['household_id', 'type']
});

const settlementDuration = new Histogram({
  name: 'nestegg_settlement_duration_seconds',
  help: 'Time taken to compute settlements',
  labelNames: ['household_id', 'month']
});
```

### 10.4 Error Handling & Alerting

**Global Exception Filter:**
```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : 500;
    
    this.logger.error({
      err: exception,
      req: request,
      statusCode: status
    }, 'Unhandled exception');
    
    // Alert on 5xx errors
    if (status >= 500) {
      this.alertingService.sendAlert({
        severity: 'error',
        message: `API Error: ${exception.message}`,
        context: { path: request.url, method: request.method }
      });
    }
    
    response.status(status).json({
      error: {
        code: this.getErrorCode(exception),
        message: this.getErrorMessage(exception),
        timestamp: new Date().toISOString(),
        path: request.url
      }
    });
  }
}
```

---

## 11. Deployment

### 11.1 Docker Compose Setup

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  reverse-proxy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
      - frontend

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://nestegg:${DB_PASSWORD}@db:5432/nestegg
      SESSION_SECRET: ${SESSION_SECRET}
      NODE_ENV: production
      TZ: Asia/Tokyo
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    environment:
      VITE_API_BASE_URL: /api/v1
    depends_on:
      - backend

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: nestegg
      POSTGRES_USER: nestegg
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backup:
    image: postgres:15-alpine
    environment:
      PGPASSWORD: ${DB_PASSWORD}
    volumes:
      - ./backups:/backups
    command: |
      sh -c '
        while true; do
          pg_dump -h db -U nestegg -Fc nestegg > /backups/nestegg_$(date +%Y%m%d_%H%M%S).dump
          find /backups -name "*.dump" -mtime +7 -delete
          sleep 86400
        done
      '
    depends_on:
      - db

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

### 11.2 Environment Configuration

**.env file:**
```bash
# Database
DB_PASSWORD=your_secure_password_here

# Application
SESSION_SECRET=your_session_secret_32_chars_min
JWT_SECRET=your_jwt_secret_for_api_tokens

# Optional: External access
ALLOWED_ORIGINS=https://your-domain.com,https://192.168.1.100

# Backup retention
BACKUP_RETENTION_DAYS=30
```

### 11.3 Reverse Proxy Configuration

**Caddyfile:**
```caddyfile
nestegg.home.local {
  # Frontend
  handle /* {
    reverse_proxy frontend:3000
  }
  
  # API
  handle /api/* {
    reverse_proxy backend:3000
  }
  
  # Security headers
  header {
    X-Frame-Options DENY
    X-Content-Type-Options nosniff
    Referrer-Policy strict-origin-when-cross-origin
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
  }
  
  # Optional: Enable TLS for local CA
  tls internal
}
```

### 11.4 Production Considerations

**Security Hardening:**
- Use non-root user in Docker containers
- Enable PostgreSQL SSL connections
- Implement rate limiting at reverse proxy level
- Regular security updates for base images

**Backup Strategy:**
- Daily PostgreSQL dumps with compression
- Retention: Daily (7 days), Weekly (4 weeks), Monthly (12 months)
- Test restore procedures monthly
- Off-site backup storage (optional)

**Monitoring Setup:**
- Prometheus metrics collection
- Grafana dashboards for visualization
- Log aggregation with Loki or ELK stack
- Uptime monitoring with external service

---

## 12. UI/UX Guidelines

### 12.1 Core User Interfaces

**Primary Screens:**
1. **Dashboard** - Monthly summary, recent transactions, quick actions
2. **Transactions** - List/create/edit expenses and incomes
3. **Categories** - Manage expense and income categories
4. **Actors** - Manage payment methods (users, cards, etc.)
5. **Settlements** - View and manage month-end calculations
6. **Reports** - Charts and export functionality
7. **Settings** - Household configuration, user management

### 12.2 Input Speed Optimizations

**Quick Entry Features:**
- Recent categories dropdown with keyboard navigation
- Tag autocomplete with chip selection
- "Duplicate last transaction" with one-click edit
- Keyboard shortcuts for common actions (Ctrl+N for new transaction)
- Undo last action (5-second window)

**Form Enhancements:**
```typescript
// Smart defaults based on user patterns
const useSmartDefaults = (userId: string) => {
  const { data: recentTransactions } = useQuery(['recent-transactions', userId], 
    () => api.getRecentTransactions(userId, 5)
  );
  
  return {
    suggestedCategory: recentTransactions?.[0]?.category_id,
    suggestedActor: recentTransactions?.[0]?.payer_actor_id,
    suggestedTags: getMostUsedTags(recentTransactions)
  };
};
```

### 12.3 Number Formatting & Localization

**Japanese Yen Display:**
```typescript
const formatYen = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Examples:
// formatYen(1500) => "¥1,500"
// formatYen(123456) => "¥123,456"
```

**Date Formatting:**
```typescript
const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tokyo'
  }).format(new Date(date));
};
```

### 12.4 Accessibility Guidelines

**Keyboard Navigation:**
- Tab order follows logical flow
- All interactive elements focusable
- Skip links for main content areas
- Keyboard shortcuts documented and accessible

**Screen Reader Support:**
```jsx
<button 
  aria-label={`Delete transaction: ${transaction.note || 'Unnamed'} for ${formatYen(transaction.amount_yen)}`}
  onClick={() => handleDelete(transaction.id)}
>
  <TrashIcon aria-hidden="true" />
</button>

<input
  type="number"
  aria-label="Transaction amount in yen"
  aria-describedby="amount-help"
  {...register('amount_yen')}
/>
<div id="amount-help" className="sr-only">
  Enter the amount in Japanese yen without decimal places
</div>
```

**Visual Accessibility:**
- High contrast mode support
- Minimum 4.5:1 color contrast ratio
- Focus indicators clearly visible
- Text scalable to 200% without horizontal scrolling

### 12.5 Responsive Design

**Breakpoints:**
```css
/* Mobile First Approach */
.transaction-form {
  @apply flex flex-col gap-4;
}

/* Tablet and up */
@media (min-width: 768px) {
  .transaction-form {
    @apply grid grid-cols-2 gap-6;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .transaction-form {
    @apply grid-cols-3;
  }
}
```

**Mobile Optimizations:**
- Touch-friendly button sizes (minimum 44px)
- Swipe gestures for transaction actions
- Bottom sheet modals for forms
- Optimized keyboard types (numeric for amounts)

### 12.6 State Management & Loading States

**Optimistic Updates:**
```typescript
const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: api.createTransaction,
    onMutate: async (newTransaction) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['transactions']);
      
      // Snapshot previous value
      const previousTransactions = queryClient.getQueryData(['transactions']);
      
      // Optimistically update
      queryClient.setQueryData(['transactions'], (old: Transaction[]) => [
        { ...newTransaction, id: 'temp-' + Date.now() },
        ...old
      ]);
      
      return { previousTransactions };
    },
    onError: (err, newTransaction, context) => {
      // Rollback on error
      queryClient.setQueryData(['transactions'], context?.previousTransactions);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries(['transactions']);
    }
  });
};
```

---

## 13. Example Workflows

### 13.1 External API Client Integration

**Creating a PAT:**
```bash
# Admin creates API token
curl -X POST https://nestegg.home.local/api/v1/auth/tokens \
  -H 'Authorization: Bearer <admin-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Budget Tracking Script",
    "scopes": ["transactions:read", "transactions:write", "settlements:read"]
  }'

# Response:
{
  "id": "token-uuid",
  "name": "Budget Tracking Script", 
  "token": "nestegg_pat_1234567890abcdef...",
  "scopes": ["transactions:read", "transactions:write", "settlements:read"],
  "created_at": "2025-08-23T10:00:00Z"
}
```

**Using the PAT:**
```bash
# Add expense via external script
curl -X POST https://nestegg.home.local/api/v1/transactions \
  -H 'Authorization: Bearer nestegg_pat_1234567890abcdef...' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: script-2025-08-23-001' \
  -d '{
    "type": "EXPENSE",
    "amount_yen": 2800,
    "occurred_on": "2025-08-23",
    "category_id": "uuid-restaurant",
    "payer_actor_id": "uuid-family-card",
    "should_pay": "HOUSEHOLD",
    "note": "Lunch with team",
    "tags": ["business", "meal"]
  }'
```

### 13.2 Complete Settlement Workflow

**1. Record Monthly Incomes:**
```http
POST /api/v1/incomes
{
  "user_id": "alice-uuid",
  "month": "2025-08-01",
  "gross_yen": 400000,
  "deduction_tax_yen": 80000,
  "deduction_social_yen": 60000,
  "deduction_other_yen": 10000
}
```

**2. Track Expenses Throughout Month:**
```http
POST /api/v1/transactions
{
  "type": "EXPENSE",
  "amount_yen": 15000,
  "occurred_on": "2025-08-15", 
  "category_id": "groceries-uuid",
  "payer_actor_id": "alice-uuid",
  "should_pay": "HOUSEHOLD"
}

POST /api/v1/transactions  
{
  "type": "EXPENSE",
  "amount_yen": 3000,
  "occurred_on": "2025-08-20",
  "category_id": "coffee-uuid", 
  "payer_actor_id": "bob-uuid",
  "should_pay": "USER",
  "should_pay_user_id": "alice-uuid"
}
```

**3. Run Month-End Settlement:**
```http
POST /api/v1/settlements/2025-08/run

# Response:
{
  "id": "settlement-uuid",
  "household_id": "household-uuid",
  "month": "2025-08-01",
  "status": "DRAFT",
  "computed_at": "2025-09-01T02:00:00Z",
  "lines": [
    {
      "from_user_id": "bob-uuid",
      "to_user_id": "alice-uuid", 
      "amount_yen": 8500,
      "description": "Net settlement for August 2025"
    }
  ]
}
```

**4. Review and Finalize:**
```http
GET /api/v1/settlements/2025-08
# Review the draft settlement

POST /api/v1/settlements/settlement-uuid/finalize
# Lock the settlement
```

### 13.3 Data Import Workflow

**CSV Import Process:**
```typescript
// 1. Upload CSV file
const formData = new FormData();
formData.append('file', csvFile);
formData.append('source', 'bank_export');

const uploadResponse = await fetch('/api/v1/imports/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

const { file_id } = await uploadResponse.json();

// 2. Configure field mapping
const mappingResponse = await fetch('/api/v1/imports/preview', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_id,
    mapping: {
      date_column: 'Transaction Date',
      amount_column: 'Amount',
      description_column: 'Description',
      category_mapping: {
        'GROCERY STORE': 'groceries-uuid',
        'GAS STATION': 'transportation-uuid'
      }
    }
  })
});

// 3. Execute import with deduplication
const importResponse = await fetch('/api/v1/imports/execute', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_id,
    mapping,
    default_payer_actor_id: 'family-card-uuid',
    default_should_pay: 'HOUSEHOLD'
  })
});

const result = await importResponse.json();
// { imported: 23, skipped: 2, errors: 0 }
```

### 13.4 Report Generation

**Monthly Category Breakdown:**
```http
GET /api/v1/reports/category-breakdown?month=2025-08

{
  "month": "2025-08-01",
  "total_expenses": 450000,
  "total_incomes": 800000,
  "categories": [
    {
      "id": "groceries-uuid",
      "name": "Groceries", 
      "type": "EXPENSE",
      "amount_yen": 85000,
      "transaction_count": 12,
      "percentage": 18.9
    },
    {
      "id": "restaurants-uuid",
      "name": "Restaurants",
      "type": "EXPENSE", 
      "amount_yen": 45000,
      "transaction_count": 8,
      "percentage": 10.0
    }
  ]
}
```

**User Balance Summary:**
```http
GET /api/v1/reports/user-balance?month=2025-08

{
  "month": "2025-08-01",
  "users": [
    {
      "id": "alice-uuid",
      "name": "Alice",
      "income": {
        "gross_yen": 400000,
        "allocatable_yen": 250000
      },
      "expenses": {
        "household_share_yen": 225000,
        "household_paid_yen": 180000,
        "personal_paid_yen": 15000,
        "personal_owed_yen": 3000
      },
      "net_balance_yen": -63000
    }
  ]
}
```

---

## 14. Design Decisions

### 14.1 Key Architectural Choices

**1. JPY-Only with Integer Storage**
- **Decision:** Store all amounts as `BIGINT` representing integer yen
- **Rationale:** Avoids floating-point precision issues, simplifies calculations
- **Trade-off:** Cannot handle sub-yen precision, but not needed for household budgeting

**2. Payment Actor Model**
- **Decision:** Separate `actors` table for both user and non-user payment methods
- **Rationale:** Supports family cards, cash, gift cards without requiring bank accounts
- **Trade-off:** Slight complexity increase, but much more flexible than account-only model

**3. Idempotent Settlement Algorithm**
- **Decision:** Month-end calculations can be re-run safely with same results
- **Rationale:** Enables corrections, debugging, and reliable automation
- **Trade-off:** More complex implementation than append-only settlements

**4. Row-Level Security (RLS)**
- **Decision:** Enforce data isolation at PostgreSQL level
- **Rationale:** Defense-in-depth, prevents application bugs from leaking data
- **Trade-off:** Requires careful session management, slight performance overhead

**5. Soft Deletion with Audit Trail**
- **Decision:** Never hard delete data, maintain complete audit log
- **Rationale:** Financial data requires strong auditability and recoverability
- **Trade-off:** Database size growth over time, query complexity for filtering deleted records

### 14.2 Technology Justifications

**Frontend: React 19 + TypeScript + Vite**
- **Pros:** Modern, fast development, excellent TypeScript support, strong ecosystem
- **Cons:** JavaScript fatigue, bundle size considerations
- **Alternative considered:** Vue.js, Svelte

**Backend: NestJS + TypeScript**
- **Pros:** Structured framework, excellent TypeScript integration, dependency injection
- **Cons:** Learning curve, potentially over-engineered for simple APIs
- **Alternative considered:** Express.js, Fastify

**Database: PostgreSQL + Prisma**
- **Pros:** ACID compliance, JSON support, mature RLS implementation, excellent Prisma integration
- **Cons:** Resource requirements higher than SQLite
- **Alternative considered:** SQLite (insufficient for RLS), MySQL

**Authentication: Session + PAT Hybrid**
- **Pros:** Web sessions for UI, token-based for API clients, granular scoping
- **Cons:** Dual auth complexity
- **Alternative considered:** JWT-only (harder to revoke), OAuth 2.0 (overkill for self-hosted)

### 14.3 Performance Considerations

**Database Indexing Strategy:**
```sql
-- Primary access patterns
CREATE INDEX idx_transactions_household_date ON transactions(household_id, occurred_on DESC);
CREATE INDEX idx_transactions_category ON transactions(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_tags ON transactions USING gin(tags);
CREATE INDEX idx_audit_log_household_time ON audit_log(household_id, at DESC);

-- Settlement queries
CREATE INDEX idx_settlements_household_month ON settlements(household_id, month);
CREATE INDEX idx_incomes_user_month ON incomes(user_id, month);
```

**Pagination Strategy:**
- Cursor-based pagination for large datasets
- Limit of 100 items per page with configurable client override
- Efficient `WHERE id > cursor ORDER BY id LIMIT N` queries

**Caching Approach:**
- HTTP caching headers for static reports
- Application-level caching for category trees, user lists
- No caching for real-time transaction data (consistency over speed)

### 14.4 Security Design Principles

**Defense in Depth:**
1. **Application Layer:** Input validation, authorization checks
2. **Database Layer:** RLS policies, constraints
3. **Network Layer:** TLS, CORS, rate limiting
4. **Infrastructure Layer:** Container isolation, reverse proxy

**Principle of Least Privilege:**
- API tokens scoped to specific operations
- User roles with minimal necessary permissions
- Database connections with limited privileges

**Audit First:**
- All state changes logged before execution
- Immutable audit log (append-only)
- Regular audit log backup and archival

### 14.5 Scalability Considerations

**Current Scale Target:**
- Households: 1-10 (single-family deployment)
- Users per household: 2-6
- Transactions per month: 50-500
- Data retention: 10+ years

**Growth Path:**
- Horizontal scaling via household sharding
- Read replicas for reporting queries
- CDN for static assets
- Background job queue for heavy operations

**Resource Planning:**
- Database: 2-4 CPU cores, 8-16 GB RAM
- Application: 1-2 CPU cores, 4-8 GB RAM
- Storage: 1-10 GB (grows ~100 MB/year per active household)

---

## Conclusion

This design document provides a comprehensive blueprint for building NestEgg, a robust household budgeting application focused on Japanese yen, self-hosted deployment, and strong audit capabilities. The architecture prioritizes data consistency, security, and maintainability while providing both web UI and programmatic API access.

Key strengths of this design:
- **Data Integrity:** ACID transactions, RLS, comprehensive validation
- **Flexibility:** Support for various payment methods and external integrations  
- **Auditability:** Complete change tracking with soft deletion
- **Developer Experience:** Strong TypeScript support, comprehensive testing strategy
- **Self-Hosted Ready:** Docker-based deployment with monitoring and backup strategies

The modular architecture allows for incremental implementation and future enhancements while maintaining backward compatibility and data migration paths.

---

**Next Steps:**
1. Set up development environment with Docker Compose
2. Implement core database schema with Prisma migrations
3. Build authentication and basic CRUD APIs
4. Develop settlement algorithm with comprehensive tests
5. Create frontend components for transaction management
6. Implement month-end automation with monitoring

For implementation details, refer to the companion documents:
- [API Specification](./api_specification.md)
- [Database Schema](./database_schema.md) 
- [Testing Strategy](./testing_strategy.md)