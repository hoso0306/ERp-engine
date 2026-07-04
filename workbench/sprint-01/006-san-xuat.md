# Sprint 01 — Module Sản xuất

> **Tên file:** `workbench/sprint-01/006-san-xuat.md`

---

# Mục tiêu

Hoàn thành nền tảng Module Production theo kiến trúc đã thống nhất.

Production là Work Execution Layer.

Module này chỉ quản lý quá trình sản xuất tại xưởng.

Không quản lý:

- Báo giá
- Bán hàng
- Kho
- Công nợ
- Dashboard

---

# Task 00 — Schema Migration

## Mục tiêu

Chuẩn bị schema cho Module Production.

Bao gồm:

- Đổi Running Number từ `SX` sang `PO`
- Thêm `startedAt`, `completedAt` vào `ProductionOrder`
- Kiểm tra ProductionOrderItem (đã đúng theo knowledge, không cần đổi)
- Thêm `ProductionOrderTimeline` + enum `ProductionOrderTimelineAction`, `ProductionOrderTimelineActorType`
- Đồng bộ Prisma Schema
- Đồng bộ ERD

---

## Fields cần thêm vào ProductionOrder

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `startedAt` | `DateTime?` | Thời điểm bấm "Bắt đầu sản xuất" |
| `completedAt` | `DateTime?` | Thời điểm bấm "Hoàn thành" |

---

## Enum ProductionOrderTimelineActorType

**Tạo enum riêng, không tái sử dụng `SalesOrderTimelineActorType`.** Dù giá trị hiện tại giống hệt (`SYSTEM`, `USER`), hai module cần độc lập — nếu dùng chung enum, giá trị mới thêm cho Production sau này (vd `MACHINE`) sẽ vô tình hợp lệ luôn ở `SalesOrderTimeline.actorType`. Chấp nhận trùng lặp định nghĩa để giữ 2 module tách biệt.

---

## Definition of Done

- [x] Running Number dùng prefix `PO` (đổi seed + cập nhật code test data hiện có `SX000001 → PO000001`).
- [x] `startedAt`, `completedAt` đã thêm vào `ProductionOrder`.
- [x] ProductionOrderItem đúng theo knowledge (không cần đổi schema).
- [x] `ProductionOrderTimeline` được tạo, dùng enum `ProductionOrderTimelineActorType` riêng (không tái sử dụng của Sales Order).
- [x] Migration chạy thành công.
- [x] ERD đồng bộ.

---

# Task 01 — Data Model

## Mục tiêu

Hoàn thiện Data Model cho Module Production.

Bao gồm:

- ProductionOrder
- ProductionOrderItem
- ProductionOrderTimeline

Định nghĩa:

- Enum
- Quan hệ dữ liệu
- Validation
- Index
- Running Number

---

## Definition of Done

- [x] ProductionOrder sinh từ SalesOrder.
- [x] Không tạo thủ công.
- [x] Một ProductionOrder thuộc đúng một ProductionCenter.
- [x] ProductionOrderItem snapshot từ SalesOrderItem.
- [x] salesOrderItemId chỉ dùng để navigation.
- [x] Không snapshot lại OrderBOM.
- [x] Không tạo ProductionOrderMaterial.
- [x] Hoàn thành ERD.

---

# Task 02 — Production Order Integration

## Mục tiêu

**Không viết lại generator.** Việc sinh `ProductionOrder`/`ProductionOrderItem` (nhóm theo `productionCenter`, trong transaction của `POST /quotations/:id/approve`) **đã được code xong** ở Sales Order Task 02 (`quotation-workflow.service.ts`).

Task này chỉ bổ sung phần còn thiếu: ghi `ProductionOrderTimeline` (`PRODUCTION_ORDER_CREATED`, actorType `SYSTEM`) cho từng Production Order vừa tạo, ngay trong transaction `approve()` đã có sẵn — không tạo transaction mới, không sinh lại dữ liệu.

---

## Definition of Done

- [x] Không có code sinh `ProductionOrder`/`ProductionOrderItem` mới nào được viết thêm (xác nhận việc này đã có sẵn).
- [x] `ProductionOrderTimeline` (`PRODUCTION_ORDER_CREATED`) được ghi cho từng PO, trong cùng transaction `approve()`.
- [x] Rollback đúng khi transaction `approve()` thất bại (đã đúng từ trước, chỉ verify lại).

---

# Task 03 — Production Read API

## Mục tiêu

API phục vụ xưởng.

Bao gồm:

- Danh sách ProductionOrder
- Chi tiết
- Search
- Filter theo xưởng
- Filter theo trạng thái
- Pagination

---

## Definition of Done

- [x] List.
- [x] Detail.
- [x] Search.
- [x] Filter theo ProductionCenter (mỗi xưởng chỉ xem đơn của mình).
- [x] Filter theo Status.
- [x] Pagination.

---

# Task 04 — Workflow Engine

## Mục tiêu

Triển khai Workflow theo Action.

Action:

- Start Production
- Complete Production

Không sửa Status trực tiếp.

**V1 không có Manual Override cho Production Order** (khác Sales Order/Quotation) — quyết định có chủ đích, không phải thiếu sót. Complete có "Undo" sẽ kéo theo rollback `SalesOrder.completedProductionOrders`/Dashboard/Warehouse — quá phức tạp cho V1. Nếu bấm nhầm, Admin xử lý qua DB/script, không qua API. Để dành V2.

---

## Action API

```http
POST /production-orders/:id/start

POST /production-orders/:id/complete
```

Không dùng:

```http
PATCH /production-orders/:id

{
  "status":"IN_PRODUCTION"
}
```

---

## Definition of Done

- [x] Start Action.
- [x] Complete Action.
- [x] Validation đầy đủ.
- [x] Không sửa Status trực tiếp.

---

# Task 05 — Sales Order Synchronization

## Mục tiêu

Đồng bộ trạng thái về Sales Order.

Sau khi Complete:

```text
ProductionOrder
        │
        ▼
SalesOrderService.syncProductionProgress()
```

ERP tự:

- cập nhật completedProductionOrders
- kiểm tra completed == total
- chuyển SalesOrder sang PRODUCTION_COMPLETED
- ghi SalesOrderTimeline

---

## Definition of Done

- [x] syncProductionProgress() được gọi.
- [x] completedProductionOrders cập nhật đúng.
- [x] SalesOrder tự chuyển PRODUCTION_COMPLETED.
- [x] SalesOrderTimeline được ghi.
- [x] Không cần thao tác thủ công.

---

# Task 06 — Timeline

## Mục tiêu

Triển khai ProductionOrderTimeline.

Append-only.

Audit Log.

---

## ProductionOrderTimelineAction

```text
PRODUCTION_ORDER_CREATED

STARTED

COMPLETED

CANCELLED
```

Actor (enum riêng `ProductionOrderTimelineActorType`, không tái sử dụng của Sales Order — xem Task 00):

```text
SYSTEM

USER
```

## Payload theo từng Action

| Action | Payload gợi ý |
| --- | --- |
| `PRODUCTION_ORDER_CREATED` | `{ salesOrderCode }` |
| `STARTED` | `{}` |
| `COMPLETED` | `{ startedAt, completedAt }` |
| `CANCELLED` | `{ reason }` (kế thừa `reason` từ `SalesOrder.cancel()`) |

---

## Definition of Done

- [x] Timeline append-only.
- [x] Không Update.
- [x] Không Delete.
- [x] ActorType đầy đủ, dùng enum riêng của Production.
- [x] Payload đúng cấu trúc theo bảng trên cho từng action.

---

# Task 07 — Cancel Workflow

## Mục tiêu

Triển khai Cancel theo đúng Business Rule.

Không có API Cancel riêng cho Production Order.

Chỉ được cascade từ SalesOrder.

Flow:

```text
SalesOrder.cancel()

↓

Nếu tất cả PO đều PENDING

↓

ProductionOrder

↓

CANCELLED
```

**Đây là thay đổi duy nhất chạm vào code Sales Order đã ship** (đã thống nhất trước, không phải phát sinh ngoài kế hoạch): sửa `SalesOrderService.cancel()` (thuộc module Sales Order) để cascade cập nhật các `ProductionOrder` liên quan sang `CANCELLED` sau khi `SalesOrder.status = CANCELLED` thành công. Production module **không tự tạo** cơ chế Cancel của riêng mình — không có `ProductionOrderService.cancel()`.

---

## Definition of Done

- [x] Không có Cancel API riêng cho Production Order.
- [x] `SalesOrderService.cancel()` đã cập nhật để cascade `ProductionOrder → CANCELLED` khi huỷ thành công.
- [x] Chỉ SYSTEM được Cancel (actorType `SYSTEM` trong `ProductionOrderTimeline`).
- [x] Timeline được ghi cho từng PO bị cascade.
- [x] Validation đầy đủ (đã chặn từ phía `SalesOrder.cancel()` nếu có PO `IN_PRODUCTION`/`PRODUCTION_COMPLETED`).

---

# Task 08 — Validation

## Mục tiêu

Kiểm tra toàn bộ Business Rule.

Bao gồm:

- Không Start hai lần.
- Không Complete hai lần.
- Không Complete khi chưa Start.
- Không quay ngược trạng thái.
- ProductionOrder chỉ Complete một lần.

---

## Definition of Done

- [x] Validation đầy đủ.
- [x] Workflow bất biến.
- [x] Pass Review.

---

# Task 09 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Kiểm tra:

- Business Flow
- Snapshot
- Workflow
- Timeline
- API
- Validation
- Prisma
- ERD

Đảm bảo đồng bộ:

- knowledge/modules/production.md
- schema.prisma
- ERD

---

## Snapshot Integrity Review

Sau khi tạo ProductionOrder, thay đổi dữ liệu liên quan và kiểm tra:

- [x] Product đổi tên → `ProductionOrderItem.productName` không đổi.
- [x] SalesOrderItem đổi (nếu có thể) → `ProductionOrderItem` không đổi.
- [x] Material/MaterialPrice đổi → vật tư xem qua `salesOrderItemId → OrderBOM` vẫn đúng dữ liệu snapshot cũ (không bị ảnh hưởng).

---

## Definition of Done

- [x] Không còn TODO.
- [x] Đồng bộ Knowledge.
- [x] Đồng bộ Prisma.
- [x] Đồng bộ ERD.
- [x] Snapshot Integrity Review pass toàn bộ.
- [x] Pass Review.

---

# Module Dependencies

## Phụ thuộc

- Product
- Quotation
- SalesOrder

## Module bị ảnh hưởng

- Warehouse
- Dashboard

Không được thay đổi Business Rule hoặc Data Model của các module trên.

Nếu cần thay đổi phải dừng và xác nhận với người dùng.

---

# Commit Message

```text
feat(production): implement production foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module Warehouse.

Sau đó dừng và chờ Task tiếp theo.
