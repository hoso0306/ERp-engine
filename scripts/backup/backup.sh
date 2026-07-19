#!/bin/sh
# Backup PostgreSQL production — pg_dump từ container erp-postgres, nén gzip,
# xoá bản cũ hơn RETENTION_DAYS. Chạy qua cron trên VPS host (KHÔNG chạy trong
# container), ví dụ crontab: 0 2 * * * /path/to/scripts/backup/backup.sh
#
# Điểm mở rộng: đẩy file backup lên Google Drive (rclone) — CHƯA làm ở đây,
# để task riêng sau này (thêm 1 dòng `rclone copy "$OUT_FILE" remote:erp-backup/`
# ngay sau khi tạo xong file, không cần sửa gì khác trong script này).

set -eu

BACKUP_DIR="${BACKUP_DIR:-/opt/erp/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER_NAME="${CONTAINER_NAME:-erp-postgres}"
DB_USER="${DB_USER:-erp}"
DB_NAME="${DB_NAME:-erp}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT_FILE="$BACKUP_DIR/erp-$TIMESTAMP.sql.gz"

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT_FILE"

echo "Backup xong: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Xoá bản backup cũ hơn RETENTION_DAYS ngày.
find "$BACKUP_DIR" -name "erp-*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete
