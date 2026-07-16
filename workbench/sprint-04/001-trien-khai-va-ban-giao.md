# Milestone (Sprint 04) - Triển khai (DevOps) + Bàn giao khách hàng

> **Tên file:** `workbench/sprint-04/001-trien-khai-va-ban-giao.md`
> **Trạng thái:** Phần 🟢 (2.1, 2.2, 2.6) ĐÃ HOÀN THÀNH (16/07/2026) — chờ lệnh cho phần 🔴.

---

# Bối cảnh

Theo `workbench/roadmap.md`, toàn bộ FE nghiệp vụ (Bước 0-7, 9, 10) đã hoàn thành. Chỉ còn Bước 6 (`008-bao-cao.md` — Module Báo cáo) chưa làm.

Ngoài phần nghiệp vụ, để bàn giao web ERP này cho một xưởng rèm thật sử dụng, còn hai nhóm việc **chưa từng được lên kế hoạch** trong roadmap gốc — roadmap gốc chỉ tính đến "xây tính năng", không tính đến "vận hành thật" và "bàn giao thật":

1. **Triển khai/Vận hành (DevOps)** — hiện trạng kiểm tra thực tế: không có CI (`.github` không có workflow nào), `docker-compose.yml` chỉ chạy Postgres cho dev, chưa có Dockerfile production cho API/Web, thư mục `docker/nginx` đang **rỗng**, `.env.example` chỉ có DB + `JWT_SECRET=change-me-in-production` (chưa có hướng dẫn secret thật), chưa có backup DB, chưa có monitoring/error tracking.
2. **Bàn giao khách hàng** — chưa có dữ liệu thật của xưởng, chưa có tài liệu hướng dẫn sử dụng, chưa UAT với người dùng thật, chưa có quy trình hỗ trợ sau bàn giao.

File này liệt kê chi tiết hai nhóm trên để review phạm vi trước khi lập kế hoạch code/thao tác cụ thể. **Nhiều mục cần khách hàng/người dùng quyết định (hạ tầng, domain, công cụ monitoring...) — đánh dấu rõ bên dưới, không tự suy đoán.**

---

# Thứ tự thực hiện (chốt 16/07/2026)

Không đợi "hoàn thiện tất cả tính năng" mới bắt đầu, cũng không làm toàn bộ song song với code hiện tại — tách theo tính chất từng việc:

**🟢 Làm ngay, song song với code tính năng** — không phụ thuộc nghiệp vụ, đóng gói code hiện có nên làm sớm để tránh dồn việc cuối dự án và bắt lỗi build/tsc sớm: 2.1 (CI), 2.2 (Dockerfile production), 2.6 (kỷ luật `migrate deploy`).

**🔴 Chờ gần go-live** (ít nhất xong Module Báo cáo + Import Excel, tính năng tương đối ổn định) — vì làm sớm sẽ phải làm lại: UI còn đổi thì UAT/đào tạo mất công lặp lại; hạ tầng thật (domain/SSL/backup lịch/monitoring) nên gắn với thời điểm gần go-live thay vì cấu hình rồi bỏ không; dữ liệu thật nhập sớm dễ bị rác theo các thay đổi schema đang diễn ra: 2.3, 2.4, 2.5, 2.7, 2.8, và **toàn bộ Nhóm 3**.

---

# Nhóm 2 — Triển khai / Vận hành (DevOps)

## 2.1 CI (kiểm tra tự động trước khi merge) ✅ đã làm (16/07/2026)

- `.github/workflows/ci.yml`: chạy `pnpm install`, `tsc --noEmit`, `eslint`, test API (`jest`) trên mỗi PR/push vào `main`.
- Chưa cần deploy tự động (CD) ở bước này — chỉ chặn merge code lỗi.

## 2.2 Production Build ✅ đã làm (16/07/2026)

- Dockerfile multi-stage cho `apps/api` (NestJS build → `node dist/main.js`).
- Dockerfile multi-stage cho `apps/web` (Next.js `build` → `next start` hoặc export tuỳ mô hình host).
- `docker-compose.prod.yml` (tách khỏi `docker-compose.yml` hiện tại chỉ dùng cho dev DB): API + Web + Postgres + Nginx.

## 2.3 Nginx (thư mục `docker/nginx` đang rỗng) 🔴 chờ gần go-live

- Reverse proxy: `/api/*` → API container, còn lại → Web container.
- Gzip, security headers cơ bản.
- SSL termination — **cần xác nhận:** dùng Let's Encrypt/certbot tự động hay khách đã có chứng chỉ sẵn qua nhà cung cấp hosting?

