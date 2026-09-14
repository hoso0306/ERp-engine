#!/bin/sh
# Backup PostgreSQL production — pg_dump từ container erp-postgres, nén gzip,
# xoá bản cũ hơn RETENTION_DAYS. Chạy qua cron trên VPS host (KHÔNG chạy trong
# container), ví dụ crontab: 0 2 * * * /path/to/scripts/backup/backup.sh
#
# Từ 14/09/2026: đẩy thêm off-site lên Google Drive qua rclone (remote
# `erp-gdrive`, cấu hình tại /root/.config/rclone/rclone.conf trên VPS — xem
# knowledge/project/06-moi-truong-phat-trien.md) — vì backup local nằm CHUNG
# ổ đĩa với VPS, mất VPS là mất luôn data + backup cùng lúc.
#
# Đồng thời đóng gói `.env.production` + SSL cert (Cloudflare Origin) — 2 thứ
# này không có bản sao nào khác ngoài VPS, cần để dựng lại nhanh trên VPS mới.
# Không giữ lịch sử riêng cho phần này (JWT_SECRET/cert hiếm khi đổi) — luôn
# ghi đè thành 1 bản mới nhất.

set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/erp}"
BACKUP_DIR="${BACKUP_DIR:-/opt/erp/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER_NAME="${CONTAINER_NAME:-erp-postgres}"
DB_USER="${DB_USER:-erp}"
DB_NAME="${DB_NAME:-erp}"
RCLONE_REMOTE="${RCLONE_REMOTE:-erp-gdrive:erp-backup}"
RCLONE_RETENTION_DAYS="${RCLONE_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT_FILE="$BACKUP_DIR/erp-$TIMESTAMP.sql.gz"

docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT_FILE"

echo "Backup DB xong: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

# Xoá bản backup DB cũ hơn RETENTION_DAYS ngày (local).
find "$BACKUP_DIR" -name "erp-*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete

# Đóng gói config + secret để dựng lại nhanh trên VPS mới. `|| true` vì thiếu
# 1 file (vd chưa cấu hình SSL) không nên làm hỏng backup DB đã xong ở trên.
CONFIG_FILE="$BACKUP_DIR/erp-config-latest.tar.gz"
if tar -czf "$CONFIG_FILE" -C "$PROJECT_DIR" \
  .env.production \
  docker/nginx/certs/origin.key \
  docker/nginx/certs/origin.pem \
  2>/dev/null
then
  chmod 600 "$CONFIG_FILE"
  echo "Backup config xong: $CONFIG_FILE"
else
  echo "CẢNH BÁO: thiếu 1 vài file khi đóng gói config (.env.production/cert) — kiểm tra lại $PROJECT_DIR"
fi

# Đẩy off-site lên Google Drive — KHÔNG chặn/fail cả script nếu rclone lỗi
# (vd token hết hạn), vì bản local vẫn còn nguyên, chỉ mất lớp dự phòng off-site.
if command -v rclone >/dev/null 2>&1; then
  if rclone copy "$OUT_FILE" "$RCLONE_REMOTE/" && { [ ! -f "$CONFIG_FILE" ] || rclone copy "$CONFIG_FILE" "$RCLONE_REMOTE/"; }; then
    echo "Đã đẩy lên $RCLONE_REMOTE"
    # Retention riêng cho Drive — chỉ áp dụng cho các bản DB dump có
    # timestamp, KHÔNG đụng erp-config-latest.tar.gz (luôn bị ghi đè, không
    # cần dọn theo tuổi).
    rclone delete "$RCLONE_REMOTE/" --min-age "${RCLONE_RETENTION_DAYS}d" --include "erp-*.sql.gz" 2>&1 || true
  else
    echo "CẢNH BÁO: đẩy backup lên $RCLONE_REMOTE thất bại — kiểm tra 'rclone config' / token trên VPS"
  fi
else
  echo "CẢNH BÁO: rclone chưa cài trên máy này — bỏ qua backup off-site"
fi
