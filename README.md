# Hotel CRM - Modular Monolith Architecture

**Version**: 1.0.0 (MVP - Phase 1)  
**Status**: Architecture finalized, implementation in progress  
**Deployment**: AWS (eu-central-1 / Frankfurt, Europe-only)

## Architecture Overview

We are building a **modular monolith** — a single Express.js + TypeScript application with clearly separated internal modules. Each module is designed to be extracted into a future microservice if needed, but runs in-process for MVP simplicity and performance.

### Why Modular Monolith (Not Microservices)?

| Aspect | Microservices | Modular Monolith |
|--------|---------------|------------------|
| Deployment | 10 containers | 1 container |
| Network overhead | Inter-service HTTP calls (+50ms) | In-process calls (0ms) |
| Debugging | Distributed tracing needed | Single process, simple logs |
| Team size needed | 5-7 devs | 3-4 devs |
| Infrastructure cost | €220/month | €87/month |
| Timeline | 12-16 weeks | 4 weeks |

## Repository Structure

```
hotel-crm/
├── backend/                    # Single Express.js + TypeScript monolith
│   ├── src/
│   │   ├── server.ts          # Single entry point
│   │   ├── config/            # Environment & service configuration
│   │   ├── middleware/        # Shared middleware (auth, validation, errors)
│   │   ├── modules/           # Business logic modules (each future microservice)
│   │   │   ├── auth/          # Authentication
│   │   │   ├── crm/           # Hotels, Rooms, Tasks
│   │   │   ├── hr/            # HR & Payroll
│   │   │   ├── quality/       # Quality Verification
│   │   │   ├── calendar/      # Availability & Scheduling
│   │   │   ├── staffing/      # Worker Assignment
│   │   │   ├── notifications/ # Push/Email/In-app
│   │   │   └── analytics/     # Metrics & Reporting
│   │   ├── shared/            # Common utilities (db, cache, logger, errors)
│   │   └── types/             # Shared TypeScript definitions
│   ├── prisma/                # Prisma ORM schema & migrations
│   ├── tests/                 # Test suite
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # Next.js dashboard
│   ├── app/                   # App Router structure
│   └── public/
│
├── mobile/                    # React Native apps
│   ├── worker-app/            # Worker/Staff app
│   └── checker-app/           # Quality Checker app
│
├── docs/                      # Architecture & API documentation
├── docker-compose.yml         # Local development services
├── _legacy/                   # Archived files from old architecture
│   ├── backend-microservices/ # Old microservice code
│   ├── docker/                # Old Docker configs
│   └── k8s/                   # Old Kubernetes configs
│
└── README.md                  # This file
```

## Module Boundaries

Each module in `backend/src/modules/` follows this structure:

```
module/
├── routes.ts       # Express route definitions
├── controller.ts   # HTTP request handlers
├── service.ts      # Business logic & database queries
├── model.ts        # Database model (via Prisma)
└── types.ts        # TypeScript interfaces for this module
```

### Modules

- **auth**: User authentication, JWT tokens, permissions
- **crm**: Hotels, rooms, workers, task management
- **hr**: Employee records, contracts, payroll
- **quality**: Quality verification, rating system
- **calendar**: Availability tracking, scheduling
- **staffing**: Worker assignment, optimization
- **notifications**: Push, email, in-app messaging
- **analytics**: Metrics, reporting, leaderboards

## Technology Stack

### Backend
- **Runtime**: Node.js + Express.js
- **Language**: TypeScript
- **ORM**: Prisma (PostgreSQL)
- **Cache**: Redis (optional, performance layer only)
- **Validation**: Zod
- **Testing**: Jest + Supertest
- **Deployment**: Docker on AWS EC2 (image in AWS ECR)

### Frontend
- **Framework**: Next.js 14+
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **State**: Zustand/TanStack Query

### Mobile
- **Framework**: React Native + Expo
- **Platform**: iOS & Android
- **Deployment**: Expo EAS

### Database
- **Primary**: PostgreSQL 15 (AWS RDS PostgreSQL)
- **Cache**: Redis 7 (on EC2 via Docker; AWS ElastiCache when scaling)

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15 (local or via Docker)

### Local Development Setup

```bash
# Clone repository
git clone <repo-url>
cd hotel-crm

# Install workspace dependencies
npm install

# Start local services (PostgreSQL, Redis, Adminer, MailHog)
docker-compose up -d

# Setup database
cd backend
npx prisma migrate dev
npx prisma db seed

# Start backend development server
npm run dev

# In another terminal, start frontend
cd ../frontend
npm run dev

# Access:
# - Backend API: http://localhost:3001
# - Frontend: http://localhost:3000
# - Database UI (Adminer): http://localhost:8082
# - Email UI (MailHog): http://localhost:8025
```

## Development Workflow

### Adding a New Module

1. Create folder: `backend/src/modules/module-name/`
2. Create files: `routes.ts`, `controller.ts`, `service.ts`, `model.ts`, `types.ts`
3. Update Prisma schema in `backend/prisma/schema.prisma`
4. Register routes in `backend/src/server.ts`
5. Add tests in `backend/tests/`

### Making Database Changes

```bash
cd backend

# Create migration
npx prisma migrate dev --name add_feature_name

# Reset (local only)
npx prisma migrate reset
```

### Running Tests

