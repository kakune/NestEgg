# NestEgg API Specification

**Version:** 1.0  
**Date:** 2025-08-23  
**Base URL:** `/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Patterns](#common-patterns)
3. [Core Resources](#core-resources)
4. [Settlement Management](#settlement-management)
5. [Reporting](#reporting)
6. [Import/Export](#importexport)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Webhooks](#webhooks)
10. [OpenAPI Schema](#openapi-schema)

---

## Authentication

### Session-Based Authentication (Web UI)

**Login:**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```http
HTTP/1.1 200 OK
Set-Cookie: nestegg_session=abc123; HttpOnly; Secure; SameSite=Strict
Content-Type: application/json

{
  "user": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin",
    "household": {
      "id": "household-uuid", 
      "name": "Doe Family"
    }
  },
  "expires_at": "2025-08-24T10:00:00Z"
}
```

**Logout:**
```http
POST /api/v1/auth/logout
Cookie: nestegg_session=abc123
```

### Personal Access Token (PAT) Authentication

**Create Token (Admin Only):**
```http
POST /api/v1/auth/tokens
Authorization: Bearer <existing-token>
Content-Type: application/json

{
  "name": "Budget Automation Script",
  "scopes": [
    "transactions:read",
    "transactions:write", 
    "settlements:read"
  ],
  "expires_in": 2592000  # 30 days in seconds (optional)
}
```

**Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "token-uuid",
  "name": "Budget Automation Script",
  "token": "nestegg_pat_1234567890abcdef...",
  "scopes": ["transactions:read", "transactions:write", "settlements:read"],
  "created_at": "2025-08-23T10:00:00Z",
  "expires_at": "2025-09-22T10:00:00Z"
}
```

**List Tokens:**
```http
GET /api/v1/auth/tokens
Authorization: Bearer <token>
```

**Revoke Token:**
```http
DELETE /api/v1/auth/tokens/{token_id}
Authorization: Bearer <token>
```

### Token Scopes

| Scope | Description |
|-------|-------------|
| `users:read` | View household users |
| `users:write` | Create/update users (admin only) |
| `actors:read` | View payment actors |
| `actors:write` | Create/update payment actors |
| `categories:read` | View categories |
| `categories:write` | Create/update categories |
| `transactions:read` | View transactions |
| `transactions:write` | Create/update/delete transactions |
| `incomes:read` | View income records |
| `incomes:write` | Create/update income records |
| `settlements:read` | View settlements |
| `settlements:write` | Run/finalize settlements (admin only) |
| `reports:read` | Access reporting endpoints |
| `imports:write` | Upload and import data |

---

## Common Patterns

### Request Headers

**Required for all requests:**
```http
Content-Type: application/json
Authorization: Bearer <token>  # For PAT auth
# OR
Cookie: nestegg_session=<session>  # For session auth
```

**Optional headers:**
```http
Idempotency-Key: <uuid>  # For POST operations
Accept-Language: ja-JP,en;q=0.9  # For localized error messages
X-Request-ID: <uuid>  # For request tracing
```

### Response Format

**Success Response:**
```json
{
  "data": { /* resource data */ },
  "meta": { /* metadata like pagination */ }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "field": "amount_yen",
      "reason": "Must be a positive integer"
    },
    "request_id": "req-uuid"
  }
}
```

### Pagination

**Cursor-Based Pagination:**
```http
GET /api/v1/transactions?limit=20&cursor=eyJpZCI6InV1aWQi...
```

**Response:**
```json
{
  "data": [ /* array of resources */ ],
  "meta": {
    "has_more": true,
    "next_cursor": "eyJpZCI6InV1aWQi...",
    "count": 20
  }
}
```

### Filtering & Search

**Common Query Parameters:**
- `limit`: Max items per page (default: 50, max: 100)
- `cursor`: Pagination cursor
- `sort`: Sort field (default: `-created_at`)
- `q`: Full-text search query
- `from`: Date range start (YYYY-MM-DD)
- `to`: Date range end (YYYY-MM-DD)
- `include_deleted`: `boolean` - Include soft-deleted records. (Admin only)

