# Môi trường phát triển

> **Tên file:** `knowledge/project/06-moi-truong-phat-trien.md`

---

# Mục đích

Tài liệu này mô tả cách khởi động toàn bộ dự án ERP Engine trên máy local, và thông tin server production — để chạy nhanh, đúng, không lẫn lộn với các dự án khác (Demo-HPG, HS-SOLUTION) đang chạy song song trên cùng máy.

---

# Local — Cách chạy

## Database: Docker Postgres (`docker-compose.yml`), khớp version production

Chuẩn hoá 14/09/2026: dùng **Docker Postgres 17-alpine** (container `erp-postgres`, khai báo sẵn trong `docker-compose.yml`) — khớp đúng version với production (17), tách biệt hoàn toàn với các dự án khác trên máy và với PostgreSQL cài native của hệ thống.

Trước đó có giai đoạn dùng tạm PostgreSQL **native** (cài qua `apt`, port 5432) vì lúc đó Docker gặp lỗi mạng (thiếu module iptables/nftables). Lỗi đó đã fix, dữ liệu native đã migrate (`pg_dump` / `pg_restore`) sang container Docker này. Native Postgres hiện đã `systemctl disable` (không tự chạy khi khởi động máy), giữ lại phòng khi cần restore/kiểm tra 1 backup rời — xem "Sự cố thường gặp".

Khởi động:

```bash
cd ~/Workspace/Projects/ERP-engine
docker compose up -d   # khởi động container erp-postgres nếu chưa chạy
pnpm dev
```

## Chạy API + Web

```bash
pnpm dev
```

Chạy song song `apps/api` (`nest start --watch`) và `apps/web` (`next dev`) qua `pnpm -r dev`.

---

# Các service & port (local)

| Thành phần | Tiến trình | Port | Ghi chú |
| --- | --- | --- | --- |
| PostgreSQL | Docker container `erp-postgres` (`postgres:17-alpine`) | **5432** | Database `erp`, user `erp` / mật khẩu `erp123` (xem `apps/api/.env`) |
| API (NestJS, watch mode) | `nest start --watch` | **3001** | `process.env.PORT ?? 3001` (`apps/api/src/main.ts`) |
| Web (Next.js dev) | `next dev` | **3000** | Mặc định Next.js |

---

# Không xung đột với Demo-HPG / HS-SOLUTION

ERP Engine dùng port **3000 / 3001 / 5432**, cả 3 đều qua Docker (container `erp-postgres`). Demo-HPG dùng **3002 / 3011 / 5433** (Docker). HS-SOLUTION dùng **3003 / 3012 / 5434** (Docker). Cả ba chạy song song không đụng port, không đụng database — mỗi project tự cô lập DB riêng trong container của mình.

---

# Production — VPS

| Thuộc tính | Giá trị |
| --- | --- |
| SSH alias | `thanglong-erp-vps` (đã cấu hình sẵn trong `~/.ssh/config`) |
| IP | `14.225.211.11` |
| User | `root` |
| Thư mục project | `/opt/erp` |
| Deploy | `docker compose -f docker-compose.prod.yml up -d --build` |
| Postgres version | `postgres:17-alpine` — khớp với local |

Containers production: `erp-postgres`, `erp-api`, `erp-web`, `erp-nginx` (reverse proxy, expose port 80/443 ra ngoài — 3 container còn lại không map port ra host).

```bash
ssh thanglong-erp-vps
cd /opt/erp
docker compose -f docker-compose.prod.yml ps
```

---

# Backup & Restore (Disaster Recovery)

## Backup tự động (VPS)

Cron của user `deploy` trên VPS, chạy `scripts/backup/backup.sh` mỗi ngày lúc 2h sáng:

```
0 2 * * * cd /opt/erp && BACKUP_DIR=/opt/erp/backups RETENTION_DAYS=14 ./scripts/backup/backup.sh >> /var/log/erp-backup.log 2>&1
```

Mỗi lần chạy tạo ra 2 thứ, lưu ở `/opt/erp/backups/` (giữ 14 ngày) **và** đẩy off-site lên Google Drive qua rclone (remote `erp-gdrive:erp-backup/`, giữ 30 ngày cho bản DB dump):