```bash
cd backend
npm test                    # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

## Architecture Decisions

### Modular Monolith vs Microservices
✅ **Chosen**: Modular Monolith (Phase 1)
- Single deployment, simple debugging, low ops cost
- Modules are designed for future microservice extraction
- Revisit in Phase 2 if scaling demands it

### Database
✅ **Chosen**: PostgreSQL + Prisma
- AWS RDS PostgreSQL (same db engine in dev/prod)
- Prisma ORM for type-safe queries
- No Supabase (avoid vendor lock-in)

### Caching
✅ **Chosen**: Redis as optional performance layer
- Cache is NOT source of truth
- App must work if Redis is unavailable
- Falls back to PostgreSQL queries

### Deployment
✅ **Chosen**: AWS
- Single EC2 instance MVP
- eu-central-1 (Frankfurt) region (EU compliance)
- Docker containers, image stored in AWS ECR
- RDS PostgreSQL for the database, S3 for uploads/documents
- Scale horizontally behind an Application Load Balancer when needed

## Migration Path to Microservices (Phase 2+)

When traffic demands it:
1. Copy module folder into its own service
2. Add Express wrapper + Dockerfile
3. Replace in-process function calls with HTTP client calls
4. Deploy as separate container
5. Update reverse proxy routing

**Zero refactoring needed** — code is already organized for this.

## Environment Variables

Create `.env.local` in the `backend/` directory:

```env
# Database
DATABASE_URL="postgresql://hotelcrm:password@localhost:5432/hotelcrm_dev?schema=public"

# Redis
REDIS_URL="redis://:dev_password@localhost:6379"

# JWT
JWT_SECRET="your-secret-key-min-32-chars"

# Environment
NODE_ENV="development"
LOG_LEVEL="debug"

# AWS (production only)
AWS_REGION="eu-central-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
S3_BUCKET=""
```

## API Standards

All endpoints must follow these rules:

1. **Response Format**:
   ```json
   {
     "success": true,
     "data": { /* payload */ },
     "error": null
   }
   ```

2. **Error Format**:
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "INVALID_REQUEST",
       "message": "User-friendly message",
       "details": {}
     }
   }
   ```

3. **Validation**: Use Zod for all request bodies
4. **Auth**: JWT token in `Authorization: Bearer <token>` header
5. **Permissions**: Role-based access control (RBAC)

## RBAC & Permissions

All endpoints must check permissions. See `RBAC_PERMISSION_MATRIX.md` in `/docs/` for detailed permission matrix.

## Monitoring & Logging

- **Logs**: Structured JSON logs via Winston
- **Monitoring**: AWS CloudWatch (metrics, logs, alarms)
- **Tracing**: OpenTelemetry (Phase 2)
- **Alerts**: Uptime monitoring (Phase 2)

## Security & GDPR

### Required
- JWT authentication
- Role-based permissions
- Hotel-scoped data access
- Audit logging for HR/payroll
- GDPR-compliant deletion/export
- Encrypted HR documents
- Encrypted payroll data

### Never
- Expose payroll broadly
- Allow payroll deletion
- Bypass permission middleware
- Store sensitive data unencrypted

## Testing

- **Unit**: 80%+ coverage required
- **Integration**: Real database tests
- **E2E**: Cypress/Playwright (Phase 2)

## Deployment

### Development
```bash
docker-compose up -d
npm run dev
```

### Production (AWS)
```bash
docker build -t hotel-crm:latest .
# Authenticate to ECR, then push
aws ecr get-login-password --region eu-central-1 \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-central-1.amazonaws.com
docker tag hotel-crm:latest <account-id>.dkr.ecr.eu-central-1.amazonaws.com/hotel-crm/backend:latest
docker push <account-id>.dkr.ecr.eu-central-1.amazonaws.com/hotel-crm/backend:latest
# Deploy to EC2 (pull image + restart). See AWS_DEPLOYMENT_GUIDE.md
```

## Troubleshooting

### Database connection refused
- Check PostgreSQL is running: `docker-compose ps`
- Verify `DATABASE_URL` in `.env.local`
- Reset: `npx prisma migrate reset`

### Redis connection refused
- Check Redis is running: `docker-compose ps`
- Clear Redis: `redis-cli -a dev_password FLUSHALL`

### Type errors in modules
- Regenerate Prisma types: `npx prisma generate`
- Rebuild TypeScript: `tsc --noEmit`

## Contributing

1. Create feature branch from `main`
2. Follow module structure for new features
3. Write tests (80%+ coverage)
4. Update documentation
5. Submit PR with description of changes

## Phase 1 - MVP Scope

### Included
- Authentication
- Hotels & Rooms
- Task management
- Worker assignments
- Quality verification
- Rating system
- Leaderboard
- HR basics (contracts, documents)
- Notifications
- Daily operations

### Deferred (Phase 2+)
- AI chatbot
- Geolocation tracking
- Full offline-first sync
- Kubernetes deployment
- Microservices
- Advanced analytics
- Multi-region deployment

## Documentation

- `MASTER_ARCHITECTURE.md` — Architecture decisions & rationale
- `CLAUDE_CONTEXT.md` — Operational context for Claude
- `/docs/API_STANDARDS.md` — API contract guidelines
- `/docs/RBAC_PERMISSION_MATRIX.md` — Permission rules
- `/docs/DATABASE_SCHEMA.md` — Data model documentation
- `/docs/EVENT_FLOW_MAPPING.md` — User workflows

## License

Proprietary - Zirove/Hotel CRM Project

## Support

For questions about architecture or implementation, refer to:
1. MASTER_ARCHITECTURE.md (decisions & rationale)
2. CLAUDE_CONTEXT.md (operational context)
3. Module README files in each service folder
