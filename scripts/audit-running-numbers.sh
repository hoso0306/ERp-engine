#!/bin/sh
# Kiểm tra running_numbers có bị "lệch" so với dữ liệu thật không — lệch xảy
# ra khi có bản ghi được tạo mà không đi qua luồng sinh mã chuẩn (import trực
# tiếp DB, script chạy tay...), khiến các lần sinh mã tiếp theo cố tạo lại
# đúng mã đã tồn tại → lỗi "Unique constraint failed" (500) khi người dùng
# thao tác bình thường. Xem thêm apps/api/src/shared/retry-on-code-conflict.ts
# (tự phục hồi khi gặp lỗi này) — script này chỉ để PHÁT HIỆN SỚM, không tự sửa.
#
# Chạy sau mỗi lần deploy production:
#   ./scripts/audit-running-numbers.sh
# Hoặc chỉ định container/DB khác (mặc định đúng với production compose):
#   CONTAINER_NAME=erp-postgres DB_USER=erp DB_NAME=erp ./scripts/audit-running-numbers.sh
#
# Exit code 0 = mọi loại mã đều an toàn (counter >= mã cao nhất thực tế).
# Exit code 1 = có ít nhất 1 loại bị lệch, in rõ loại nào + lệch bao nhiêu.

set -eu

CONTAINER_NAME="${CONTAINER_NAME:-erp-postgres}"
DB_USER="${DB_USER:-erp}"
DB_NAME="${DB_NAME:-erp}"

RESULT=$(docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' -c "
SELECT rn.type, rn.last_number, COALESCE(m.max_number, 0) AS max_number
FROM running_numbers rn
LEFT JOIN LATERAL (
  SELECT MAX(CAST(substring(code from '[0-9]+\$') AS int)) AS max_number
  FROM (
    SELECT code FROM customers WHERE rn.type = 'CUSTOMER' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM quotations WHERE rn.type = 'QUOTATION' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM sales_orders WHERE rn.type = 'SALES_ORDER' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM products WHERE rn.type = 'PRODUCT' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM materials WHERE rn.type = 'MATERIAL' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM production_centers WHERE rn.type = 'PRODUCTION_CENTER' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM production_orders WHERE rn.type = 'PRODUCTION_ORDER' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM returns WHERE rn.type = 'RETURN' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM vat_settlements WHERE rn.type = 'VAT_SETTLEMENT' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM opening_balances WHERE rn.type = 'OPENING_BALANCE' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM payments WHERE rn.type = 'PAYMENT' AND code LIKE rn.prefix || '%'
    UNION ALL SELECT code FROM material_receipts WHERE rn.type = 'MATERIAL_RECEIPT' AND code LIKE rn.prefix || '%'
  ) codes
) m ON true
ORDER BY rn.type;
")

DRIFT_FOUND=0
echo "Loại               | Counter | Mã cao nhất thực tế | Trạng thái"
echo "-------------------|---------|----------------------|------------"
echo "$RESULT" | while IFS='|' read -r type last_number max_number; do
  [ -z "$type" ] && continue
  if [ "$max_number" -gt "$last_number" ]; then
    printf "%-18s | %7s | %20s | LỆCH (thiếu %s)\n" "$type" "$last_number" "$max_number" "$((max_number - last_number))"
    echo "DRIFT" >> /tmp/audit-running-numbers-drift-flag
  else
    printf "%-18s | %7s | %20s | OK\n" "$type" "$last_number" "$max_number"
  fi
done

if [ -f /tmp/audit-running-numbers-drift-flag ]; then
  rm -f /tmp/audit-running-numbers-drift-flag
  echo ""
  echo "CẢNH BÁO: có loại mã bị lệch — vẫn an toàn nhờ retryOnCodeConflict tự phục hồi," \
       "nhưng nên sửa counter cho khớp để tránh retry không cần thiết:"
  echo "  docker exec -i \$CONTAINER_NAME psql -U \$DB_USER -d \$DB_NAME -c \"UPDATE running_numbers SET last_number = <mã cao nhất> WHERE type = '<LOẠI>';\""
  exit 1
fi

echo ""
echo "Tất cả running_numbers đều khớp dữ liệu thật."
