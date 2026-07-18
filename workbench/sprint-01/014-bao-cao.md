# Sprint 01 — Module Báo cáo (Report)

> **Tên file:** `workbench/sprint-01/014-bao-cao.md`

---

# Mục tiêu

Hoàn thành Module Báo cáo — tầng phân tích theo kỳ, phục vụ Owner/Kế toán ra quyết định.

Đọc kỹ `knowledge/modules/report.md` trước khi bắt đầu — **toàn bộ quyết định thiết kế nghiệp vụ đã chốt ở đó**, đặc biệt mục "Nguyên tắc phân vai Dashboard vs Report" và bảng "Nguyên tắc mốc ngày & Planned vs Actual". File task này chỉ tổ chức trình tự thực hiện, không lặp lại nội dung nghiệp vụ.

Report không chứa Business Logic. Report chỉ tổng hợp và trình bày dữ liệu từ các Module khác, luôn theo một khoảng ngày (`from`–`to`) do người dùng chọn.

Không có:

- Create
- Update
- Delete

Chỉ có:

- Read
- Export (Excel, PDF)

---

# Kiến trúc

Report không truy cập trực tiếp Database (Prisma/Repository) của các Module khác — cùng nguyên tắc Module Ownership đã áp dụng cho Dashboard (`009-dashboard.md`).

Report chỉ gọi **Service hiện có** của module sở hữu dữ liệu:

```
SalesOrderService
DebtService
ReturnService
CustomerService
```

**Không tạo `ReportQueryService` hay bất kỳ class song song nào khác.** Mỗi Service hiện có được bổ sung thêm method đọc phục vụ Report ngay trong chính nó (xem Task 00) — cùng cách Dashboard đã làm.

**Dashboard và Report là hai module riêng, dùng chung Service nguồn nhưng gọi method khác nhau:** Dashboard gọi `getDashboardSummary()` (tức thời/không kỳ), Report gọi các method mới ở Task 00 (luôn có `from`/`to`). Không được sửa lại method của Dashboard để nhét thêm logic theo kỳ vào đó.

**Không triển khai D1 (Báo cáo kho).** Doanh nghiệp chưa muốn xây module Kho — đang được ẩn khỏi phần mềm ở task riêng (xem `knowledge/modules/warehouse.md` mục "Trạng thái triển khai"). Report không gọi `WarehouseService`.

---

# Triết lý Report

Report không phát minh số liệu mới. Mỗi chỉ số chỉ có đúng **một nguồn sự thật (Single Source of Truth)** — đã chốt ở bảng "Nguyên tắc mốc ngày & Planned vs Actual" trong `report.md`:

| Chỉ số | Module sở hữu | Mốc ngày |
|---|---|---|
| Doanh thu / Giá vốn / Lợi nhuận kế hoạch | Sales Order | `SalesOrder.createdAt` |
| Tiền mặt về | Debt (Payment) | `Payment.paymentDate` |
| Công nợ | Debt | Không theo kỳ (số dư) |
| Giá trị hàng hoàn | Return | `Return.returnDate` |

Report chỉ hiển thị. Nếu một báo cáo cần dữ liệu mà module nguồn chưa có (field/method/index) → bổ sung tại module nguồn (Task 00), không tự tính trong Report.

Mọi báo cáo loại `SalesOrder.status = CANCELLED` (trừ Payment — không tồn tại trên đơn huỷ).

---

# Task 00 — Chuẩn bị Report Dependencies

## Mục tiêu

Task này **không tạo Service mới**, chỉ hoàn thiện những gì Report cần từ các module hiện có: bổ sung method đọc theo kỳ ở Service đã tồn tại, 1 index còn thiếu, và 1 shared service mới (`PdfService`).

## Bổ sung method đọc

