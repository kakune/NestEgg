# NestEgg Backend API

This document provides essential information for frontend developers to set up, use, and understand the NestEgg backend API.

## Table of Contents

1.  [Getting Started](#getting-started)
2.  [Authentication](#authentication)
3.  [API Overview](#api-overview)
4.  [Querying Resources](#querying-resources)
5.  [Error Handling](#error-handling)
6.  [Key Workflows](#key-workflows)

---

## 1. Getting Started

### Prerequisites

-   Node.js (v20 or later)
-   npm
-   Docker and Docker Compose (for running the database)

### Installation

Install all project dependencies from the workspace root:

```bash
npm install
```

### Environment Setup

The backend requires a `.env` file for configuration. Create one by copying the example file:

```bash
cp .env.example .env
```

You must configure the following essential variables in your new `.env` file:

-   `DATABASE_URL`: The connection string for the PostgreSQL database.
    -   Example: `postgresql://user:password@localhost:5432/nestegg?schema=public`
-   `JWT_SECRET`: A long, random, and secret string used for signing authentication tokens.

### Running the Application

To run the application in development mode with hot-reloading:

```bash
# From the workspace root
npm run start:dev --workspace=backend
```

The API server will be available at `http://localhost:3000`.

## 2. Authentication

Most API endpoints are protected and require a JSON Web Token (JWT) for access.

**Authentication Flow:**

1.  **Register or Login**: A new user registers a household or logs in.
    -   `POST /api/v1/auth/register`
    -   `POST /api/v1/auth/login`
2.  **Receive Token**: The response from a successful login/registration will include an `accessToken`.
3.  **Authorize Requests**: For all subsequent requests to protected endpoints, include the token in the `Authorization` header.
    -   `Authorization: Bearer <your_accessToken>`

**Public Endpoints:**
The following endpoints do not require authentication:
-   `/` - Application welcome message
-   `/health` and `/health/detailed`
-   `/api/v1/auth/register`
-   `/api/v1/auth/login`

**Key Auth Endpoints:**
-   `GET /api/v1/auth/me`: Retrieves the profile of the currently authenticated user.
-   `POST /api/v1/auth/logout`: Invalidates the current session token.

### Personal Access Tokens (PATs)

For programmatic access (e.g., scripts, third-party integrations), you can create Personal Access Tokens.
-   `POST /api/v1/auth/personal-access-tokens`: Creates a new PAT with specified permissions (scopes).
-   `DELETE /api/v1/auth/personal-access-tokens/:tokenId`: Revokes an existing PAT.

## 3. API Overview

### Global Prefix

All API routes are prefixed with `/api/v1`. For example, the users endpoint is accessible at `/api/v1/users`.

### Core Resources

The API is organized around RESTful resources. Beyond standard CRUD, many resources offer specialized endpoints for querying and management.

| Resource | Endpoint | Description |
| :--- | :--- | :--- |
| **Auth** | `/auth` | Handles user registration, login, logout, and token management. See [Authentication](#authentication). |
| **Users** | `/users` | Manages household users (CRUD). Also includes `PUT /:id/password` for password changes. |
| **Actors** | `/actors` | Manages transaction actors (e.g., users, stores). Includes `GET /:id/stats` for statistics and `GET /user/:userId` for user-specific actors. |
| **Categories** | `/categories` | Manages hierarchical transaction categories. Includes `GET /tree`, `GET /:id/path`, and `GET /:id/stats`. |
| **Transactions** | `/transactions` | Manages daily income and expense records. Offers powerful querying capabilities. See [Querying Resources](#querying-resources). |
| **Incomes** | `/incomes` | Manages monthly income records. Offers powerful querying capabilities. See [Querying Resources](#querying-resources). |
| **Settlements** | `/settlements` | Manages the monthly settlement process. Includes `POST /run` and `POST /:id/finalize`. |
| **CSV** | `/csv` | Provides endpoints for CSV data import and export for transactions and incomes. See [Key Workflows](#key-workflows). |

## 4. Querying Resources

Many `GET` endpoints support filtering, sorting, and pagination via query parameters.

-   **Filtering**: Most fields can be filtered (e.g., `?year=2024&type=EXPENSE`).
-   **Sorting**: Use `sortBy` and `sortOrder`. Example: `?sortBy=date&sortOrder=desc`.
-   **Pagination**: Use `limit` and `offset`. Example: `?limit=20&offset=40`.

Please refer to the DTO files in `src/*/dto/` for available query parameters for each endpoint.

### Advanced Queries for Transactions and Incomes

The `transactions` and `incomes` resources provide a rich set of endpoints for complex data retrieval:

**Transactions (`/transactions`)**
-   `GET /summary`: Returns a summary (totals, counts, net amount) based on filter criteria.
-   `GET /search?q=...`: Performs a full-text search on transaction notes.
-   `GET /by-category/:id`: Retrieves all transactions for a specific category.
-   `GET /by-actor/:id`: Retrieves all transactions for a specific actor.
-   `GET /by-tag/:tag`: Retrieves all transactions tagged with a specific tag.
-   `GET /recent`: Gets the most recent transactions.
-   `GET /date-range/:from/:to`: Retrieves transactions within a specific date range.
-   `POST /bulk`: Create multiple transactions in a single request.
-   `DELETE /bulk`: Delete multiple transactions in a single request.

**Incomes (`/incomes`)**
-   `GET /statistics`: Returns aggregate statistics (totals, averages) over a period.
-   `GET /breakdown/:year`: Provides a per-user breakdown of income for a given year.
-   `GET /search?q=...`: Performs a full-text search on income descriptions.
-   `GET /recent`: Gets the most recent income records.
-   `GET /current-year`: Retrieves all income records for the current year.
-   `GET /user/:userId`: Retrieves all incomes for a specific user.
-   `GET /user/:userId/year/:year`: Retrieves incomes for a specific user and year.
-   `GET /user/:userId/month/:year/:month`: Retrieves income for a specific user and month.
-   `GET /year/:year`: Retrieves all household incomes for a specific year.
-   `POST /bulk`: Create multiple income records in a single request.
-   `DELETE /user/:userId/year/:year`: Delete all income records for a specific user and year.

## 5. Error Handling

The API uses a standardized error response format. When an error occurs, the response body will contain:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "A human-readable error message.",
    "details": [
      // Optional: For validation errors, an array of specific issues
      {
        "field": "fieldName",
        "message": "Specific validation message for the field."
      }
    ],
    "request_id": "uuid-for-tracing",
    "timestamp": "iso-8601-timestamp",
    "path": "/api/v1/requested/path"
  }
}
```

**Common Status Codes & Error Codes:**

| Status | Code | Meaning |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | The request body or query parameters failed validation. |
| `401` | `UNAUTHORIZED` | Missing or invalid authentication token. |
| `403` | `FORBIDDEN` | Authenticated user lacks permission for the action. |
| `404` | `RESOURCE_NOT_FOUND` | The requested resource does not exist. |
| `409` | `DUPLICATE_RESOURCE` | A resource with the same unique key already exists. |
| `500` | `INTERNAL_SERVER_ERROR` | An unexpected error occurred on the server. |

## 6. Key Workflows

### User and Household Setup

1.  A new user registers by calling `POST /api/v1/auth/register`. This creates a new `Household` and an `admin` `User`.
2.  The admin user can then invite and create other users within the same household by calling `POST /api/v1/users`.

### CSV Import/Export

The API supports a multi-step process for importing data from a CSV file to ensure data quality, as well as exporting data. This is available for both **Transactions** and **Incomes**.

**Import Workflow (Example: Transactions)**
1.  **Upload (`POST /api/v1/csv/transactions/upload`)**: Upload the raw CSV file. The API returns the file headers and sample data.
2.  **Preview (`POST /api/v1/csv/transactions/preview`)**: Send the CSV data along with a field mapping configuration. The API validates the data and returns a preview of what will be imported, including any errors or potential duplicates.
3.  **Import (`POST /api/v1/csv/transactions/import`)**: After confirming the preview, send the same payload to this endpoint to finalize the import.

Similar endpoints exist for incomes (`/api/v1/csv/incomes/upload`, `/api/v1/csv/incomes/preview`, `/api/v1/csv/incomes/import`).

**Export Workflow (Example: Transactions)**
-   **Export (`GET /api/v1/csv/transactions/export`)**: Export transaction data in CSV or JSON format. The endpoint accepts the same filter query parameters as the main `GET /api/v1/transactions` endpoint.

**Templates and Mappings**
-   `GET /api/v1/csv/transactions/template`: Downloads a sample CSV template for transactions.
-   `GET /api/v1/csv/field-mappings/transactions`: Returns the expected field mappings for transaction imports.
-   (Similar endpoints exist for `/incomes`)

### Monthly Settlement

The settlement process calculates and finalizes financial transfers between household members. This is typically an admin-only function.

1.  **Run Settlement (`POST /api/v1/settlements/run`)**: An admin triggers the settlement calculation for a specific year and month. This creates a `DRAFT` settlement with proposed transfers.
2.  **Review**: The frontend can fetch the draft settlement via `GET /api/v1/settlements/:id` to show the proposed transfers to the admin.
3.  **Finalize (`POST /api/v1/settlements/:id/finalize`)**: Once the admin confirms the draft, they call this endpoint to finalize it. A finalized settlement is immutable.
