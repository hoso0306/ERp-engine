# Milestone (Sprint 04) - Triển khai Module Báo cáo (Report)

> **Tên file:** `workbench/sprint-04/008-module-bao-cao.md`
> **Trạng thái:** 📝 KẾ HOẠCH — CHỜ XÁC NHẬN (chưa code)

---

# Bối cảnh

Sau khi rà soát bộ lọc thời gian Dashboard (007) và nhận review từ ChatGPT về việc Dashboard đang lẫn vai trò "vận hành realtime" với "phân tích theo kỳ", người dùng quyết định **triển khai luôn Module Báo cáo** (`knowledge/modules/report.md`) — vốn trước đó ở trạng thái "Thiết kế — chưa triển khai".

`report.md` đã là một tài liệu thiết kế rất đầy đủ, có sẵn: 14 báo cáo (gộp 12 endpoint), nguyên tắc mốc ngày Planned/Actual, API routes, permission, và mục "Thay đổi schema cần trước". **Kế hoạch này không đổi thiết kế nghiệp vụ** — chỉ tổ chức trình tự thực hiện.

## Phát hiện quan trọng khi khảo sát (thay đổi phạm vi so với report.md)

Khảo sát schema hiện tại thấy phần lớn "Thay đổi schema cần TRƯỚC" ở `report.md` mục tương ứng **đã được làm từ trước** (không rõ ở lần nào, nhưng đã có sẵn):

- ✅ `SalesOrderItem.productId` / `productTypeId` / `productTypeName` — đã có, đã có index `[productId]`, `[productTypeId]`.
- ✅ `SalesOrder.ownerId` / `ownerName` — đã có (comment trong schema ghi rõ "phục vụ Báo cáo doanh số theo nhân viên (report.md C1)").
- ✅ `SalesOrder.createdAt`, `Return.returnDate`, `MaterialReceipt.createdAt` — đã có index.
- ❌ **Còn thiếu duy nhất 1 việc**: `Payment.paymentDate` — chưa có index.

**Cập nhật 18/07/2026 (sau khi lên kế hoạch):** doanh nghiệp chưa muốn xây module Kho, đang ẩn khỏi phần mềm ở task riêng — **D1 Báo cáo kho tạm gỡ khỏi phạm vi**. Còn **11 endpoint** (không phải 12), Nhóm D chỉ còn D2. Xem `report.md` mục "Nguyên tắc phân vai" và Nhóm D.

→ Việc 1 vì vậy chỉ còn rất nhỏ (1 index + seed permission + khung module), không phải 2 migration lớn kèm backfill như tài liệu gốc lo ngại.

`ExcelService` (dùng `exceljs`) đã có sẵn ở `apps/api/src/shared/excel/excel.service.ts`, đang được `customer.service.ts`/`product.service.ts` dùng cho import/export — tái sử dụng đúng như `report.md` yêu cầu, không viết mới.

---

# Phạm vi

## Trong phạm vi

- 11 endpoint đọc (`GET /reports/*`, không gồm D1 Báo cáo kho — tạm gỡ) + export Excel **và PDF** tương ứng (`?format=xlsx|pdf`), đúng danh sách ở `report.md`.
- Permission `report.view` (seed).
- Trang Frontend `/reports` — menu điều hướng theo 4 nhóm (Tài chính / Bán hàng / Con người / Vận hành — Vận hành chỉ còn Hàng hoàn), mỗi báo cáo 1 view có bộ lọc `from`/`to` + bảng số liệu + **biểu đồ xu hướng** (report nào có chuỗi theo ngày/tháng) + nút Export Excel/PDF.
- `PdfService` mới (`apps/api/src/shared/pdf/`) — wrapper mỏng, cùng convention `ExcelService`.
- 1 thư viện chart cho `apps/web` (chưa có sẵn — chọn lúc code, ví dụ recharts, ưu tiên nhẹ/dễ dùng với Next.js).
- 1 migration nhỏ: index `Payment.paymentDate`.

## Ngoài phạm vi (giữ nguyên theo `report.md` mục "Không làm trong V1")

- Bảng thống kê riêng / Materialized View / cache / background job.
- Lợi nhuận thực tế, doanh thu thuần sau hàng hoàn, giá vốn tồn kho FIFO/AVG.
- Custom report builder, lập lịch gửi báo cáo qua email.
- "Lệnh sản xuất trễ tiến độ" (ý tưởng card Dashboard, không thuộc Report) — người dùng xác nhận bỏ qua, chưa cần.
- Dọn lại Dashboard (bỏ bộ lọc kỳ ở Sản xuất/Hàng hoàn thêm ở 007) — làm **sau khi Report xong**, task riêng.

---

# Trình tự thực hiện (theo nhóm phụ thuộc dữ liệu, không theo thứ tự A→D máy móc)

## Việc 1 — Nền tảng