- `SalesOrderService`:
  - `getRevenueReport(from, to, groupBy?: 'day'|'month'|'year')` — A1 + B3 (tổng doanh thu, so sánh kỳ trước, chuỗi theo `groupBy`).
  - `getProfitReport(from, to, groupBy?)` — A3 + B3 (lợi nhuận kế hoạch + tỷ suất, nhãn bắt buộc "kế hoạch").
  - `getOrdersReport(from, to)` — B1 (số đơn theo status/paymentStatus, giá trị trung bình, tỷ lệ đúng hạn/trễ hạn).
  - `getRevenueByProduct(from, to)` — B2 (group theo `SalesOrderItem.productId`, hiển thị `productName` snapshot).
  - `getGrowthByProductType(from, to)` — B4 (group theo `SalesOrderItem.productTypeId`/`productTypeName` snapshot + theo tháng).
  - `getRevenueByEmployee(from, to)` — C1 (group theo `ownerId`, hiển thị `ownerName` snapshot).
  - `getRevenueByCustomer(from, to)` — C2 (group theo `customerId`: tổng đơn, tổng doanh thu, lần mua đầu/gần nhất).
- `DebtService`:
  - `getCashInReport(from, to)` — A2 (tổng `Payment.amount`, phân theo `paymentMethod`, chuỗi theo ngày). Đây là chỉ số Actual — không cộng lẫn với doanh thu Planned.
  - `getDebtReport(from, to)` — A4 (tái dùng số dư hiện tại từ các method Dashboard đã có; bổ sung phần phát sinh trong kỳ: Receivable mới của SO tạo trong kỳ + gọi `getCashInReport()` cho phần tiền thu trong kỳ).
- `CustomerService`:
  - `getNewCustomersInRange(from, to)` — phần "khách mới trong kỳ" của C2 (`Customer.createdAt`).
- `ReturnService`: **không cần method mới** — `getDashboardSummary(range)`, `getTopReturnReasons(range)`, `getReturnsByCustomer(range)` đã có sẵn từ Dashboard (Sprint 04, `007-bo-loc-thoi-gian-dashboard.md`), nhận đúng `{ from?, to? }` — D2 tái sử dụng trực tiếp.

## Migration

- Thêm `@@index([paymentDate])` cho `Payment` (còn thiếu duy nhất — mọi index/field khác report.md yêu cầu đã có sẵn từ trước, xem `report.md` mục "Thay đổi schema cần TRƯỚC").

## PdfService mới

- Tạo `apps/api/src/shared/pdf/pdf.service.ts` — wrapper mỏng quanh 1 thư viện PDF, API tối thiểu tương đương `ExcelService.export()` (nhận cột + rows, trả file qua `Response`). Đăng ký `PdfModule` cùng vị trí quy ước với `ExcelModule`.
- `ExcelService` **không cần sửa** — đã có sẵn, tái sử dụng nguyên trạng.

## Helper dùng chung trong ReportModule

- Parse `from`/`to` (ISO date string → giờ local, `to` tính hết ngày 23:59:59.999) — cùng pattern đã dùng ở `dashboard.controller.ts` (`parseRange`).
- Helper loại trừ `SalesOrder.status = CANCELLED` dùng chung cho các method ở trên (đặt tại `SalesOrderService`, không đặt ở Report).

---

## Definition of Done

- [ ] `SalesOrderService` có đầy đủ 7 method đọc theo kỳ ở trên.
- [ ] `DebtService` có đầy đủ 2 method đọc theo kỳ ở trên.
- [ ] `CustomerService` có `getNewCustomersInRange()`.
- [ ] `ReturnService` xác nhận tái dùng được nguyên trạng — không sửa.
- [ ] Migration `Payment(paymentDate)` áp dụng thành công.
- [ ] `PdfService` hoạt động, export thử 1 file PDF đơn giản.
- [ ] Không tạo class `ReportQueryService` hay Repository nào.
- [ ] Report không truy cập Prisma trực tiếp (chuẩn bị sẵn nguyên tắc cho các Task sau).

---

# Task 01 — Report Module Foundation

## Mục tiêu

Dựng khung `ReportModule` + permission.

```http
GET /reports/*
```

Bao gồm:

