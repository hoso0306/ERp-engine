# Module Sản xuất (Production)

> **Tên file:** `knowledge/modules/production.md`

---

# Mục đích

Quản lý toàn bộ quá trình sản xuất tại các xưởng.

Production Order được sinh tự động từ Sales Order.

Module này chịu trách nhiệm:

- Quản lý công việc sản xuất
- Theo dõi tiến độ từng xưởng
- Cập nhật trạng thái hoàn thành
- Đồng bộ tiến độ về Sales Order

Không chịu trách nhiệm:

- Báo giá
- Bán hàng
- Kho
- Công nợ
- Dashboard
- Giao hàng / Logistics (thuộc Sales Order)

---

# Vai trò trong ERP

Production là Work Execution Layer.

Không phải Sales Layer. Không phải Logistics Layer.

Production không quan tâm:

- khách hàng
- giá bán
- doanh thu
- lợi nhuận
- xe đã gửi hay chưa

Production chỉ quan tâm:

- làm gì
- làm ở đâu
- làm xong chưa

Nhiệm vụ của Production dừng lại ở `PRODUCTION_COMPLETED`. Từ đó trở đi (Ship, Deliver) là nghiệp vụ của Sales Order, Production không tham gia và không có trạng thái riêng cho việc này.

---

# Business Flow

```text
Quotation Approved
        │
        ▼
ERP sinh Sales Order
        │
        ▼
ERP sinh Production Orders
        │
        ▼
Các xưởng thực hiện
        │
        ▼
Production Order Completed
        │
        ▼
ERP cập nhật:

completedProductionOrders

        │
        ▼
Nếu tất cả Production Orders hoàn thành

↓

Sales Order

PRODUCTION_COMPLETED
```

---

# Triết lý thiết kế

Production Order là một Work Order.

Không phải chứng từ bán hàng.

Mỗi Production Order chỉ thuộc đúng một Production Center.

Ví dụ:

```text
SO000001

↓

PO001

↓

Xưởng cửa lưới
```

Không tồn tại Production Order phục vụ nhiều xưởng.

---

# Production Center

V1 quản lý đơn giản.

```text
ProductionCenter

id

code

name

isActive
```

Ví dụ

```text
XL01

Xưởng cửa lưới

----------------

XL02

Xưởng bạt

----------------

XL03

Xưởng cầu vồng
```

Một Product chỉ thuộc đúng một Production Center.

---

# Trạng thái Phiếu sản xuất

```text
PENDING
    ↓
IN_PRODUCTION
    ↓
PRODUCTION_COMPLETED
```

`CANCELLED` là trạng thái riêng, không nằm trong luồng chính — chỉ xảy ra khi Sales Order huỷ (xem mục "Huỷ Production Order").

**Không có trạng thái `SHIPPED` ở Production Order.** Việc gửi xe là nghiệp vụ của Sales Order (`SalesOrder.status = SHIPPED`) — Production không biết và không cần biết đơn đã gửi xe hay chưa.

---

## PENDING

ERP vừa sinh.

Xưởng chưa bắt đầu.

---

## IN_PRODUCTION

Xưởng bắt đầu làm.

Người dùng bấm:

"Bắt đầu sản xuất"

---

## PRODUCTION_COMPLETED

Xưởng hoàn thành.

Người dùng bấm:

"Hoàn thành"

ERP tự động gọi sang Sales Order để cập nhật:

`SalesOrder.completedProductionOrders`

(xem mục "ERP tự động" bên dưới)

---

## CANCELLED

Không phải Action người dùng bấm trực tiếp trên Production Order.

Chỉ xảy ra khi Sales Order thực hiện Action "Huỷ" (`cancel`) và **toàn bộ** Production Order liên quan vẫn đang `PENDING`. ERP sẽ tự cascade toàn bộ các Production Order đó sang `CANCELLED`.

Nếu đã có bất kỳ Production Order nào `IN_PRODUCTION` hoặc `PRODUCTION_COMPLETED`, Sales Order **không được phép huỷ** — do đó không có Production Order nào bị Cancel trong trường hợp đó.

---

# Dữ liệu quản lý

## ProductionOrder

```text
code
salesOrderId
productionCenterId
productionCenterName
status
startedAt              // thời điểm bấm "Bắt đầu sản xuất"
completedAt             // thời điểm bấm "Hoàn thành"
createdAt
updatedAt
```

**Về `startedAt`/`completedAt`:** đây là Derived Data (có thể suy ra từ thời điểm ghi `ProductionOrderTimeline`), nhưng vẫn lưu riêng vì lý do hiệu năng đọc — phục vụ báo cáo kiểu "thời gian sản xuất trung bình mỗi xưởng" mà không phải join + filter Timeline theo action mỗi lần. Nguồn cập nhật: do `ProductionService.start()`/`complete()` set trực tiếp khi Action xảy ra.

