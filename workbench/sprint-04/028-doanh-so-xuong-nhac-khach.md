# Milestone (Sprint 04) - Doanh số theo xưởng + Trang chi tiết xưởng + Nhắc khách lâu không mua

> **Tên file:** `workbench/sprint-04/028-doanh-so-xuong-nhac-khach.md`
> **Trạng thái:** ✅ Code xong (11/10/2026) — chưa commit, chưa deploy. Chờ user xem UI thật.

---

# Bối cảnh

Khách hàng yêu cầu 3 tính năng:

1. Dashboard có chỗ xem doanh số của các xưởng sản xuất.
2. Xem từng xưởng: doanh số theo thời gian + danh sách phiếu sản xuất.
3. Nhắc khách hàng lâu không mua hàng — 1 tab riêng.

---

# Quyết định đã chốt (11/10/2026)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Xưởng nào hiển thị | **Tất cả xưởng** có phát sinh doanh số (không hard-code danh sách). Dòng bán lẻ vật tư (`productionCenterId = null`) gom thành 1 dòng "Bán lẻ vật tư" để tổng khớp doanh thu. |
| 2 | Doanh số xưởng có trừ hàng hoàn | **Không — gross** (`SUM(SalesOrderItem.subtotal)`). Chưa có quy tắc phân bổ giá trị hoàn theo dòng/xưởng — cùng lý do B2/B4 ở `report.md`. UI ghi rõ "chưa trừ hàng hoàn". |
| 3 | Dashboard dùng preset "Tháng này" | **Được** — theo tiền lệ khối "Doanh số theo nhân viên" (`dashboard.md` 1b). |
| 4 | Nhắc khách: chỉ danh sách hay ghi nhận liên hệ | **Chỉ danh sách** (V1). Ghi nhận "Đã liên hệ" là task riêng sau nếu cần. |
| 5 | Khách chưa từng mua | **Có đưa vào**, doanh số 0, mốc tính = **ngày tạo khách**, cột ngày mua ghi "Chưa mua". |
| 6 | Phân quyền theo người phụ trách | Không áp dụng — `Customer.saleId` có trong schema nhưng chưa dùng ở UI. Ai có `customer.view` thấy toàn bộ. |
| 7 | Ngưỡng nhắc | **Theo Mức độ ưu tiên** của khách (tận dụng `Customer.priority`): 3 Setting `Customer.reminderDaysHigh/Medium/Low`, mặc định 30/60/90 ngày. |
| 8 | Khách Ngừng hoạt động (INACTIVE) | **Không** đưa vào tab nhắc. |

---

# Nguồn dữ liệu (không thêm field/bảng mới)

- `SalesOrder.totalAmount = SUM(SalesOrderItem.subtotal)` (đã kiểm tra trên dữ liệu local: 32/32 đơn khớp) → doanh số theo xưởng cộng lại khớp tổng doanh thu gross.
- `SalesOrderItem.productionCenterId/productionCenterName` — snapshot tại Approve.
- Mốc ngày: `SalesOrder.createdAt`, loại `CANCELLED` (`reportRangeWhere()`), cắt kỳ theo `Settings.Company.timezone`.
- Ngày mua gần nhất: `MAX(SalesOrder.createdAt)` theo `customerId`, loại `CANCELLED`. Số ngày không mua = Derived, tính runtime, không lưu (Nguyên tắc 13).

---

# Task

## ✅ Task 1 — Khối "Doanh số theo xưởng" trên Dashboard

- [x] BE `SalesOrderService.getRevenueByProductionCenter(from, to)` — group `SalesOrderItem` theo `productionCenterId`, trả `orderCount` (distinct đơn), `revenue`, `revenuePercent`.
- [x] BE `DashboardService.getProductionCenterRevenueDashboard()` + `GET /dashboard/sales/by-production-center?from=&to=` (bắt buộc from/to, gate `sales-order.view-cost`).
- [x] FE `ProductionCenterRevenuePanel` — card riêng, `DateRangeFilter` mặc định "Tháng này", đặt dưới khối "Doanh số theo nhân viên". Bấm tên xưởng → `/production-centers/[id]`.

## ✅ Task 2 — Trang chi tiết xưởng (đã chuyển sang `/reports/production-centers/[id]` ở Task 5)

- [x] BE `SalesOrderService.getProductionCenterRevenueSeries(centerId, from, to, groupBy)` — tổng + chuỗi theo kỳ (dùng `buildSeries`).
- [x] BE ~~`GET /production-centers/:id/revenue`~~ → ~~`GET /dashboard/sales/by-production-center/:id`~~ → chuyển sang Report ở Task 5 (gate `sales-order.view-cost`). Đổi chỗ đặt: `ProductionCenterController` thuộc Product module, Product không phụ thuộc SalesOrder — đặt ở đó sẽ sinh vòng phụ thuộc. Đặt thành route con của khối Task 1.
- [x] FE trang chi tiết: thông tin xưởng, khối doanh số (bộ lọc ngày + biểu đồ cột + tổng), khối danh sách phiếu SX (dùng lại `GET /production-orders?productionCenterId=`, lọc trạng thái, phân trang).
- [x] Trang danh sách xưởng có link sang chi tiết.

