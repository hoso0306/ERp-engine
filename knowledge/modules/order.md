# Module Đơn hàng (Sales Order)

> **Tên file:** `knowledge/modules/order.md`

---

# Mục đích

Quản lý toàn bộ quá trình thực hiện đơn hàng sau khi khách hàng đã xác nhận báo giá.

Sales Order được sinh tự động từ Module Báo giá.

Module này là trung tâm điều phối toàn bộ quy trình:

- Sản xuất
- Giao hàng
- Thanh toán
- Dashboard

Không chịu trách nhiệm tính giá hay thương lượng với khách hàng.

---

# Vai trò trong ERP

Sales Order là trung tâm điều phối (Fulfillment).

Module này chịu trách nhiệm:

- Theo dõi tiến độ đơn hàng
- Quản lý các Phiếu sản xuất
- Quản lý trạng thái giao hàng
- Quản lý trạng thái thanh toán
- Cập nhật Dashboard

Không chịu trách nhiệm:

- Báo giá
- Tính giá bán
- Tính giá vốn
- Quản lý sản xuất nội bộ
- Quản lý kho

Các nghiệp vụ trên được xử lý tại Module tương ứng.

---

# Business Flow

```text
Quotation (APPROVED)
    ↓
ERP Snapshot
    ↓
Sinh Sales Order (IN_PRODUCTION)
    ↓
Sinh SalesOrderItems (Snapshot)
    ↓
Sinh Production Orders
    ↓
Các xưởng sản xuất
    ↓
All POs Completed → ERP tự chuyển → PRODUCTION_COMPLETED
    ↓
Gửi xe → SHIPPED
    ↓
Khách nhận → DELIVERED
```

---

# Triết lý thiết kế

Sales Order là một Snapshot độc lập.

Sau khi được sinh ra, không đọc lại dữ liệu từ:

- Product
- Pricing Rule
- Material Requirement
- Quotation

Mọi dữ liệu đều được copy sang Sales Order tại thời điểm tạo.

Điều này đảm bảo:

- Chứng từ không thay đổi theo thời gian.
- Báo cáo luôn chính xác.
- Có thể lưu trữ lâu dài.

---

# Trạng thái Đơn hàng

Sales Order không có Draft.

Ngay khi được sinh từ Báo giá, trạng thái bắt đầu là `IN_PRODUCTION`.

```text
IN_PRODUCTION → PRODUCTION_COMPLETED → SHIPPED → DELIVERED
```

## Giải thích

### IN_PRODUCTION

ERP đã sinh các Phiếu sản xuất. Các xưởng đang thực hiện.

### PRODUCTION_COMPLETED

**ERP tự động chuyển** khi toàn bộ Production Order liên quan đã hoàn thành.

Không cần người dùng bấm nút.

```text
PO1 Completed + PO2 Completed + PO3 Completed
    ↓
ERP kiểm tra: All POs completed?
    ↓ YES
SalesOrder → PRODUCTION_COMPLETED
```

### SHIPPED

Hàng đã xuất kho. Đã gửi xe.

Người dùng thực hiện Action "Gửi xe".

### DELIVERED

Khách đã nhận hàng.

Người dùng thực hiện Action "Khách đã nhận".

---

# Trạng thái Thanh toán

Quản lý độc lập với trạng thái đơn hàng.

```text
UNPAID → PARTIALLY_PAID → PAID
```

Ví dụ: Đơn hàng đã giao nhưng khách chưa thanh toán — hoàn toàn hợp lệ.

---

# Dữ liệu quản lý

## Thông tin chung

```text
SalesOrder
  code                        // mã đơn hàng
  quotationCode               // mã báo giá nguồn (snapshot)
  customerId
  customerName                // snapshot
  customerPhone               // snapshot
  ownerName                   // String? — người phụ trách (V1: string, V2: FK User)
  deliveryName                // snapshot từ Customer.name tại Approve — có thể sửa sau (xem "Địa chỉ giao hàng")
  deliveryPhone               // snapshot từ Customer.phone tại Approve — có thể sửa sau
  deliveryAddress             // String? — snapshot từ Customer.address tại Approve — có thể sửa sau
  deliveryProvince            // String? — snapshot từ Customer.province tại Approve — có thể sửa sau
  deliveryDistrict            // String? — snapshot từ Customer.district tại Approve — có thể sửa sau
  deliveryWard                // String? — snapshot từ Customer.ward tại Approve — có thể sửa sau
  carrierName                 // String? — snapshot từ Customer.defaultCarrierName tại Approve (fix 24/07/2026) — có thể sửa sau qua CarrierInfoDialog
  carrierPhone                // String? — snapshot từ Customer.defaultCarrierPhone tại Approve — có thể sửa sau
  carrierNote                 // String? — snapshot từ Customer.defaultCarrierNote tại Approve — có thể sửa sau
  status                      // SalesOrderStatus
  paymentStatus               // PaymentStatus
  totalAmount                 // doanh thu kế hoạch
  plannedCost                 // giá vốn kế hoạch
  plannedProfit               // = totalAmount - plannedCost (tính khi tạo, lưu lại)
  totalProductionOrders       // Int, >= 1
  completedProductionOrders   // Int, default 0, <= totalProductionOrders
  expectedDeliveryDate        // DateTime?
  actualDeliveryDate          // DateTime?
  note
  createdAt
  updatedAt
```