| File | Nội dung | Lịch sử giữ lại |
| --- | --- | --- |
| `erp-YYYYMMDD-HHMMSS.sql.gz` | `pg_dump` toàn bộ database `erp` (schema + data, kể cả logo/con dấu base64) | 14 ngày (local), 30 ngày (Drive) |
| `erp-config-latest.tar.gz` | `.env.production` (JWT_SECRET, mật khẩu DB, domain...) + SSL cert Cloudflare Origin (`origin.key`, `origin.pem`) | Chỉ giữ **1 bản mới nhất**, luôn ghi đè (không cần lịch sử vì hiếm khi đổi) |

**Không nằm trong backup** (vì không cần / đã có nơi khác):
- Code — đã có GitHub (`hoso0306/ERp-engine`).
- Role Postgres (`erp`) — không cần dump riêng, vì `docker-compose.prod.yml` tự tạo role này từ `.env.production` (`POSTGRES_USER`/`POSTGRES_PASSWORD`) khi container Postgres khởi tạo lần đầu.

Cấu hình rclone nằm ở `/home/deploy/.config/rclone/rclone.conf` trên VPS (không tracked trong Git — chứa token OAuth). Dùng **shared client_id của rclone** (đang bị khai tử dần trong 2026 — nếu sau này lệnh backup báo lỗi liên quan `client_id`/token, cần tạo Google Cloud OAuth client riêng, xem https://rclone.org/drive/#making-your-own-client-id, rồi `rclone config` sửa lại remote `erp-gdrive`).

## Restore trên VPS mới (khi VPS hiện tại sập hoàn toàn)

```bash
# 1. Lấy code
git clone https://github.com/hoso0306/ERp-engine /opt/erp
cd /opt/erp

# 2. Cài rclone, cấu hình lại remote erp-gdrive (xem hướng dẫn OAuth ở trên)
#    rồi tải 2 file mới nhất từ Drive:
rclone copy erp-gdrive:erp-backup/erp-config-latest.tar.gz .
rclone lsl erp-gdrive:erp-backup/ | grep '.sql.gz' | tail -1   # tìm bản .sql.gz mới nhất
rclone copy erp-gdrive:erp-backup/<file>.sql.gz .

# 3. Giải nén config — có lại .env.production + SSL cert
tar -xzf erp-config-latest.tar.gz -C .
mkdir -p docker/nginx/certs
mv origin.key origin.pem docker/nginx/certs/

# 4. Dựng container (tạo role/database erp rỗng từ .env.production)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build postgres

# 5. Phục hồi data
gunzip -c <file>.sql.gz | docker exec -i erp-postgres psql -U erp erp

# 6. Dựng nốt api/web/nginx
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 7. Trỏ DNS domain sang IP VPS mới (Cloudflare) — cert cũ (origin.pem) dùng lại được
#    vì Cloudflare Origin Cert không gắn với IP, chỉ gắn với domain.
```

---

# Sự cố thường gặp

**Login báo lỗi 500 / "table does not exist":** kiểm tra container Postgres có đang chạy và có đúng data không:

```bash
docker compose ps                 # erp-postgres phải Up
docker exec erp-postgres psql -U erp -d erp -c "\dt"   # phải liệt kê đủ bảng, không rỗng
```

**Cần dùng PostgreSQL native cho việc khác (vd restore/kiểm tra 1 file backup `.sql` rời):**

Native đã `disable` (không tự chạy sau reboot) nhưng vẫn cài sẵn trên máy, port 5432 — **phải dừng Docker Postgres trước** để tránh đụng port:

```bash
cd ~/Workspace/Projects/ERP-engine && docker compose stop   # nhường port 5432
sudo systemctl start postgresql                              # bật native tạm thời
# ... làm việc cần native ...
sudo systemctl stop postgresql                                # xong thì tắt lại
cd ~/Workspace/Projects/ERP-engine && docker compose up -d   # bật lại Docker cho dev
```

---

# Phiên bản

| Thuộc tính | Giá trị |
| --- | --- |
| Phiên bản | 2.1 |
| Trạng thái | Draft |
| Cập nhật | 14/09/2026 — thêm backup off-site Google Drive (rclone) + backup `.env.production`/SSL cert, hướng dẫn restore VPS mới |
