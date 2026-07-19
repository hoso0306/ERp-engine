#!/bin/sh
# Deploy production trên VPS — chạy từ gốc repo hoặc từ chính thư mục này.
#
# Điều kiện trước khi chạy lần đầu:
#   - Đã tạo .env.production (copy từ .env.production.example, điền giá trị thật).
#   - Đã đặt Cloudflare Origin Cert tại docker/nginx/certs/origin.pem + origin.key
#     (nginx sẽ không start được nếu thiếu 2 file này).
#
# Dùng: ./scripts/deploy/deploy.sh

set -eu

cd "$(dirname "$0")/../.."

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Không tìm thấy $ENV_FILE — copy từ .env.production.example và điền giá trị thật trước." >&2
  exit 1
fi

echo "==> git pull"
git pull

echo "==> docker compose build + up"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "==> Chờ API healthy (tối đa 60s)..."
HEALTHY=0
for _ in $(seq 1 30); do
  if RESULT=$(docker compose -f "$COMPOSE_FILE" exec -T api node -e "
    const http = require('http');
    http.get('http://localhost:3001/api/health', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        console.log(data);
        process.exit(data.includes('\"database\":\"ok\"') ? 0 : 1);
      });
    }).on('error', () => process.exit(1));
  " 2>/dev/null); then
    echo "API healthy: $RESULT"
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ "$HEALTHY" -eq 0 ]; then
  echo "CẢNH BÁO: API chưa healthy sau 60s — kiểm tra log: docker compose -f $COMPOSE_FILE logs api" >&2
fi

echo ""
echo "==> Nếu đây là LẦN DEPLOY ĐẦU TIÊN, chạy seed dữ liệu khởi tạo (Role/Permission/Owner):"
echo "    docker compose -f $COMPOSE_FILE exec api npx prisma db seed"
echo "    -> Mật khẩu tạm của Owner chỉ in ra MỘT LẦN trong log ngay sau lệnh trên — lưu lại ngay,"
echo "       không hiển thị lại lần sau (xem apps/api/prisma/seed.ts)."
echo ""
echo "Deploy xong. Theo dõi log: docker compose -f $COMPOSE_FILE logs -f"