## SalesOrderItem (Snapshot)

Mỗi dòng sản phẩm lưu độc lập. Không FK về QuotationItem. Không đọc lại Product.

```text
SalesOrderItem
  salesOrderId
  productCode               // snapshot
  productName               // snapshot
  pricingRuleVersionId      // snapshot reference
  materialRequirementVersionId  // snapshot reference
  quantity
  systemPrice
  groupDiscount
  additionalDiscountPercent
  additionalDiscountAmount
  finalPrice
  plannedCost
  subtotal
```

## SalesOrderItemParameter (Snapshot)

Snapshot toàn bộ Product Parameters tại thời điểm tạo. Không FK. Không thay đổi theo Product.

```text
SalesOrderItemParameter
  salesOrderItemId
  name      // ví dụ: "chieucao"
  value     // ví dụ: "2100"
  unit      // ví dụ: "mm"
```

---

# Planned Financials

Tính và lưu ngay khi Sales Order được tạo từ Approve.

```text
totalAmount   = tổng subtotal của tất cả SalesOrderItem (đã gồm quantity)
plannedCost   = tổng plannedCost của tất cả SalesOrderItem (đã gồm quantity)
plannedProfit = totalAmount - plannedCost - discountAmount
```

**`plannedProfit` phải trừ `discountAmount`** (Giảm thêm cấp toàn báo giá, snapshot từ `Quotation.discountAmount` tại Approve — Review Nghiệp vụ Tài chính, chốt 18/07/2026). `grandTotal` (dùng cho Receivable) đã trừ `discountAmount` từ Sprint 04; `plannedProfit` bị bỏ sót ở lần đó vì thuộc một dòng code khác trong cùng hàm `approve()` — sửa lại cho nhất quán: tiền đã giảm cho khách không thể vẫn tính là lợi nhuận công ty giữ được.

Dashboard đọc trực tiếp 3 field này — không SUM lại từ items.

Nếu V2 cần theo dõi thực tế thì thêm: `actualRevenue`, `actualCost`, `actualProfit`.

---

# Production Progress

```text
SalesOrder
  totalProductionOrders       Int   // số Phiếu sản xuất đã sinh, luôn >= 1
  completedProductionOrders   Int   // số Phiếu đã hoàn thành, luôn <= totalProductionOrders
```

ERP tự cập nhật `completedProductionOrders` mỗi khi một Production Order hoàn thành.

Người dùng không chỉnh sửa hai field này.

UI tự tính và hiển thị: `2/3 (67%)`.

**Nguyên tắc:** Lưu Source Data, hiển thị Derived Data.

---

# Delivery Dates

```text
SalesOrder
  expectedDeliveryDate   DateTime?   // ngày giao hàng dự kiến
  actualDeliveryDate     DateTime?   // ngày giao hàng thực tế
```

V1 chỉ lưu field. Chưa có logic kiểm tra trễ hạn.

Dashboard V2 dùng để hiển thị đơn trễ / đơn đúng hạn.

---

# Địa chỉ giao hàng

Sprint 04 (`009-in-phieu-san-xuat.md`) — bổ sung sau khi phát hiện `Customer.address` không đủ biểu diễn thực tế: một Customer (đặc biệt khách doanh nghiệp) có thể yêu cầu giao hàng ở nhiều địa điểm khác nhau cho từng đơn (ví dụ mỗi đơn giao một công trình).

```text
SalesOrder
  deliveryName
  deliveryPhone
  deliveryAddress       // String?
  deliveryProvince      // String?
  deliveryDistrict      // String?
  deliveryWard           // String?
```

**Tạo:** auto-copy từ `Customer` (`name`, `phone`, `address`, `province`, `district`, `ward`) tại thời điểm Approve — cùng lúc snapshot `customerName`/`customerPhone`. Sau đó **không đọc lại `Customer`**.