Không có `assignedAt` — V1 chưa có khái niệm giao việc (assign).

Không có `totalItems` — số lượng dòng sản phẩm tính trực tiếp từ `items.length` khi cần, không lưu riêng (chi phí tính rất thấp, không có lý do lưu Derived Data).

---

## ProductionOrderItem

Snapshot từ SalesOrderItem.

```text
productionOrderId
salesOrderItemId
productCode
productName
quantity
```

Không đọc lại Product.

Không đọc lại SalesOrderItem để lấy lại giá trị.

**`salesOrderItemId` chỉ dùng để điều hướng dữ liệu (navigation), không được dùng để đọc lại giá trị nghiệp vụ.** `SalesOrderItem` hay `Product` có thay đổi (về lý thuyết là không thể vì đều là Immutable Document/Master Data đang sống) thì cũng không được làm thay đổi `ProductionOrderItem` đã tạo — `productCode`/`productName`/`quantity` đã copy sẵn là giá trị cuối cùng, không tính lại.

**Chi tiết vật tư (BOM) không snapshot lại ở đây.** `OrderBOM`/`OrderBOMItem` (thuộc Sales Order module) đã là snapshot bất biến — mỗi `SalesOrderItem` có đúng một `OrderBOM` (`OrderBOM.salesOrderItemId` là unique). Khi cần xem vật tư của một `ProductionOrderItem`, join qua `salesOrderItemId → OrderBOM → OrderBOMItem` là đủ, không cần bảng snapshot thứ hai.

**Không tạo `ProductionOrderMaterial`.** Bảng này từng được đề xuất nhưng bị bỏ vì tạo dữ liệu trùng lặp không cần thiết — `OrderBOM` đã đóng vai trò snapshot kế hoạch vật tư rồi.

Nếu V2 cần theo dõi **tiêu hao thực tế** (khác với kế hoạch trong BOM — ví dụ hao hụt, phế phẩm), sẽ tạo bảng mới `ProductionMaterialUsage` ghi số liệu thực tế phát sinh trong lúc sản xuất. Đây là *Source Data mới*, không phải snapshot lại BOM.

---

# Snapshot Rule

`ProductionOrderItem` được sinh từ `SalesOrderItem` (không phải từ `Product` trực tiếp).

Ngay khi ERP sinh Production Order, snapshot bao gồm:

- `productCode`
- `productName`
- `quantity`

Các giá trị trên được copy từ `SalesOrderItem` (bản thân nó đã là Snapshot).

Sau đó không đọc lại `Product` hay `SalesOrderItem` để tính toán lại giá trị.

Chi tiết vật tư (BOM) không copy — đọc qua reference `salesOrderItemId → OrderBOM` (xem mục "ProductionOrderItem" ở trên).

---

# Workflow Engine

Người dùng thao tác bằng Action.

Không sửa Status trực tiếp.

## Action API

```http
POST /production-orders/:id/start

POST /production-orders/:id/complete
```

Không dùng

```http
PATCH

{
    "status":"COMPLETED"
}
```

---

# ERP tự động

## Khi Complete

ERP thực hiện, trong cùng một transaction:

```text
ProductionOrder.status = PRODUCTION_COMPLETED
completedAt = now()
    ↓
Ghi ProductionOrderTimeline (COMPLETED, actorType USER)
    ↓
Gọi SalesOrderService.syncProductionProgress(salesOrderId)
```

**Đây là dependency chính thức, không phải ngầm hiểu.** `syncProductionProgress()` đã được xây dựng và test ở Sales Order module (Task 04/07) — tính lại `completedProductionOrders`, và nếu đủ điều kiện (`completed == total`), tự chuyển `SalesOrder.status = PRODUCTION_COMPLETED` + ghi `SalesOrderTimeline` (`PRODUCTION_COMPLETED`, actorType `SYSTEM`).

Không cần người dùng thao tác thêm ở Sales Order.

---

# Huỷ Production Order

Không có Action huỷ trực tiếp trên Production Order.

Chỉ xảy ra khi Sales Order gọi `cancel()`:

```text
SalesOrder.cancel()
    ↓
Kiểm tra: tất cả Production Order liên quan đang PENDING?
    ↓ YES                              ↓ NO
SalesOrder → CANCELLED           Chặn — không cho huỷ
    ↓
Cascade: toàn bộ Production Order → CANCELLED
    ↓
Ghi ProductionOrderTimeline (CANCELLED, actorType SYSTEM) cho từng PO
```

Không xử lý rollback vật tư/kế hoạch trong V1.

---

# Timeline

Append-only, theo đúng pattern đã dùng ở `SalesOrderTimeline` (Task 01/05).

## ProductionOrderTimelineAction

```text
PRODUCTION_ORDER_CREATED    // SYSTEM — khi ERP sinh PO (đồng thời với Sales Order)
STARTED                     // USER   — "Bắt đầu sản xuất"
COMPLETED                   // USER   — "Hoàn thành"
CANCELLED                   // SYSTEM — cascade từ Sales Order huỷ
```

