# Infrastructure & Deployment Plan — Hotel CRM

**Stack:** Node.js · Express · Prisma · PostgreSQL · AWS · Expo
**Architecture:** Modular Monolith (MVP) → path to microservices
**Date:** 2026-06-09 · **Reconciled to AWS:** 2026-06-19
**Region primary:** Frankfurt (`eu-central-1`) — GDPR-compliant EU hosting

> **Platform note:** This plan was migrated from DigitalOcean to **AWS** as the single deployment platform. AWS service mapping: Compute = **EC2**, Database = **RDS PostgreSQL**, Storage = **S3**, Registry = **ECR**, Monitoring = **CloudWatch**, SSL = **ACM**, DNS = **Route53** (optional), Secrets = **AWS Secrets Manager** (env vars acceptable for MVP). See `AWS_DEPLOYMENT_GUIDE.md` for the step-by-step procedure.

---

## 1. Environment Strategy

### Three-Environment Pipeline

| Environment | Purpose | Branch | Domain |
|---|---|---|---|
| `development` | Local dev via Docker Compose | feature/* | localhost:3001 |
| `staging` | Pre-prod integration & QA | `main` | staging-api.hotelcrm.app |
| `production` | Live system | `release/*` | api.hotelcrm.app |

### Environment Separation Rules

- Each environment has its own AWS RDS PostgreSQL instance (never share DB between envs)
- Staging mirrors production topology at 50% capacity
- Production secrets live in AWS Secrets Manager (or EC2 instance env file for MVP) — **never** in source control
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

### Tool: AWS Secrets Manager (preferred) — env vars on EC2 acceptable for MVP

All production secrets are stored in **AWS Secrets Manager** and injected at boot — never committed to Git. For the MVP, an alternative is an `/etc/hotel-crm/.env` file on the EC2 instance (chmod 600, owned by the deploy user) populated from Secrets Manager.

### Secret Categories & Storage

| Secret | Storage Location | Rotation Cadence |
|---|---|---|
| `DATABASE_URL` | AWS Secrets Manager | On breach / quarterly |
| `JWT_SECRET` (≥32 chars) | AWS Secrets Manager | Quarterly |
| `JWT_REFRESH_SECRET` | AWS Secrets Manager | Quarterly |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or IAM role) | IAM role on EC2 (preferred) / Secrets Manager | Prefer instance role — no static keys |
| `S3_BUCKET` | App config / Secrets Manager | Non-sensitive |
| `SENDGRID_API_KEY` | AWS Secrets Manager | Annually |
| `APNS_KEY_ID` / `TEAM_ID` | AWS Secrets Manager | On cert expiry |
| `APNS_PRIVATE_KEY_BASE64` | AWS Secrets Manager (base64) | On key expiry |
| `FIREBASE_CREDENTIALS` | AWS Secrets Manager (base64 JSON) | Annually |
| `SENTRY_DSN` | App config | Non-sensitive |
| DB master password | AWS RDS (rotated via Secrets Manager rotation) | Quarterly |

> **Best practice:** EC2 accesses S3 via an **IAM instance role** — no long-lived `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` on the box. Static keys are only for local dev or CI.

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

1. Generate new secret value (or trigger Secrets Manager rotation)
2. Update the secret in AWS Secrets Manager; redeploy / restart the EC2 service to pick it up
3. Invalidate all active `Session` rows for JWT secrets (forced re-login)
4. Archive old value in team password manager (1Password/Bitwarden) with rotation date

### GDPR / Compliance Notes

- Payroll `encrypted_data` field uses **AES-256** with keys referenced via `encryption_key_id` — actual keys stored in AWS Secrets Manager (or AWS KMS), never in DB
- Document URLs in S3 use **pre-signed URLs** (15-min expiry) — no direct public access; bucket has "Block all public access" enabled
- Audit logs (`AuditLog` table) capture all access to sensitive resources

---

## 3. Backup Strategy

### PostgreSQL Backups (AWS RDS)

| Tier | Frequency | Retention | RPO | RTO |
|---|---|---|---|---|
| Automated daily snapshots | Daily 02:00 UTC | 7 days (dev), 30 days (prod) | 24h | 30 min |
| Point-in-time recovery (PITR) | Continuous (transaction logs) | 7 days (prod) | 5 min | 1 hour |
| Weekly manual export | Sunday 03:00 UTC | 90 days | — | — |

AWS RDS includes automated backups and PITR out of the box; enable automated backups with a 30-day retention window on the production instance.

### Weekly Export Automation

```bash
# Runs as a cron on EC2 (or an EventBridge-scheduled Lambda)
pg_dump $DATABASE_URL --format=custom --compress=9 \
  | aws s3 cp - s3://hotelcrm-backups/weekly/$(date +%Y%m%d).dump \
    --storage-class STANDARD_IA
```

### S3 (File Storage) Backups

- Lifecycle policy: transition objects to `GLACIER` after 180 days
- Cross-region replication: `eu-central-1` → `eu-west-1` for production bucket
- Versioning enabled on `hotelcrm-uploads` bucket — 30-day noncurrent version retention

### Application State Backup

Redis (if used for caching) is ephemeral — no backup needed; data reconstructed from PostgreSQL.

### Backup Validation

- Monthly restore drill: restore latest snapshot to a throwaway RDS instance, run `prisma db pull` to validate schema integrity
- Automated restore test via GitHub Actions on the first Monday of each month

---

## 4. Monitoring

### Stack: AWS CloudWatch + Sentry + UptimeRobot

#### Infrastructure Metrics (CloudWatch — EC2 + RDS)

| Metric | Alert Threshold | Channel |
|---|---|---|
| EC2 CPU utilization | > 80% for 5 min | Slack #alerts |
| EC2 memory usage (CW agent) | > 85% | Slack #alerts |
| EC2 disk usage (CW agent) | > 90% | PagerDuty (prod only) |
| RDS DatabaseConnections | > 80% of max_connections | Slack #alerts |
| RDS FreeStorageSpace | < 25% | Slack #alerts + email |

Alarms are defined in CloudWatch and route to SNS → Slack/PagerDuty.

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

Track via CloudWatch Logs Insights queries:
- Tasks created/completed per day per hotel
- Worker assignments filled rate
- Quality verification turnaround time
- Push notification delivery rate

---

## 5. Logging

### Stack: Winston + AWS CloudWatch Logs

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
    // Production: the CloudWatch agent ships stdout to a CloudWatch Logs group
  ],
});
```

### Request Logging Middleware

Every request logs: `method`, `path`, `status`, `duration_ms`, `user_id` (if authenticated), `hotel_id` (from JWT), `ip` (hashed for GDPR), `request_id` (UUID for tracing).

### GDPR Log Hygiene

- **Never log** raw PII: passwords, full names, passport numbers, salary figures, document contents
- IP addresses stored as SHA-256 hash in logs
- Log retention: 30 days searchable in CloudWatch, then exported to S3/Glacier for 1 year, then purged
- AuditLog table (PostgreSQL) is the authoritative trail for compliance — logs are operational only

### Log Aggregation (Production)

```
App Container stdout (JSON)
    → CloudWatch agent on EC2
    → CloudWatch Logs group /hotel-crm/api
    → Retention: 30 days searchable, exported to S3 (1 year archive)
```

CloudWatch metric filters / alarms trigger on:
- `level: "error"` → SNS → immediate Slack notification
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

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: eu-central-1

      - name: Build, tag, push image to ECR
        run: |
          aws ecr get-login-password --region eu-central-1 \
            | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
          docker build -t ${{ secrets.ECR_REGISTRY }}/hotel-crm/backend:$GITHUB_SHA backend
          docker push ${{ secrets.ECR_REGISTRY }}/hotel-crm/backend:$GITHUB_SHA

      - name: Deploy to staging EC2
        run: |
          aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --targets "Key=tag:Name,Values=hotel-crm-staging" \
            --parameters 'commands=["/opt/hotel-crm/scripts/deploy.sh staging '"$GITHUB_SHA"'"]'
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

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: eu-central-1

      - name: Deploy to production EC2
        run: |
          aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --targets "Key=tag:Name,Values=hotel-crm-production" \
            --parameters 'commands=["/opt/hotel-crm/scripts/deploy.sh production '"$GITHUB_REF_NAME"'"]'
```

### Deployment Process (Zero-Downtime)

On EC2, deploys pull the new image and restart behind the reverse proxy / load balancer:
1. Build and push container image to ECR
2. Run `prisma migrate deploy` (migration must be backward-compatible)
3. Pull new image on EC2, start the new container, pass health check (`GET /api/v1/health`)
4. Switch traffic (ALB target / Nginx upstream) to the new container
5. Stop the old container

> For a single-instance MVP without an ALB, use `pm2 reload` / a rolling container swap to minimize downtime.

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

### AWS Architecture

```
                          ┌─────────────────────────────────────────┐
                          │            AWS  eu-central-1             │
                          │                  (VPC)                   │
  Mobile (Expo) ──────┐   │   ┌─────────────┐    ┌──────────────┐  │
  Web Frontend ───────┼───┼──▶│ Application │───▶│   EC2         │  │
  Admin Dashboard ────┘   │   │ Load        │    │ (Node/Express)│  │
                          │   │ Balancer    │    │  Port 3001    │  │
                          │   │ (HTTPS/443, │    │  Docker       │  │
                          │   │  ACM cert)  │    └──────┬───────┘  │
                          │   └─────────────┘           │           │
                          │   ┌─────────────────────────▼────────┐  │
                          │   │    AWS RDS PostgreSQL             │  │
                          │   │    Primary (db.t3.medium)         │  │
                          │   │    Multi-AZ standby (prod)        │  │
                          │   └──────────────────────────────────┘  │
                          │                                          │
                          │   ┌──────────────────────────────────┐  │
                          │   │    AWS S3 (eu-central-1)          │  │
                          │   │    hotelcrm-uploads (private)     │  │
                          │   │    hotelcrm-backups               │  │
                          │   └──────────────────────────────────┘  │
                          │                                          │
                          │   ┌──────────────┐                       │
                          │   │ Redis (Docker │  (optional, caching) │
                          │   │ on EC2 /      │                       │
                          │   │ ElastiCache)  │                       │
                          │   └──────────────┘                       │
                          └─────────────────────────────────────────┘

  Edge / DNS / SSL:
  ├── Route53 (DNS — optional if domain stays external)
  ├── ACM (TLS certificate on the ALB)
  └── AWS WAF (attached to ALB; CloudFront optional for CDN)

  Container images: AWS ECR (hotel-crm/backend)

  External Services:
  ├── SendGrid (transactional email)
  ├── APNs / FCM (push notifications)
  ├── Sentry (error tracking)
  └── Expo EAS (mobile CI/CD + OTA updates)
```

### Compute Specification (EC2)

```
Production:
  EC2 instance         — t3.medium (2 vCPU, 4GB RAM), Ubuntu 24.04 LTS, eu-central-1
  Runs:                  Docker (backend container from ECR), Nginx reverse proxy,
                         Docker Redis (optional), CloudWatch agent
  IAM instance role:     S3 read/write (hotelcrm-uploads), Secrets Manager read,
                         CloudWatch Logs write, ECR pull
  Storage:               30GB gp3 EBS root volume

Database:
  RDS PostgreSQL 15      — db.t3.medium, 50GB gp3, Multi-AZ (prod), automated backups 30d

Object storage:
  S3 bucket              — hotelcrm-uploads (private, versioned, SSE-S3 encryption)
  S3 bucket              — hotelcrm-backups (STANDARD_IA + lifecycle to Glacier)
```

### Scaling Triggers

- **Horizontal:** Place EC2 instances in an Auto Scaling Group behind the ALB; scale 1 → N when CPU > 70% sustained 10 min
- **Vertical:** Upgrade RDS instance class when DB CPU > 60% average over 1 day or connection pool > 80%
- **Read replica:** Add an RDS read replica when reporting queries begin affecting write latency (> 200ms average)
- **Cache:** Migrate Docker Redis → AWS ElastiCache when cache load justifies a managed tier

### Network Security

- All public traffic HTTPS/TLS 1.3 (ALB terminates TLS using an ACM certificate)
- RDS: SSL required (`?sslmode=require` in DATABASE_URL); reachable only from the EC2 security group, private subnet
- S3: "Block all public access" ON; pre-signed URLs (15-min TTL) for file access
- EC2: private subnet where possible; only the ALB security group is internet-facing
- Security groups: ALB SG allows 443 from internet; EC2 SG allows 3001 only from ALB SG; RDS SG allows 5432 only from EC2 SG
- Rate limiting: 100 req/min per IP on auth routes, 1000 req/min on API routes (app-level + AWS WAF rule)

---

## 8. Cost Estimates

### Monthly Production Costs (eu-central-1, USD approximate)

| Resource | Spec | Monthly Cost |
|---|---|---|
| EC2 — t3.medium | 2 vCPU, 4GB RAM (on-demand) | ~$30 |
| RDS PostgreSQL — db.t3.medium Multi-AZ | 2 vCPU, 4GB RAM, 50GB gp3 | ~$110 |
| S3 | 250GB storage + 1TB egress | ~$30 |
| Application Load Balancer | 1 ALB | ~$20 |
| ACM | TLS certificate | $0 (free) |
| Route53 | 1 hosted zone + queries | ~$1 |
| ECR | image storage | ~$1 |
| CloudWatch | metrics, logs, alarms | ~$10 |
| Sentry | Team plan | ~$26 |
| SendGrid | Essentials 40K emails/mo | ~$15 |
| UptimeRobot | Free tier (50 monitors) | $0 |
| Expo EAS | Production plan | ~$29 |
| **Total MVP** | | **~$300/mo** |

> A leaner single-instance MVP (no ALB, no Multi-AZ, RDS db.t3.small) brings this down to roughly **$130–160/mo**. Use the lean tier to launch, then enable Multi-AZ and the ALB as traffic grows.

### Staging Environment

| Resource | Spec | Monthly Cost |
|---|---|---|
| EC2 — t3.small | 2 vCPU, 2GB RAM | ~$15 |
| RDS PostgreSQL — db.t3.micro | Single-AZ, 20GB | ~$15 |
| S3 | Shared dev bucket | ~$2 |
| **Total Staging** | | **~$32/mo** |

### Cost Scaling Milestones

| Monthly Active Users | Est. Monthly Infra Cost | Key Upgrade |
|---|---|---|
| < 200 (MVP) | ~$160 (lean) | Single EC2 + RDS single-AZ |
| 200–1,000 | ~$300 | ALB + Multi-AZ RDS, CloudWatch alarms |
| 1,000–5,000 | ~$600 | Auto Scaling Group, RDS read replica, ElastiCache |
| 5,000+ | ~$1,200+ | Re-evaluate to microservices / ECS/EKS |

---

## 9. Disaster Recovery

### RPO / RTO Targets

| Tier | Event | RPO | RTO |
|---|---|---|---|
| P1 — DB corruption/deletion | Malicious delete, botched migration | 5 min (PITR) | 1 hour |
| P2 — EC2 instance failure | Crashed container, OOM | 0 (stateless, ASG/auto-restart) | 2 min |
| P3 — AWS region outage | Full eu-central-1 unavailability | 24h (last snapshot) | 4 hours |
| P4 — Secrets exposure | Leaked JWT/DB creds | N/A | 30 min (rotation) |

### DR Runbooks

#### P1 — Database Recovery

```bash
# 1. List automated snapshots / PITR window
aws rds describe-db-instances --db-instance-identifier hotel-crm-prod

# 2. Restore to a new instance from a point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier hotel-crm-prod \
  --target-db-instance-identifier hotel-crm-restored \
  --restore-time "2026-06-09T02:00:00Z"

# 3. Update DATABASE_URL (Secrets Manager) to point to the restored instance
#    and restart the EC2 service

# 4. Verify data integrity
cd backend && npx prisma db pull  # compare schema
npm run db:seed -- --check-only   # validate row counts
```

#### P2 — Compute Instance Recovery

An Auto Scaling Group replaces failed EC2 instances automatically. Manual escalation:

```bash
# Force a fresh instance / redeploy of last known-good image
aws autoscaling start-instance-refresh --auto-scaling-group-name hotel-crm-prod-asg
```

#### P3 — Region Failover (eu-west-1)

Pre-requisites (set up during initial deployment):
- S3 cross-region replication: eu-central-1 → eu-west-1 already enabled
- Weekly DB export stored in the eu-west-1 backups bucket

```bash
# 1. Restore latest weekly dump to an RDS instance in eu-west-1
pg_restore --clean --if-exists -d $EUW1_DATABASE_URL hotelcrm-backup-latest.dump

# 2. Launch EC2 (from AMI/launch template) in eu-west-1 behind a regional ALB

# 3. Update Route53 record (or external DNS) to the eu-west-1 ALB
#    Use a low TTL (60s) on the record for fast failover

# 4. Notify users via status page (status.hotelcrm.app)
```

Expected eu-west-1 failover time: **2–4 hours** (restore + DNS propagation).

#### P4 — Secrets Rotation (Breach Response)

```bash
# Execute within 30 minutes of suspected breach:

# 1. Rotate JWT_SECRET in Secrets Manager — invalidates ALL active sessions
#    Restart the EC2 service to load the new value

# 2. Rotate the RDS master password (Secrets Manager rotation)
#    Update DATABASE_URL secret

# 3. Rotate IAM credentials / revoke compromised IAM keys
#    Prefer instance roles so there are no static S3 keys to rotate

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

Under GDPR Article 33: personal data breaches must be reported to the relevant DPA (e.g., BfDI for Germany) **within 72 hours** of discovery. The `AuditLog` table and structured logs provide the evidence trail required for the breach notification. AWS provides a GDPR Data Processing Addendum (DPA) covering EU data residency in eu-central-1 — execute it before storing production personal data.

---

## Implementation Checklist

### Phase 1 — Foundation (Week 1)
- [ ] Create AWS account / Organization; create VPC with public + private subnets in eu-central-1
- [ ] Provision RDS PostgreSQL (dev + staging + prod instances)
- [ ] Create S3 buckets (uploads + backups) with versioning, encryption, and "Block public access"
- [ ] Create ECR repository `hotel-crm/backend`
- [ ] Set up GitHub Actions CI pipeline with test DB
- [ ] Add `src/config/env.ts` fail-fast validation
- [ ] Implement `GET /api/v1/health` endpoint

### Phase 2 — Security & Observability (Week 2)
- [ ] Integrate Sentry (backend + both Expo apps)
- [ ] Configure Winston structured logging + CloudWatch agent
- [ ] Set up CloudWatch alarms (EC2 CPU/mem/disk, RDS connections/storage) → SNS → Slack
- [ ] Configure UptimeRobot with Slack webhook
- [ ] Implement pre-signed URL generation for S3 file access (via IAM instance role)
- [ ] Enable rate limiting middleware (express-rate-limit) + AWS WAF rule on the ALB

### Phase 3 — CI/CD & Staging (Week 3)
- [ ] Build + push backend image to ECR from CI
- [ ] Configure GitHub Actions deploy-staging workflow (SSM/CodeDeploy to EC2)
- [ ] Configure GitHub Actions deploy-production workflow with manual approval gate
- [ ] Set up EAS Build profiles for worker-app and checker-app
- [ ] Run first full staging deployment and smoke-test

### Phase 4 — DR & Hardening (Week 4)
- [ ] Configure automated weekly DB export to S3
- [ ] Document and test P1 DB restore runbook (RDS PITR)
- [ ] Pre-configure eu-west-1 failover (AMI/launch template + replicated S3)
- [ ] Set DNS TTL to 60s on api.hotelcrm.app (Route53 or external DNS)
- [ ] Schedule monthly backup restore drill (GitHub Actions cron)
- [ ] Complete GDPR data retention automation for `DataRetentionLog`
</content>
