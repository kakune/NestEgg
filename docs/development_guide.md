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

### Production Environment (Conceptual)

**Note:** This is not yet implemented, but it outlines the future direction.

For production, we will build optimized, standalone Docker images.
-   The **backend** will be a compiled, minimal Node.js server.
-   The **frontend** will be compiled into static assets (HTML, CSS, JS) and served efficiently by a lightweight web server like **Nginx**.
-   The database will typically be a managed service for reliability and scalability.

---

## 2. Getting Started

1.  **Start all services:**
    ```bash
    docker compose up --build
    ```
    This command will build the Docker images (if they don't exist) and start the frontend, backend, and database containers.

2.  **Access the application:**
    -   Open your browser and navigate to **`http://localhost:5173`**. You should see the React application running.
    -   The backend API is accessible at `http://localhost:3000`.

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

We use Jest for the backend and Vitest for the frontend. You can run tests for each workspace from the project's root directory.

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
