# ERD — ERP Engine

> **Cập nhật:** 2026-07-04 (đã đồng bộ sau khi hoàn thành Module Sales Order — Task 00-09, sprint-01/005-don-hang.md)
> **Trạng thái:** Dựa trên schema thực tế + order.md đã thiết kế
> **Lưu ý:** ERD là simplified view — chỉ hiển thị các fields quan trọng. Xem schema.prisma để biết toàn bộ fields.

---

## Sơ đồ quan hệ

```mermaid
erDiagram

    %% ─────────────────────────────────────
    %% MASTER DATA
    %% ─────────────────────────────────────

    CustomerGroup {
        string id PK
        string name UK
        decimal discountPercent
    }

    DeliveryRoute {
        string id PK
        string name UK
    }

    Unit {
        string id PK
        string name UK
    }

    ProductType {
        string id PK
        string name UK
        boolean isActive
    }

    ProductionCenter {
        string id PK
        string code UK
        string name
        boolean isActive
    }

    %% ─────────────────────────────────────
    %% MATERIAL
    %% ─────────────────────────────────────

    Material {
        string id PK
        string code UK
        string name
        string unitId FK
        boolean isActive
    }

    MaterialPrice {
        string id PK
        string materialId FK
        string supplierId
        string supplierName
        decimal price
        datetime effectiveFrom
        datetime effectiveTo
        boolean isDefault
    }

    %% ─────────────────────────────────────
    %% PRODUCT
    %% ─────────────────────────────────────

    Product {
        string id PK
        string code UK
        string name
        string productTypeId FK
        string unitId FK
        string productionCenterId FK
        enum status
    }

    ProductParameter {
        string id PK
        string productId FK
        string name
        string label
        enum type
        boolean isRequired
    }

    ProductParameterOption {
        string id PK
        string parameterId FK
        string value
        string label
    }

    PricingRule {
        string id PK
        string productId FK_UK
    }

    PricingRuleVersion {
        string id PK
        string pricingRuleId FK
        int versionNumber
        string expression
        enum status
    }

    PricingRuleItem {
        string id PK
        string pricingRuleVersionId FK
        enum ruleType
        decimal value
    }

    MaterialRequirement {
        string id PK
        string productId FK_UK
    }

    MaterialRequirementVersion {
        string id PK
        string materialRequirementId FK
        int versionNumber
        enum status
    }

    MaterialRequirementItem {
        string id PK
        string materialRequirementVersionId FK
        string materialId FK
        string expression
        decimal wastePercent
    }

    %% ─────────────────────────────────────
    %% CUSTOMER
    %% ─────────────────────────────────────

    Customer {
        string id PK
        string code UK
        string name
        string phone UK
        string customerGroupId FK
        string deliveryRouteId FK
        enum status
        decimal debtLimit
        int debtTermDays
    }

    %% ─────────────────────────────────────
    %% QUOTATION
    %% ─────────────────────────────────────

    Quotation {
        string id PK
        string code UK
        string customerId FK
        string salesOrderId FK_UK
        enum status
        datetime expiryDate
    }

    QuotationItem {
        string id PK
        string quotationId FK
        string productId FK
        decimal quantity
        decimal systemPrice
        decimal groupDiscount
        decimal additionalDiscountPercent
        decimal additionalDiscountAmount
        decimal finalPrice
        decimal subtotal
    }

    QuotationItemParameter {
        string id PK
        string quotationItemId FK
        string name
        string value
        string unit
    }

    QuotationTimeline {
        string id PK
        string quotationId FK
        enum action
        json payload
        datetime createdAt
    }

    %% ─────────────────────────────────────
    %% SALES ORDER
    %% ─────────────────────────────────────

    SalesOrder {
        string id PK
        string code UK
        string quotationCode
        string customerId
        string customerName
        string customerPhone
        enum status
        enum paymentStatus
        decimal totalAmount
        decimal plannedCost
        decimal plannedProfit
        string ownerName
        int totalProductionOrders
        int completedProductionOrders
        datetime expectedDeliveryDate
        datetime actualDeliveryDate
    }

    SalesOrderItem {
        string id PK
        string salesOrderId FK
        string productCode
        string productName
        string productionCenterId
        string productionCenterName
        decimal systemPrice
        decimal groupDiscount
        decimal finalPrice
        decimal quantity
        decimal subtotal
        decimal plannedCost
    }

    SalesOrderItemParameter {
        string id PK
        string salesOrderItemId FK
        string name
        string value
        string unit
    }

    OrderBOM {
        string id PK
        string salesOrderItemId FK_UK
        string materialRequirementVersionId
        decimal plannedCost
    }

    OrderBOMItem {
        string id PK
        string orderBOMId FK
        string materialCode
        string materialName
        string expression
        decimal wastePercent
        enum roundType
        decimal roundValue
        decimal quantity
        decimal unitPrice
        decimal lineTotal
    }

    SalesOrderTimeline {
        string id PK
        string salesOrderId FK
        enum action
        enum actorType
        json payload
        string createdBy
        datetime createdAt
    }

    %% ─────────────────────────────────────
    %% PRODUCTION ORDER
    %% ─────────────────────────────────────

    ProductionOrder {
        string id PK
        string code UK
        string salesOrderId FK
        string productionCenterId
        string productionCenterName
        enum status
        datetime startedAt
        datetime completedAt
    }

    ProductionOrderItem {
        string id PK
        string productionOrderId FK
        string salesOrderItemId
        string productCode
        string productName
        decimal quantity
    }

    ProductionOrderTimeline {
        string id PK
        string productionOrderId FK
        enum action
        enum actorType
        json payload
        string createdBy
        datetime createdAt
    }

    %% ─────────────────────────────────────
    %% WAREHOUSE (TBD - chưa thiết kế)
    %% ─────────────────────────────────────

    Warehouse_TBD {
        string id PK
        string note "Chưa thiết kế"
    }

    %% ─────────────────────────────────────
    %% RELATIONSHIPS
    %% ─────────────────────────────────────

    %% Master Data
    Unit                       ||--|{ Material                    : "đơn vị"
    Unit                       ||--|{ Product                     : "đơn vị"
    ProductType                ||--|{ Product                     : "loại SP"
    ProductionCenter           ||--|{ Product                     : "xưởng SX"
    CustomerGroup              ||--o{ Customer                    : "nhóm KH"
    DeliveryRoute              ||--o{ Customer                    : "tuyến"

    %% Material
    Material                   ||--|{ MaterialPrice               : "giá NVL"
    Material                   ||--o{ MaterialRequirementItem     : "dùng trong BOM"

    %% Product
    Product                    ||--|{ ProductParameter            : "thông số"
    ProductParameter           ||--o{ ProductParameterOption      : "lựa chọn"
    Product                    ||--o| PricingRule                 : "bảng giá"
    PricingRule                ||--|{ PricingRuleVersion          : "phiên bản"
    PricingRuleVersion         ||--o{ PricingRuleItem             : "quy tắc"
    Product                    ||--o| MaterialRequirement         : "NVL yêu cầu"
    MaterialRequirement        ||--|{ MaterialRequirementVersion  : "phiên bản"
    MaterialRequirementVersion ||--|{ MaterialRequirementItem     : "dòng BOM"

    %% Customer → Quotation
    Customer                   ||--o{ Quotation                   : "tạo báo giá"

    %% Quotation
    Quotation                  ||--|{ QuotationItem               : "dòng SP"
    Quotation                  ||--o{ QuotationTimeline           : "lịch sử"
    QuotationItem              ||--|{ QuotationItemParameter      : "thông số (snapshot)"
    Product                    ||--o{ QuotationItem               : "tham chiếu"

    %% Quotation → Sales Order (1-1)
    Quotation                  ||--o| SalesOrder                  : "approve → sinh"

    %% Sales Order
    SalesOrder                 ||--|{ SalesOrderItem              : "dòng SP (snapshot)"
    SalesOrderItem             ||--|{ SalesOrderItemParameter     : "thông số (snapshot)"
    SalesOrderItem             ||--o| OrderBOM                    : "BOM (snapshot)"
    OrderBOM                   ||--|{ OrderBOMItem                : "dòng NVL (snapshot)"

    %% Sales Order → Production Order
    SalesOrder                 ||--|{ ProductionOrder             : "phiếu SX theo xưởng"
    ProductionOrder            ||--|{ ProductionOrderItem         : "dòng SP"
    ProductionOrder            ||--o{ ProductionOrderTimeline     : "lịch sử (audit log)"

    %% Sales Order → Timeline
    SalesOrder                 ||--o{ SalesOrderTimeline          : "lịch sử (audit log)"

    %% Production Order → Warehouse (TBD)
    ProductionOrder            ||--o{ Warehouse_TBD              : "xuất kho (TBD)"
```

