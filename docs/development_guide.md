# Development Guide

A guide to help you get started with developing the NestEgg application.

## 1. Environment Overview

This project is set up as a monorepo with a clear separation between the backend and frontend, all managed within a Dockerized environment.

### Development Environment

-   **How to run:** `docker compose up`
-   **Services:**
    -   **Frontend:** React (Vite) running on `http://localhost:5173`.
    -   **Backend:** NestJS API running on `http://localhost:3000`.
    -   **Database:** PostgreSQL running on `localhost:5432`.
-   **Features:**
    -   **Hot-Reloading:** Changes to your code in both `frontend` and `backend` directories will automatically trigger a reload of the respective service.
    -   **API Proxying:** Frontend requests made to `/api` are automatically proxied to the backend service, avoiding CORS issues during development.
    -   **Shared Dependencies:** All `node_modules` are managed by the root `package.json` using npm Workspaces.

### Production Environment

For production, we build optimized, standalone Docker images.
-   **How to run:** `docker compose -f docker-compose.prod.yml up --build`
-   **Services:**
    -   **Frontend:** Nginx serving static React build at `http://localhost:80`.
    -   **Backend:** Compiled NestJS server at `http://localhost:3000`.
    -   **Database:** PostgreSQL (internal only).
-   **Features:**
    -   **Multi-stage builds** for optimized image sizes.
    -   **Nginx reverse proxy** for API calls (`/api` → backend:3000).
    -   **Production-optimized** React and NestJS builds.

---

## 2. Getting Started

1.  **Start all services:**
    ```bash
    docker compose up --build
    ```
    This command will build the Docker images (if they don't exist) and start the frontend, backend, and database containers.

2.  **Access the application:**
    -   Open your browser and navigate to **`http://localhost:5173`**. You should see the NestEgg React application with backend connection status.
    -   The backend API is accessible at `http://localhost:3000` with endpoints:
        -   `GET /` - Hello World message
        -   `GET /users` - Mock user data
        -   `GET /health` - Health check

3.  **Start coding!**
    -   Modify frontend code in the `/frontend/src` directory.
    -   Modify backend code in the `/backend/src` directory.
    -   Changes will be reflected automatically thanks to hot-reloading.

4.  **Stop all services:**
    When you are finished, stop all running containers with:
    ```bash
    docker compose down
    ```

---

## 3. Running Tests

We use Jest for the backend, Vitest for the frontend, and Playwright for E2E tests. You can run tests from the project's root directory.

-   **Run all tests (Backend & Frontend):**
    ```bash
    npm test
    ```

-   **Run only Backend tests:**
    ```bash
    npm test -w backend
    ```

-   **Run only Frontend tests:**
    ```bash
    npm test -w frontend
    ```

-   **Run E2E tests:**
    ```bash
    npm run e2e:run
    ```

---

## 4. Database and Prisma

We will use **Prisma** as our ORM to interact with the PostgreSQL database. While not fully integrated yet, here are the commands you will use.

-   **Schema Definition:** The database schema will be defined in `/backend/prisma/schema.prisma`. When you modify this file, you need to create and apply a migration.

-   **Creating a Migration:**
    After changing the `schema.prisma` file, run the following command. This command must be run inside the `backend` container to ensure it can connect to the database container correctly.

    1.  Open a new terminal on your host machine.
    2.  Execute the command:
        ```bash
        docker compose exec backend npx prisma migrate dev --name <your-migration-name>
        ```
        *(Replace `<your-migration-name>` with a descriptive name, e.g., `add-user-table`)*.

-   **Prisma Studio (Database GUI):**
    Prisma includes a GUI to view and edit your data, which is incredibly useful for development.
    ```bash
    docker compose exec backend npx prisma studio
    ```
    This will launch Prisma Studio, typically on `http://localhost:5555`. You may need to ensure this port is exposed in the `docker-compose.yml` file if you have trouble accessing it.

---

## 5. Linting and Formatting

To ensure code quality and consistency, we use **ESLint** for linting and **Prettier** for formatting. You can run these checks from the root directory.

-   **Check for linting and formatting issues:**
    ```bash
    npm run lint
    ```

-   **Automatically fix issues:**
    ```bash
    npm run lint:fix
    ```

Please run these checks before committing your code to maintain a clean and consistent codebase.