---

## Core Resources

### User Management

**Get Current User:**
```http
GET /api/v1/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "id": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "household_id": "household-uuid",
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-08-23T10:00:00Z"
  }
}
```

**List Household Users:**
```http
GET /api/v1/users
Authorization: Bearer <token>
```

**Update User:**
```http
PATCH /api/v1/users/{user_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
  // "role": "admin" // Role updates are typically restricted to admin users only.
}
```

### Payment Actors

**List Actors:**
```http
GET /api/v1/actors?kind=INSTRUMENT&is_active=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "actor-uuid",
      "household_id": "household-uuid", 
      "kind": "USER",
      "user_id": "user-uuid",
      "name": "John Doe",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "actor-uuid-2",
      "household_id": "household-uuid",
      "kind": "INSTRUMENT", 
      "user_id": null,
      "name": "Family Credit Card",
      "is_active": true,
      "created_at": "2025-01-15T00:00:00Z"
    }
  ]
}
```

**Create Actor:**
```http
POST /api/v1/actors
Authorization: Bearer <token>
Content-Type: application/json

{
  "kind": "INSTRUMENT",
  "name": "Gift Card Balance",
  "is_active": true
}
```

**Update Actor:**
```http
PATCH /api/v1/actors/{actor_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Card Name",
  "is_active": false
}
```

### Categories

**List Categories:**
```http
GET /api/v1/categories?type=EXPENSE&parent_id=null
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "category-uuid",
      "household_id": "household-uuid",
      "name": "Food & Dining", 
      "parent_id": null,
      "type": "EXPENSE",
      "children": [
        {
          "id": "subcategory-uuid",
          "name": "Groceries",
          "parent_id": "category-uuid",
          "type": "EXPENSE"
        }
      ],
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Create Category:**
```http
POST /api/v1/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Transportation",
  "type": "EXPENSE",
  "parent_id": null
}
```

**Update Category:**
```http
PATCH /api/v1/categories/{category_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Travel & Transportation",
  "parent_id": "parent-category-uuid"
}
```

### Transactions

**List Transactions:**
```http
GET /api/v1/transactions?from=2025-08-01&to=2025-08-31&type=EXPENSE&category_id=cat-uuid&limit=50
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "transaction-uuid",
      "household_id": "household-uuid",
      "type": "EXPENSE",
      "amount_yen": 15000,
      "occurred_on": "2025-08-23",
      "booked_at": "2025-08-23T14:30:00Z",
      "category": {
        "id": "category-uuid",
        "name": "Groceries"
      },
      "payer_actor": {
        "id": "actor-uuid", 
        "name": "Family Card",
        "kind": "INSTRUMENT"
      },
      "payer_user": {
        "id": "user-uuid",
        "name": "John Doe"
      },
      "should_pay": "HOUSEHOLD",
      "should_pay_user": null,
      "note": "Weekly grocery shopping",
      "tags": ["supermarket", "food", "weekly"],
      "created_at": "2025-08-23T14:30:00Z",
      "updated_at": "2025-08-23T14:30:00Z",
      "deleted_at": null
    }
  ],
  "meta": {
    "has_more": false,
    "next_cursor": null,
    "count": 1,
    "total_amount_yen": 15000
  }
}
```

**Create Transaction:**
```http
POST /api/v1/transactions
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: idempotent-key-uuid