---

## Gap Analysis — Những điểm cần cập nhật

### 1. SalesOrder — thiếu fields theo order.md ✅ Đã xử lý (Task 00 — sprint-01)

Đã thêm đầy đủ trong migration `20260704091748_order_module_schema_prep`:

| Field | Kiểu | Ghi chú |
|---|---|---|
| `plannedCost` | `Decimal` | Giá vốn kế hoạch |
| `plannedProfit` | `Decimal` | = totalAmount - plannedCost |
| `ownerName` | `String?` | Người phụ trách |
| `totalProductionOrders` | `Int` | >= 1 |
| `completedProductionOrders` | `Int` | default 0, <= total |
| `expectedDeliveryDate` | `DateTime?` | Ngày giao dự kiến |
| `actualDeliveryDate` | `DateTime?` | Ngày giao thực tế |

Lưu ý: cột `plannedCost`, `plannedProfit`, `totalProductionOrders` là required (NOT NULL, không default) — sẽ được Task 02 (Snapshot Engine) tính và set khi tạo SalesOrder.

---

### 2. Enum names — cần thống nhất sang tiếng Anh ✅ Đã xử lý (Task 00 — sprint-01)

| Trước | Sau |
|---|---|
| `DANG_SAN_XUAT` | `IN_PRODUCTION` |
| `HOAN_THANH` | `PRODUCTION_COMPLETED` |
| `DA_HUY` | `CANCELLED` |
| `CHO_SAN_XUAT` | `PENDING` |

