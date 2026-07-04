# Sprint 01 — Module Đơn hàng

> **Tên file:** `workbench/sprint-01/005-don-hang.md`

---

# Mục tiêu

Hoàn thành nền tảng Module Sales Order theo kiến trúc đã thống nhất.

Module này không cho phép tạo thủ công.

Sales Order chỉ được sinh tự động khi Báo giá được Approve.

Hoàn thành:

- Schema Migration
- Data Model
- CRUD (Read Only)
- Snapshot
- Workflow
- Timeline & Exception Flows
- Dashboard Summary

---

# Task 00 — Schema Migration

## Mục tiêu

Chuẩn bị database trước khi implement business logic.

Bao gồm:

- Rename Enums sang tiếng Anh
- Thêm các fields mới vào `SalesOrder`
- Thêm `PaymentStatus` enum và field
- Thêm `supplierName` vào `MaterialPrice`
- Chạy Prisma migration
- Đồng bộ ERD

---

## Enum cần rename

| Hiện tại | Đổi thành |
| --- | --- |
| `DANG_SAN_XUAT` | `IN_PRODUCTION` |
| `HOAN_THANH` | `PRODUCTION_COMPLETED` |
| `DA_HUY` | `CANCELLED` |
| `CHO_SAN_XUAT` | `PENDING` |

---

## Fields cần thêm vào SalesOrder

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `plannedCost` | `Decimal` | Giá vốn kế hoạch |
| `plannedProfit` | `Decimal` | = totalAmount - plannedCost |
| `ownerName` | `String?` | V1: string |
| `totalProductionOrders` | `Int` | >= 1 |
| `completedProductionOrders` | `Int` | default 0 |
| `expectedDeliveryDate` | `DateTime?` | |
| `actualDeliveryDate` | `DateTime?` | |
| `paymentStatus` | `PaymentStatus` | default UNPAID |

---

## Definition of Done

- [x] Enums đã rename sang tiếng Anh.
- [x] Fields mới đã có trong SalesOrder.
- [x] PaymentStatus enum đã tạo.
- [x] supplierName đã thêm vào MaterialPrice.
- [x] Migration chạy thành công.
- [x] Toàn bộ code tham chiếu enum đã cập nhật.
- [x] ERD đã đồng bộ.

---

## Commit Message đề xuất

```text
feat(order): prepare schema for sales order module
```

---

# Task 01 — Thiết kế Data Model

## Mục tiêu

Thiết kế đầy đủ Data Model cho Module Sales Order.

Bao gồm:

- SalesOrder
- SalesOrderItem
- SalesOrderItemParameter
- OrderBOM
- OrderBOMItem
- SalesOrderTimeline

Định nghĩa:

- Enum
- Quan hệ dữ liệu
- Index
- Validation
- Running Number

---

## Definition of Done

- [x] SalesOrder được sinh từ Quotation.
- [x] Không cho phép tạo thủ công.
- [x] SalesOrder là Snapshot độc lập.
- [x] SalesOrderItem là Snapshot độc lập.
- [x] SalesOrderItemParameter không FK về ProductParameter.
- [x] OrderBOM và OrderBOMItem là Snapshot — không FK về MaterialRequirementVersion.
- [x] Running Number SO000001.
- [x] Enum thống nhất tiếng Anh.
- [x] Hoàn thành ERD.

---

## Commit Message đề xuất

```text
feat(order): design sales order data model (timeline, running number fix)
```

---

# Task 02 — Snapshot Engine

## Mục tiêu

Triển khai cơ chế Snapshot từ Quotation sang Sales Order.

Trigger duy nhất:

```http
POST /quotations/:id/approve
```

Toàn bộ thực hiện trong **một transaction**:

1. Snapshot Customer
2. Snapshot từng SalesOrderItem (Product code, name, giá bán, giá vốn, chiết khấu)
3. Snapshot SalesOrderItemParameter
4. Snapshot `QuotationItem.pricingRuleVersionId` vào SalesOrderItem
5. Tính OrderBOM từ `QuotationItem.materialRequirementVersionId` — không re-query ACTIVE
6. Tính `plannedCost`, `plannedProfit`, `totalAmount`
7. Sinh ProductionOrders — nhóm theo `productionCenter`
8. Set `totalProductionOrders`