## 2.4 Environment & Secrets 🔴 chờ gần go-live

- `.env.production` template — tách biệt secret thật (`JWT_SECRET`, `DB_PASSWORD`) khỏi `.env.example` (hiện `JWT_SECRET` mặc định là placeholder, **không được deploy với giá trị này**).
- **Cần xác nhận:** hạ tầng host ở đâu (VPS riêng, cloud provider nào, hay khách tự có server)? Ảnh hưởng trực tiếp cách quản lý secret (file `.env` trên server vs secret manager).

## 2.5 Database Backup 🔴 chờ gần go-live

- `pg_dump` định kỳ (cron), lưu ít nhất N bản gần nhất — **cần chốt:** tần suất (hàng ngày?) và nơi lưu (local disk / cloud storage).
- Thử khôi phục (restore drill) ít nhất 1 lần trước khi bàn giao — xác nhận backup thật sự dùng được, không chỉ chạy lệnh cho có.

## 2.6 Migration Workflow ✅ đã làm (16/07/2026)

- Production phải chạy `prisma migrate deploy` (áp dụng migration đã có), **không** dùng `prisma db push` (lệnh này dùng cho dev, có thể làm mất dữ liệu không cảnh báo).
- Quy trình rollback nếu migration lỗi giữa chừng.

## 2.7 Logging & Monitoring 🔴 chờ gần go-live

- Log có cấu trúc (JSON) thay vì `console.log` rải rác — **cần rà soát mức độ hiện tại**.
- Error tracking — **cần xác nhận:** có dùng công cụ ngoài (Sentry, hoặc tương đương) hay chỉ log file + kiểm tra thủ công ở giai đoạn đầu (phù hợp quy mô 1 xưởng, tránh chi phí không cần thiết)?
- `GET /health` đã có sẵn (`health.controller.ts`, không cần đăng nhập) — dùng cho uptime check, chỉ cần trỏ công cụ giám sát (hoặc cron đơn giản gọi + cảnh báo) vào endpoint này.

## 2.8 Trước khi Go-live 🔴 chờ gần go-live

- Kiểm tra tải cơ bản (không cần load test chuyên sâu, quy mô 1 xưởng) — xác nhận các luồng chính (tạo báo giá, activate pricing version, hoàn thành SX) chạy ổn với dữ liệu gần với thật.
- Domain + HTTPS hoạt động đúng end-to-end.

---

# Nhóm 3 — Bàn giao khách hàng 🔴 toàn bộ chờ gần go-live

## 3.1 Dữ liệu thật thay dữ liệu demo/test

- Danh mục thật của xưởng: Product Type, Unit, Material (+ giá), Production Center thật — **hiện `seed.ts` chỉ seed Role/Permission/User mặc định, không có dữ liệu nghiệp vụ demo**, nên bước này là **nhập mới** chứ không phải "xoá demo".
- **Cần xác nhận với khách:** ai là người nhập danh mục sản phẩm/vật tư thật — đội dự án nhập hộ theo file khách cung cấp, hay hướng dẫn khách tự nhập qua UI (Import Excel — đang làm ở Việc 2 milestone `012`, sẽ hỗ trợ trực tiếp việc này)?
- Xoá/không mang theo dữ liệu test đã tạo trong lúc dev (vd sản phẩm SP000003 đã kích hoạt thật khi test permission ở milestone `012`) khỏi môi trường production — **production phải là DB sạch, không kế thừa dữ liệu dev**.

## 3.2 Tài khoản & phân quyền thật

- Tạo Owner đầu tiên cho khách (mật khẩu tạm, bắt đổi ở lần đăng nhập đầu — flow đã có sẵn).
- Khách tự tạo các User còn lại (Sales/Production/Warehouse/Accountant) qua `/settings/users` đã làm ở milestone `010`, hoặc đội dự án hỗ trợ tạo hộ lô đầu — **cần xác nhận với khách**.

## 3.3 Tài liệu hướng dẫn sử dụng

- Tài liệu tiếng Việt theo từng Role (Sales: tạo báo giá; Production: thao tác phiếu SX; Warehouse: nhập kho; Accountant: ghi nhận thanh toán...) — **cần chốt hình thức:** file markdown/PDF, hay video ngắn quay màn hình thao tác, hay cả hai?
- Không cần tài liệu kỹ thuật (kiến trúc, API) cho khách — chỉ tài liệu thao tác.

## 3.4 UAT (User Acceptance Test) với khách

