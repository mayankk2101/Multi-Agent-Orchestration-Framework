# Infrastructure Readiness Checklist — Hotel CRM MVP

**Platform:** AWS EC2 · PostgreSQL · GitHub Actions · PM2 · Nginx (TLS termination)
**Region:** eu-central-1 (Frankfurt)
**Domains:** `hotelcrm.app`, `www.hotelcrm.app`, `api.hotelcrm.app`, `staging-api.hotelcrm.app`

> Checklist only. No implementation. Tick each item before promoting to the next environment.

---

## Required AWS Resources

### Compute (EC2)
- [ ] Staging EC2 instance provisioned (Ubuntu, Node 20 capable)
- [ ] Production EC2 instance provisioned (Ubuntu, Node 20 capable)
- [ ] EC2 instance role attached (preferred over static AWS keys for S3 access)
- [ ] Elastic IP allocated and associated to each instance
- [ ] SSH key pair created; `deploy` OS user exists on each instance

### Database (RDS PostgreSQL)
- [ ] Staging RDS PostgreSQL instance provisioned
- [ ] Production RDS PostgreSQL instance provisioned
- [ ] `sslmode=require` enforced on all connections
- [ ] Automated backups + retention window enabled
- [ ] DB subnet group restricted to private subnets

### Storage (S3)
- [ ] `hotelcrm-uploads` bucket created (uploads)
- [ ] `hotelcrm-backups` bucket created (DB backups)
- [ ] Bucket policies / IAM scoped to the EC2 instance role
- [ ] Versioning + lifecycle policy on backups bucket

### Edge / DNS / TLS
- [ ] DNS records for all hosts point to the correct instances (Route53 or external)
- [ ] TLS path chosen: **ACM + ALB (preferred)** or **certbot/Let's Encrypt on Nginx (no-ALB MVP)**
- [ ] (If ALB) ACM certificate `hotelcrm.app` + `*.hotelcrm.app` issued and attached
- [ ] AWS WAF managed rules attached (if using ALB)

### IAM
- [ ] EC2 instance role grants only S3 (uploads/backups) access
- [ ] No long-lived AWS access keys stored on instances
- [ ] CI/CD deploy credentials scoped to least privilege

---

## Required GitHub Secrets

### Staging (GitHub Environment: `staging`)
- [ ] `STAGING_DATABASE_URL`
- [ ] `STAGING_EC2_HOST`
- [ ] `STAGING_SSH_KEY`

### Production (GitHub Environment: `production`)
- [ ] `PROD_DATABASE_URL`
- [ ] `PROD_EC2_HOST`
- [ ] `PROD_SSH_KEY`
- [ ] `production` environment configured with **required reviewers** (manual approval)

### Environment configuration
- [ ] `staging` deploys on push to `develop`
- [ ] `production` deploys on push to `main`
- [ ] Secrets scoped per-environment (not repo-wide)

---

## Required Server Configuration

### Filesystem / layout
- [ ] App deployed to `/opt/hotel-crm` (git checkout)
- [ ] Secrets file at `/etc/hotel-crm/.env` (mode `600`, owned by `deploy`)
- [ ] Log directory `/var/log/hotel-crm/` exists and is writable

### Runtime
- [ ] Node.js 20 installed (required for `--env-file`)
- [ ] PM2 installed globally
- [ ] Git installed and repo cloned with `origin` remote
- [ ] `deploy` user can run `npm ci`, `npm run build`, and `pm2`

### Nginx
- [ ] Nginx installed; `nginx/hotelcrm.conf` deployed to `sites-available` and enabled
- [ ] API vhost `api.hotelcrm.app` → `127.0.0.1:3001`
- [ ] Web vhost `hotelcrm.app`/`www` → `127.0.0.1:3000`
- [ ] HTTP→HTTPS (80→443) redirect active
- [ ] Rate-limit zones active (`auth` 2r/s, `api` 20r/s)
- [ ] Security headers present (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP)

### Security Groups
- [ ] Web SG: inbound 443 (and 80 for redirect) from `0.0.0.0/0`
- [ ] SSH SG: inbound 22 restricted to admin IPs / bastion only
- [ ] App ports 3000 / 3001 **not** exposed publicly (localhost only, behind Nginx)
- [ ] RDS SG: inbound 5432 only from the EC2 instance SG (no public access)
- [ ] Egress rules reviewed (S3, SendGrid, APNs, FCM, Sentry endpoints reachable)

---

## Required Environment Variables

> Stored in `/etc/hotel-crm/.env` (loaded by PM2 via `--env-file`). See `backend/.env.example`.

### Backend — Application
- [ ] `NODE_ENV=production`
- [ ] `PORT=3001`
- [ ] `API_VERSION=v1`

### Backend — Database / Cache
- [ ] `DATABASE_URL` (RDS, `sslmode=require`)
- [ ] `REDIS_URL` (optional — caching)

