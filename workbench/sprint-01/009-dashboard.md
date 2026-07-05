# Sprint 01 — Module Dashboard

> **Tên file:** `workbench/sprint-01/009-dashboard.md`

---

# Mục tiêu

Hoàn thành Dashboard quản trị của toàn bộ ERP.

Dashboard không chứa Business Logic.

Dashboard chỉ tổng hợp và hiển thị dữ liệu từ các Module khác.

Không có:

- Create
- Update
- Delete

Chỉ có:

- Read

---

# Kiến trúc

Dashboard không truy cập trực tiếp Database (Prisma/Repository) của các Module khác.

Dashboard chỉ gọi **Service hiện có** của module sở hữu dữ liệu:

```
SalesOrderService
ProductionOrderService
WarehouseService
DebtService
```

**Không tạo thêm class `XxxQueryService` song song.** Mỗi module hiện chỉ có một Service duy nhất (xử lý cả đọc lẫn ghi) — tách thêm một tầng Query Service riêng là over-engineering không cần thiết ở quy mô hiện tại (CQRS chỉ đáng làm khi có nhu cầu thật, vd hiệu năng/cache riêng cho nhánh đọc). Thay vào đó, mỗi Service hiện có được **bổ sung thêm method đọc phục vụ Dashboard** ngay trong chính nó:

```text
SalesOrderService
    ├── ship(), deliver(), cancel()...  (đã có)
    ├── getDashboardSummary()
    ├── getStatistics()
    └── getRecentOrders()

ProductionOrderService
    ├── start(), complete()...  (đã có)
    ├── getDashboardSummary()
    ├── getBusyCenters()
    └── getProgressSummary()

WarehouseService
    ├── receive(), issue()...  (đã có)
    ├── getCurrentStock()
    ├── getTopConsumedMaterials()
    ├── getLowStockMaterials()
    └── getInventorySummary()

DebtService
    ├── createPayment()...  (đã có)
    ├── getDashboardSummary()
    ├── getOverdueCustomers()
    ├── getUpcomingDueReceivables(days = 7)
    ├── getCreditLimitExceededCustomers()
    └── getTopDebtors()
```

Dashboard không gọi Repository. Dashboard không gọi Prisma. Dashboard không tự viết Query sang bảng của Module khác.

**Lưu ý implementation:** trong `DebtService`, các method liệt kê chi tiết (`findAll` với filter `overdue`/`risk`) và các method tổng hợp cho Dashboard (`getOverdueCustomers()`, `getUpcomingDueReceivables()`...) đều dựa trên cùng một định nghĩa "thế nào là quá hạn" (`dueDate < today`). Nên tách định nghĩa đó thành một helper dùng chung trong `DebtService`, để tránh hai nơi định nghĩa "quá hạn" bị lệch nhau khi sửa sau này.

---

# Triết lý Dashboard

Dashboard không phải nơi phát minh ra KPI.

Mỗi KPI chỉ có đúng **một Module sở hữu (Single Owner)**.

Ví dụ:

| KPI | Module sở hữu |
|------|---------------|
| Doanh thu | Sales Order |
| Giá vốn | Sales Order |
| Lợi nhuận | Sales Order |
| Tiến độ sản xuất | Production |
| Tồn kho | Warehouse |
| Công nợ | Debt |

Dashboard chỉ hiển thị.

Nếu một KPI chưa có Module sở hữu thì phải bổ sung tại Module đó trước (xem Task 00).

Không được tự tính trong Dashboard.

---

# Task 00 — Chuẩn bị Dashboard Dependencies

## Mục tiêu

Task này **không tạo Service mới**, chỉ hoàn thiện những gì Dashboard cần từ các module hiện có: bổ sung method đọc còn thiếu ngay trong Service đã tồn tại, và bổ sung 1 field mới ở Product module.

---

## Bổ sung method đọc

- `SalesOrderService`: `getDashboardSummary()`, `getStatistics()`, `getRecentOrders()`.
- `ProductionOrderService`: `getDashboardSummary()`, `getBusyCenters()`, `getProgressSummary()`.
- `WarehouseService`: `getCurrentStock()` (kiểm tra đã có qua Read API `007-kho.md` Task 04 chưa, nếu có rồi thì tái sử dụng), `getTopConsumedMaterials()`, `getLowStockMaterials()`, `getInventorySummary()`.
- `DebtService`: `getDashboardSummary()`, `getOverdueCustomers()`, `getUpcomingDueReceivables(days = 7)`, `getCreditLimitExceededCustomers()`, `getTopDebtors()`.

