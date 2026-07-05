# Module Kho (Warehouse)

> **Tên file:** `knowledge/modules/warehouse.md`

---

# Mục đích

Quản lý toàn bộ biến động kho của doanh nghiệp.

Warehouse không tạo ra nghiệp vụ.

Warehouse chỉ ghi nhận các giao dịch nhập, xuất và tồn kho.

Module này chịu trách nhiệm:

- Quản lý tồn kho nguyên liệu
- Ghi nhận nhập kho
- Ghi nhận xuất kho
- Theo dõi lịch sử biến động kho
- Cung cấp dữ liệu tồn kho cho các Module khác

Không chịu trách nhiệm:

- Báo giá
- Bán hàng
- Sản xuất
- Công nợ
- Dashboard

---

# Vai trò trong ERP

Warehouse là Inventory Layer.

Warehouse không quyết định:

- mua gì
- bán gì
- sản xuất gì

Warehouse chỉ ghi nhận:

- nhập
- xuất
- tồn

---

# Triết lý thiết kế

ERP này phục vụ doanh nghiệp sản xuất theo đơn hàng (Make To Order).

Business Flow thực tế:

```text
Khách đặt hàng

↓

Sản xuất

↓

Giao khách
```

Không phải:

```text
Sản xuất

↓

Nhập kho thành phẩm

↓

Xuất bán
```

Do đó:

**V1 không quản lý Kho thành phẩm.**

Warehouse chỉ quản lý:

- Kho nguyên liệu

Thành phẩm sau khi sản xuất xong sẽ giao trực tiếp cho khách.

Không sinh thêm bước nhập kho rồi xuất kho thành phẩm.

---

# Business Flow

```text
Nhập nguyên liệu

↓

Material Receipt

↓

Kho nguyên liệu

↓

Production Order Start

↓

Warehouse Transaction (OUT)

↓

Sản xuất

↓

Sales Order

↓

Ship
```

`Ship` không sinh thêm dữ liệu ở Warehouse — xem mục "Ship không thuộc Warehouse" bên dưới.

---

# Phạm vi quản lý

## Quản lý

- Nguyên liệu
- Biến động kho (Warehouse Transaction)
- Lịch sử nhập xuất
- Tồn kho

## Không quản lý

- Thành phẩm (V1)
- Kiểm kê
- Điều chuyển kho
- Reserve
- FIFO/LIFO

---

# Dữ liệu quản lý

## MaterialReceipt

Chứng từ nhập kho — **tạo thủ công** qua API bởi nhân viên kho khi nhận hàng từ nhà cung cấp. Đây là document duy nhất trong module này cho phép Create API.

```text
code            // Running Number: PN000001
materialId
materialCode    // snapshot tại thời điểm tạo
materialName    // snapshot
unit            // snapshot
quantity        // Decimal, > 0
supplierName    // (snapshot) String? — free-text, V1 chưa có Supplier model (giống MaterialPrice.supplierName)
note
createdBy       // V1: string?
createdAt
updatedAt
```

Khi tạo, ERP tự sinh 1 `WarehouseTransaction` (`direction = IN`) trong cùng transaction.

**V1 không có `status`.** Create = ghi nhận đã hoàn tất ngay (không có Draft/Approval). Hệ quả: **V1 không có cách sửa một `MaterialReceipt` đã tạo sai** (vd nhập nhầm số lượng) — Admin xử lý qua DB/script, giống tiền lệ đã áp dụng cho Production (không có Manual Override). Đây là quyết định có chủ đích để giữ V1 tối giản, không phải thiếu sót.

## WarehouseTransaction

**Đây là bảng duy nhất ghi nhận biến động kho** — không có bảng `StockLedger` riêng, không có bảng `MaterialIssue` riêng. Mỗi dòng vừa là một "Transaction", vừa là một "Ledger entry".

```text
id
direction            // enum: IN | OUT — hướng vật lý, không đổi/không mở rộng
transactionType       // enum: MATERIAL_RECEIPT | MATERIAL_ISSUE — lý do nghiệp vụ, mở rộng được sau này (ADJUSTMENT, RETURN, TRANSFER...)
materialId
materialCode          // snapshot
materialName          // snapshot
unit                  // snapshot
quantity              // Decimal, luôn dương — dấu +/- áp dụng theo `direction` khi cộng vào Material.currentStock
materialReceiptId     // FK? — set khi transactionType = MATERIAL_RECEIPT
productionOrderId     // FK? — set khi transactionType = MATERIAL_ISSUE
createdAt
```

Đúng một trong hai field `materialReceiptId` / `productionOrderId` được set, tuỳ theo `transactionType`.

**Không lưu số dư (running balance) trên từng dòng.** Lý do: nếu sau này có sửa/import/migrate một giao dịch ở giữa lịch sử, toàn bộ số dư của các giao dịch phía sau sẽ sai theo — rủi ro dây chuyền không kiểm soát được. Thay vào đó, tồn kho hiện tại chỉ lưu **một giá trị duy nhất** trên `Material.currentStock` (xem mục "Current Stock") — nếu cần sửa một giao dịch quá khứ, chỉ cần áp dụng đúng phần chênh lệch (delta) vào `currentStock` hiện tại, không phải tính lại cả chuỗi lịch sử.

