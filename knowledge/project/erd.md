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
        decimal currentStock
        decimal minimumStock
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
    %% WAREHOUSE
    %% ─────────────────────────────────────

    MaterialReceipt {
        string id PK
        string code UK
        string materialId FK
        string materialCode
        string materialName
        string unit
        decimal quantity
        string supplierName
        string note
        string createdBy
    }

    WarehouseTransaction {
        string id PK
        enum direction
        enum transactionType
        string materialId FK
        string materialCode
        string materialName
        string unit
        decimal quantity
        string materialReceiptId FK_UK
        string productionOrderId FK
        datetime createdAt
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
        string productCode
        string productName
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
        string ownerId FK
        string ownerName
        int totalProductionOrders
        int completedProductionOrders
        datetime expectedDeliveryDate
        datetime actualDeliveryDate
    }

    SalesOrderItem {
        string id PK
        string salesOrderId FK
        string productId
        string productCode
        string productName
        string productTypeId
        string productTypeName
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
    %% DEBT (Accounts Receivable)
    %% ─────────────────────────────────────

    Receivable {
        string id PK
        string salesOrderId FK_UK
        string customerId
        decimal totalAmount
        decimal paidAmount
        decimal remainingAmount "CHECK >= 0"
        decimal debtLimitSnapshot
        int debtTermDaysSnapshot
        datetime dueDate
    }

    Payment {
        string id PK
        string code UK
        string salesOrderId
        string receivableId FK
        datetime paymentDate
        decimal amount
        enum paymentMethod
        string referenceNumber
        string note
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
    %% SETTINGS (không có FK — module cấu hình độc lập)
    %% ─────────────────────────────────────

    Company {
        string id PK "Singleton"
        string companyName
        string logo
        string address
        string phone
        string email
        string website
        string taxCode
        string currency
        string currencySymbol
        string timezone
    }

    Setting {
        string id PK
        string module "UK (module, key)"
        string key "UK (module, key)"
        string value
        string defaultValue
        enum valueType
        string description
    }

    %% ─────────────────────────────────────
    %% RETURN (Recovery Management)
    %% ─────────────────────────────────────

    Return {
        string id PK
        string code UK
        string salesOrderId FK
        string salesOrderCode
        string customerId
        string customerName
        enum status
        string completedBy
        datetime completedAt
        datetime returnDate
        string receivedBy
        string note
    }

    ReturnItem {
        string id PK
        string returnId FK
        string salesOrderItemId
        string productCode
        string productName
        json productParameters
        decimal orderedQuantity
        decimal returnedQuantity
        decimal unitPriceSnapshot
        enum reason
        string note
    }

    RecoveryInventory {
        string id PK
        string code UK
        string returnItemId FK_UK
        string createdFromReturnCode
        string productCode
        string productName
        json productParameters
        decimal quantity
        string location
        enum status
        string imageUrl
        string usedForNote
        datetime createdAt
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
    Material                   ||--o{ MaterialReceipt              : "nhập kho"
    Material                   ||--o{ WarehouseTransaction         : "biến động kho"

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

    %% Warehouse
    MaterialReceipt            ||--o| WarehouseTransaction         : "sinh (IN)"
    ProductionOrder            ||--o{ WarehouseTransaction         : "xuất kho (OUT)"

    %% Debt (Accounts Receivable)
    SalesOrder                 ||--o| Receivable                  : "approve() → sinh đồng thời"
    Receivable                 ||--|{ Payment                     : "lịch sử thu tiền"

    %% Return (Recovery Management)
    SalesOrder                 ||--o{ Return                      : "khách trả hàng (đã DELIVERED)"
    Return                     ||--|{ ReturnItem                  : "dòng SP trả (snapshot)"
    ReturnItem                 ||--o| RecoveryInventory            : "sinh tự động"
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

### 12. Warehouse module — thiết kế xong ✅ Đã xử lý (Task 00 — sprint-01, `007-kho.md`)

Thay thế placeholder `Warehouse_TBD` (mục 7) bằng schema thật:

- `Material` — thêm `currentStock` (`Decimal`, cache tồn kho, cập nhật theo Delta — xem `warehouse.md` mục "Current Stock").
- `MaterialReceipt` (`material_receipts`) — chứng từ nhập kho, Create API duy nhất của module này. Snapshot `materialCode`/`materialName`/`unit`/`supplierName`. Running Number `MATERIAL_RECEIPT` → prefix `PN`.
- `WarehouseTransaction` (`warehouse_transactions`) — **bảng Ledger duy nhất** cho mọi biến động kho (không có `StockLedger`/`MaterialIssue` riêng). Tách `direction` (`IN`/`OUT`, cố định) và `transactionType` (`MATERIAL_RECEIPT`/`MATERIAL_ISSUE`, mở rộng được). Đúng một trong `materialReceiptId`/`productionOrderId` được set tuỳ `transactionType`.
- **Idempotency constraint:** `@@unique([productionOrderId, materialId])` trên `WarehouseTransaction` — đảm bảo một Production Order chỉ xuất kho đúng một lần cho mỗi vật tư ở tầng DB, không chỉ dựa vào validate status ở application (xem `warehouse.md` mục "Transaction Boundary").
- Quan hệ: `MaterialReceipt ||--o| WarehouseTransaction`, `ProductionOrder ||--o{ WarehouseTransaction`.
- Không có `runningBalance` trên từng dòng — tồn kho hiện tại chỉ có một nguồn duy nhất: `Material.currentStock`.

---

### 13. Debt module (Accounts Receivable) — thiết kế xong ✅ Đã xử lý (Task 00 — sprint-01, `008-cong-no.md`)

- `Receivable` (`receivables`) — 1-1 với `SalesOrder` (`salesOrderId` unique), sinh **đồng thời** với `SalesOrder` trong transaction `Quotation.approve()`, không đợi `Delivered`. Snapshot Credit Policy (`debtLimitSnapshot`/`debtTermDaysSnapshot` copy từ `Customer.debtLimit`/`debtTermDays` tại thời điểm tạo). `customerId` là **Redundant Reference** (copy ID bất biến, không `@relation` — cùng convention với `SalesOrder.customerId`), không phải Derived Data. **Không có field `status`** — `SalesOrder.status` là nguồn sự thật duy nhất quyết định hiệu lực công nợ.
- `remainingAmount` là Derived Data được phép lưu (lý do hiệu năng đọc cho Dashboard/Debt Monitoring), cập nhật atomic (`increment`/`decrement`) trong `PaymentService.create()`. **`CHECK (remaining_amount >= 0)`** khai báo tay trong migration (Prisma không model được CHECK constraint) — enforce ở DB, không chỉ validate ở application.
- `dueDate` — `NULL` lúc tạo, set khi `SalesOrder.deliver()` (`actualDeliveryDate + debtTermDaysSnapshot`, dùng snapshot chứ không đọc lại `Customer.debtTermDays`).
- `Payment` (`payments`) — lịch sử thu tiền, append-only (không Update/Delete). `salesOrderId` là Redundant Reference giữ cùng `receivableId` (tránh join, không `@relation`). Running Number `PAYMENT` → prefix `PT`.
- Enum `PaymentMethod` (`CASH`/`BANK_TRANSFER`).
- **Không có `PaymentTimeline`/`ReceivableTimeline` riêng** — tái sử dụng `SalesOrderTimeline` action `PAYMENT_STATUS_CHANGED` đã có sẵn, ghi mỗi lần tạo Payment (kể cả khi `paymentStatus` không đổi). Việc sinh `Receivable` cũng không tạo Timeline riêng — gộp vào payload có sẵn của `SALES_ORDER_CREATED` (`receivableCreated: true`).
- `daysOverdue`/`riskLevel`/`creditExceeded` — Derived, **không lưu DB**, tính runtime.
- Quan hệ: `SalesOrder ||--o| Receivable`, `Receivable ||--|{ Payment`.
- API cũ `POST /sales-orders/:id/record-payment` + `RecordPaymentDto` bị xoá hoàn toàn, thay bằng `POST /payments`.

---

### 14. Dashboard module — thiết kế xong ✅ Đã xử lý (Task 00 — sprint-01, `009-dashboard.md`)

Dashboard **không có model/bảng riêng** — chỉ tổng hợp qua Service của module sở hữu dữ liệu (`SalesOrderService`/`ProductionOrderService`/`WarehouseService`/`DebtService`), không query trực tiếp Prisma của module khác (Module Ownership).

Thay đổi Data Model duy nhất chạm vào module khác:

- `Material` — thêm `minimumStock` (`Decimal?`, ngưỡng tồn kho tối thiểu, thuộc **Product module**) — phục vụ "Sắp hết hàng"/"Hết hàng" ở Warehouse Overview. `NULL` = chưa cấu hình ngưỡng, không tính cảnh báo.
- Thêm index phục vụ các query Dashboard hay dùng (không đổi Business Rule):
  - `WarehouseTransaction @@index([transactionType, direction, createdAt])` — cho `getTopConsumedMaterials()`.
  - `Receivable @@index([dueDate])` — cho overdue/risk/upcoming-due.
  - `SalesOrder @@index([expectedDeliveryDate])` — cho `getDelayedOrders()` (Alerts).

Mỗi Service hiện có được bổ sung method đọc riêng cho Dashboard (không tạo `XxxQueryService` song song) — xem `dashboard.md` mục "Module Ownership".

---

### 15. Settings module — thiết kế xong ✅ Đã xử lý (Task 00 — sprint-01, `010-cai-dat.md`)

- `Company` (`companies`) — **model mới hoàn toàn**, Singleton (seed sẵn 1 bản ghi trong migration/seed, không có Create/Delete API). `currency`/`currencySymbol` chỉ là nhãn hiển thị, không phải công tắc đa tiền tệ.
- `Setting` (`settings`) — bảng key-value dùng chung cho Dashboard/Notification/Document/Security/Backup Settings. `@@unique([module, key])`. Không Create key mới qua API (chỉ seed), không Delete — chỉ Update giá trị.
- `RunningNumber` — thêm field `enabled` (`Boolean @default(true)`) — chỉ ẩn/hiện chứng từ khỏi menu, không chặn tạo chứng từ. `lastNumber` không được sửa qua Settings API (đã verify: request PUT có `lastNumber` trong body bị bỏ qua).
- Không có quan hệ FK nào giữa `Company`/`Setting` với các model khác — module cấu hình độc lập, các module khác chỉ đọc qua `SettingService` (Module Ownership, cùng nguyên tắc đã áp dụng cho Dashboard).
- Đã refactor các nơi từng hard-code giá trị Loại 1: `DebtService.getUpcomingDueReceivables()`/`getOverdueCustomers()`/`getTopDebtors()` đọc `Settings.Dashboard.upcomingDueDays`/`topCustomers`; `WarehouseService.getTopConsumedMaterials()` đọc `Settings.Dashboard.defaultDashboardPeriod`/`topMaterials`; trang in Báo giá (`apps/web/.../quotations/[id]/print/page.tsx`) đọc `Settings.Company.*` + `Settings.Document.quotationDefaultTerms` thay vì placeholder hard-code.

---

### 16. Return module (Recovery Management) — thiết kế xong ✅ Đã xử lý (Task 00 — sprint-01, `011-hang-hoan.md`)

- `Return` (`returns`) — chỉ tạo được khi `SalesOrder.status = DELIVERED`. `customerId`/`customerName` copy trực tiếp từ `SalesOrder` (đã tự là snapshot), không đọc `Customer`. `salesOrderId` là relation thật (quan hệ cấu trúc chính); `customerId` là Redundant Reference (không `@relation`, cùng convention `Receivable.customerId`).
- `ReturnItem` (`return_items`) — snapshot từ `SalesOrderItem` tại thời điểm tạo (`productCode`/`productName`/`productParameters` dạng `Json?`/`orderedQuantity`/`unitPriceSnapshot` từ `finalPrice`). `salesOrderItemId` chỉ dùng điều hướng (navigation), không `@relation` — cùng convention `ProductionOrderItem.salesOrderItemId`. Không có `subtotalSnapshot`/`condition` (Derived Data không cần thiết, xem return.md).
- **Validate cộng dồn qua nhiều Return** (Task 03): `SUM(ReturnItem.returnedQuantity)` theo cùng `salesOrderItemId` — tính trên **toàn bộ** `ReturnItem` từng tạo trước đó (không giới hạn theo Return nào) — không được vượt `SalesOrderItem.quantity`. Đã verify sống: return lần 2 cộng dồn đúng, lần 3 bị chặn chính xác.
- `RecoveryInventory` (`recovery_inventories`) — sinh tự động 1-1 từ mỗi `ReturnItem`, độc lập hoàn toàn với Warehouse. `createdFromReturnCode` là Redundant Reference tới `Return.code`. **`code` không có Running Number riêng** (tài liệu không định nghĩa) — dùng `{returnCode}-{số thứ tự dòng}` (vd `RT000001-1`), vẫn đảm bảo duy nhất + truy vết được nguồn gốc mà không cần thêm loại chứng từ mới.
- Thêm field `usedForNote` (không có trong bảng field Task 00 nhưng Task 05 — mark-used — yêu cầu rõ) — String tự do, không FK, không automation.
- Enum `ReturnReason` (7 giá trị), `RecoveryInventoryStatus` (`AVAILABLE`/`USED`/`DISPOSED`) — workflow một chiều, mọi Action chỉ chạy được từ `AVAILABLE`.
- **Quyết định đã xác nhận với người dùng:** endpoint Management (Task 06, `PUT /recovery-inventory/:id`) được phép sửa `status` trực tiếp — khác với Action `mark-used`/`dispose` (Task 05) vốn bắt buộc `status` hiện tại phải là `AVAILABLE`. Đây là 2 con đường thay đổi status cùng tồn tại theo yêu cầu, không phải xung đột thiết kế.
- Đã xác nhận với người dùng bổ sung `GET /returns` + `GET /returns/:id` (không có trong Task 02 gốc) để tra cứu lịch sử Return.
- Dashboard: `ReturnService` bổ sung `getDashboardSummary()`/`getAgingRecoveryInventory()`/`getTopReturnReasons()`/`getReturnsByCustomer()` — `DashboardModule` gọi qua các method này (`GET /dashboard/returns`), không tự viết Prisma query (Module Ownership).
- Quan hệ: `SalesOrder ||--o{ Return`, `Return ||--|{ ReturnItem`, `ReturnItem ||--o| RecoveryInventory`.

---

### 17. Authentication module — thiết kế xong ✅ Đã xử lý (Task 00 — sprint-01, `012-authentication.md`)

Không tạo model mới — chỉ bổ sung field vào `User` đã có sẵn (từ đầu dự án, chưa từng dùng tới cho đến module này):

```text
User
  passwordHash        String    // bcrypt, không bao giờ lưu/trả plaintext
  isActive             Boolean   @default(true)   // vô hiệu hoá, không xoá
  lastLoginAt          DateTime?
  lastLoginIp          String?
  mustChangePassword   Boolean   @default(false)  // theo từng User — xem authentication.md
```

- `User` không xuất hiện trong sơ đồ mermaid ở trên (ERD chỉ hiển thị model nghiệp vụ — cùng cách xử lý đã áp dụng cho `RunningNumber`), nhưng field đã có đầy đủ trong `schema.prisma`.
- **Chưa thêm `roleId`** — thuộc phạm vi `013-permission.md`, Authentication chỉ đọc field này (khi đã tồn tại) để đưa vào payload JWT, không sở hữu.
- JWT chỉ chứa `sub` (userId) ở giai đoạn này — `roleId` sẽ được thêm vào payload khi Permission module hoàn thành, không cần regenerate token cũ (yêu cầu đăng nhập lại là đủ).
- Thời hạn JWT đọc từ `Settings.Security.sessionTimeout` (phút) qua `SettingService` — không hard-code.
- **Không tạo bảng `RefreshToken`/session/blacklist** — V1 stateless, đúng theo `authentication.md` mục "Không làm trong V1".
- Thêm biến môi trường `JWT_SECRET` (`.env`, `.env.example`) — dùng cho `JwtModule`.
- **Phát hiện + sửa một bug tiềm ẩn khi triển khai:** `AuthModule` gọi `JwtModule.register({ secret: process.env.JWT_SECRET })` như một static argument, được evaluate ngay lúc `import` (trước khi `ConfigModule.forRoot()` kịp chạy `dotenv.config()`), nên `JWT_SECRET` có thể `undefined` khi app khởi động qua đường import thông thường. Đã sửa bằng cách thêm `import 'dotenv/config'` làm dòng đầu tiên của `main.ts` — đảm bảo biến môi trường được nạp trước khi bất kỳ module nào (kể cả `AuthModule`) được import.
- `AuthService.setTemporaryPassword(userId)` — method nội bộ (không có HTTP endpoint), export cho `013-permission.md` gọi khi tạo/reset User. Đã verify sống: trả plaintext đúng một lần, `passwordHash` lưu đúng hash, `mustChangePassword` set theo `Settings.Security.forceChangePasswordOnFirstLogin`.

---

### 18. Permission module (Authorization) — thiết kế xong ✅ Đã xử lý (Task 00 — sprint-01, `013-permission.md`)

Model mới (không hiển thị trong sơ đồ mermaid ở trên — cùng cách xử lý đã áp dụng cho `User`/`RunningNumber`, ERD chỉ hiển thị model nghiệp vụ):

```text
Role
  code        String   UK   // bất biến — OWNER, ADMIN, MANAGER, SALES, PRODUCTION, WAREHOUSE, ACCOUNTANT, VIEWER (+ Role tự tạo qua Task 04)
  name        String        // hiển thị, sửa được
  isActive    Boolean  @default(true)

Permission
  resource    String
  action      String
  key         String   UK   // "{resource}.{action}" — Derived Data, lý do Hiệu năng đọc

RolePermission
  roleId        String
  permissionId  String
  @@unique([roleId, permissionId])

PermissionAudit          // append-only
  roleId        String
  permissionId  String?      // null khi ROLE_CREATED/ROLE_DISABLED/USER_*
  userId        String?      // xem ghi chú bên dưới
  action        GRANT | REVOKE | ROLE_CREATED | ROLE_DISABLED | USER_CREATED | USER_DISABLED | USER_ROLE_CHANGED
  changedBy     String?
  payload       Json?        // delta, vd { fromRole, toRole }

User (bổ sung)
  roleId        String    // FK Role, bắt buộc
```

- **Bổ sung `PermissionAudit.userId`** (không có trong bảng field gốc ở Task 00 của `013-permission.md`, chỉ liệt `roleId`/`permissionId`/`action`/`changedBy`/`payload`/`createdAt`) — bắt buộc phải có để biết audit USER_CREATED/USER_DISABLED/USER_ROLE_CHANGED đang nói về User nào; `roleId` một mình không định danh được User (nhiều User có thể cùng Role). Redundant reference, không `@relation`, cùng convention các field điều hướng khác trong schema (vd `ReturnItem.salesOrderItemId`). Cần người dùng xác nhận lại bổ sung này.
- `User.roleId` — FK bắt buộc tới `Role`. Trước đây (`012-authentication.md`) JWT chỉ chứa `sub`; nay `AuthService.issueToken()` đưa thêm `roleId` vào payload để `PermissionGuard` đọc thẳng từ `req.user`, không phải query DB mỗi request.
- `PermissionGuard` (`src/permission/permission.guard.ts`) đọc metadata từ `@RequirePermission(key)` (đặt ở method, không đặt ở class — `Reflector.get()` chỉ đọc `context.getHandler()`, đã phát hiện và sửa bug này khi verify sống trên `DashboardController`), tra `Role → RolePermission → Permission.key`, throw `ForbiddenException` nếu thiếu quyền.
- Bootstrap Owner (seed) dùng `crypto.randomBytes` + `bcrypt` trực tiếp trong `prisma/seed.ts` (cùng thuật toán `AuthService.setTemporaryPassword()`) thay vì gọi qua Nest DI — seed chạy độc lập bằng `ts-node`, ngoài Nest application context.
- **`PUT /recovery-inventory/:id`** (Management, `011-hang-hoan.md` Task 06) dùng permission riêng **`return.update`** (đã xác nhận với người dùng) — tách biệt với `return.dispose` vì `dispose` là Business Action một chiều (Task 05, chỉ chạy khi `status = AVAILABLE`), còn Management sửa `location`/`imageUrl`/`status` tự do không qua ràng buộc đó. Permission catalog Return: `view/create/update/mark-used/dispose`.
- `CompanyController`/`RunningNumberController` (thuộc `SettingModule`, không nằm trong danh sách liệt kê gốc ở Task 02 của `013-permission.md` — chỉ ghi "SettingController") cũng được gắn `settings.view`/`settings.update` — cùng permission với `SettingController` vì cùng thuộc Settings module, không có permission riêng.
- `PermissionModule` phụ thuộc 2 chiều với `AuthModule` (`forwardRef`): `PermissionModule` gọi `AuthService.setTemporaryPassword()` khi tạo User; `AuthModule` gọi `PermissionService.getPermissionKeysForRole()` để mở rộng `GET /auth/me` với field `permissions`. `SettingModule` cũng dùng `forwardRef` khi import `PermissionModule` vì tạo thành chu trình `Setting → Permission → Auth → Setting` (do `AuthModule` đã import `SettingModule` sẵn từ `012-authentication.md`). Đã xác nhận với người dùng: đây là hạn chế kỹ thuật của NestJS khi resolve module phụ thuộc vòng, không phải lỗi/nợ kiến trúc.
- Dashboard KPI Permission (Task 06): `DashboardController.getOverview()`/`getAlerts()` ẩn từng field con (`production`/`warehouse`/`debt`/`returns`, và tương ứng bên trong `alerts`) thành `null` nếu Role thiếu đúng quyền `view` của module sở hữu — không tạo permission `dashboard.xxx` riêng, không ẩn toàn bộ Dashboard. `sales`/`delayedOrders` không bị ẩn (Task 06 gốc không liệt Sales Overview).
- Đã verify sống (chạy API thật + PostgreSQL thật): login → JWT chứa `roleId` → `GET /auth/me` trả 38 permission keys đúng theo Role OWNER; tạo User Role SALES → 403 đúng ở `warehouse.view`/`dashboard.view`/`user.view`, 200 đúng ở `customer.view`; chặn tự vô hiệu hoá chính mình; chặn Disable Role còn User đang dùng; `PermissionAudit` ghi đúng `USER_CREATED`.

---

### 19. Vòng Architecture Review 2026-07-05 — ✅ ĐÃ migrate & triển khai (Sprint 02 Milestone 01, 06/07/2026)

Các quyết định đã thống nhất trong đợt review kiến trúc toàn dự án (xem `knowledge/modules/report.md`, `quotation.md`, `return.md` bản cập nhật 05/07). Đã triển khai trong `workbench/sprint-02/001-cap-nhat-kien-truc.md` — migration chính `20260706044014_architecture_review_snapshots_return_status_indexes` + migration bổ sung `20260706052711_return_completed_by_at`:

**QuotationItem** (`quotation.md` — sửa vi phạm Snapshot Rule): ✅

- Thêm `productCode`, `productName` (snapshot tại thời điểm thêm/sửa dòng). Backfill bản ghi cũ: join qua `productId` một lần duy nhất lúc migrate. FE (danh sách/chi tiết/trang in) đọc snapshot, `productId` chỉ điều hướng. Verify sống: đổi tên Product sau khi có báo giá → báo giá vẫn giữ tên cũ.

**Return** (`return.md` — bổ sung trạng thái xử lý đã cam kết ở `02-quy-trinh`/`03-danh-sach-module`): ✅

- Thêm enum `ReturnStatus` (`PROCESSING`/`COMPLETED`) + field `Return.status` (`@default(PROCESSING)`). Backfill bản ghi cũ: set `COMPLETED` (nghiệp vụ đã kết thúc trước khi có trạng thái).
- Action mới `POST /returns/:id/complete` (chỉ từ `PROCESSING`, một chiều) — dùng permission `return.update` (đã chốt, không seed key mới). Bổ sung `completedBy`/`completedAt` (đã chốt 06/07/2026 — theo gợi ý "tối giản" của `return.md` nhưng chọn phương án đầy đủ 2 field) để ghi người thực hiện + thời điểm. `GET /returns` filter theo `status`. FE badge/nút hoãn đến khi có module FE Return (đã chốt 06/07/2026).

**SalesOrderItem** (`report.md` — phục vụ báo cáo B2/B4, cấm join ngược Master Data): ✅

- Thêm `productTypeId` (Redundant Reference), `productTypeName` (snapshot) — set tại Approve. Backfill: join qua `productId` (cột này đã tồn tại từ trước — mục gốc ghi "thêm productId" là thừa, và join theo id chính xác hơn join theo `productCode`).

**SalesOrder** (`report.md` C1 + architecture review "trước Go-Live"): ✅

- Thêm `ownerId String?` (FK User); `ownerName` giữ làm snapshot hiển thị. Approve set `ownerId` = người tạo báo giá (`Quotation.createdBy`, ghi từ JWT khi tạo), fallback người bấm Approve khi `createdBy` NULL. Không backfill dữ liệu cũ (NULL).

**Index theo ngày** (`report.md` mục 3): ✅

- `SalesOrder @@index([createdAt])`, `Payment @@index([paymentDate])`, `Return @@index([returnDate])`, `MaterialReceipt @@index([createdAt])`, `SalesOrderItem @@index([productId])`, `SalesOrderItem @@index([productTypeId])`.

**Validation mới, không đổi schema** (`quotation.md`): ✅

- Approve chặn khi `QuotationItem.pricingRuleVersionId` không còn là version ACTIVE — throw `errorCode: PRICING_VERSION_STALE` + danh sách dòng lệch; Action `POST /quotations/:id/recalculate-prices` (chỉ Draft/Sent) tính lại bằng version ACTIVE, trả `changes` cũ/mới cho FE hiển thị chênh lệch, ghi Timeline bằng action `QUOTATION_MANUAL_OVERRIDE` sẵn có với `payload.action = "RECALCULATE_PRICES"` (đã chốt 06/07/2026 — không thêm enum mới).
- Không Cancel Quotation đã có `salesOrderId` (kể cả Manual Override) — chặn ở cả `cancel()` lẫn `override()`.

**Huỷ đơn đã thu cọc — ✅ đã chốt (05/07/2026), ✅ đã triển khai (06/07/2026):** cho phép Cancel khi mọi PO còn PENDING kể cả `paidAmount > 0` — cảnh báo bắt buộc xác nhận, Receivable ra khỏi công nợ mở theo rule lọc status sẵn có, Payment giữ nguyên, hoàn tiền ngoài ERP, Timeline payload `{ reason, paidAmount, refundNote }` (chỉ thêm 2 field sau khi `paidAmount > 0`). Không thêm schema mới. Xem `order.md` mục "Huỷ đơn đã thu cọc" + `debt.md`. FE dialog cảnh báo hoãn đến khi có module FE Order (đã chốt 06/07/2026); API detail đã trả sẵn `receivable.paidAmount` cho FE dùng.

Toàn bộ verify sống 06/07/2026 trên API + PostgreSQL thật (45 check PASS): snapshot giữ tên cũ khi đổi tên Product; đổi version giá → Approve chặn đúng dòng → tính lại (+chênh lệch đúng) → Approve OK; `ownerId`/`productTypeId`/`productTypeName` đúng trên SalesOrder mới; huỷ đơn đã cọc (PO cascade, payload đúng, công nợ mở giảm đúng delta trên `/receivables/dashboard`, Payment giữ nguyên); Return complete một chiều + filter status.

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