### Backend — Auth (JWT)
- [ ] `JWT_SECRET` (≥ 32 chars, unique per env)
- [ ] `JWT_REFRESH_SECRET` (≥ 32 chars, distinct from access secret)
- [ ] `JWT_ACCESS_EXPIRY` (e.g. `1h`)
- [ ] `JWT_REFRESH_EXPIRY` (e.g. `7d`)

### Backend — CORS / URLs
- [ ] `CORS_ORIGIN` (production frontend origin)
- [ ] `FRONTEND_URL`

### Backend — AWS / Storage
- [ ] `AWS_REGION=eu-central-1`
- [ ] `S3_BUCKET=hotelcrm-uploads`
- [ ] `S3_BUCKET_BACKUPS=hotelcrm-backups`
- [ ] `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` **only if not using instance role**

### Backend — Integrations
- [ ] `EMAIL_SERVICE` + `SENDGRID_API_KEY` (or `RESEND_API_KEY`)
- [ ] `APNS_PRIVATE_KEY_BASE64`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `SENTRY_DSN`
- [ ] `LOG_LEVEL=info`

### Frontend (build-time)
- [ ] `NEXT_PUBLIC_API_BASE_URL` (e.g. `https://api.hotelcrm.app/api/v1`)

---

## Required Database Configuration

- [ ] Database `hotel_crm` created with `public` schema
- [ ] Dedicated application DB user with least-privilege grants
- [ ] TLS enforced (`sslmode=require`) end to end
- [ ] Prisma migrations apply cleanly: `npx prisma migrate deploy`
- [ ] Migration step wired into both deploy workflows (staging + prod)
- [ ] Seed/reference data loaded (if required for first run)
- [ ] `backup-db.sh` schedule configured → `hotelcrm-backups` bucket
- [ ] Backup restore tested at least once
- [ ] Connection pool sizing validated against RDS `max_connections`

---

## Pre-Deployment Checklist

- [ ] `ci.yml` gate passing (lint, type-check, tests, build)
- [ ] Backend builds: `npm run build` (needs devDependencies / `tsc`)
- [ ] Frontend builds: `next build` (needs typescript + tailwindcss + @tailwindcss/postcss)
- [ ] All required GitHub Secrets present for the target environment
- [ ] `/etc/hotel-crm/.env` complete and validated on the target server
- [ ] PM2 apps registered: `hotel-crm-api`, `hotel-crm-web`
- [ ] `pm2 startup` + `pm2 save` configured (survives reboot)
- [ ] Health endpoints reachable locally: `:3001/api/v1/health`, `:3000`
- [ ] Nginx config valid: `nginx -t`
- [ ] TLS certificate valid and not near expiry
- [ ] Security groups reviewed (no public 3000/3001/5432)
- [ ] Rollback path understood (PM2 restart / previous git ref)

---

## Staging Deployment Checklist

- [ ] Branch is `develop`; push triggers `Deploy Staging`
- [ ] CI Gate green before deploy job runs
- [ ] Migrations applied with `STAGING_DATABASE_URL`
- [ ] SSH deploy to `STAGING_EC2_HOST` as `deploy` succeeds
- [ ] Backend installed + built on instance
- [ ] Frontend installed + built on instance
- [ ] Secrets sourced from `/etc/hotel-crm/.env`
- [ ] `pm2 restart hotel-crm-api --update-env` succeeds
- [ ] `pm2 restart hotel-crm-web --update-env` succeeds
- [ ] API health check passes (`:3001/api/v1/health`)
- [ ] Frontend health check passes (`:3000`)
- [ ] Smoke test through `https://staging-api.hotelcrm.app`
- [ ] Logs clean in `/var/log/hotel-crm/`

---

## Production Deployment Checklist

- [ ] Branch is `main`; push triggers `Deploy Production`
- [ ] CI Gate green before deploy job runs
- [ ] **Manual approval** granted (production environment reviewers)
- [ ] Migrations applied with `PROD_DATABASE_URL`
- [ ] DB backup taken immediately before migration
- [ ] SSH deploy to `PROD_EC2_HOST` as `deploy` succeeds
- [ ] Backend installed + built; frontend installed + built
- [ ] `pm2 reload hotel-crm-api --update-env` (zero-downtime) succeeds
- [ ] `pm2 restart hotel-crm-web --update-env` succeeds
- [ ] API health check passes — auto-rollback on failure
- [ ] Frontend health check passes — auto-rollback on failure
- [ ] Release tag pushed (`release/<timestamp>`)
- [ ] Live verification: `https://hotelcrm.app` and `https://api.hotelcrm.app/api/v1/health`
- [ ] Monitoring/alerting green (Sentry, uptime, logs)
- [ ] Rollback plan confirmed (previous release tag + `pm2` restart)
