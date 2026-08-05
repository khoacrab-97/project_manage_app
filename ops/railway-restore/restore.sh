#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_ENABLED:?Set RESTORE_ENABLED=true}"
: "${RESTORE_CONFIRM:?Set RESTORE_CONFIRM=I_UNDERSTAND_RESTORE_REPLACES_TARGET_DB}"
: "${TARGET_DATABASE_URL:?Missing target DB URL}"
: "${S3_BUCKET:?Missing bucket}"
: "${S3_REGION:?Missing region}"
: "${S3_ENDPOINT:?Missing endpoint}"
: "${BACKUP_KEY:?Missing backup key}"
: "${AWS_ACCESS_KEY_ID:?Missing access key}"
: "${AWS_SECRET_ACCESS_KEY:?Missing secret key}"

if [ "$RESTORE_ENABLED" != "true" ]; then
  echo "RESTORE_ENABLED is not true. Exiting."
  exit 0
fi

if [ "$RESTORE_CONFIRM" != "I_UNDERSTAND_RESTORE_REPLACES_TARGET_DB" ]; then
  echo "RESTORE_CONFIRM mismatch. Refusing to restore."
  exit 1
fi

echo "Downloading s3://$S3_BUCKET/$BACKUP_KEY"
aws s3 cp "s3://$S3_BUCKET/$BACKUP_KEY" /tmp/backup.sql.gz \
  --endpoint-url "$S3_ENDPOINT" \
  --region "$S3_REGION"

echo "Checking archive..."
gzip -t /tmp/backup.sql.gz
tar -tzf /tmp/backup.sql.gz >/dev/null

echo "Restoring target database..."
gunzip -c /tmp/backup.sql.gz | pg_restore \
  --format=tar \
  --exit-on-error \
  --single-transaction \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$TARGET_DATABASE_URL"

echo "Quick verification:"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'select count(*) as transaction_count from "Transaction";'
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'select coalesce(sum("soTien"), 0) as transaction_sum from "Transaction";'
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'select count(*) as project_count from "Project";'

echo "Restore completed."