#!/usr/bin/env bash
# scripts/backup-db.sh
# Weekly PostgreSQL export to DO Spaces.
# Schedule via cron: 0 3 * * 0  /opt/hotel-crm/scripts/backup-db.sh >> /var/log/hotel-crm/backup.log 2>&1
set -euo pipefail

SECRET_ENV="/etc/hotel-crm/.env"

if [ ! -f "$SECRET_ENV" ]; then
  echo "ERROR: $SECRET_ENV not found." >&2
  exit 1
fi

set -a
source "$SECRET_ENV"
set +a

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="weekly/hotelcrm-${TIMESTAMP}.dump"

echo "[$(date -u)] Starting weekly backup → $BACKUP_FILE"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-password \
  | aws s3 cp - "s3://${DO_SPACES_BUCKET_BACKUPS:-hotelcrm-backups}/$BACKUP_FILE" \
      --endpoint-url "https://${DO_SPACES_REGION:-fra1}.digitaloceanspaces.com" \
      --storage-class STANDARD_IA

echo "[$(date -u)] Backup complete: $BACKUP_FILE"

# Remove local copies older than 90 days from Spaces (lifecycle policy handles archive)
echo "[$(date -u)] Backup job finished successfully."