{
  "type": "EXPENSE",
  "amount_yen": 4500,
  "occurred_on": "2025-08-23",
  "category_id": "category-uuid",
  "payer_actor_id": "actor-uuid", 
  "should_pay": "HOUSEHOLD",
  "note": "Coffee and pastries",
  "tags": ["coffee", "morning", "cafe"]
}
```

**Response:**
```json
{
  "data": {
    "id": "new-transaction-uuid",
    "household_id": "household-uuid",
    "type": "EXPENSE",
    "amount_yen": 4500,
    "occurred_on": "2025-08-23",
    "booked_at": "2025-08-23T14:35:00Z",
    "category_id": "category-uuid",
    "payer_actor_id": "actor-uuid",
    "payer_user_id": "current-user-uuid",
    "should_pay": "HOUSEHOLD", 
    "should_pay_user_id": null,
    "note": "Coffee and pastries",
    "tags": ["coffee", "morning", "cafe"],
    "source_hash": null,
    "created_at": "2025-08-23T14:35:00Z",
    "updated_at": "2025-08-23T14:35:00Z",
    "deleted_at": null
  }
}
```

**Update Transaction:**
```http
PATCH /api/v1/transactions/{transaction_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount_yen": 4800,
  "note": "Coffee, pastries, and tip",
  "tags": ["coffee", "morning", "cafe", "tip"]
}
```

**Delete Transaction (Soft Delete):**
```http
DELETE /api/v1/transactions/{transaction_id}
Authorization: Bearer <token>
```

**Response:**
```http
HTTP/1.1 204 No Content
```

### Income Management

**List Incomes:**
```http
GET /api/v1/incomes?month=2025-08&user_id=user-uuid
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": "income-uuid",
      "household_id": "household-uuid", 
      "user": {
        "id": "user-uuid",
        "name": "John Doe"
      },
      "month": "2025-08-01",
      "gross_yen": 450000,
      "deduction_tax_yen": 90000,
      "deduction_social_yen": 67500,
      "deduction_other_yen": 5000,
      "allocatable_yen": 287500,
      "created_at": "2025-08-01T09:00:00Z",
      "updated_at": "2025-08-01T09:00:00Z"
    }
  ]
}
```

**Create Income:**
```http
POST /api/v1/incomes
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "user-uuid",
  "month": "2025-08-01",
  "gross_yen": 450000,
  "deduction_tax_yen": 90000,
  "deduction_social_yen": 67500,
  "deduction_other_yen": 5000
}
```

**Update Income:**
```http
PATCH /api/v1/incomes/{income_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "gross_yen": 460000,
  "deduction_tax_yen": 92000
}
```

---

## Settlement Management

### Run Settlement

**Compute Settlement (Idempotent):**
```http
POST /api/v1/settlements/{month}/run
Authorization: Bearer <token>
```

Where `{month}` is in format `YYYY-MM` (e.g., `2025-08`).

**Response:**
```json
{
  "data": {
    "id": "settlement-uuid",
    "household_id": "household-uuid", 
    "month": "2025-08-01",
    "status": "DRAFT",
    "computed_at": "2025-09-01T02:00:00Z",
    "summary": {
      "total_household_expenses_yen": 450000,
      "total_personal_expenses_yen": 25000,
      "participant_count": 2,
      "transfer_count": 1
    },
    "lines": [
      {
        "id": "line-uuid",
        "from_user": {
          "id": "user2-uuid", 
          "name": "Jane Doe"
        },
        "to_user": {
          "id": "user1-uuid",
          "name": "John Doe"
        },
        "amount_yen": 125000,
        "description": "Net household settlement for August 2025"
      }
    ],
    "user_details": [
      {
        "user": {
          "id": "user1-uuid",
          "name": "John Doe"
        },
        "income_allocation_yen": 287500,
        "household_share_yen": 281250,
        "household_paid_yen": 275000,
        "personal_net_yen": -10000,
        "final_balance_yen": -16250
      },
      {
        "user": {
          "id": "user2-uuid", 
          "name": "Jane Doe"
        },
        "income_allocation_yen": 200000,
        "household_share_yen": 168750,
        "household_paid_yen": 175000,
        "personal_net_yen": 15000,
        "final_balance_yen": 21250
      }
    ]
  }
}
```

### Get Settlement

**Retrieve Existing Settlement:**
```http
GET /api/v1/settlements/{month}
Authorization: Bearer <token>
```

**List Settlements:**
```http
GET /api/v1/settlements?limit=12&sort=-month
Authorization: Bearer <token>
```

### Finalize Settlement

**Lock Settlement:**
```http
POST /api/v1/settlements/{settlement_id}/finalize
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirmed": true,
  "notes": "Settlement reviewed and approved by all parties"
}
```

**Response:**
```json
{
  "data": {
    "id": "settlement-uuid",
    "status": "FINALIZED",
    "finalized_at": "2025-09-01T10:30:00Z",
    "finalized_by": {
      "id": "user-uuid",
      "name": "John Doe"
    }
  }
}
```

---

## Reporting

### Monthly Summary

**Get Month Summary:**
```http
GET /api/v1/reports/summary?month=2025-08
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "month": "2025-08-01",
    "household_id": "household-uuid",
    "summary": {
      "total_income_yen": 750000,
      "total_expenses_yen": 425000,
      "net_income_yen": 325000,
      "transaction_count": 87,
      "avg_transaction_yen": 4885
    },
    "by_type": {
      "EXPENSE": {
        "total_yen": 425000,
        "count": 75,
        "avg_yen": 5667
      },
      "INCOME": {
        "total_yen": 750000,
        "count": 12,
        "avg_yen": 62500
      }
    },
    "by_should_pay": {
      "HOUSEHOLD": {
        "total_yen": 380000,
        "count": 68
      },
      "USER": {
        "total_yen": 45000,
        "count": 7
      }
    },
    "top_categories": [
      {
        "category": {
          "id": "cat-uuid",
          "name": "Groceries"
        },
        "total_yen": 85000,
        "count": 12,
        "percentage": 20.0
      }
    ]
  }
}
```

### Category Breakdown

**Get Category Analysis:**
```http
GET /api/v1/reports/category-breakdown?month=2025-08&type=EXPENSE
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "month": "2025-08-01",
    "type": "EXPENSE",
    "total_yen": 425000,
    "categories": [
      {
        "category": {
          "id": "cat-uuid",
          "name": "Food & Dining",
          "parent_id": null
        },
        "total_yen": 125000,
        "count": 25,
        "percentage": 29.4,
        "subcategories": [
          {
            "category": {
              "id": "subcat-uuid",
              "name": "Groceries", 
              "parent_id": "cat-uuid"
            },
            "total_yen": 85000,
            "count": 15,
            "percentage": 20.0
          },
          {
            "category": {
              "id": "subcat-uuid-2",
              "name": "Restaurants",
              "parent_id": "cat-uuid"
            },
            "total_yen": 40000,
            "count": 10,
            "percentage": 9.4
          }
        ]
      }
    ],
    "trends": {
      "vs_previous_month": {
        "amount_change_yen": 15000,
        "percentage_change": 3.7
      },
      "vs_same_month_last_year": {
        "amount_change_yen": -25000,
        "percentage_change": -5.6
      }
    }
  }
}
```

### User Balance Report

**Get User Financial Summary:**
```http
GET /api/v1/reports/user-balance?month=2025-08
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": {
    "month": "2025-08-01",
    "users": [
      {
        "user": {
          "id": "user1-uuid",
          "name": "John Doe"
        },
        "income": {
          "gross_yen": 450000,
          "deductions_yen": 162500,
          "allocatable_yen": 287500,
          "allocation_percentage": 59.0
        },
        "expenses": {
          "household_share_yen": 251000,
          "household_paid_yen": 245000,
          "personal_expenses_paid_yen": 15000,
          "personal_expenses_owed_yen": 5000,
          "net_personal_yen": -10000
        },
        "settlement": {
          "household_balance_yen": -6000,
          "personal_balance_yen": -10000,
          "net_balance_yen": -16000,
          "status": "owes_money"
        },
        "trends": {
          "expenses_vs_previous_month": {
            "change_yen": 12000,
            "percentage_change": 4.6
          }
        }
      }
    ]
  }
}
```

### Export Data

**Generate CSV Export:**
```http
POST /api/v1/reports/export
Authorization: Bearer <token>
Content-Type: application/json