## Bổ sung dữ liệu ở Product module

**Đây là thay đổi chạm vào Product module đã ship** — không phải việc của Dashboard, nhưng Dashboard (Warehouse Overview) cần dữ liệu này:

- Thêm field `Material.minimumStock` (Decimal, ngưỡng tồn kho tối thiểu).
- Migration.
- Cập nhật DTO (`CreateMaterialDto`/`UpdateMaterialDto`) để nhập/sửa được giá trị này.
- Cập nhật CRUD Material (`ProductService`/`MaterialController`) để nhận field mới.

---

## Definition of Done

- [x] `SalesOrderService` có đầy đủ method đọc phục vụ Dashboard.
- [x] `ProductionOrderService` có đầy đủ method đọc phục vụ Dashboard.
- [x] `WarehouseService` có đầy đủ method đọc phục vụ Dashboard.
- [x] `DebtService` có đầy đủ method đọc phục vụ Dashboard, bao gồm `getUpcomingDueReceivables()`.
- [x] `Material.minimumStock` đã thêm (field + migration + DTO + CRUD).
- [x] Không tạo class `XxxQueryService` nào.
- [x] Dashboard không truy cập Repository.
- [x] Dashboard không truy cập Prisma.

---

# Task 01 — Dashboard Overview API

## Mục tiêu

Triển khai API tổng hợp.

```http
GET /dashboard/overview
```

Bao gồm:

- Sales Summary
- Production Summary
- Warehouse Summary
- Debt Summary
- Alerts Summary

Gọi lần lượt `SalesOrderService`/`ProductionOrderService`/`WarehouseService`/`DebtService` (các method ở Task 00), gộp kết quả lại — không tự tính toán gì thêm trong Dashboard.

---

## Definition of Done

- [x] API hoạt động.
- [x] Không tính lại Business Logic.
- [x] Chỉ đọc qua Service của module sở hữu dữ liệu.

---

# Task 02 — Sales Dashboard

## Mục tiêu

Hiển thị:

- Tổng doanh thu kế hoạch
- Tổng giá vốn
- Tổng lợi nhuận
- Đơn đang sản xuất
- Đơn hoàn thành
- Đơn đã giao

Nguồn: `SalesOrderService.getDashboardSummary()`.

---

## Definition of Done

- [x] Sales KPI.
- [x] Đúng số liệu.
- [x] Không đọc `SalesOrderItem`.
- [x] Không tính lại Pricing.

---

# Task 03 — Production Dashboard

## Mục tiêu

Hiển thị:

- Đơn đang sản xuất
- Đơn đã hoàn thành
- Tiến độ sản xuất
- Xưởng nhiều việc nhất
- Xưởng ít việc nhất

Nguồn: `ProductionOrderService.getDashboardSummary()` / `getBusyCenters()` / `getProgressSummary()`.

---

## Definition of Done

- [x] Production KPI.
- [x] Tiến độ đúng.
- [x] Không tính lại Workflow.
- [x] Không đọc trực tiếp Production Repository/Prisma.

---

# Task 04 — Warehouse Dashboard

## Mục tiêu

Hiển thị:

- Giá trị tồn kho
- Tồn kho hiện tại
- Vật tư sắp hết
- Vật tư hết hàng
- Top vật tư tiêu thụ

Nguồn: `WarehouseService.getCurrentStock()` / `getTopConsumedMaterials()` / `getLowStockMaterials()` / `getInventorySummary()`.

Điều kiện cảnh báo: so sánh `currentStock` với `minimumStock` (đã thêm ở Task 00).

---

## Definition of Done

- [x] Đọc `currentStock`.
- [x] Cảnh báo theo `minimumStock`.
- [x] Top vật tư tiêu thụ hoạt động.
- [x] Dashboard không đọc `WarehouseTransaction` trực tiếp — chỉ qua `WarehouseService`.

---

# Task 05 — Debt Dashboard

## Mục tiêu

Hiển thị:

