# Infrastructure & Deployment Plan — Hotel CRM

**Stack:** Node.js · Express · Prisma · PostgreSQL · DigitalOcean · Expo  
**Architecture:** Modular Monolith (MVP) → path to microservices  
**Date:** 2026-06-09  
**Region primary:** Frankfurt (`fra1`) — GDPR-compliant EU hosting

---

## 1. Environment Strategy

### Three-Environment Pipeline

| Environment | Purpose | Branch | Domain |
|---|---|---|---|
| `development` | Local dev via Docker Compose | feature/* | localhost:3001 |
| `staging` | Pre-prod integration & QA | `main` | staging-api.hotelcrm.app |
| `production` | Live system | `release/*` | api.hotelcrm.app |

### Environment Separation Rules

- Each environment has its own DigitalOcean PostgreSQL cluster (never share DB between envs)
- Staging mirrors production topology at 50% capacity
- Production environment variables are **never** stored in source control
- Mobile apps (Expo) use build-time `APP_ENV` flag to switch API base URLs

### `.env` File Conventions

```
# Local only — never committed
backend/.env                 # development overrides
backend/.env.test            # test runner overrides

# Committed — safe defaults only
backend/.env.example         # template with no secrets
```

### Mobile Build Flavors (Expo)

```
# worker-app / checker-app
APP_ENV=development   → http://localhost:3001/api/v1
APP_ENV=staging       → https://staging-api.hotelcrm.app/api/v1
APP_ENV=production    → https://api.hotelcrm.app/api/v1
```

EAS Build profiles (`eas.json`) map `APP_ENV` per build profile.

---

## 2. Secrets Management

### Tool: DigitalOcean App Platform Environment Variables (encrypted at rest)

All production secrets are stored as **encrypted env vars** in DO App Platform — never in `.env` files on the server, never in Git.

### Secret Categories & Storage

| Secret | Storage Location | Rotation Cadence |
|---|---|---|
| `DATABASE_URL` | DO App Platform (encrypted) | On breach / quarterly |
| `JWT_SECRET` (≥32 chars) | DO App Platform | Quarterly |
| `JWT_REFRESH_SECRET` | DO App Platform | Quarterly |
| `DO_SPACES_KEY` / `SECRET` | DO App Platform | Quarterly |
| `SENDGRID_API_KEY` | DO App Platform | Annually |
| `APNS_KEY_ID` / `TEAM_ID` | DO App Platform + `.p8` file in DO Spaces (private bucket) | On cert expiry |
| `FIREBASE_CREDENTIALS` | DO App Platform (base64 JSON) | Annually |
| `SENTRY_DSN` | DO App Platform | Non-sensitive; change if project moves |
| DB passwords | DigitalOcean managed DB (rotated via DO control panel) | Quarterly |

### Secret Injection Pattern

```typescript
// src/config/env.ts — validate all env vars at startup
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // ... all required vars
});

export const env = envSchema.parse(process.env); // throws at boot if missing
```

Server **refuses to start** if any required secret is absent — fail-fast is safer than running with defaults.

### Rotation Procedure

1. Generate new secret value
2. Update DO App Platform encrypted env var (zero-downtime rolling deploy triggers automatically)
3. Invalidate all active `Session` rows for JWT secrets (forced re-login)
4. Archive old value in team password manager (1Password/Bitwarden) with rotation date

### GDPR / Compliance Notes

- Payroll `encrypted_data` field uses **AES-256** with keys referenced via `encryption_key_id` — actual keys stored in DO App Platform, never in DB
- Document URLs in DO Spaces use **pre-signed URLs** (15-min expiry) — no direct public access
- Audit logs (`AuditLog` table) capture all access to sensitive resources

---

## 3. Backup Strategy

### PostgreSQL Backups (DigitalOcean Managed DB)

| Tier | Frequency | Retention | RPO | RTO |
|---|---|---|---|---|
| Automated daily snapshots | Daily 02:00 UTC | 7 days (dev), 30 days (prod) | 24h | 30 min |
| Point-in-time recovery (PITR) | Continuous WAL streaming | 7 days (prod) | 5 min | 1 hour |
| Weekly manual export | Sunday 03:00 UTC | 90 days | — | — |

DigitalOcean Managed PostgreSQL includes automated backups and PITR out of the box on Business tier.

### Weekly Export Automation

```bash
# Runs as DO Scheduled Function or cron on a droplet
pg_dump $DATABASE_URL --format=custom --compress=9 \
  | aws s3 cp - s3://hotelcrm-backups/weekly/$(date +%Y%m%d).dump \
    --endpoint-url https://fra1.digitaloceanspaces.com \
    --storage-class STANDARD_IA
```

### DO Spaces (File Storage) Backups

- Lifecycle policy: transition files to `ARCHIVE` tier after 180 days
- Cross-region replication: `fra1` → `ams3` for production bucket
- Versioning enabled on `hotelcrm-uploads` bucket — 30-day version retention

### Application State Backup

Redis (if used for caching) is ephemeral — no backup needed; data reconstructed from PostgreSQL.

### Backup Validation

- Monthly restore drill: restore latest backup to a throwaway DO Managed DB instance, run `prisma db pull` to validate schema integrity
- Automated restore test via GitHub Actions on the first Monday of each month

---

## 4. Monitoring

### Stack: DigitalOcean Monitoring + Sentry + UptimeRobot

#### Infrastructure Metrics (DO Monitoring — included free)

| Metric | Alert Threshold | Channel |
|---|---|---|
| CPU utilization | > 80% for 5 min | Slack #alerts |
| Memory usage | > 85% | Slack #alerts |
| Disk I/O | > 90% | PagerDuty (prod only) |
| DB connection pool | > 80% of max_connections | Slack #alerts |
| DB disk usage | > 75% | Slack #alerts + email |

#### Application Metrics (Sentry Performance)

```typescript
// src/server.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    new Sentry.Integrations.Prisma({ client: prisma }),
  ],
});
```

Key Sentry dashboards:
- Error rate by route and user role
- P95/P99 API latency per endpoint
- Prisma query performance (slow query detection > 500ms)
- Mobile crash-free sessions (Expo Sentry SDK)

#### Uptime Monitoring (UptimeRobot — free tier)

- Health endpoint: `GET /api/v1/health` → checks DB connectivity, returns `{ status, db, version, uptime }`
- Check interval: 5 minutes
- Alert: email + Slack on 2 consecutive failures
- Public status page: `status.hotelcrm.app`

#### Business Metrics (Custom — log-derived)

Track via structured log queries (see Logging section):
- Tasks created/completed per day per hotel
- Worker assignments filled rate
- Quality verification turnaround time
- Push notification delivery rate

---

## 5. Logging

### Stack: Winston + DigitalOcean Managed Logging (or Logtail)

### Log Levels

```
ERROR   — unhandled exceptions, DB failures, auth breaches
WARN    — rate limit hits, validation failures, slow queries (>500ms)
INFO    — request/response cycle, background job completions
DEBUG   — disabled in production; enabled via LOG_LEVEL=debug locally
```

### Structured Log Format (JSON)

```typescript
// src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'hotel-crm-api',
    environment: env.NODE_ENV,
    version: process.env.npm_package_version,
  },
  transports: [
    new winston.transports.Console(),
    // Production: pipe stdout to DO Managed Logging or Logtail agent
  ],
});
```

### Request Logging Middleware

Every request logs: `method`, `path`, `status`, `duration_ms`, `user_id` (if authenticated), `hotel_id` (from JWT), `ip` (hashed for GDPR), `request_id` (UUID for tracing).

### GDPR Log Hygiene

- **Never log** raw PII: passwords, full names, passport numbers, salary figures, document contents
- IP addresses stored as SHA-256 hash in logs
- Log retention: 30 days in hot storage, 90 days in cold archive, then purged
- AuditLog table (PostgreSQL) is the authoritative trail for compliance — logs are operational only

### Log Aggregation (Production)

```
App Container stdout (JSON)
    → DO App Platform log drain
    → Logtail (Better Stack) [~$25/month for 5GB/day]
    → Retention: 30 days searchable, 1 year archive
```

Logtail alerts trigger on:
- `level: "error"` → immediate Slack notification
- `message: "prisma query slow"` with `duration_ms > 1000` → weekly digest
- `status: 401` spike > 50/min → Slack alert (possible credential stuffing)

---

## 6. CI/CD Pipeline

### GitHub Actions Workflow

```
Push to feature/* → CI (lint + typecheck + tests)
Merge to main    → CI + Deploy to STAGING
Tag release/*    → CI + Deploy to PRODUCTION (manual approval gate)
```

### Pipeline Definition

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: ['**']
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: hotelcrm_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install backend deps
        run: npm ci
        working-directory: backend

      - name: Typecheck
        run: npm run typecheck
        working-directory: backend

      - name: Lint
        run: npm run lint
        working-directory: backend

      - name: Prisma migrate (test DB)
        run: npx prisma migrate deploy
        working-directory: backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hotelcrm_test

      - name: Tests
        run: npm test
        working-directory: backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hotelcrm_test
          NODE_ENV: test
          JWT_SECRET: test-secret-min-32-characters-long!!
          JWT_REFRESH_SECRET: test-refresh-secret-32-chars-long!!
```

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: ci  # reuse CI workflow via workflow_call
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to DO App Platform (staging)
        uses: digitalocean/app_action@v1
        with:
          app_name: hotel-crm-staging
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
```

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    tags: ['release/*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # requires manual approval in GitHub Environments
    steps:
      - uses: actions/checkout@v4

      - name: Run DB migrations (production)
        run: npx prisma migrate deploy
        working-directory: backend
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}

      - name: Deploy to DO App Platform (production)
        uses: digitalocean/app_action@v1
        with:
          app_name: hotel-crm-production
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
```

### Deployment Process (Zero-Downtime)

DO App Platform performs rolling deploys by default:
1. Build new container image
2. Run `prisma migrate deploy` (migration must be backward-compatible)
3. Start new instance, pass health check (`GET /api/v1/health`)
4. Route traffic to new instance
5. Terminate old instance

**Additive-only migration rule:** Never rename/drop columns in a single deploy. Use expand-contract pattern (add column → deploy → backfill → remove old column → deploy).

### Mobile (Expo EAS)

```bash
# Staging OTA update (no app store submission)
eas update --branch staging --message "fix: task status sync"

# Production release build → App Store / Play Store
eas build --platform all --profile production
eas submit --platform all
```

---

## 7. Production Topology

### DigitalOcean Architecture

```
                          ┌─────────────────────────────────────────┐
                          │         DigitalOcean  fra1               │
                          │                                          │
  Mobile (Expo) ──────┐   │   ┌─────────────┐    ┌──────────────┐  │
  Web Frontend ───────┼───┼──▶│  DO Load    │───▶│  App Platform │  │
  Admin Dashboard ────┘   │   │  Balancer   │    │  (2 instances)│  │
                          │   │  (HTTPS/443)│    │  Node/Express │  │
                          │   └─────────────┘    │  Port 3001    │  │
                          │                      └──────┬───────┘  │
                          │                             │           │
                          │   ┌─────────────────────────▼────────┐  │
                          │   │    DO Managed PostgreSQL          │  │
                          │   │    Primary (4GB RAM, 2 vCPU)     │  │
                          │   │    Standby replica (hot)          │  │
                          │   │    Connection pooler (PgBouncer)  │  │
                          │   └──────────────────────────────────┘  │
                          │                                          │
                          │   ┌──────────────────────────────────┐  │
                          │   │    DO Spaces (fra1)               │  │
                          │   │    hotelcrm-uploads (private)     │  │
                          │   │    hotelcrm-backups               │  │
                          │   └──────────────────────────────────┘  │
                          │                                          │
                          │   ┌──────────────┐                       │
                          │   │  DO Redis    │  (optional, caching)  │
                          │   │  1GB managed │                       │
                          │   └──────────────┘                       │
                          └─────────────────────────────────────────┘

  External Services:
  ├── SendGrid (transactional email)
  ├── APNs / FCM (push notifications)
  ├── Sentry (error tracking)
  └── Expo EAS (mobile CI/CD + OTA updates)
```

### App Platform Specification

```yaml
# .do/app.yaml
name: hotel-crm-production
region: fra

services:
  - name: api
    source_dir: /backend
    github:
      branch: main
      deploy_on_push: false  # controlled by CI/CD workflow
    build_command: npm ci && npm run build
    run_command: node dist/server.js
    environment_slug: node-js
    instance_count: 2          # HA — 2 instances minimum
    instance_size_slug: professional-xs  # 1 vCPU, 1GB RAM (~$12/mo each)
    health_check:
      http_path: /api/v1/health
      initial_delay_seconds: 20
      period_seconds: 10
      failure_threshold: 3
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
        type: SECRET
      - key: JWT_SECRET
        type: SECRET
      # ... all secrets injected here

databases:
  - name: db
    engine: PG
    version: "15"
    size: db-s-2vcpu-4gb   # $50/mo — 4GB RAM, 38GB SSD, standby included
    num_nodes: 2            # primary + standby
```

### Scaling Triggers

- **Horizontal:** Scale App Platform instances from 2 → 4 when CPU > 70% sustained 10 min
- **Vertical:** Upgrade DB tier when DB CPU > 60% average over 1 day or connection pool > 80%
- **Read replica:** Add when reporting queries begin affecting write latency (> 200ms average)

### Network Security

- All traffic HTTPS/TLS 1.3 (DO Load Balancer terminates TLS)
- DO Managed DB: SSL required (`?sslmode=require` in DATABASE_URL), VPC-internal connection
- DO Spaces: private bucket + pre-signed URLs (15-min TTL) — no public read
- App instances: private VPC, only LB exposes public IP
- Rate limiting: 100 req/min per IP on auth routes, 1000 req/min on API routes

---

## 8. Cost Estimates

### Monthly Production Costs (fra1, EUR approximate)

| Resource | Spec | Monthly Cost |
|---|---|---|
| App Platform — 2 × Professional XS | 1 vCPU, 1GB RAM each | ~$24 |
| DO Managed PostgreSQL | 2-node cluster, 4GB RAM, 38GB SSD | ~$50 |
| DO Spaces | 250GB storage + 1TB egress | ~$8 |
| DO Load Balancer | Included in App Platform | $0 |
| DO Managed Redis | 1GB (optional, caching) | ~$15 |
| Sentry | Team plan (1 seat free, 5 devs ~$26/mo) | ~$26 |
| SendGrid | Essentials 40K emails/mo | ~$15 |
| UptimeRobot | Free tier (50 monitors) | $0 |
| Expo EAS | Production plan | ~$29 |
| **Total MVP** | | **~$167/mo** |

### Staging Environment

| Resource | Spec | Monthly Cost |
|---|---|---|
| App Platform — 1 × Basic XS | Shared, 512MB RAM | ~$5 |
| DO Managed PostgreSQL | 1-node, 1GB RAM | ~$15 |
| DO Spaces | Shared dev bucket | ~$2 |
| **Total Staging** | | **~$22/mo** |

### Cost Scaling Milestones

| Monthly Active Users | Est. Monthly Infra Cost | Key Upgrade |
|---|---|---|
| < 200 (MVP) | ~$167 | Current spec |
| 200–1,000 | ~$300 | Scale to 4 app instances, larger DB |
| 1,000–5,000 | ~$600 | Read replica, Redis, CDN |
| 5,000+ | ~$1,200+ | Re-evaluate to microservices |

---

## 9. Disaster Recovery

### RPO / RTO Targets

| Tier | Event | RPO | RTO |
|---|---|---|---|
| P1 — DB corruption/deletion | Malicious delete, botched migration | 5 min (PITR) | 1 hour |
| P2 — App instance failure | Crashed container, OOM | 0 (stateless, auto-restart) | 2 min |
| P3 — DO region outage | Full fra1 unavailability | 24h (last snapshot) | 4 hours |
| P4 — Secrets exposure | Leaked JWT/DB creds | N/A | 30 min (rotation) |

### DR Runbooks

#### P1 — Database Recovery

```bash
# 1. Identify recovery point
doctl databases backup list <db-id>

# 2. Restore to new cluster from PITR
doctl databases restore <db-id> \
  --restore-from-timestamp "2026-06-09T02:00:00Z" \
  --name hotel-crm-restored

# 3. Update DATABASE_URL in App Platform to point to restored cluster
#    (App Platform will rolling-restart automatically)

# 4. Verify data integrity
cd backend && npx prisma db pull  # compare schema
npm run db:seed -- --check-only   # validate row counts
```

#### P2 — App Instance Recovery

DO App Platform auto-restarts failed instances. Manual escalation:

```bash
# Force redeploy from last known-good image
doctl apps create-deployment <app-id> --force-rebuild=false
```

#### P3 — Region Failover (ams3)

Pre-requisites (set up during initial deployment):
- DO Spaces cross-region replication: fra1 → ams3 already enabled
- Weekly DB export stored in ams3 Spaces bucket

```bash
# 1. Restore latest weekly dump to ams3 Managed DB
pg_restore --clean --if-exists -d $AMS3_DATABASE_URL hotelcrm-backup-latest.dump

# 2. Deploy App Platform in ams3 region (app.yaml with region: ams)
doctl apps create --spec .do/app-ams3.yaml

# 3. Update DNS (Cloudflare/DO DNS) A record to point to ams3 load balancer IP
#    TTL should be pre-set to 60s for fast failover

# 4. Notify users via status page (status.hotelcrm.app)
```

Expected ams3 failover time: **2–4 hours** (restore + DNS propagation).

#### P4 — Secrets Rotation (Breach Response)

```bash
# Execute within 30 minutes of suspected breach:

# 1. Rotate JWT_SECRET — invalidates ALL active sessions
#    Update in DO App Platform → rolling deploy auto-triggers

# 2. Rotate DB password via DO control panel
#    Update DATABASE_URL in App Platform

# 3. Rotate DO Spaces keys
#    Generate new key pair in DO control panel
#    Update DO_SPACES_KEY / DO_SPACES_SECRET in App Platform

# 4. Purge all Session rows (force re-login for all users)
psql $DATABASE_URL -c "DELETE FROM \"Session\";"

# 5. Review AuditLog for breach scope
psql $DATABASE_URL -c \
  "SELECT * FROM \"AuditLog\" WHERE timestamp > NOW() - INTERVAL '24h' ORDER BY timestamp DESC LIMIT 500;"
```

### DR Communication Plan

| Event | Immediate (0–15 min) | 1 hour | Resolution |
|---|---|---|---|
| DB outage | Alert Slack #incidents | Email hotel managers | Post-mortem within 48h |
| App outage | UptimeRobot → Slack | Update status.hotelcrm.app | RCA in 24h |
| Data breach | Internal escalation + legal | Notify affected users (GDPR: 72h obligation) | DPA notification if required |

### GDPR Incident Obligation

Under GDPR Article 33: personal data breaches must be reported to the relevant DPA (e.g., BfDI for Germany) **within 72 hours** of discovery. The `AuditLog` table and structured logs provide the evidence trail required for the breach notification.

---

## Implementation Checklist

### Phase 1 — Foundation (Week 1)
- [ ] Create DO project with VPC in fra1
- [ ] Provision Managed PostgreSQL (dev + staging + prod clusters)
- [ ] Configure DO Spaces buckets with versioning and cross-region replication
- [ ] Set up GitHub Actions CI pipeline with test DB
- [ ] Add `src/config/env.ts` fail-fast validation
- [ ] Implement `GET /api/v1/health` endpoint

### Phase 2 — Security & Observability (Week 2)
- [ ] Integrate Sentry (backend + both Expo apps)
- [ ] Configure Winston structured logging with request middleware
- [ ] Set up DO Monitoring alerts (CPU, memory, DB connections)
- [ ] Configure UptimeRobot with Slack webhook
- [ ] Implement pre-signed URL generation for DO Spaces file access
- [ ] Enable rate limiting middleware (express-rate-limit)

### Phase 3 — CI/CD & Staging (Week 3)
- [ ] Write `.do/app.yaml` for staging and production App Platform specs
- [ ] Configure GitHub Actions deploy-staging workflow
- [ ] Configure GitHub Actions deploy-production workflow with manual approval gate
- [ ] Set up EAS Build profiles for worker-app and checker-app
- [ ] Run first full staging deployment and smoke-test

### Phase 4 — DR & Hardening (Week 4)
- [ ] Configure automated weekly DB export to DO Spaces
- [ ] Document and test P1 DB restore runbook
- [ ] Pre-configure ams3 failover App Platform spec
- [ ] Set DNS TTL to 60s on api.hotelcrm.app
- [ ] Schedule monthly backup restore drill (GitHub Actions cron)
- [ ] Complete GDPR data retention automation for `DataRetentionLog`