{
  "format": "csv",
  "type": "transactions",
  "filters": {
    "from": "2025-01-01",
    "to": "2025-12-31",
    "type": "EXPENSE",
    "include_deleted": false
  },
  "fields": [
    "occurred_on",
    "type", 
    "amount_yen",
    "category.name",
    "payer_actor.name",
    "should_pay",
    "note",
    "tags"
  ]
}
```

**Response:**
```json
{
  "data": {
    "export_id": "export-uuid",
    "status": "processing",
    "created_at": "2025-08-23T15:00:00Z",
    "estimated_completion": "2025-08-23T15:02:00Z"
  }
}
```

**Check Export Status:**
```http
GET /api/v1/reports/exports/{export_id}
Authorization: Bearer <token>
```

**Download Export:**
```http
GET /api/v1/reports/exports/{export_id}/download
Authorization: Bearer <token>
```

---

## Import/Export

### File Upload

**Upload Import File:**
```http
POST /api/v1/imports/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: [CSV file]
source: "bank_export"
```

**Response:**
```json
{
  "data": {
    "file_id": "file-uuid",
    "filename": "bank_export.csv",
    "size_bytes": 15420,
    "rows_detected": 156,
    "columns": [
      "Date",
      "Description", 
      "Amount",
      "Balance"
    ],
    "sample_rows": [
      ["2025-08-23", "GROCERY STORE XYZ", "-1500", "125000"],
      ["2025-08-22", "COFFEE SHOP ABC", "-450", "126500"]
    ]
  }
}
```

### Import Mapping

**Preview Import with Mapping:**
```http
POST /api/v1/imports/preview
Authorization: Bearer <token>
Content-Type: application/json

