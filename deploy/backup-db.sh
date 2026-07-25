#!/usr/bin/env bash
# Nightly Postgres dump to S3. Run from the repo root on the Lightsail box.
#
# One-time setup:
#   1. Create a private S3 bucket (e.g. passpath-backups) and add a lifecycle
#      rule that expires objects after 30 days — retention handled, no scripting.
#   2. Install the AWS CLI:  sudo apt-get install -y awscli
#      and configure it:     aws configure   (IAM user with s3:PutObject on the bucket only)
#   3. Cron (crontab -e), 02:00 daily:
#      0 2 * * * cd /home/ubuntu/PassPath && BUCKET=passpath-backups ./deploy/backup-db.sh >> /home/ubuntu/backup.log 2>&1
set -euo pipefail

BUCKET="${BUCKET:?set BUCKET, e.g. BUCKET=passpath-backups ./deploy/backup-db.sh}"
STAMP="$(date +%Y-%m-%d)"
OUT="/tmp/passpath-${STAMP}.sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U passpath passpath | gzip > "$OUT"

aws s3 cp "$OUT" "s3://${BUCKET}/db/passpath-${STAMP}.sql.gz"
rm -f "$OUT"
echo "backup ok: ${STAMP}"