- Tổng phải thu
- Đã thu
- Còn phải thu
- Quá hạn
- Sắp đến hạn
- Khách vượt hạn mức
- Top khách nợ nhiều
- Top khách quá hạn

Nguồn: `DebtService.getDashboardSummary()` / `getOverdueCustomers()` / `getUpcomingDueReceivables(days=7)` / `getCreditLimitExceededCustomers()` / `getTopDebtors()`.

Dashboard không tự tính công nợ, không tự tính quá hạn, không tự tính hạn mức — toàn bộ logic này thuộc `DebtService` (đã bổ sung ở Task 00).

---

## Definition of Done

- [x] Debt KPI.
- [x] Due Date đúng.
- [x] Overdue đúng.
- [x] Sắp đến hạn đúng (dùng `getUpcomingDueReceivables()`).
- [x] Credit Limit đúng.
- [x] Dashboard chỉ dùng `DebtService`.

---

# Task 06 — Alerts Dashboard

## Mục tiêu

Tổng hợp cảnh báo.

Bao gồm:

- Công nợ quá hạn
- Khách vượt hạn mức
- Đơn trễ tiến độ
- Vật tư sắp hết
- Hết vật tư

Alerts chỉ hiển thị. Không thay đổi trạng thái.

---

## Definition of Done

- [x] Alerts hoạt động.
- [x] Không sinh Business Logic.
- [x] Không Update dữ liệu.
- [x] Dữ liệu lấy từ Service của module sở hữu (Task 00-05).

---

# Task 07 — Performance

## Mục tiêu

Tối ưu Dashboard.

Cho phép:

- SUM
- COUNT
- GROUP BY
- JOIN đơn giản
- ORDER BY
- LIMIT

Điều kiện:

- Có Index phù hợp.
- Không N+1 Query.
- Không tính lại Business Logic.

Không cho phép:

- Tính lại Pricing Engine
- Tính lại BOM
- Tính lại Discount
- Tính lại Material Requirement
- Tính lại Workflow

---

## Definition of Done

- [x] Không có N+1 Query.
- [x] Dashboard mở nhanh.
- [x] Query tối ưu.
- [x] Không có Business Logic trong Dashboard.

---

# Task 08 — API Review

## Mục tiêu

Review toàn bộ Dashboard API.

Kiểm tra:

- Response
- DTO
- Naming
- Performance
- Query

---

## Definition of Done

- [x] API nhất quán.
- [x] DTO đúng.
- [x] Naming đúng.
- [x] Pass Review.

---

# Task 09 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Đảm bảo đồng bộ:

- knowledge/modules/dashboard.md
- schema.prisma (field `Material.minimumStock`)
- ERD

Kiểm tra:

- Dashboard Rules
- KPI Ownership
- Module Ownership (gọi Service, không tạo Query Service riêng)
- Performance
- API

---

## Dashboard Review Checklist

- [x] Dashboard không có Business Logic.
- [x] Dashboard không truy cập Repository.
- [x] Dashboard không truy cập Prisma.
- [x] Dashboard chỉ gọi Service của module sở hữu dữ liệu — không có class `XxxQueryService` nào được tạo.
- [x] Mỗi KPI chỉ có một Module sở hữu.
- [x] Không tính lại KPI đã có Summary Field.
- [x] Query tối ưu, không có N+1 Query.

---

## Definition of Done

- [x] Không còn TODO.
- [x] Đồng bộ Knowledge.
- [x] Đồng bộ Prisma.
- [x] Đồng bộ ERD.
- [x] Pass Review.

---

# Module Dependencies

Dashboard phụ thuộc:

- Sales Order
- Production
- Warehouse
- Debt
- Product (chỉ cung cấp `Material.minimumStock` — không cung cấp KPI)

Dashboard không được thay đổi Data Model, Business Rule, hay Workflow của các Module trên, ngoài phạm vi đã thống nhất ở đây (bổ sung method đọc + `Material.minimumStock`).

Nếu Dashboard cần dữ liệu mới ngoài phạm vi này → phải bổ sung tại Module sở hữu dữ liệu, không tự tính trong Dashboard, và phải dừng lại xác nhận với người dùng trước.

---

# Commit Message

```text
feat(dashboard): implement dashboard foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module Báo cáo.

Sau đó dừng và chờ Task tiếp theo.