**Sửa:** Action riêng `updateDeliveryAddress()` (`POST /sales-orders/:id/update-delivery-address`), permission `sales-order.view` (không cần permission riêng). Khác Manual Override:

- Không bắt buộc lý do.
- Không giới hạn theo `Status` — sửa được ở mọi trạng thái, kể cả sau `SHIPPED`/`DELIVERED` (còn sửa lại hồ sơ nếu cần).
- Không đổi `Status`.

Mọi lần sửa vẫn ghi `SalesOrderTimeline` (`DELIVERY_ADDRESS_UPDATED`, actorType `USER`, payload `{ old, new }`) — không sửa dữ liệu âm thầm, chỉ là không cần giải trình như Override.

`Customer.address` không bao giờ bị đổi bởi action này — đây chỉ là địa chỉ mặc định cho các đơn *sau này*, tách biệt hoàn toàn khỏi địa chỉ giao của từng đơn đã tạo.

Xem thêm ghi chú ngoại lệ ở mục "Immutable Document" bên dưới.

---

# Snapshot Rule

Ngay khi tạo Sales Order, ERP copy toàn bộ:

- Thông tin khách hàng
- Product code, name
- Pricing Rule Version
- Material Requirement Version
- Order BOM (từng dòng nguyên vật liệu + giá tại thời điểm tạo)
- Giá bán, giá vốn, chiết khấu
- Product Parameters
- Planned Revenue (totalAmount), Planned Cost, Planned Profit

Sau đó không đọc lại dữ liệu gốc.

---

# Production Rule

Một Sales Order có thể sinh nhiều Production Order. ERP tự nhóm theo Production Center.

```text
SO000001
  ├── PO000001 → Xưởng cửa lưới
  └── PO000002 → Xưởng bạt
```

Người dùng không tạo Production Order thủ công.

Chi tiết trạng thái và quy trình nội bộ của Production Order thuộc `production.md`.

---

# Shipping Rule

Người dùng thực hiện Action "Gửi xe":

- Sales Order → `SHIPPED`
- Toàn bộ Production Order liên quan → cập nhật trạng thái phù hợp (chi tiết xem `production.md`)

Không cần cập nhật từng Phiếu sản xuất thủ công.

---

# Payment Rule

Cho phép thanh toán nhiều lần.

```text
Lần 1: 5.000.000 → PARTIALLY_PAID
Lần 2: 15.000.000 → PAID
```

Chi tiết các lần thu tiền do Module Công nợ quản lý. Sales Order chỉ lưu `paymentStatus`.

---

# Huỷ đơn hàng

V1: Nếu đã có Production Order bắt đầu sản xuất (`IN_PRODUCTION` hoặc `PRODUCTION_COMPLETED`) → **không cho phép huỷ**.

Không cho phép huỷ đơn đã ở trạng thái `CANCELLED` hoặc `DELIVERED`.

Chỉ Admin được dùng Manual Override kèm lý do bắt buộc.

Không xử lý rollback Production trong V1.

## Huỷ đơn đã thu cọc

**Được phép huỷ** (quyết định đã chốt 05/07/2026 — thay thế rule cũ chặn Cancel khi `Receivable.paidAmount > 0`, vốn tạo deadlock vì V1 không có Refund).

Điều kiện huỷ không đổi: mọi Production Order còn `PENDING`. Khi đơn đã có tiền cọc:

- UI hiển thị cảnh báo bắt buộc xác nhận: *"Đơn hàng đã thu cọc. ERP sẽ đóng công nợ. Việc hoàn tiền thực hiện ngoài hệ thống."*
- Receivable giữ nguyên bản ghi, tự ra khỏi công nợ mở (rule lọc `SalesOrder.status != CANCELLED` sẵn có).
- Payment giữ nguyên (append-only).
- Timeline (`CANCELLED`) payload: `{ reason, paidAmount, refundNote: "Refund handled outside ERP" }`.

Chi tiết phía công nợ xem `debt.md` mục "Receivable không tự quyết định hiệu lực công nợ".

---

# Immutable Document

Sales Order là chứng từ bất biến (Immutable Document).

Sau khi được sinh, không được:

- Sửa dữ liệu nghiệp vụ
- Thay đổi Snapshot (giá, BOM, thông số)
- Tính lại giá
- Sinh lại BOM

Nếu cần thay đổi, phải thực hiện thông qua Workflow hoặc Manual Override theo đúng Business Rule.

Nguyên tắc này nhất quán với CLAUDE.md Section 7 (Snapshot & Document Design) và Section 8 (Versioning).

