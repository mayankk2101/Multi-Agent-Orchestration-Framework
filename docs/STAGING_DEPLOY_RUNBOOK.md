# Staging Deploy Runbook (F2)

**Scope:** Hotel CRM — staging Droplet only  
**Audience:** Engineers triggering or debugging a staging deployment  
**Updated:** 2026-06-14

---

## 1. Normal Deploy (Automatic)

Push to `develop`. GitHub Actions runs:

```
ci  →  deploy-staging
```

The CI gate (`ci.yml`) must pass before the SSH deploy step runs.  
Monitor the run at: `https://github.com/deepak525kumar/hotel-crm/actions`

---

## 2. Pre-flight Checklist

Before pushing, confirm:

- [ ] `STAGING_DATABASE_URL` secret is set in GitHub → Settings → Secrets → Actions → `staging` environment
- [ ] `STAGING_DROPLET_IP` secret is set
- [ ] `STAGING_SSH_KEY` secret is set (private key; corresponding public key is in `deploy@<droplet>:~/.ssh/authorized_keys`)
- [ ] `/etc/hotel-crm/.env` exists on the staging Droplet (see §6 for first-time setup)
- [ ] Droplet is reachable: `ssh deploy@<STAGING_DROPLET_IP> 'pm2 list'`

---

## 3. What the Workflow Does

```
GitHub Actions runner (ubuntu-latest)
  1. npm ci --omit=dev          (backend, runner)
  2. npm run build               (backend TypeScript → dist/, runner)
  3. prisma migrate deploy       (runner → STAGING_DATABASE_URL)

SSH into deploy@<STAGING_DROPLET_IP>
  4. git fetch origin develop && git checkout origin/develop
  5. cd backend && npm ci --omit=dev && npm run build
  6. cd frontend && npm ci --omit=dev && npm run build
  7. source /etc/hotel-crm/.env  (loads secrets into shell)
  8. pm2 restart hotel-crm-api --update-env
  9. pm2 restart hotel-crm-web --update-env
 10. sleep 15
 11. curl -sf http://localhost:3001/api/v1/health   (must return HTTP 200)
 12. curl -sf http://localhost:3000                  (must return HTTP 200)
```

---

## 4. Manual Deploy (Fallback)

SSH to the Droplet and run the deploy script:

```bash
ssh deploy@<STAGING_DROPLET_IP>
bash /opt/hotel-crm/scripts/deploy.sh staging origin/develop
```

The script sources `/etc/hotel-crm/.env` automatically before running migrations and pm2.

---

## 5. Health Check Verification

After any deploy, confirm both processes are healthy:

```bash
ssh deploy@<STAGING_DROPLET_IP>

# API
curl -s http://localhost:3001/api/v1/health
# Expected: {"status":"ok","uptime":<seconds>,"timestamp":"..."}

# Frontend
curl -sI http://localhost:3000 | head -1
# Expected: HTTP/1.1 200 OK

# PM2 process list
pm2 list
# Both hotel-crm-api and hotel-crm-web should show status: online
```

---

## 6. First-Time Droplet Setup

Run once as root on a fresh Ubuntu 24.04 Droplet:

```bash
bash scripts/setup-droplet.sh staging
```

Then populate the secret file:

```bash
# On the Droplet, as root:
vim /etc/hotel-crm/.env
# Fill in all variables from backend/.env.example
# Set ownership: chown root:deploy /etc/hotel-crm/.env && chmod 640 /etc/hotel-crm/.env

# Clone the repo
git clone https://github.com/deepak525kumar/hotel-crm.git /opt/hotel-crm
chown -R deploy:deploy /opt/hotel-crm

# Start PM2 for the first time (as deploy user)
su - deploy -c 'source ~/.nvm/nvm.sh && cd /opt/hotel-crm && pm2 start ecosystem.config.js --env production && pm2 save'
```

---

## 7. Diagnosing a Failed Deploy

### Health check timed out / curl failed

```bash
pm2 logs hotel-crm-api --lines 50
pm2 logs hotel-crm-web --lines 50
```

Common causes:
- Missing env var → check `/etc/hotel-crm/.env` has all required keys
- Port already in use → `lsof -i :3001` or `lsof -i :3000`
- Build failed silently → re-run `npm run build` manually in `/opt/hotel-crm/backend`

### PM2 process in errored state

```bash
pm2 describe hotel-crm-api   # shows restart count, error reason
pm2 restart hotel-crm-api
```

### Migration failed

The migration runs on the GitHub Actions runner (not the Droplet) against `STAGING_DATABASE_URL`.  
Check the Actions log for the `Run migrations (staging)` step.  
If the migration is partially applied, connect to the staging DB and inspect `_prisma_migrations`.

### Secrets not loaded (env vars missing at runtime)

`ecosystem.config.js` uses `node_args: '--env-file=/etc/hotel-crm/.env'` (Node 20 built-in).  
Verify Node version on Droplet: `node --version` must be ≥ 20.6.

```bash
# Confirm env var is present at runtime:
pm2 exec hotel-crm-api -- node -e "console.log(process.env.DATABASE_URL ? 'ok' : 'MISSING')"
```

---

## 8. Rollback Procedure

There is no automatic rollback in staging. To revert:

```bash
ssh deploy@<STAGING_DROPLET_IP>
cd /opt/hotel-crm
git log --oneline -10                  # find the previous good commit SHA
git checkout <SHA>
cd backend && npm ci --omit=dev && npm run build
cd ../frontend && npm ci --omit=dev && npm run build
cd /opt/hotel-crm
set -a && source /etc/hotel-crm/.env && set +a
pm2 restart hotel-crm-api --update-env
pm2 restart hotel-crm-web --update-env
sleep 15
curl -sf http://localhost:3001/api/v1/health
```

> **Note:** Do NOT run `prisma migrate deploy` when rolling back — migrations are forward-only.  
> If a migration must be reversed, use `prisma migrate resolve --rolled-back <migration_name>` after manually reverting the schema changes in the DB.

---

## 9. Known Remaining Issues

| ID | Issue | Impact | Workaround |
|----|-------|--------|------------|
| NVM-PATH | SSH non-login shell may not have NVM in PATH | `npm`/`pm2` not found during deploy | Add `. ~/.nvm/nvm.sh` to deploy user's `~/.profile`; verify `pm2 startup systemd` ran |
| ROLLBACK-PROD | Production workflow restarts broken code on health check failure instead of reverting | Production only; staging unaffected | Manual rollback per §8 |
| TAG-PERMS | Production tag push may fail (403) — `permissions: contents: write` missing from deploy-production.yml | Release tag not created; deploy itself succeeds | Add `permissions: contents: write` to deploy job in deploy-production.yml |
| REDIS-ENV | `docker-compose.prod.yml` has no `env_file:` directive; `${REDIS_PASSWORD}` may not expand | Redis starts with empty password | Pass `REDIS_PASSWORD` in shell before `docker compose up`, or add `env_file: /etc/hotel-crm/.env` |