- [ ] Migration: thêm `@@index([paymentDate])` cho `Payment`.
- [ ] Seed permission `report.view` vào `PERMISSION_CATALOG` (`report: ['view']`) — OWNER/ADMIN tự động có qua `allKeys()`, MANAGER/VIEWER tự động có qua `viewKeys()`; **ACCOUNTANT cần thêm thủ công** vào danh sách permissionKeys (hiện đang liệt kê tường minh, không dùng `viewKeys()`).
- [ ] Khung `ReportModule` (`report.controller.ts`, `report.service.ts`, `report.module.ts`) — chỉ đọc, gọi qua Service module sở hữu (đúng Module Ownership), không tự viết Prisma query trong Report.
- [ ] Helper dùng chung: parse `from`/`to` (giờ local, inclusive cả ngày cuối — cùng pattern đã dùng ở `dashboard.controller.ts`), loại trừ `SalesOrder.status = CANCELLED`.
- [ ] `PdfService` mới (`apps/api/src/shared/pdf/pdf.service.ts`) — chọn 1 thư viện PDF (ví dụ `pdfmake`/`puppeteer`, cân nhắc nhẹ vì server nhỏ), API tối thiểu tương đương `ExcelService.export()` (nhận cột + rows, trả file qua `Response`).
- [ ] Cài thư viện chart cho `apps/web` (ví dụ `recharts`) — 1 component wrapper dùng chung (`ReportTrendChart` hay tương tự) để không lặp code cấu hình chart ở mỗi report.

## Việc 2 — Nhóm A: Tài chính (A1–A4)

- [ ] Backend: `GET /reports/revenue`, `/reports/cash-in`, `/reports/profit`, `/reports/debt` (tái dùng `DebtService` sẵn có cho A4).
- [ ] Frontend: trang con "Tài chính" — card tổng kỳ này/so kỳ trước, biểu đồ xu hướng (A1/A2/A3), bảng chi tiết.
- [ ] Excel & PDF export cho cả 4.

## Việc 3 — Nhóm B: Bán hàng (B1–B4)

- [ ] Backend: `GET /reports/orders`, `/reports/revenue-by-product`, `/reports/growth`, `/reports/growth-by-product-type`.
- [ ] Frontend (bảng + biểu đồ cho B3/B4 — có chuỗi theo kỳ) + Excel & PDF export.

## Việc 4 — Nhóm C: Con người (C1–C2)

- [ ] Backend: `GET /reports/revenue-by-employee`, `/reports/revenue-by-customer`.
- [ ] Frontend (bảng xếp hạng, không cần biểu đồ — không có chuỗi thời gian) + Excel & PDF export.

## Việc 5 — Nhóm D: Vận hành (chỉ còn D2 — D1 Báo cáo kho tạm gỡ)

> Doanh nghiệp chưa muốn xây module Kho, đang được ẩn khỏi phần mềm ở task riêng (18/07/2026). Report **không làm D1**, không đụng `WarehouseService`.

- [ ] Backend: `GET /reports/returns` (tái dùng `ReturnService`).
- [ ] Frontend + Excel & PDF export.

## Việc 6 — Điều hướng + hoàn thiện

- [ ] Thêm mục "Báo cáo" vào sidebar (permission-gated `report.view`).
- [ ] Trang `/reports` (landing) — danh sách 4 nhóm, mỗi nhóm dẫn tới các báo cáo con.

## Việc 7 — Test + Verify

- [ ] Unit test cho `ReportService` và `PdfService` (mock các Service nguồn — không đụng Prisma trực tiếp trong test, cùng pattern các module khác).
- [ ] `tsc --noEmit` + `next build` + `nest build` sạch.
- [ ] Verify sống qua API thật: kiểm ít nhất A1 (doanh thu) và D2 (hàng hoàn) khớp số với Dashboard đang hiển thị (cùng nguồn dữ liệu, khác cách trình bày) — đối chiếu đúng cam kết "Report và Dashboard không bao giờ ra hai con số khác nhau cho cùng một câu hỏi" ở đầu `report.md`.
- [ ] Verify export: tải thử ít nhất 1 file Excel và 1 file PDF, mở ra kiểm tra đúng dữ liệu/bộ lọc.
- [ ] Cập nhật `report.md`: đổi trạng thái từ "Thiết kế — chưa triển khai" → "Đã triển khai", xoá/rút gọn mục "Thay đổi schema cần TRƯỚC" (đã xong, không cần giữ như việc tương lai).

---

# Ghi chú thực hiện

Khối lượng lớn (12 báo cáo × backend + FE + Excel). Đề xuất báo cáo theo cụm: **Việc 1 → Việc 2 (Tài chính) → Việc 3 (Bán hàng) → Việc 4 (Con người) → Việc 5 (Vận hành) → Việc 6-7 (hoàn thiện + test)**.

**Cần bạn xác nhận trước khi bắt đầu**: chạy liên tục qua các cụm không dừng lại chờ lệnh giữa chừng (như task Sprint 04-005 trước đây), hay dừng lại xin xác nhận sau mỗi Nhóm?
