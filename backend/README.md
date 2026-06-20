# Hotel CRM - Backend (Modular Monolith MVP)

A production-safe, modular monolith backend for the Hotel CRM system. Migrated from microservices architecture to enable faster development while preserving the ability to extract modules into microservices later.

## Architecture

- **Single Express application** with modular organization
- **PostgreSQL database** (unified, managed via Prisma ORM)
- **JWT authentication** with role-based access control (RBAC)
- **Zod validation** for all inputs
- **Winston logging** for structured logging
- **TypeScript** with strict mode
- **Modular structure** for future microservice extraction

See [../MASTER_ARCHITECTURE.md](../MASTER_ARCHITECTURE.md) and [../API_STANDARDS.md](../API_STANDARDS.md) for detailed documentation.

## Project Structure

```
backend/
├── src/
│   ├── server.ts                 # Express entry point
│   ├── app.ts                    # Express app factory
│   ├── config/
│   │   ├── env.ts                # Environment validation (Zod)
│   │   └── constants.ts          # HTTP status codes, error codes
│   ├── middleware/
│   │   ├── auth.ts               # JWT authentication
│   │   ├── permissions.ts        # Role/permission checking
│   │   ├── errorHandler.ts       # Global error handling
│   │   ├── validation.ts         # Request validation
│   │   └── requestLogger.ts      # Request logging
│   ├── lib/
│   │   ├── db.ts                 # Prisma connection
│   │   ├── jwt.ts                # JWT utilities
│   │   ├── logger.ts             # Winston logger
│   │   ├── errors.ts             # Custom error classes
│   │   ├── base-service.ts       # Base service class
│   │   ├── types.ts              # TypeScript types
│   │   └── utils.ts              # Utility functions
│   ├── modules/
│   │   ├── auth/                 # Auth (signup, login, JWT)
│   │   ├── crm/                  # Hotels, rooms, tasks
│   │   ├── quality/              # Verification, ratings, leaderboard
│   │   ├── hr/                   # Contracts, payroll, documents
│   │   ├── staffing/             # Work requests, assignments
│   │   ├── notifications/        # Notifications (email, push, in-app)
│   │   ├── analytics/            # Leaderboard, stats, summaries
│   │   └── calendar/             # Daily operations
│   ├── routes/
│   │   └── v1/
│   │       └── index.ts          # Routes aggregator
│   └── types/
│       └── global.ts             # Global TypeScript types
├── prisma/
│   └── schema.prisma             # Database schema
├── package.json
├── tsconfig.json
└── .env.example
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or Docker)
- npm or yarn

### Setup

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your configuration. For development, you can use:
   ```env
   NODE_ENV=development
   PORT=3001
   DATABASE_URL=postgresql://user:password@localhost:5432/hotel_crm
   JWT_SECRET=your-secret-key-min-32-characters-long-and-random
   LOG_LEVEL=debug
   CORS_ORIGIN=http://localhost:3000
   ```

3. **Setup database**
   ```bash
   # Push schema to database
   npm run db:push

   # Or run migrations
   npm run db:migrate
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   Server runs on `http://localhost:3001`

## Available Scripts

```bash
# Development
npm run dev               # Start dev server with auto-reload

# Build & Run
npm run build            # Compile TypeScript
npm start                # Run compiled server
npm run typecheck        # Check TypeScript types

# Linting
npm run lint             # Run ESLint

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio (GUI)
npm run db:seed          # Seed database with test data

# Testing (deferred to Phase 2)
npm test
```

## Database Setup

### Using AWS RDS (Production)

1. Create an RDS PostgreSQL instance in AWS (region `eu-central-1`)
2. Set `DATABASE_URL` to the connection string (append `?sslmode=require`)
3. Run `npm run db:migrate` (production uses `prisma migrate deploy`)

See [../AWS_DEPLOYMENT_GUIDE.md](../AWS_DEPLOYMENT_GUIDE.md) for full setup.

### Using Docker (Development)

Create a `docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: hotelcrm
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: hotel_crm
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Then:
```bash
docker-compose up -d
export DATABASE_URL="postgresql://hotelcrm:dev_password@localhost:5432/hotel_crm"
npm run db:push
```

## API Documentation

### Base URL
```
http://localhost:3001/api/v1
```

### Authentication

All protected endpoints require JWT token in `Authorization` header:
```
Authorization: Bearer <access_token>
```

### Response Format

Success response (200/201):
```json
{
  "status": "success",
  "data": { "id": "...", "name": "..." },
  "meta": {
    "timestamp": "2026-05-27T10:30:00Z",
    "request_id": "req-123"
  }
}
```

Error response (4xx/5xx):
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  },
  "meta": {
    "timestamp": "2026-05-27T10:30:00Z",
    "request_id": "req-123"
  }
}
```

### Endpoints (MVP Phase 1)

