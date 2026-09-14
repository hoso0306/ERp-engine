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
| Phiên bản | 2.0 |
| Trạng thái | Draft |
| Cập nhật | 14/09/2026 — chuyển local từ Postgres native sang Docker (`erp-postgres`, postgres:17-alpine) để khớp version production |