- `report.controller.ts`, `report.service.ts`, `report.module.ts`.
- Permission `report.view` — seed vào `PERMISSION_CATALOG` (`report: ['view']`). `OWNER`/`ADMIN` tự có qua `allKeys()`, `MANAGER`/`VIEWER` tự có qua `viewKeys()`; **`ACCOUNTANT` cần thêm thủ công** (đang khai báo tường minh, không dùng `viewKeys()`).
- Guard: `AuthGuard`, `PermissionGuard`, `@RequirePermission('report.view')` trên toàn bộ endpoint — không tách quyền theo từng báo cáo ở V1.

`ReportService` chỉ gọi method của Task 00 — không tự viết `prisma.xxx.groupBy()`.

---

## Definition of Done

- [ ] `ReportModule` đăng ký vào `AppModule`.
- [ ] Permission `report.view` seed đúng cho cả 6 role hiện có (đặc biệt xác nhận `ACCOUNTANT`).
- [ ] Guard hoạt động — user không có `report.view` nhận 403.
- [ ] `ReportService` không có Prisma import.

---

# Task 02 — Nhóm A: Báo cáo Tài chính

## Mục tiêu

```http
GET /reports/revenue    # A1 — SalesOrderService.getRevenueReport()
GET /reports/cash-in    # A2 — DebtService.getCashInReport()
GET /reports/profit     # A3 — SalesOrderService.getProfitReport()
GET /reports/debt       # A4 — DebtService.getDebtReport()
```

Query chung: `from`, `to` (bắt buộc — Report không có "Tất cả" như preset Dashboard).

**A3 bắt buộc hiển thị nhãn "Lợi nhuận kế hoạch"** — không hiển thị chữ "lợi nhuận" trần trụi (xem `report.md`).

**A4** tách rõ 2 phần trong response: `balance` (số dư hiện tại, không theo kỳ) và `inRange` (phát sinh trong kỳ: công nợ mới + tiền thu trong kỳ) — không gộp chung một object phẳng, tránh Owner hiểu nhầm số dư là số phát sinh.

---

## Definition of Done

- [ ] 4 endpoint hoạt động đúng, đúng nguồn dữ liệu theo bảng "Triết lý Report".
- [ ] A2 không cộng lẫn với A1/A3 trong cùng response.
- [ ] A4 tách rõ `balance` / `inRange`.
- [ ] Không tính lại Pricing/Discount/BOM.

---

# Task 03 — Nhóm B: Báo cáo Bán hàng

## Mục tiêu

```http
GET /reports/orders                  # B1 — SalesOrderService.getOrdersReport()
GET /reports/revenue-by-product      # B2 — SalesOrderService.getRevenueByProduct()
GET /reports/growth                  # B3 — SalesOrderService.getRevenueReport()/getProfitReport()/DebtService.getCashInReport() với groupBy=month|year
GET /reports/growth-by-product-type  # B4 — SalesOrderService.getGrowthByProductType()
```

B3 **không phải một method mới** — `ReportService` gọi lại A1/A2/A3 với `groupBy` khác (tháng/năm thay vì ngày), gộp 3 kết quả vào 1 response. Không viết logic tính doanh thu/lợi nhuận lần thứ hai.

B2/B4 group theo `productId`/`productTypeId` snapshot trên `SalesOrderItem` — không join ngược `Product`/`ProductType` (vi phạm Snapshot Rule).

---

## Definition of Done

- [ ] 4 endpoint hoạt động.
- [ ] B3 tái sử dụng nguyên A1/A2/A3, không tính lại.
- [ ] B2/B4 chỉ đọc field snapshot trên `SalesOrderItem`, không join Master Data.
- [ ] % tăng trưởng (so kỳ trước, cùng kỳ năm trước) tính runtime, không lưu.

---

# Task 04 — Nhóm C: Báo cáo Con người

## Mục tiêu

```http
GET /reports/revenue-by-employee   # C1 — SalesOrderService.getRevenueByEmployee()
GET /reports/revenue-by-customer   # C2 — SalesOrderService.getRevenueByCustomer() + CustomerService.getNewCustomersInRange()
```