- Cho người dùng thật của khách thao tác thử trên môi trường staging (không phải dev) theo đúng luồng nghiệp vụ thật của họ, thu phản hồi trước khi go-live chính thức.
- Khác với test kỹ thuật (Playwright/API test) đã làm xong ở từng milestone — đây là test theo góc nhìn người dùng cuối, không phải Dev.

## 3.5 Đào tạo

- Buổi hướng dẫn trực tiếp/online cho từng nhóm Role trước ngày go-live — **cần chốt lịch với khách**.

## 3.6 Hỗ trợ sau bàn giao

- Kênh báo lỗi/hỗ trợ (Zalo, email, hotline...) — **cần xác nhận với khách dùng kênh nào**.
- Phạm vi hỗ trợ và thời gian (bao lâu là hỗ trợ miễn phí sau bàn giao, ngoài phạm vi đó tính phí thế nào) — **đây là quyết định hợp đồng/kinh doanh, ngoài phạm vi kỹ thuật**, chỉ ghi nhận ở đây để không bị quên.

## 3.7 Checklist bàn giao chính thức

- Danh sách tài khoản đã tạo cho khách (Owner + các User).
- Bàn giao quyền truy cập hạ tầng (nếu khách sở hữu server/domain) hoặc thoả thuận ai giữ quyền vận hành.
- Biên bản bàn giao xác nhận đã đào tạo + UAT đạt.

---

# Việc cần làm ngay (🟢) — ✅ ĐÃ HOÀN THÀNH (16/07/2026)

1. CI cơ bản (2.1) — ✅.
2. Dockerfile production cho API + Web — chỉ phần build, chưa cần compose gắn domain/SSL thật (2.2) — ✅.
3. Đảm bảo quy trình deploy dùng `migrate deploy`, không dùng `db push` (2.6) — ✅.

## Kết quả thực hiện

**File đã thêm:**
- `.github/workflows/ci.yml` — checkout → cài pnpm 10.12.1 + Node 22 (cache pnpm) → `pnpm install --frozen-lockfile` → `pnpm -r lint` → `pnpm -r build` (typecheck cả API+Web) → `pnpm --filter api test`. Chạy trên push/PR vào `main`. Chưa làm CD (deploy tự động) — đúng phạm vi đã chốt.
- `.dockerignore` (root) — loại `node_modules`, `dist`, `.next`, `.git`, `workbench`, `knowledge`... khỏi build context.
- `apps/api/Dockerfile` — multi-stage (`deps` → `build` → `runtime`), build context là gốc repo (pnpm monorepo dùng chung 1 lockfile). Entrypoint chạy `npx prisma migrate deploy && node dist/src/main.js` trước khi start — đúng yêu cầu 2.6 (không dùng `db push`).
- `apps/web/Dockerfile` — multi-stage tương tự; `NEXT_PUBLIC_API_URL` truyền qua `--build-arg` (biến `NEXT_PUBLIC_*` được Next.js nhúng thẳng vào bundle lúc build, không set được lúc chạy container như biến server thường).
- `docker-compose.prod.yml` (root) — service `postgres` + `api` + `web`, build từ 2 Dockerfile trên. **Chưa có service Nginx** (đó là 2.3, còn 🔴) — hiện `ports` expose thẳng ra host để test được, sẽ đổi thành `expose` nội bộ khi thêm Nginx.

**File đã sửa (bug có sẵn, phát hiện lúc verify Docker build, nằm trong đúng phạm vi "Production Build"):**
- `apps/api/package.json` — thêm `"postinstall": "prisma generate"` (trước đây không có bước tự sinh Prisma Client sau `pnpm install`, chỉ chạy được nhờ máy dev đã từng generate thủ công); sửa `start:prod` từ `node dist/main` → `node dist/src/main` — **bug có sẵn chưa từng bị phát hiện** vì `tsconfig.json` không set `rootDir` nên `nest build` xuất ra `dist/src/main.js` chứ không phải `dist/main.js`, và chưa ai chạy thử `pnpm start:prod` trước đây (dev luôn dùng `nest start --watch`).

**Đã verify thật, không chỉ đọc code:**
- `pnpm --filter api test` — 221/221 test pass (17 test suite).
- `pnpm --filter api build` và `pnpm --filter web build` — cả hai build sạch, typecheck không lỗi.
- `docker build` cả 2 Dockerfile thành công. Chạy thật container API trỏ vào Postgres dev (`erp-postgres` đang chạy sẵn) — log xác nhận `26 migrations found... No pending migrations to apply`, Nest khởi động đủ module, `GET /api/health` trả `{"status":"ok","database":"ok"}`. Chạy thật container Web — `next start` lên đúng cổng, `GET /login` trả `200`. Đã xoá image test (`erp-api:test`, `erp-web:test`) sau khi verify xong, không để lại rác trên máy.

