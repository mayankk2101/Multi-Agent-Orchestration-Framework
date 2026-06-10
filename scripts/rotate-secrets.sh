#!/usr/bin/env bash
# scripts/rotate-secrets.sh
# Rotate JWT secrets on the Droplet and force all sessions to re-login.
# Usage: bash rotate-secrets.sh [access|refresh|all]
set -euo pipefail

SECRET_ENV="/etc/hotel-crm/.env"
ROTATE="${1:-all}"

if [ ! -f "$SECRET_ENV" ]; then
  echo "ERROR: $SECRET_ENV not found." >&2
  exit 1
fi

generate_secret() {
  openssl rand -base64 48 | tr -d '\n'
}

rotate_key() {
  local KEY="$1"
  local NEW_VAL
  NEW_VAL=$(generate_secret)
  # Replace value in-place (preserves file permissions)
  sed -i "s|^${KEY}=.*|${KEY}=${NEW_VAL}|" "$SECRET_ENV"
  echo "  Rotated $KEY"
}

echo "==> Rotating secrets [$ROTATE]"

if [[ "$ROTATE" == "access" || "$ROTATE" == "all" ]]; then
  rotate_key "JWT_SECRET"
fi

if [[ "$ROTATE" == "refresh" || "$ROTATE" == "all" ]]; then
  rotate_key "JWT_REFRESH_SECRET"
fi

echo "==> Reloading application with new secrets"
pm2 reload hotel-crm-api --update-env

echo "==> Purging all sessions from database (forces re-login)"
set -a
source "$SECRET_ENV"
set +a
psql "$DATABASE_URL" -c 'DELETE FROM "Session";' && echo "  Sessions purged"

sleep 5
HEALTH=$(curl -sf http://localhost:3001/api/v1/health 2>/dev/null || echo "FAILED")
echo "Health check: $HEALTH"

echo ""
echo "Secret rotation complete: $(date -u)"
echo "Record this rotation in the compliance register."