{
  "file_id": "file-uuid",
  "mapping": {
    "date_column": "Date",
    "amount_column": "Amount", 
    "description_column": "Description",
    "amount_multiplier": -1,
    "date_format": "YYYY-MM-DD",
    "default_category_id": "misc-expenses-uuid",
    "default_payer_actor_id": "family-card-uuid",
    "default_should_pay": "HOUSEHOLD",
    "category_rules": [
      {
        "pattern": "GROCERY|SUPERMARKET",
        "category_id": "groceries-uuid"
      },
      {
        "pattern": "COFFEE|CAFE", 
        "category_id": "dining-out-uuid"
      }
    ]
  }
}
```

**Response:**
```json
{
  "data": {
    "preview": [
      {
        "row": 1,
        "source": {
          "Date": "2025-08-23",
          "Description": "GROCERY STORE XYZ",
          "Amount": "-1500"
        },
        "mapped": {
          "type": "EXPENSE",
          "amount_yen": 1500,
          "occurred_on": "2025-08-23",
          "category_id": "groceries-uuid",
          "payer_actor_id": "family-card-uuid",
          "should_pay": "HOUSEHOLD",
          "note": "GROCERY STORE XYZ"
        },
        "status": "valid"
      },
      {
        "row": 2,
        "source": {
          "Date": "2025-08-22", 
          "Description": "INVALID DATE FORMAT",
          "Amount": "abc"
        },
        "mapped": null,
        "status": "error",
        "errors": [
          "Invalid date format",
          "Invalid amount: not a number"
        ]
      }
    ],
    "summary": {
      "total_rows": 156,
      "valid_rows": 154,
      "error_rows": 2,
      "duplicate_rows": 0
    }
  }
}
```

**Execute Import:**
```http
POST /api/v1/imports/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "file_id": "file-uuid",
  "mapping": { /* same as preview */ },
  "options": {
    "skip_duplicates": true,
    "dry_run": false
  }
}
```

**Response:**
```json
{
  "data": {
    "import_id": "import-uuid",
    "status": "completed",
    "summary": {
      "total_rows": 156,
      "imported": 154,
      "skipped": 2,
      "errors": 0
    },
    "created_transactions": [
      "tx-uuid-1",
      "tx-uuid-2"
    ],
    "skipped_rows": [
      {
        "row": 5,
        "reason": "duplicate",
        "source_hash": "hash123"
      }
    ]
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Status | Meaning | Usage |
|--------|---------|--------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate/constraint violation |
| 422 | Unprocessable Entity | Valid JSON but business logic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Maintenance mode |

### Error Codes

**Authentication Errors:**
- `INVALID_CREDENTIALS` - Login failed
- `TOKEN_EXPIRED` - API token expired
- `TOKEN_REVOKED` - API token was revoked
- `SESSION_EXPIRED` - Session cookie expired
- `INSUFFICIENT_SCOPE` - Token lacks required permissions

**Validation Errors:**
- `VALIDATION_ERROR` - Request data validation failed
- `INVALID_DATE_FORMAT` - Date string format invalid
- `INVALID_AMOUNT` - Amount not positive integer
- `REQUIRED_FIELD_MISSING` - Required field not provided
- `FIELD_TOO_LONG` - String field exceeds max length

**Business Logic Errors:**
- `SETTLEMENT_ALREADY_FINALIZED` - Cannot modify finalized settlement
- `INSUFFICIENT_PERMISSIONS` - User lacks required role
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `DUPLICATE_RESOURCE` - Resource already exists
- `INVALID_MONTH_FORMAT` - Month not in YYYY-MM format
- `FUTURE_DATE_NOT_ALLOWED` - Transaction date in future

**System Errors:**
- `DATABASE_ERROR` - Database operation failed
- `EXTERNAL_SERVICE_ERROR` - Third-party service unavailable
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `MAINTENANCE_MODE` - System under maintenance

### Error Response Examples

**Validation Error:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "amount_yen",
        "code": "INVALID_AMOUNT",
        "message": "Amount must be a positive integer"
      },
      {
        "field": "occurred_on", 
        "code": "FUTURE_DATE_NOT_ALLOWED",
        "message": "Transaction date cannot be in the future"
      }
    ],
    "request_id": "req-12345"
  }
}
```

**Authorization Error:**
```http  
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "Token lacks required permissions",
    "details": {
      "required_scope": "transactions:write",
      "token_scopes": ["transactions:read", "reports:read"]
    },
    "request_id": "req-12346"
  }
}
```

**Rate Limit Error:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED", 
    "message": "Too many requests",
    "details": {
      "limit": 1000,
      "window": "1 hour",
      "reset_at": "2025-08-23T16:00:00Z"
    },
    "request_id": "req-12347"
  }
}
```

