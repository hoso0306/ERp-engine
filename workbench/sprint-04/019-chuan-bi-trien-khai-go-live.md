# 019 — Runbook triển khai go-live (VPS + domain thật)

Tiếp theo `001-trien-khai-va-ban-giao.md` mục 2.3/2.4/2.5/2.7 (đã tới lúc "gần go-live"
vì VPS/domain đã có quyết định). Runbook này là các bước thao tác THẬT trên VPS +
domain sau khi mua xong — chỉ chạy khi đã có 2 thứ đó trong tay.

Phạm vi: đưa hệ thống lên chạy được với HTTPS thật + backup local cơ bản.
KHÔNG bao gồm: dữ liệu thật/UAT/đào tạo (Nhóm 3, chờ Report + Excel Import ổn định),
đẩy backup lên Google Drive (task sau), Sentry (chưa dùng giai đoạn đầu).

## 1. DNS + Cloudflare

1. Trỏ nameserver domain sang Cloudflare (tại nhà đăng ký domain).
2. Trong Cloudflare, thêm DNS record `A` trỏ về IP VPS, bật **Proxy (orange cloud)**.
3. SSL/TLS → Overview → chọn mode **Full (strict)**.
4. SSL/TLS → Origin Server → **Create Certificate** → tải về 2 file, đổi tên
   thành `origin.pem` (certificate) và `origin.key` (private key).

## 2. Chuẩn bị VPS

1. SSH vào VPS bằng user root lần đầu, tạo user thường có quyền sudo, cấu hình
   SSH key-only (tắt đăng nhập bằng password trong `/etc/ssh/sshd_config`:
   `PasswordAuthentication no`), restart `sshd`.
2. Cài UFW, chỉ mở cổng cần thiết:

   ```sh
   ufw allow 22
   ufw allow 80
   ufw allow 443
   ufw enable
   ```

3. Cài Docker + Docker Compose plugin (theo hướng dẫn chính thức Docker cho Ubuntu).

## 3. Clone repo + chuẩn bị secrets

1. `git clone <repo-url>` vào VPS (dùng deploy key/token nếu repo private).
2. Copy `origin.pem` + `origin.key` (bước 1.4) vào `docker/nginx/certs/` trên VPS.
3. `cp .env.production.example .env.production`, điền giá trị thật:
   - `DB_PASSWORD` — mật khẩu mạnh, không dùng giá trị mẫu.
   - `JWT_SECRET` — generate bằng `openssl rand -base64 32`.
   - `NEXT_PUBLIC_API_URL` — domain thật, dạng `https://domain-that.com` (không kèm `/api`).
   - `BOOTSTRAP_OWNER_EMAIL` / `BOOTSTRAP_OWNER_NAME` — thông tin Owner đầu tiên.
4. `chmod +x scripts/deploy/deploy.sh scripts/backup/backup.sh`.

## 4. Deploy lần đầu

1. Chạy `./scripts/deploy/deploy.sh` — script tự `git pull`, `docker compose up -d --build`,
   rồi kiểm tra `/api/health`.
2. Chạy seed dữ liệu khởi tạo (Role/Permission/Owner) — **chỉ chạy 1 lần**:

   ```sh
   docker compose -f docker-compose.prod.yml exec api npx prisma db seed
   ```

3. **Lưu ngay mật khẩu tạm của Owner** in ra trong log ngay sau lệnh trên —
   không hiển thị lại lần sau (xem `apps/api/prisma/seed.ts`).

## 5. Verify end-to-end

- [ ] Mở `https://domain-that.com` — không có cảnh báo chứng chỉ ở trình duyệt.
- [ ] `https://domain-that.com/api/health` trả về `"database":"ok"`.
- [ ] Đăng nhập bằng email + mật khẩu tạm Owner → hệ thống bắt đổi mật khẩu ở lần đầu → đổi thành công.
- [ ] Thử 1-2 luồng chính (tạo báo giá, xem đơn hàng) chạy được bình thường.

## 6. Backup local

1. Thêm cron trên VPS host (không phải trong container):

   ```sh
   crontab -e
   # Thêm dòng:
   0 2 * * * cd /path/to/erp-repo && BACKUP_DIR=/opt/erp/backups ./scripts/backup/backup.sh >> /var/log/erp-backup.log 2>&1
   ```

2. Chạy tay 1 lần để xác nhận: `./scripts/backup/backup.sh`, kiểm tra file `.sql.gz` sinh ra trong `/opt/erp/backups`.
3. Đẩy backup lên Google Drive — **để task sau** (đã thống nhất trước).

## 7. Monitoring (tuỳ chọn)

- Tạo monitor trên UptimeRobot (free) gọi `https://domain-that.com/api/health` mỗi 5 phút.
- **Bắt buộc dùng loại "Keyword Monitor"** tìm chuỗi `"database":"ok"` trong response body —
  endpoint này luôn trả HTTP 200 kể cả khi DB lỗi, nên monitor kiểu chỉ check status code
  sẽ không phát hiện được sự cố DB.

## Checklist hoàn tất

- [ ] DNS + Cloudflare Origin Cert hoạt động (mục 1).
- [ ] VPS hardening cơ bản: SSH key-only, UFW chỉ mở 22/80/443 (mục 2).
- [ ] Deploy thành công, Owner đăng nhập được (mục 3-5).
- [ ] Cron backup chạy và sinh file đúng (mục 6).
- [ ] (Tuỳ chọn) Monitor uptime đã gắn (mục 7).

Sau khi checklist trên xong, các việc còn lại (Nhóm 3 trong `001-trien-khai-va-ban-giao.md`:
dữ liệu thật, tài khoản User, tài liệu hướng dẫn, UAT, đào tạo, kênh hỗ trợ) sẽ tách
thành Task riêng khi Report module + Excel Import ổn định, theo đúng thứ tự đã chốt.