## ✅ Task 3 — Tab "Khách cần nhắc"

- [x] Seed 3 Setting `Customer.reminderDaysHigh/Medium/Low` (30/60/90) + hiển thị chỉnh sửa ở trang Cài đặt hệ thống. Thêm data migration `20261011000000_customer_reminder_settings` (INSERT … ON CONFLICT DO NOTHING) để prod tự có 3 dòng khi `migrate deploy` — không đổi schema.
- [x] BE `SalesOrderService.getOrderStatsByCustomer()` — `MAX(createdAt)`, `SUM(totalAmount)`, `COUNT` theo khách, loại CANCELLED.
- [x] BE `CustomerService.getReminders(priority?)` + `GET /customers/reminders` (gate `customer.view`).
- [x] FE tab "Khách cần nhắc" ở `/customers`: lọc mức ưu tiên, sắp Cao → Thấp rồi số ngày quá ngưỡng giảm dần.

## ✅ Task 4 — Test + cập nhật tài liệu

- [x] Unit test BE cho các method mới.
- [x] `tsc`/lint BE + FE, `next build`.
- [x] Kiểm tra API thật trên local.
- [x] Cập nhật `dashboard.md`, `customer.md`, `setting.md`, `production.md`.

## ✅ Task 5 — Chuyển chi tiết xưởng vào Báo cáo (bổ sung 11/10/2026)

User yêu cầu: trang chi tiết xưởng đặt ở Báo cáo, không link từ danh sách Xưởng sản xuất. Quyết định: tạo nhóm báo cáo mới **"Sản xuất"**; quyền `report.view` như các báo cáo khác; Dashboard **giữ link** sang trang báo cáo mới.

- [x] Nhóm "Sản xuất" ở `/reports` + thẻ "Doanh thu theo xưởng" → `/reports/production-centers` (bảng xếp hạng, bấm tên xưởng → chi tiết).
- [x] Chuyển `/production-centers/[id]` → `/reports/production-centers/[id]` (doanh thu theo kỳ + biểu đồ + danh sách phiếu SX).
- [x] BE: `GET /reports/revenue-by-production-center` + `/:id` (`report.view`); **xoá** `GET /dashboard/sales/by-production-center/:id` (không còn dùng). Khối Dashboard `GET /dashboard/sales/by-production-center` giữ nguyên.
- [x] Bỏ link ở trang danh sách Xưởng sản xuất (file trở về như HEAD).
- [x] `ReportRankingTable` thêm `href?` tuỳ chọn cho drill-down (không ảnh hưởng báo cáo cũ).
- [x] Link ở khối Dashboard trỏ sang `/reports/production-centers/[id]`.
- [x] Test: tsc BE/FE, `next build`, Jest 399/399; API thật: route cũ 404, 2 route mới 200 (tổng/chuỗi khớp số cũ); 6 trang liên quan 200.
- [x] Tài liệu: `report.md` (Nhóm E), `dashboard.md`, `production.md`.

---

# Kết quả

- **BE:** `tsc --noEmit` sạch; Jest 23 suite / 399 test pass (thêm 7 test mới: 4 cho `getRevenueByProductionCenter`/`getProductionCenterRevenueSeries`/`getOrderStatsByCustomer`, 3 cho `getReminders`). ESLint: các file sửa không thêm lỗi mới so với HEAD.
- **FE:** `tsc --noEmit` + `next build` sạch. ESLint báo `react-hooks/set-state-in-effect` ở các panel/trang mới — cùng pattern fetch-trong-effect đang dùng toàn codebase (vd `employee-revenue-panel.tsx`), không sửa riêng.
- **API thật (local):**
  - `/dashboard/sales/by-production-center` năm 2026: tổng 131.289.305 = SUM(totalAmount) 133.789.305 − 2.500.000 của 3 đơn TEST chèn tay không có dòng hàng (SO000012/13/15, quotation `BG-TEST*`) — luồng thật không sinh được đơn không có dòng.
  - Chuỗi theo tháng Xưởng Bạt khớp tổng ở Dashboard (41.819.800).
  - Role "Quản lý" (không có `sales-order.view-cost`) nhận `null` ở cả 2 route doanh số xưởng.
  - `/customers/reminders`: 30 khách cần nhắc; lọc `priority`, báo lỗi 400 priority sai, 401 khi không token.
- **FE pages** `/dashboard`, `/customers`, `/production-centers`, `/production-centers/[id]`, `/settings/system` compile + 200 trên dev server.
- **Deploy:** có 1 data migration mới (`20261011000000_customer_reminder_settings`) — chạy cùng `prisma migrate deploy` như bình thường.