**Không có Create API cho `WarehouseTransaction`.** Luôn được ERP tự sinh từ `MaterialReceipt` (thủ công phía trên) hoặc từ `ProductionOrder.start()` (tự động, xem mục "Material Issue").

## Current Stock

**Không phải một bảng riêng — là một field cache trên `Material`.**

```text
Material
  ...
  currentStock    // Decimal — cache, cập nhật mỗi khi có WarehouseTransaction mới
```

Nguồn sự thật (Source of Truth) vẫn là `WarehouseTransaction` — `Material.currentStock` chỉ là cache để đọc nhanh, không cần SUM lại toàn bộ lịch sử mỗi lần hiển thị.

Cập nhật: mỗi khi ghi `WarehouseTransaction` mới, `WarehouseService` cộng/trừ trực tiếp vào `Material.currentStock` (`direction = IN` → cộng, `direction = OUT` → trừ), trong cùng transaction DB với việc ghi `WarehouseTransaction`.

---

# Snapshot Rule

`WarehouseTransaction` snapshot `materialCode`, `materialName`, `unit` tại thời điểm ghi nhận — không chỉ lưu `materialId`.

Sau đó không đọc lại `Material` để hiển thị — nếu Material đổi tên/đơn vị sau này, các Transaction cũ vẫn giữ đúng tên/đơn vị tại thời điểm phát sinh.

`MaterialReceipt` cũng snapshot tương tự (`materialCode`, `materialName`, `unit`).

---

# Material Receipt

Quản lý nhập nguyên liệu.

Tạo thủ công qua API, nguồn nhập:

- Nhà cung cấp (`supplierName`, free-text V1)

Ví dụ:

```text
Mua

500m

Vải

↓

Material Receipt (PN000001)

↓

WarehouseTransaction (direction=IN, transactionType=MATERIAL_RECEIPT, quantity=500)

↓

Material.currentStock += 500
```

---

# Material Issue

Xuất nguyên liệu cho sản xuất.

**Không phải một document/bảng riêng** — chỉ là `WarehouseTransaction` với `direction = OUT`, `transactionType = MATERIAL_ISSUE`, `productionOrderId` trỏ về Production Order tương ứng.

Trigger:

```text
ProductionOrder.start()
```

ERP tự động sinh — không tạo thủ công, không có API riêng.

**Số lượng xuất kho không tự tính lại** — đọc trực tiếp từ snapshot đã có sẵn:

```text
ProductionOrder.start()
    ↓
Với mỗi ProductionOrderItem
    ↓
salesOrderItemId → OrderBOM → OrderBOMItem.quantity
    ↓
Sinh WarehouseTransaction (OUT) cho từng dòng vật tư
```

Warehouse không tự tính định mức — chỉ đọc `OrderBOMItem.quantity` (đã snapshot từ lúc duyệt báo giá).

Ví dụ:

```text
PO001 (start)

↓

OrderBOMItem: Vải, quantity = 120m

↓

WarehouseTransaction (direction=OUT, transactionType=MATERIAL_ISSUE, quantity=120)

↓

Material.currentStock -= 120
```

---

# Transaction Boundary khi Start Production

Đây là quyết định kiến trúc quan trọng nhất của tích hợp Production ↔ Warehouse.

```text
ProductionService.start()
    ↓
BEGIN TRANSACTION
    ↓
Với mỗi vật tư cần dùng (từ OrderBOMItem):
    Kiểm tra Current Stock đủ không?
    ↓ Đủ                              ↓ Thiếu
    Ghi WarehouseTransaction (OUT)     ROLLBACK toàn bộ — start() thất bại
    ↓
ProductionOrder.status = IN_PRODUCTION
    ↓
COMMIT
```

**Không bao giờ có trường hợp `ProductionOrder.status = IN_PRODUCTION` mà chưa xuất kho**, và ngược lại không bao giờ xuất kho mà Start thất bại. Toàn bộ nằm trong một transaction DB duy nhất — nếu thiếu bất kỳ vật tư nào, toàn bộ rollback, `ProductionOrder` giữ nguyên `PENDING`.

Về mặt code: `ProductionService.start()` gọi `WarehouseService` (ví dụ `warehouseService.issueForProductionOrder(productionOrderId, tx)`) và truyền `tx` xuyên suốt — cùng pattern đã dùng cho `syncProductionProgress(salesOrderId, tx)`.

---

# Ship không thuộc Warehouse

Khi Sales Order thực hiện Action `Ship`, **Warehouse không ghi nhận gì thêm**.

Lý do:

- `SalesOrder.ship()` đã ghi `SalesOrderTimeline` (action `SHIPPED`) — đây là nguồn sự thật duy nhất cho sự kiện này.
- V1 không quản lý kho thành phẩm, nên không có số lượng nào để trừ.