## ActorType

Mỗi entry lưu `actorType`: `SYSTEM` hoặc `USER`.

**Dùng enum Prisma riêng `ProductionOrderTimelineActorType`, không tái sử dụng `SalesOrderTimelineActorType`.** Dù giá trị hiện tại giống hệt nhau, hai module cần độc lập: nếu dùng chung 1 enum, sau này Production muốn thêm giá trị (ví dụ `MACHINE` cho tín hiệu tự động từ máy) thì giá trị đó cũng sẽ hợp lệ được ở `SalesOrderTimeline.actorType` dù vô nghĩa ở đó — Prisma không giới hạn được theo từng model dùng chung 1 enum. Chấp nhận trùng lặp định nghĩa để giữ 2 module tách biệt thật sự.

## Payload theo từng Action

Giống pattern đã áp dụng cho `SalesOrderTimeline` — `payload Json?` không được Postgres enforce schema, nên quy ước cấu trúc rõ ràng ở đây:

| Action | Payload gợi ý |
| --- | --- |
| `PRODUCTION_ORDER_CREATED` | `{ salesOrderCode }` |
| `STARTED` | `{}` |
| `COMPLETED` | `{ startedAt, completedAt }` |
| `CANCELLED` | `{ reason }` (kế thừa `reason` từ `SalesOrder.cancel()`) |

Ví dụ:

```text
08:00  SYSTEM  PRODUCTION_ORDER_CREATED
08:30  USER    STARTED
15:20  USER    COMPLETED
```

---

# Validation

## Start

Chỉ được Start khi

Status = PENDING

---

## Complete

Chỉ được Complete khi

Status = IN_PRODUCTION

Một Production Order chỉ được Complete **một lần**. Sau khi đã `PRODUCTION_COMPLETED`, không có Action nào đưa trạng thái quay lại `IN_PRODUCTION` hoặc `PENDING` — workflow chỉ đi một chiều (immutable).

**V1 không có Manual Override cho Production Order** (khác với Sales Order/Quotation). Lý do: Complete có "Undo" sẽ kéo theo phải rollback `SalesOrder.completedProductionOrders`, Dashboard, và sau này cả Warehouse — quá phức tạp cho V1. Nếu bấm nhầm, Admin xử lý trực tiếp qua DB/script, không qua API. Đây là quyết định có chủ đích, nhất quán với "Không xử lý rollback vật tư/kế hoạch trong V1" ở mục Huỷ Production Order. Sẽ xem xét lại ở V2 nếu cần.

---

# Running Number

```text
PRODUCTION_ORDER → prefix "PO" → PO000001
```

Thống nhất với quy ước toàn ERP (`SO`, `BG`, `PO` — không dùng viết tắt tiếng Việt như `SX` nữa).

**Lưu ý triển khai:** seed hiện tại đang dùng prefix `SX`. Khi code Production module sẽ đổi `RunningNumber.prefix` (`SX → PO`) và cập nhật code của Production Order test data hiện có (`SX000001 → PO000001`) cho nhất quán — giống cách đã xử lý `DH → SO` ở Sales Order Task 01.

---

# Business Rule

- Production Order chỉ được sinh từ Sales Order.
- Không tạo Production Order thủ công.
- Một Production Order thuộc đúng một Production Center.
- Một Product chỉ thuộc đúng một Production Center.
- Production Order là Snapshot (product code/name/quantity) — vật tư đọc qua reference `salesOrderItemId → OrderBOM`, không snapshot lại.
- Không đọc lại Product.
- Không đọc lại SalesOrderItem để tính toán lại giá trị. `salesOrderItemId` chỉ dùng để điều hướng (navigation), không dùng để đọc lại giá trị nghiệp vụ.
- Một Production Order chỉ Complete một lần — không có chiều ngược `PRODUCTION_COMPLETED → IN_PRODUCTION`.
- Người dùng thao tác bằng Action (`start`, `complete`).
- ERP tự cập nhật Sales Order qua `syncProductionProgress()`.
- ERP tự cascade Cancel xuống Production Order khi Sales Order huỷ (chỉ khi tất cả đang PENDING).
- Không có trạng thái `SHIPPED` ở Production Order — Ship là nghiệp vụ của Sales Order.

---

# Quan hệ dữ liệu

```text
SalesOrder
      │
      ▼
ProductionOrder ────────► ProductionOrderTimeline
      │
      ▼
ProductionOrderItem
      │
      │ (reference, không snapshot lại)
      ▼
OrderBOM / OrderBOMItem  (thuộc Sales Order module)
```

---

# Ghi chú

Production Module chỉ quản lý công việc của xưởng.

Không quản lý:

- Giá bán
- Chiết khấu
- Công nợ
- Kho
- Giao hàng (Ship/Deliver)

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
