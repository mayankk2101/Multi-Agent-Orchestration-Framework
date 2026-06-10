#!/usr/bin/env bash
# scripts/deploy.sh
# Manual deployment script — run as the deploy user on the Droplet.
# GitHub Actions calls equivalent steps via SSH; this script is for manual deploys.
# Usage: bash scripts/deploy.sh [production|staging] [git-ref]
set -euo pipefail

ENV="${1:-production}"
GIT_REF="${2:-origin/main}"
APP_DIR="/opt/hotel-crm"
SECRET_ENV="/etc/hotel-crm/.env"

if [ "$ENV" = "staging" ]; then
  GIT_REF="${2:-origin/develop}"
fi

echo "==> Deploying [$ENV] from $GIT_REF"

# Verify secret file exists
if [ ! -f "$SECRET_ENV" ]; then
  echo "ERROR: $SECRET_ENV not found. Run setup-droplet.sh first." >&2
  exit 1
fi

# Load NVM
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"

echo "==> [1/6] Fetch latest code"
cd "$APP_DIR"
git fetch --all --tags
git checkout "$GIT_REF"

echo "==> [2/6] Install backend dependencies"
cd "$APP_DIR/backend"
npm ci --omit=dev

echo "==> [3/6] Build backend"
npm run build

echo "==> [4/6] Run database migrations"
set -a
source "$SECRET_ENV"
set +a
npx prisma migrate deploy

echo "==> [5/7] Install and build frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> [6/7] Start/reload application"
cd "$APP_DIR"
if pm2 list | grep -q "hotel-crm-api"; then
  pm2 reload hotel-crm-api --update-env
  pm2 restart hotel-crm-web --update-env
else
  pm2 start ecosystem.config.js --env production
  pm2 save
fi

echo "==> [7/7] Health check"
sleep 10
HEALTH=$(curl -sf http://localhost:3001/api/v1/health 2>/dev/null || echo "FAILED")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "Health check passed: $HEALTH"
else
  echo "ERROR: Health check failed: $HEALTH" >&2
  echo "       Run 'pm2 logs hotel-crm-api' to investigate" >&2
  exit 1
fi

echo ""
echo "Deploy [$ENV] complete: $(date -u)"