Đã rename bằng `ALTER TYPE ... RENAME VALUE` (giữ nguyên data hiện có). Đồng thời bổ sung `SHIPPED`, `DELIVERED` vào `SalesOrderStatus` để khớp luồng trạng thái đã thiết kế ở trên (`IN_PRODUCTION → PRODUCTION_COMPLETED → SHIPPED → DELIVERED`) — quyết định đã xác nhận với người dùng để tránh phải migrate thêm lần nữa ở Task 04.

Code tham chiếu enum (`quotation-workflow.service.ts`) đã cập nhật theo tên mới.

---

### 3. PaymentStatus — chưa có trong schema ✅ Đã xử lý (Task 00 — sprint-01)

Đã thêm enum `PaymentStatus` (`UNPAID → PARTIALLY_PAID → PAID`) và field `SalesOrder.paymentStatus` (`@default(UNPAID)`).

---

### 4. SalesOrder không có FK trực tiếp về Customer

`SalesOrder` lưu `customerId`, `customerName`, `customerPhone` dạng snapshot string — đúng thiết kế.

Tuy nhiên không có Prisma relation về `Customer`, nên không thể JOIN trực tiếp nếu cần.

→ Quyết định: giữ nguyên (snapshot hoàn toàn) hay thêm FK mềm?

---

### 5. MaterialPrice — supplierId orphaned, thiếu supplierName ✅ Đã xử lý (Task 00 — sprint-01)

Đã thêm `supplierName String?` (pattern giống `ownerName`). `supplierId` giữ nguyên cho tương lai khi có module Supplier + FK thật.

---

### 6. Material hiện đang nằm trong Product module

`Material` và `MaterialPrice` đang ở cùng module với `Product` trong codebase.

Về lâu dài khi có Warehouse module, `Material` sẽ là dữ liệu dùng chung.

→ Hiện tại ổn cho V1. Khi có Warehouse thì tách thành module riêng.

---

### 7. Warehouse — chưa thiết kế

Chưa có schema. Cần thiết kế riêng khi đến module đó.

Các điểm nối dự kiến:
- `ProductionOrder` → xuất kho nguyên liệu
- `SalesOrder` → xuất kho thành phẩm (giao hàng)

---

### 8. SalesOrderTimeline chưa có model ✅ Đã xử lý (Task 01 — sprint-01)

`order.md` yêu cầu Timeline là Audit Log append-only cho SalesOrder (Task 05), nhưng schema chưa có model. Đã thêm:

- `SalesOrderTimeline` (`sales_order_timelines`) — `action` (`SalesOrderTimelineAction`), `actorType` (`SYSTEM`/`USER`), `payload Json?`, `createdBy`, `createdAt`. Theo đúng pattern `QuotationTimeline` đã có, cộng thêm `actorType` theo yêu cầu Task 05.
- Quan hệ `SalesOrder ||--o{ SalesOrderTimeline`.

Việc ghi Timeline thực tế (khi nào, ai ghi) thuộc Task 02/04/05 — Task 01 chỉ định nghĩa Data Model.

---

### 9. Running Number SalesOrder — prefix sai (`DH` thay vì `SO`) ✅ Đã xử lý (Task 01 — sprint-01)