C1 group theo `SalesOrder.ownerId` (đã có sẵn, không cần migration) — **không** group theo chuỗi `ownerName` tự do.

C2 gộp 2 nguồn: doanh thu/số đơn/lần mua theo khách (Sales Order) + khách mới trong kỳ (Customer) — `ReportService` gọi cả 2 Service, không tự query.

---

## Definition of Done

- [ ] 2 endpoint hoạt động.
- [ ] C1 group theo `ownerId`, hiển thị `ownerName` snapshot.
- [ ] C2 đúng cả phần doanh thu theo khách lẫn khách mới trong kỳ.
- [ ] Công nợ hiện tại của từng khách (trong C2) đọc realtime, không lưu vào bảng `customers` (đúng cam kết `customer.md`).

---

# Task 05 — Nhóm D: Báo cáo Vận hành (chỉ D2 — D1 tạm gỡ)

## Mục tiêu

```http
GET /reports/returns   # D2 — ReturnService.getDashboardSummary(range) / getTopReturnReasons(range) / getReturnsByCustomer(range)
```

**D1 (Báo cáo kho) không triển khai** — xem "Kiến trúc" ở đầu file. Không tạo route `/reports/warehouse`, không import `WarehouseService`.

D2 tái sử dụng nguyên 3 method `ReturnService` đã xây cho Dashboard — `ReportService` chỉ gọi lại với `from`/`to` bắt buộc (khác Dashboard: Dashboard cho phép không truyền = toàn bộ thời gian, Report bắt buộc truyền).

---

## Definition of Done

- [ ] Endpoint `/reports/returns` hoạt động, không tạo method `ReturnService` mới.
- [ ] Không có endpoint/route/import nào liên quan Warehouse trong Report.
- [ ] Giá trị hoàn hiển thị riêng, không trừ vào doanh thu (đúng ranh giới `return.md`).

---

# Task 06 — Export Excel & PDF

## Mục tiêu

Mỗi endpoint đọc ở Task 02–05 có bản export tương ứng:

```http
GET /reports/{name}/export?format=xlsx   # mặc định nếu không truyền
GET /reports/{name}/export?format=pdf
```

- Excel qua `ExcelService`, PDF qua `PdfService` (Task 00) — Report không gọi thư viện Excel/PDF trực tiếp.
- Nội dung file = đúng dữ liệu API trả về với cùng bộ lọc, kèm dòng tiêu đề ghi kỳ báo cáo + thời điểm xuất.
- **Không thêm chỉ số chỉ có trong file export** — Excel/PDF là bản in của API, không phải nguồn số liệu thứ hai.

---

## Definition of Done

- [ ] Toàn bộ 11 báo cáo (A1–A4, B1–B4, C1–C2, D2) có export Excel và PDF.
- [ ] File tải về đúng dữ liệu, đúng bộ lọc đang xem.
- [ ] Không có số liệu lệch giữa API và file export.

---

# Task 07 — Biểu đồ (Frontend)

## Mục tiêu

Report nào có chuỗi thời gian trong response (A1, A2, A3, B3) hiển thị thêm 1 biểu đồ xu hướng (line/bar tuỳ độ dài kỳ) ở FE, cùng trang với bảng số liệu.

- Cài 1 thư viện chart cho `apps/web` (chưa có sẵn — ưu tiên nhẹ, dễ dùng với Next.js, ví dụ `recharts`).
- 1 component dùng chung (vd `ReportTrendChart`) — không lặp code cấu hình chart ở từng trang report.
- Biểu đồ vẽ trực tiếp từ dữ liệu bảng đã fetch — **không gọi thêm endpoint riêng cho chart**.
- B2, B4, C1, C2, D2 không có chuỗi thời gian dạng liên tục theo cùng nghĩa — dùng bảng xếp hạng/bar chart theo nhóm thay vì line chart theo ngày (tuỳ ý khi code, không bắt buộc).

---

## Definition of Done

- [ ] Thư viện chart cài đặt, build không lỗi.
- [ ] A1/A2/A3/B3 có biểu đồ xu hướng.
- [ ] Component chart dùng chung, không copy-paste cấu hình.
- [ ] Không có request API riêng cho biểu đồ.

