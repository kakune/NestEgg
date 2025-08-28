# NestEgg

Household Financial Settlement System - A comprehensive application for managing household finances, expenses, and settlements.

## Features

- 🔐 **Authentication System** - Secure user registration and login
- 💰 **Transaction Management** - Track income and expenses
- 🏠 **Household Management** - Multi-user household support
- 📊 **Settlement Calculations** - Automatic financial settlements
- 🏷️ **Category Management** - Organize transactions by categories
- 👥 **Actor Management** - Track who made each transaction
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, TailwindCSS
- **Backend**: NestJS, Prisma, PostgreSQL
- **Authentication**: JWT with session management
- **Containerization**: Docker & Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd NestEgg
   ```

2. **Run in development mode**
   ```bash
   docker compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5173
   - Database: PostgreSQL on port 5432

4. **Development credentials**
   - Email: `docker-test@example.com`
   - Password: `Password123@`

### Production Setup

1. **Create production environment file**
   ```bash
   cp .env .env.production
   ```

2. **Update production variables in `.env.production`**
   ```env
   # Database Configuration
   DATABASE_URL="postgresql://prod_user:secure_password@db:5432/nestegg_prod?schema=public"
   
   # JWT Configuration (Use a secure secret!)
   JWT_SECRET="your-super-secure-jwt-secret-key-for-production-min-32-chars"
   JWT_EXPIRES_IN="24h"
   
   # Application Configuration
   NODE_ENV=production
   PORT=3000
   
   # Security Configuration
   BCRYPT_ROUNDS=12
   CORS_ORIGIN="https://your-domain.com"
   ```

3. **Run in production mode**
   ```bash
   # Using production environment file
   docker compose --env-file .env.production up -d
   
   # Or with inline environment override
   NODE_ENV=production docker compose up -d
   ```

## Docker Commands

### Development
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild and start (after code changes)
docker compose up -d --force-recreate

# View specific service logs
docker compose logs frontend
docker compose logs backend
docker compose logs db
```

### Production
```bash
# Start with production environment
docker compose --env-file .env.production up -d

# Scale for production (if needed)
docker compose --env-file .env.production up -d --scale frontend=2

# Health check
curl http://localhost:5173/health
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@db:5432/nestegg?schema=public` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-jwt-key...` |
| `JWT_EXPIRES_IN` | Token expiration time | `7d` |
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend server port | `3000` |
| `CORS_ORIGIN` | Frontend URL for CORS | `http://localhost:3000` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` |

## API Documentation

Once the backend is running, API documentation is available at:
- http://localhost:5173/api/v1/docs (Swagger/OpenAPI)

## Development

### Project Structure
```
NestEgg/
├── frontend/          # Next.js frontend application
├── backend/           # NestJS backend API
├── docs/             # Project documentation
├── docker-compose.yml # Docker services configuration
└── .env              # Environment variables
```

### Making Changes

1. **Frontend changes**: Files in `frontend/` are hot-reloaded
2. **Backend changes**: NestJS automatically restarts in watch mode
3. **Database changes**: Update Prisma schema in `backend/prisma/schema.prisma`

### Testing

```bash
# Run frontend tests
cd frontend && npm test

# Run backend tests
cd backend && npm test

# Run E2E tests
cd frontend && npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 5173, and 5432 are available
2. **Database connection**: Check if PostgreSQL container is running
3. **Permission issues**: Try `sudo docker compose up -d`

### Reset Database
```bash
docker compose down -v  # Removes volumes
docker compose up -d
```

### View Container Status
```bash
docker compose ps
```

### Container Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy financial managing!** 💰🏠