---

## Rate Limiting

### Limits by Authentication Type

**Session-Based (Web UI):**
- 2000 requests per hour per session
- 50 requests per minute for write operations

**Personal Access Tokens:**
- 10000 requests per hour per token
- 200 requests per minute for write operations
- 50 requests per minute for heavy operations (imports, exports)

### Rate Limit Headers

All responses include rate limiting information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1692700800
X-RateLimit-Window: 3600
```

### Rate Limit Bypass

**For administrative operations:**
```http
X-Admin-Override: true
Authorization: Bearer <admin-token>
```

Available only for tokens with `admin` scope and emergency maintenance.

---

## Webhooks

### Webhook Events

**Available Events:**
- `transaction.created`
- `transaction.updated` 
- `transaction.deleted`
- `settlement.completed`
- `settlement.finalized`
- `income.created`
- `income.updated`

### Webhook Configuration

**Register Webhook:**
```http
POST /api/v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/nestegg",
  "events": ["transaction.created", "settlement.completed"],
  "secret": "your-webhook-secret",
  "active": true
}
```

### Webhook Payload

**Example - Transaction Created:**
```json
{
  "event": "transaction.created",
  "timestamp": "2025-08-23T15:30:00Z",
  "household_id": "household-uuid",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "type": "EXPENSE",
      "amount_yen": 5000,
      "occurred_on": "2025-08-23",
      "category": {
        "id": "category-uuid",
        "name": "Dining Out"
      },
      "payer_actor": {
        "id": "actor-uuid",
        "name": "John Doe",
        "kind": "USER"
      },
      "should_pay": "HOUSEHOLD",
      "note": "Team lunch",
      "created_at": "2025-08-23T15:30:00Z"
    }
  }
}
```

### Webhook Security

**Signature Verification:**
All webhooks include a signature header for verification:

```http
X-NestEgg-Signature: sha256=5d41402abc4b2a76b9719d911017c592
X-NestEgg-Delivery: uuid-delivery-id
```

**Verification Process:**
```python
import hmac
import hashlib