Nếu bất kỳ bước nào thất bại → rollback toàn bộ, Quotation giữ nguyên trạng thái.

Không đọc lại dữ liệu gốc sau khi tạo.

---

## Definition of Done

- [x] Snapshot toàn bộ dữ liệu trong một transaction.
- [x] Không còn phụ thuộc Product sau khi tạo.
- [x] Không còn phụ thuộc Quotation sau khi tạo.
- [x] PricingRuleVersion lấy từ QuotationItem — không re-query.
- [x] OrderBOM tính từ `QuotationItem.materialRequirementVersionId` — không re-query ACTIVE.
- [x] ProductionOrders được nhóm đúng theo productionCenter.
- [x] `totalProductionOrders` được set đúng.
- [x] Rollback đúng khi thất bại.
- [x] Snapshot Rule đúng theo knowledge/modules/order.md.

---

## Commit Message đề xuất

```text
feat(order): implement snapshot engine from quotation approve
```

---

# Task 03 — Sales Order Read API

## Mục tiêu

Xây dựng API đọc dữ liệu Sales Order.

Bao gồm:

- Danh sách
- Chi tiết
- Tìm kiếm
- Lọc
- Phân trang

Sales Order không có Create / Update / Delete API.

---

## Definition of Done

- [x] Danh sách Sales Order.
- [x] Xem chi tiết.
- [x] Search.
- [x] Filter.
- [x] Pagination.
- [x] Không có Create API.
- [x] Không có Update API.
- [x] Không có Delete API.

---

## Commit Message đề xuất

```text
feat(order): add sales order read api
```

---

# Task 04 — Workflow Engine

## Mục tiêu

Triển khai Workflow theo Action.

Action:

- Ship
- Deliver

ERP tự động:

- Production Completed

Không sửa Status trực tiếp.

---

## Action API

```http
POST /sales-orders/:id/ship

POST /sales-orders/:id/deliver
```

Không dùng:

```http
PATCH /sales-orders/:id

{
    "status":"SHIPPED"
}
```

---

## Definition of Done

- [x] Ship Action.
- [x] Deliver Action.
- [x] ERP tự chuyển PRODUCTION_COMPLETED.
- [x] Không sửa Status trực tiếp.
- [x] Validation đầy đủ.

---

## Commit Message đề xuất

```text
feat(order): implement ship and deliver workflow actions
```

---

# Task 05 — Timeline, Manual Override & Exception Flows

## Mục tiêu

Triển khai Timeline và các luồng ngoại lệ.

### Timeline

Lưu lịch sử toàn bộ Action. Là Audit Log.

Mỗi entry lưu `actorType`: `SYSTEM` (ERP tự động) hoặc `USER` (người dùng thao tác). Chuẩn bị sẵn cho Notification, Cron, Bot sau này.

Ví dụ:

- ERP tạo Sales Order
- ERP sinh Production Orders
- Production Completed (tự động)
- Ship
- Deliver
- Payment Status Changed
- Manual Override
- Cancel

### Manual Override

```http
POST /sales-orders/:id/override
```

Bắt buộc:

- Chọn trạng thái mới
- Nhập lý do
- Lưu người thực hiện
- Lưu trạng thái cũ → mới

Toàn bộ ghi vào Timeline. Chỉ Admin.

### Cancel

```http
POST /sales-orders/:id/cancel
```

Block nếu đã có Production Order bắt đầu sản xuất.

Chỉ Admin. Bắt buộc nhập lý do. Ghi Timeline.

---

## Definition of Done

- [x] Timeline append-only.
- [x] Không Update, không Delete Timeline.
- [x] Lưu đầy đủ Action và actorType (`SYSTEM` hoặc `USER`).
- [x] Manual Override yêu cầu reason, ghi Timeline.
- [x] Cancel block khi PO đã started.
- [x] Cancel yêu cầu reason, ghi Timeline.

---

## Commit Message đề xuất