Không tạo `WarehouseTransaction` khi Ship. Không tạo bảng ghi lịch sử giao hàng riêng ở Warehouse — tránh trùng lặp dữ liệu với `SalesOrderTimeline`.

---

# Kho thành phẩm

V1:

Không tồn tại.

Business thực tế:

```text
Sản xuất

↓

Giao luôn
```

Không có:

```text
Nhập kho

↓

Xuất kho
```

Nếu sau này doanh nghiệp sản xuất tồn kho trước để bán sau.

V2 sẽ bổ sung:

- Finished Goods Receipt
- Finished Goods Issue

---

# Workflow Engine

Warehouse không có Workflow riêng.

Mọi `WarehouseTransaction` đều được sinh từ Module khác:

```text
MaterialReceipt (thủ công, có Create API)

↓

WarehouseTransaction (direction=IN, transactionType=MATERIAL_RECEIPT)
```

```text
ProductionOrder.start() (tự động)

↓

WarehouseTransaction (direction=OUT, transactionType=MATERIAL_ISSUE)
```

Warehouse không có nút:

- Approve
- Complete
- Deliver

---

# Validation

## MaterialReceipt

- Material phải ACTIVE.
- Quantity > 0.

## WarehouseTransaction (OUT, qua Production Start)

- Material phải ACTIVE.
- Quantity > 0.
- Current Stock sau khi trừ phải >= 0 — nếu không, chặn toàn bộ Start (xem "Transaction Boundary").

---

# Stock Rule

Current Stock luôn:

```text
>= 0
```

Không cho phép âm kho — thực thi bằng transaction boundary ở `ProductionService.start()`, không phải validate sau khi đã ghi.

Nếu thiếu nguyên liệu, Start Production thất bại — Production không chuyển `IN_PRODUCTION`.

---

# Cost Rule

Warehouse không tính giá vốn.

Giá vốn được Snapshot tại:

OrderBOM

↓

plannedCost

Warehouse chỉ quản lý Quantity.

---

# Reservation

V1:

Không có.

Nếu sau này cần.

Business sẽ là:

```text
Sales Order

↓

Reserve Material

↓

Production
```

Để V2.

---

# Running Number

```text
MaterialReceipt → prefix "PN" → PN000001
```

`WarehouseTransaction` **không cần** Running Number — không ai tra cứu theo mã giao dịch, chỉ tra theo Material hoặc theo chứng từ nguồn (`MaterialReceipt`/`ProductionOrder`).

---

# Business Rule

- Warehouse chỉ quản lý nguyên liệu.
- Không quản lý kho thành phẩm trong V1.
- Chỉ `MaterialReceipt` có Create API thủ công — `WarehouseTransaction` không có Create API, luôn do ERP tự sinh.
- `MaterialReceipt` không có `status` — Create là ghi nhận hoàn tất ngay, không có Draft/Approval. Không có cách sửa qua API nếu nhập sai (Admin xử lý qua DB/script).
- `MaterialReceipt` sinh đúng một `WarehouseTransaction` (`direction = IN`, `transactionType = MATERIAL_RECEIPT`).
- `ProductionOrder.start()` sinh `WarehouseTransaction` (`direction = OUT`, `transactionType = MATERIAL_ISSUE`) cho từng vật tư trong `OrderBOMItem` — **một Production Order chỉ được xuất kho đúng một lần** (idempotent, không xuất lại nếu `start()` bị gọi lại).
- `Ship` không sinh `WarehouseTransaction` — sự kiện đã được ghi nhận đủ ở `SalesOrderTimeline`.
- Không tính giá vốn ở Warehouse.
- Không lưu số dư (running balance) trên từng `WarehouseTransaction` — tránh rủi ro sai dây chuyền khi có sửa/import ngược lịch sử. Tồn kho hiện tại chỉ lưu một giá trị duy nhất: `Material.currentStock`.
- `WarehouseTransaction` tách `direction` (IN/OUT, không đổi) và `transactionType` (mở rộng được: MATERIAL_RECEIPT, MATERIAL_ISSUE, và sau này ADJUSTMENT/RETURN/TRANSFER...).
- Không cho phép âm kho — chặn ngay trong transaction của Start Production, không validate sau.
- `WarehouseTransaction`/`MaterialReceipt` snapshot `materialCode`/`materialName`/`unit`/`supplierName`, không đọc lại `Material` sau khi tạo.

---

# Quan hệ dữ liệu

```text
MaterialReceipt ──────► WarehouseTransaction (IN / MATERIAL_RECEIPT)
                              │
ProductionOrder ──────► WarehouseTransaction (OUT / MATERIAL_ISSUE)
                              │
                              ▼
                    Material.currentStock (+= hoặc -=)
```

---

# Ghi chú

Warehouse được thiết kế theo mô hình Make To Order.

Đây là quyết định kiến trúc.

Nếu doanh nghiệp sau này chuyển sang sản xuất tồn kho.

Sẽ bổ sung:

- Finished Goods Receipt
- Finished Goods Issue
- Reservation
- Inventory Count

ở V2.

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