**Ngoại lệ có chủ đích: `delivery*` (địa chỉ giao hàng).** Nhóm field này là dữ liệu vận hành/logistics, không phải dữ liệu tài chính/BOM/thông số đã tính toán — bản chất khác nhóm bị khoá ở trên nên không phá nguyên tắc Immutable Document. Sửa qua Action riêng `updateDeliveryAddress()` (xem mục "Địa chỉ giao hàng"), luôn ghi Timeline. Đây là ngoại lệ duy nhất được phép sửa sau khi Sales Order đã tạo.

---

# Workflow Engine

Người dùng chỉ thực hiện Action. Không sửa Status trực tiếp.

```text
Action: "Gửi xe"                    → SalesOrder: SHIPPED
Action: "Khách đã nhận"             → SalesOrder: DELIVERED
Action: "Cập nhật địa chỉ giao hàng" → SalesOrder: delivery* (không đổi Status)
```

ERP tự động:

```text
All POs Completed → SalesOrder: PRODUCTION_COMPLETED
```

---

# Manual Override

Cho phép trong trường hợp đặc biệt.

Bắt buộc:

- Chọn trạng thái mới
- Nhập lý do
- Lưu người thực hiện
- Lưu thời gian
- Lưu trạng thái cũ → mới

Toàn bộ ghi vào Timeline.

---

# Timeline

```text
09:00  ERP sinh Sales Order
09:01  ERP sinh 2 Production Orders
15:30  All POs Completed → PRODUCTION_COMPLETED (tự động)
16:00  Gửi xe → SHIPPED
18:30  Khách nhận → DELIVERED
20:00  Thu tiền 5.000.000 → PARTIALLY_PAID
D+1    Thu nốt → PAID
```

Timeline là lịch sử đầy đủ. Status chỉ là trạng thái hiện tại.

---

# Dashboard Rule

Dashboard đọc trực tiếp từ SalesOrder:

- `totalAmount` — doanh thu kế hoạch
- `plannedCost` — giá vốn kế hoạch
- `plannedProfit` — lợi nhuận kế hoạch
- `status` — trạng thái đơn hàng
- `paymentStatus` — trạng thái thanh toán
- `completedProductionOrders` / `totalProductionOrders` — tiến độ sản xuất
- `expectedDeliveryDate` / `actualDeliveryDate` — tiến độ giao hàng

Dashboard không tự tính toán.

---

# Validation

## Khi tạo

- Chỉ được sinh từ Quotation `APPROVED`.
- Không tạo thủ công.
- `totalProductionOrders >= 1`.

## Khi cập nhật

Không cho phép:

- Thêm / xoá sản phẩm
- Đổi Product, Parameters, giá bán, giá vốn
- Thay đổi Pricing Rule Version
- Thay đổi Material Requirement Version

## Khi giao hàng

Chỉ được thực hiện Action "Gửi xe" khi tất cả Production Order đã hoàn thành.

---

# Business Rule

- Một Quotation chỉ sinh đúng một Sales Order.
- Sales Order chỉ được sinh từ Quotation, không tạo thủ công.
- Sales Order là Snapshot độc lập — không đọc lại Product hoặc Quotation sau khi tạo.
- `plannedProfit = totalAmount - plannedCost` — tính khi tạo, lưu lại, không tính lại.
- `completedProductionOrders <= totalProductionOrders`, `totalProductionOrders >= 1`.
- ERP tự chuyển sang `PRODUCTION_COMPLETED` khi tất cả PO hoàn thành.
- Trạng thái thanh toán độc lập với trạng thái giao hàng.
- Người dùng thao tác bằng Action, không sửa Status trực tiếp.
- `delivery*` (địa chỉ giao hàng) là ngoại lệ duy nhất được sửa sau khi tạo — auto-copy từ Customer tại Approve, sửa qua `updateDeliveryAddress()` không giới hạn Status, không bắt buộc lý do, luôn ghi Timeline. Không đọc lại Customer sau khi tạo.

---

# Quan hệ dữ liệu

```text
Quotation
    │
    ▼
SalesOrder
    │
    ├── SalesOrderItem (Snapshot)
    │        │
    │        ├── SalesOrderItemParameter (Snapshot)
    │        │
    │        └── OrderBOM (Snapshot)
    │                │
    │                └── OrderBOMItem (Snapshot)
    │
    ├── ProductionOrder (nhiều)
    │
    ├── Timeline
    │
    └── PaymentStatus
```

---

# Ghi chú

Sales Order là trung tâm điều phối của toàn bộ quy trình thực hiện đơn hàng.

Module này không tính lại giá, không đọc lại dữ liệu từ Product hoặc Quotation.

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