**Auth Module** (`/auth`)
- `POST /signup` - Register new user
- `POST /login` - Login with email/password
- `POST /refresh` - Refresh access token
- `POST /logout` - Logout (authenticated)
- `GET /me` - Get current user (authenticated)
- `PUT /profile` - Update profile (authenticated)

**CRM Module** (`/crm`)
- `GET /hotels` - List hotels
- `POST /hotels` - Create hotel
- `GET /hotels/:hotel-id` - Get hotel
- `GET /hotels/:hotel-id/rooms` - List rooms
- `POST /hotels/:hotel-id/tasks` - Create task
- `POST /tasks/:task-id/photos` - Upload task photo

**Quality Module** (`/quality`)
- `POST /verifications` - Submit quality verification
- `POST /ratings` - Rate worker
- `GET /leaderboard` - Get worker leaderboard

**HR Module** (`/hr`)
- `GET /contracts` - List contracts
- `POST /contracts` - Create contract
- `GET /payroll` - List payroll records
- `POST /payroll` - Create payroll

**Staffing Module** (`/staffing`)
- `POST /work-requests` - Create work request
- `GET /available-workers` - Get available workers
- `POST /work-requests/:id/assign-workers` - Assign workers

**Notifications Module** (`/notifications`)
- `GET /` - List notifications
- `POST /:id/read` - Mark as read

**Analytics Module** (`/analytics`)
- `GET /leaderboard` - Get leaderboard
- `GET /stats` - Get dashboard stats

**Calendar Module** (`/calendar`)
- `GET /hotels/:hotel-id/operations` - List daily operations
- `POST /hotels/:hotel-id/operations` - Create daily operation

See [../API_STANDARDS.md](../API_STANDARDS.md) for complete API specifications.

## Development Workflow

1. **Create a new feature branch**
   ```bash
   git checkout -b feature/auth-module
   ```

2. **Follow the modular structure**
   - Create files in `src/modules/<module>/`
   - Keep services, controllers, routes, and types separate
   - Use `BaseService` for shared functionality

3. **Implement with validation**
   - Use Zod schemas for request validation
   - Use TypeScript strict mode
   - Follow API standards for responses

4. **Test your changes**
   ```bash
   npm run typecheck
   npm run lint
   # Manual testing via API
   ```

5. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: implement auth module"
   git push origin feature/auth-module
   ```

## Key Principles

### Modular Structure
- Each module is self-contained (routes, controller, service, types)
- Modules communicate via service interfaces, not direct database access
- Future extraction to microservices requires no refactoring

### Security
- JWT authentication on all protected endpoints
- Role-based access control (RBAC) via permissions middleware
- Hotel scope enforcement for managers
- Sensitive data encrypted at rest (contracts, payroll, documents)
- Audit logging for compliance

### Error Handling
- Custom error classes with HTTP status codes and error codes
- Global error middleware catches all exceptions
- Consistent error response format
- Detailed error messages in development, generic in production

### Logging
- Structured logging with Winston
- Separate logs for errors and combined output
- Request logging with unique request IDs
- Different log levels per environment

### Database
- Single PostgreSQL database
- Prisma ORM for type-safe queries
- Migrations managed via Prisma
- Relationships enforced at database level

## Deferred to Phase 2

The following are intentionally NOT implemented in Phase 1:

- **AI Chatbot** - Claude API integration
- **Geolocation** - Worker location tracking
- **Advanced Staffing** - Auto-matching algorithm
- **Calendar Sync** - Google Calendar integration
- **Full Offline Support** - WatermelonDB/PowerSync
- **Advanced Analytics** - Custom reporting
- **Biometric Auth** - Face ID / Touch ID
- **Additional Languages** - Beyond English, German, Portuguese
- **Event Bus** - Message queue for async operations

## Troubleshooting

### Database Connection Error
```bash
# Check connection string
echo $DATABASE_URL

# Verify PostgreSQL is running
psql $DATABASE_URL -c "SELECT 1"
```

### JWT Secret Invalid
```
Error: JWT_SECRET must be at least 32 characters
```
Generate a new secret:
```bash
openssl rand -base64 32
```

### Port Already in Use
```bash
# Change port in .env
PORT=3002

# Or kill existing process
lsof -ti:3001 | xargs kill -9
```

## Production Checklist

Before deploying to production:

- [ ] Database backups configured
- [ ] Environment variables securely set
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting configured
- [ ] Logging sent to centralized system (Sentry, etc.)
- [ ] Health check endpoint tested
- [ ] Error handling verified
- [ ] CORS origins restricted
- [ ] JWT secrets rotated
- [ ] Audit logging enabled

## Contributing

1. Follow the module structure
2. Use TypeScript strict mode
3. Follow API_STANDARDS.md for endpoints
4. Update this README if adding new endpoints or configuration
5. Include JSDoc comments for public functions
6. Test thoroughly before committing

## License

MIT