```text
feat(order): add timeline, manual override and cancel flows
```

---

# Task 06 — Planned Financials

## Mục tiêu

Lưu Summary Fields phục vụ Dashboard.

Bao gồm:

- totalAmount
- plannedCost
- plannedProfit

Không SUM lại từ Items.

---

## Definition of Done

- [x] totalAmount.
- [x] plannedCost.
- [x] plannedProfit.
- [x] Dashboard chỉ đọc Summary Fields.

---

## Commit Message đề xuất

```text
feat(order): expose planned financials summary for dashboard
```

---

# Task 07 — Production Progress

## Mục tiêu

Quản lý tiến độ sản xuất của Sales Order.

Lưu Source Data:

- completedProductionOrders
- totalProductionOrders

UI tự hiển thị:

```text
2/3 (67%)
```

Không lưu Progress dạng %.

---

## Definition of Done

- [x] completedProductionOrders.
- [x] totalProductionOrders.
- [x] ERP tự cập nhật.
- [x] UI tự tính %.

---

## Commit Message đề xuất

```text
feat(order): track production progress on sales order
```

---

# Task 08 — Delivery & Payment

## Mục tiêu

Quản lý:

- expectedDeliveryDate
- actualDeliveryDate
- paymentStatus

Không quản lý Công nợ.

Module Công nợ sẽ triển khai ở Sprint sau.

## Record Payment

```http
POST /sales-orders/:id/record-payment
```

**V1:** Endpoint này chỉ cập nhật `paymentStatus`. Không lưu số tiền, không lưu Payment Transaction.

Chi tiết thanh toán (số tiền, ngày, phương thức) sẽ thuộc Module Công nợ — không implement ở đây.

Luồng:

```text
UNPAID → PARTIALLY_PAID → PAID
```

Không cho phép đi ngược. Ghi Timeline.

---

## Definition of Done

- [x] Delivery Dates.
- [x] Payment Status.
- [x] record-payment endpoint hoạt động.
- [x] paymentStatus chỉ đi một chiều: UNPAID → PARTIALLY_PAID → PAID.
- [x] Không lưu Payment Details.
- [x] Ghi Timeline khi paymentStatus thay đổi.

---

## Commit Message đề xuất

```text
feat(order): add delivery dates and payment status workflow
```

---

# Task 09 — Hoàn thiện Module

## Mục tiêu

Kiểm tra toàn bộ Module.

Review:

- Business Flow
- Snapshot
- Workflow
- Timeline
- Validation
- Dashboard
- API
- ERD

Đảm bảo đồng bộ:

- knowledge/modules/order.md
- schema.prisma
- ERD

---

## Snapshot Integrity Review

Bài test quan trọng nhất của ERP snapshot design.

Sau khi tạo SalesOrder, thay đổi Master Data và kiểm tra:

- [x] Product thay đổi tên/giá → SalesOrder không đổi.
- [x] MaterialPrice thay đổi → SalesOrder không đổi.
- [x] PricingRule cập nhật version mới → SalesOrder không đổi.
- [x] MaterialRequirement cập nhật version mới → SalesOrder không đổi.
- [x] Customer thay đổi thông tin → SalesOrder không đổi.

---

## Definition of Done

- [x] Không còn TODO.
- [x] Đồng bộ Knowledge.
- [x] Đồng bộ ERD.
- [x] Đồng bộ Prisma Schema.
- [x] Snapshot Integrity Review pass toàn bộ.
- [x] Pass Review.

---

## Commit Message đề xuất

Task 09 là bước hoàn thiện toàn Module — dùng chung Commit Message tổng ở cuối file:

```text
feat(order): implement sales order foundation
```

---

# Module Dependencies

## Phụ thuộc

- Customer
- Product
- Quotation

## Module bị ảnh hưởng

- Production
- Warehouse
- Debt
- Dashboard

Không được thay đổi Business Rule hoặc Data Model của các Module trên.

Nếu cần thay đổi phải dừng và xác nhận với người dùng trước.

---

# Commit Message

```text
feat(order): implement sales order foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module Production.

Sau đó dừng và chờ Task tiếp theo.