---

# Task 08 — Frontend Report Pages + Performance

## Mục tiêu

Trang `/reports` (landing) — danh sách 4 nhóm (Tài chính / Bán hàng / Con người / Vận hành), mỗi nhóm dẫn tới các báo cáo con. Mỗi báo cáo con: bộ lọc `from`–`to` (bắt buộc chọn, không có preset kiểu Dashboard) + card tổng + biểu đồ (nếu có) + bảng chi tiết + nút Export Excel/PDF.

Thêm mục "Báo cáo" vào sidebar, permission-gated `report.view`.

Performance — cùng nguyên tắc đã áp dụng cho Dashboard (`009-dashboard.md` Task 07):

Cho phép: SUM, COUNT, GROUP BY, JOIN đơn giản, ORDER BY, LIMIT — có Index phù hợp, không N+1 Query.

Không cho phép: tính lại Pricing Engine, BOM, Discount, Material Requirement, Workflow.

---

## Definition of Done

- [ ] Trang `/reports` + 11 trang báo cáo con hoạt động.
- [ ] Sidebar có mục "Báo cáo", ẩn đúng khi thiếu quyền.
- [ ] Không N+1 Query ở bất kỳ báo cáo nào.
- [ ] Không có Business Logic tính lại trong Report (BE lẫn FE).

---

# Task 09 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Kiểm tra:

- Business Flow (đúng nguồn/mốc ngày theo bảng "Triết lý Report").
- Module Ownership (gọi Service, không tạo Query Service riêng, không đụng Warehouse).
- Excel/PDF export khớp API.
- Biểu đồ khớp dữ liệu bảng.
- Performance.
- API.

Đảm bảo đồng bộ:

- `knowledge/modules/report.md` — đổi "Trạng thái" từ "Thiết kế — chưa triển khai" → "Đã triển khai".
- `schema.prisma` (index `Payment.paymentDate`).
- ERD (nếu có thay đổi quan hệ — thực tế Task này không thêm bảng/quan hệ mới, chỉ 1 index).

---

## Report Review Checklist

- [ ] Report không có Business Logic.
- [ ] Report không truy cập Repository/Prisma trực tiếp.
- [ ] Report chỉ gọi Service của module sở hữu dữ liệu — không có class `ReportQueryService` nào được tạo.
- [ ] Mỗi chỉ số chỉ có một nguồn sự thật, khớp bảng ở `report.md`.
- [ ] Không triển khai D1 (Kho) — không còn dấu vết `WarehouseService` trong module.
- [ ] Excel/PDF export và biểu đồ đều khớp đúng dữ liệu API, không tính thêm.
- [ ] Query tối ưu, không N+1 Query.

---

## Definition of Done

- [ ] Không còn TODO.
- [ ] Đồng bộ Knowledge (`report.md` trạng thái "Đã triển khai").
- [ ] Đồng bộ Prisma.
- [ ] Đồng bộ ERD.
- [ ] Pass Review.

---

# Module Dependencies

## Phụ thuộc

- Sales Order
- Debt (Payment, Receivable)
- Return
- Customer
- Shared: `ExcelService` (có sẵn), `PdfService` (mới, Task 00)

## Module bị ảnh hưởng

- **Sales Order module:** thêm 7 method đọc (Task 00) — không đổi Business Rule/Data Model.
- **Debt module:** thêm 2 method đọc (Task 00) + index `Payment(paymentDate)`.
- **Customer module:** thêm 1 method đọc (Task 00).
- **Return module:** không đổi — tái dùng nguyên trạng.
- **Permission module:** seed `report.view`.

Report **không được thay đổi Business Rule** của:

- Sales Order
- Debt
- Return
- Customer
- Warehouse (không đụng tới — D1 tạm gỡ)

Nếu cần thay đổi thêm phải dừng và xác nhận với người dùng.

---

# Commit Message

```text
feat(report): implement report module foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module tiếp theo.

Sau đó dừng và chờ Task tiếp theo.