def verify_webhook(payload_body, signature, secret):
    expected = hmac.new(
        secret.encode('utf-8'), 
        payload_body.encode('utf-8'), 
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected}", signature)
```

---

## OpenAPI Schema

**Complete OpenAPI 3.0 specification available at:**
```http
GET /api/v1/schema.json
GET /api/v1/docs  # Interactive Swagger UI
```

**Version Information:**
```yaml
openapi: 3.0.0
info:
  title: NestEgg API
  description: Household budget management API
  version: 1.0.0
  contact:
    name: API Support
    url: https://github.com/your-org/nestegg
servers:
  - url: https://nestegg.home.local/api/v1
    description: Production server
  - url: http://localhost:3000/api/v1
    description: Development server
```

**Security Schemes:**
```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Personal Access Token
    SessionAuth:
      type: apiKey
      in: cookie
      name: nestegg_session
      description: Session cookie
```

**Example Schema Definitions:**
```yaml
components:
  schemas:
    Transaction:
      type: object
      required: [type, amount_yen, occurred_on, category_id, payer_actor_id, should_pay]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        type:
          type: string
          enum: [EXPENSE, INCOME]
        amount_yen:
          type: integer
          minimum: 1
          description: Amount in integer yen
        occurred_on:
          type: string
          format: date
          description: Transaction date (YYYY-MM-DD)
        category_id:
          type: string
          format: uuid
        payer_actor_id:
          type: string
          format: uuid
        should_pay:
          type: string
          enum: [HOUSEHOLD, USER]
        should_pay_user_id:
          type: string
          format: uuid
          nullable: true
          description: Required when should_pay=USER
        note:
          type: string
          maxLength: 500
        tags:
          type: array
          items:
            type: string
          maxItems: 10
```

---

## SDK Examples

### JavaScript/TypeScript SDK

**Installation:**
```bash
npm install @nestegg/api-client
```

**Usage:**
```typescript
import { NestEggClient } from '@nestegg/api-client';

const client = new NestEggClient({
  baseURL: 'https://nestegg.home.local/api/v1',
  token: process.env.NESTEGG_PAT
});

// Create transaction
const transaction = await client.transactions.create({
  type: 'EXPENSE',
  amount_yen: 5000,
  occurred_on: '2025-08-23',
  category_id: 'category-uuid',
  payer_actor_id: 'actor-uuid',
  should_pay: 'HOUSEHOLD',
  note: 'Lunch expense'
});

// List transactions with filtering
const transactions = await client.transactions.list({
  from: '2025-08-01',
  to: '2025-08-31',
  type: 'EXPENSE',
  limit: 50
});

// Run settlement
const settlement = await client.settlements.run('2025-08');
```

### Python SDK

**Installation:**
```bash
pip install nestegg-client
```

**Usage:**
```python
from nestegg_client import NestEggClient
from datetime import date

client = NestEggClient(
    base_url='https://nestegg.home.local/api/v1',
    token=os.environ['NESTEGG_PAT']
)

# Create transaction
transaction = client.transactions.create({
    'type': 'EXPENSE',
    'amount_yen': 5000,
    'occurred_on': date(2025, 8, 23).isoformat(),
    'category_id': 'category-uuid',
    'payer_actor_id': 'actor-uuid',
    'should_pay': 'HOUSEHOLD',
    'note': 'Lunch expense'
})

# Generate monthly report
report = client.reports.category_breakdown(
    month='2025-08',
    type='EXPENSE'
)
```

---

This API specification provides comprehensive documentation for integrating with NestEgg's household budget management system. For implementation details and business logic, refer to the [Design Document](./design_document.md) and [Database Schema](./database_schema.md).