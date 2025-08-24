# NestEgg Backend API

This document provides essential information for frontend developers to set up, use, and understand the NestEgg backend API.

## Table of Contents

1.  [Getting Started](#getting-started)
    -   [Prerequisites](#prerequisites)
    -   [Installation](#installation)
    -   [Environment Setup](#environment-setup)
    -   [Running the Application](#running-the-application)
2.  [Authentication](#authentication)
3.  [API Overview](#api-overview)
    -   [Global Prefix](#global-prefix)
    -   [Core Resources](#core-resources)
    -   [Common Query Parameters](#common-query-parameters)
4.  [Error Handling](#error-handling)
5.  [Key Workflows](#key-workflows)
    -   [User and Household Setup](#user-and-household-setup)
    -   [CSV Import](#csv-import)
    -   [Monthly Settlement](#monthly-settlement)

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
-   `/health`
-   `/api/v1/auth/register`
-   `/api/v1/auth/login`

## 3. API Overview

### Global Prefix

All API routes are prefixed with `/api/v1`. For example, the users endpoint is accessible at `/api/v1/users`.

### Core Resources

The API is organized around RESTful resources:

| Resource | Endpoint | Description |
| :--- | :--- | :--- |
| **Auth** | `/auth` | Handles user registration, login, logout, and token management. |
| **Users** | `/users` | Manages household users (CRUD). |
| **Actors** | `/actors` | Manages transaction actors (e.g., users, stores, institutions). |
| **Categories** | `/categories` | Manages transaction categories, which can be hierarchical. |
| **Transactions** | `/transactions` | Manages daily income and expense records. |
| **Incomes** | `/incomes` | Manages monthly income records used for settlements. |
| **Settlements** | `/settlements` | Manages the monthly settlement process. |
| **CSV** | `/csv` | Provides endpoints for CSV data import and export. |

### Common Query Parameters

Many `GET` endpoints support filtering, sorting, and pagination via query parameters.

-   **Filtering**: Most fields can be filtered (e.g., `?year=2024&type=EXPENSE`).
-   **Sorting**: Use `sortBy` and `sortOrder`. Example: `?sortBy=date&sortOrder=desc`.
-   **Pagination**: Use `limit` and `offset`. Example: `?limit=20&offset=40`.

Please refer to the DTO files in `src/*/dto/` for available query parameters for each endpoint.

## 4. Error Handling

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

## 5. Key Workflows

### User and Household Setup

1.  A new user registers by calling `POST /api/v1/auth/register`. This creates a new `Household` and an `admin` `User`.
2.  The admin user can then invite and create other users within the same household by calling `POST /api/v1/users`.

### CSV Import

The API supports a three-step process for importing transactions or incomes from a CSV file to ensure data quality.

1.  **Upload (`POST /api/v1/csv/transactions/upload`)**: Upload the raw CSV file. The API returns the file headers and sample data.
2.  **Preview (`POST /api/v1/csv/transactions/preview`)**: Send the CSV data along with a field mapping configuration. The API validates the data and returns a preview of what will be imported, including any errors or potential duplicates.
3.  **Import (`POST /api/v1/csv/transactions/import`)**: After confirming the preview, send the same payload to this endpoint to finalize the import.

### Monthly Settlement

The settlement process calculates and finalizes financial transfers between household members. This is typically an admin-only function.

1.  **Run Settlement (`POST /api/v1/settlements/run`)**: An admin triggers the settlement calculation for a specific year and month. This creates a `DRAFT` settlement with proposed transfers.
2.  **Review**: The frontend can fetch the draft settlement via `GET /api/v1/settlements/:id` to show the proposed transfers to the admin.
3.  **Finalize (`POST /api/v1/settlements/:id/finalize`)**: Once the admin confirms the draft, they call this endpoint to finalize it. A finalized settlement is immutable.