#!/usr/bin/env bash
# Nightly DB backup (photos are temporary by design and are not backed up).
# Kept on the server for 30 days and copied to R2 when an "r2" rclone remote exists.
set -u
umask 077
ENV_FILE=/home/eventsnap/app/.env
DIR=/var/backups/eventsnap
BUCKET=${BACKUP_BUCKET:-eventsnap-backups}

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL missing"; exit 1; }
mkdir -p "$DIR"
FILE="$DIR/eventsnap-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
if ! pg_dump "$DATABASE_URL" --no-owner --no-privileges --schema=public | gzip -9 > "$FILE"; then
  echo "pg_dump failed"; rm -f "$FILE"; exit 1
fi
[ "$(stat -c %s "$FILE")" -gt 2000 ] || { echo "backup suspiciously small"; exit 1; }
find "$DIR" -maxdepth 1 -name 'eventsnap-*.sql.gz' -mtime +30 -delete

if command -v rclone >/dev/null && rclone listremotes | grep -q '^r2:'; then
  rclone copy "$FILE" "r2:$BUCKET/db/" --quiet || { echo "rclone upload failed"; exit 1; }
else
  echo "note: no r2 remote configured; backup kept on this server only"
fi
echo "done $FILE"