`order.md` dùng ví dụ mã đơn hàng `SO000001`, nhưng seed data (`prisma/seed.ts`) đang dùng prefix `DH`. Đã sửa `RunningNumber` cho `type: 'SALES_ORDER'` sang `prefix: 'SO'` (seed + dữ liệu dev hiện có). Không đổi `PRODUCTION_ORDER` (`SX`) vì thuộc Module Production — ngoài phạm vi Task 01.

---

### 10. Naming consistency & Round Rule snapshot ✅ Đã xử lý (Task 01 — sprint-01, review sau khi thiết kế)

Rà soát lại sau khi thiết kế xong Task 01, phát hiện và sửa:

- `SalesOrderItem.planCost` và `OrderBOM.planCost` đổi tên thành `plannedCost` — thống nhất với `SalesOrder.plannedCost`/`plannedProfit` (dùng `RENAME COLUMN`, giữ nguyên data hiện có).
- `OrderBOMItem` thiếu snapshot Round Rule dùng để tính `quantity`: đã có `expression`, `wastePercent` (input) nhưng thiếu `roundType`/`roundValue` (input còn lại). Đã bổ sung `roundType RoundType @default(NONE)`, `roundValue Decimal?` — cùng kiểu enum với `MaterialRequirementItem.roundType/roundValue` để nhất quán, không tạo field string rule-name mới. Đảm bảo nếu Round Rule của `MaterialRequirementItem` đổi sau này, `OrderBOMItem` cũ vẫn giữ đúng rule đã áp dụng tại thời điểm tạo.

**Payload `SalesOrderTimeline` — quy ước cấu trúc (áp dụng khi implement Task 05):**

Field `payload Json?` không được Postgres enforce schema, nên quy ước cấu trúc theo `action` được thống nhất ở đây để Task 05 tuân theo và frontend/báo cáo dễ xử lý:

| Action | Payload gợi ý |
| --- | --- |
| `SALES_ORDER_CREATED` | `{ quotationCode }` |
| `PRODUCTION_ORDERS_GENERATED` | `{ productionOrderCodes: string[] }` |
| `PRODUCTION_COMPLETED` | `{}` (tự động, không cần payload) |
| `SHIPPED` | `{ fromStatus, toStatus }` |
| `DELIVERED` | `{ fromStatus, toStatus }` |
| `PAYMENT_STATUS_CHANGED` | `{ fromStatus, toStatus }` |
| `MANUAL_OVERRIDE` | `{ fromStatus, toStatus, reason }` |
| `CANCELLED` | `{ reason }` |

`actorType: USER` → `createdBy` bắt buộc có giá trị (userId). `actorType: SYSTEM` → `createdBy` có thể `null`.

---

### 11. Production module — hoàn thiện nền tảng ✅ Đã xử lý (Task 00 — sprint-01, `006-san-xuat.md`)

Đã xử lý các điểm còn để ngỏ ở mục 9 (`PRODUCTION_ORDER` giữ prefix `SX`) và bổ sung phần Production còn thiếu so với `knowledge/modules/production.md`:

- `ProductionOrder` — thêm `startedAt`, `completedAt` (`DateTime?`).
- `ProductionOrderTimeline` (`production_order_timelines`) — model mới, cùng pattern `SalesOrderTimeline`: `action` (`ProductionOrderTimelineAction`: `PRODUCTION_ORDER_CREATED`/`STARTED`/`COMPLETED`/`CANCELLED`), `actorType` (**enum riêng** `ProductionOrderTimelineActorType`, không tái sử dụng `SalesOrderTimelineActorType` — xem lý do ở `production.md`), `payload Json?`, `createdBy`, `createdAt`.
- Quan hệ `ProductionOrder ||--o{ ProductionOrderTimeline`.
- `RunningNumber` cho `type: 'PRODUCTION_ORDER'` đổi `prefix: 'SX' → 'PO'` (migration + seed), nhất quán với `SO`/`BG` toàn ERP.

---

## Tóm tắt luồng dữ liệu chính

```text
CustomerGroup ──── Customer
                       │
                   Quotation ──── QuotationItem ──── QuotationItemParameter
                       │               │
                       │           Product ──── PricingRule ──── PricingRuleVersion
                       │               │
                       │           MaterialRequirement ──── MaterialRequirementVersion
                       │                                           │
                       │                                    MaterialRequirementItem ──── Material
                       │
                   SalesOrder ──── SalesOrderItem ──── SalesOrderItemParameter
                       │               │
                       │           OrderBOM ──── OrderBOMItem
                       │
                       └─── ProductionOrder ──── ProductionOrderItem
                                 │
                            ProductionCenter
```