**Phát hiện nhưng CHƯA sửa (ngoài phạm vi 3 mục 🟢 đã duyệt):**
- `pnpm -r lint` hiện **fail** — 38 lỗi có sẵn ở `apps/api` (chủ yếu `@typescript-eslint/no-unsafe-*` trong vài file service/spec) và 65 lỗi có sẵn ở `apps/web` (rule `react-hooks/set-state-in-effect` ở 4 file: `user-dialog.tsx`, `material-typeahead.tsx`, `auth-context.tsx`, `use-mobile.ts`). Đây là nợ kỹ thuật có từ trước, không phải do CI/Dockerfile mới thêm gây ra — nhưng **nghĩa là CI vừa tạo sẽ đỏ ngay ở bước Lint cho tới khi có Task riêng dọn lint**. `build` và `test` (2 bước còn lại của CI) đều xanh.

**Đề xuất commit message:**
```
chore(devops): thêm CI, Dockerfile production, kỷ luật migrate deploy

- CI: lint + build + test API trên mỗi push/PR vào main
- Dockerfile multi-stage cho API/Web, verify build+run thật với DB dev
- Sửa bug có sẵn: start:prod trỏ sai dist/main -> dist/src/main
- Thêm postinstall prisma generate cho apps/api
```

**Cần bạn xác nhận trước khi làm tiếp:**
- CI hiện sẽ báo đỏ ở bước Lint do nợ kỹ thuật có sẵn (103 lỗi, không liên quan Task này) — có muốn mở Task riêng dọn lint không, hay tạm chấp nhận CI đỏ ở bước Lint cho tới khi dọn?

**Đã dừng đúng phạm vi 3 mục 🟢. Chờ lệnh cho phần 🔴** (2.3, 2.4, 2.5, 2.7, 2.8 và toàn bộ Nhóm 3) — các mục này cần bạn/khách quyết định trước (hạ tầng host, SSL, ai nhập dữ liệu thật...) như đã liệt kê ở mục "Cần khách/người dùng xác nhận" bên dưới.

# Việc chờ gần go-live (🔴, ít nhất xong Báo cáo + Import Excel)

Không làm ngay để tránh phải làm lại khi tính năng còn đổi:

1. Nginx reverse proxy config, gắn SSL thật (2.3).
2. `.env.production` template thật + secret thật (2.4) — phụ thuộc hạ tầng host đã chọn.
3. Script backup + restore drill với lịch thật (2.5).
4. Logging/monitoring thật (2.7).
5. Checklist trước go-live (2.8).
6. Xoá dữ liệu test/dev còn sót (3.1 phần dọn dẹp) rồi mới seed dữ liệu thật — làm sát ngày go-live để tránh dữ liệu thật bị ảnh hưởng bởi các migration/thay đổi schema còn diễn ra trong lúc code tính năng.
7. Toàn bộ Nhóm 3 còn lại (3.2 → 3.7).

---

# Cần khách/người dùng xác nhận trước khi làm phần còn lại

- Hạ tầng host (VPS/cloud nào, ai quản lý).
- SSL: tự động (Let's Encrypt) hay khách đã có sẵn.
- Có dùng công cụ error tracking ngoài (Sentry...) hay chỉ log + kiểm tra thủ công giai đoạn đầu.
- Ai nhập dữ liệu danh mục thật: đội dự án hay khách tự nhập qua Import Excel.
- Ai tạo tài khoản User cho khách: đội dự án tạo hộ lô đầu hay hướng dẫn khách tự tạo.
- Hình thức tài liệu hướng dẫn: markdown/PDF, video, hay cả hai.
- Lịch đào tạo với khách.
- Kênh hỗ trợ sau bàn giao + phạm vi/thời gian hỗ trợ (quyết định kinh doanh, không phải kỹ thuật).

---

# Quy trình làm việc

Theo đúng quy ước dự án: đây là bản NHÁP để review phạm vi. Sau khi xác nhận các mục ở phần "Cần khách/người dùng xác nhận", sẽ tách thành các Task nhỏ hơn (mỗi Task 1 file kế hoạch chi tiết theo convention `sprint-04/NNN-ten.md`), làm từng Task một, xong dừng lại tóm tắt + đề xuất commit message, chờ lệnh làm Task tiếp theo — không tự ý làm liền nhiều Task.
