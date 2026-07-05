# Sprint 01 — Module Hàng hoàn (Return)

> **Tên file:** `workbench/sprint-01/011-hang-hoan.md`

---

# Mục tiêu

Hoàn thành nền tảng Module Return theo kiến trúc đã thống nhất.

Module này phục vụ:

- Ghi nhận hàng khách trả.
- Quản lý Recovery Inventory.
- Thống kê hàng Return.

Module này **không** quản lý:

- Refund
- Warranty
- Accounting
- Warehouse
- Sales Order
- Production

Đọc kỹ `knowledge/modules/return.md` trước khi bắt đầu — mọi quyết định thiết kế đã chốt ở đó.

---

# Task 00 — Schema Migration

## Mục tiêu

Chuẩn bị schema cho Module Return.

Bao gồm:

- Tạo `Return`
- Tạo `ReturnItem`
- Tạo `RecoveryInventory`
- Tạo `ReturnReason`
- Tạo `RecoveryInventoryStatus`
- Thêm Running Number `RETURN`
- Đồng bộ Prisma Schema
- Đồng bộ ERD

---

## Models cần tạo

### Return

| Field | Ghi chú |
| --- | --- |
| `code` | Running Number: RT000001 |
| `salesOrderId` | |
| `salesOrderCode` | snapshot |
| `customerId` | redundant reference |
| `customerName` | snapshot |
| `returnDate` | |
| `receivedBy` | |
| `note` | |
| `createdAt` / `updatedAt` | |

### ReturnItem

| Field | Ghi chú |
| --- | --- |
| `salesOrderItemId` | |
| `productCode` | snapshot |
| `productName` | snapshot |
| `productParameters` | snapshot |
| `orderedQuantity` | snapshot |
| `returnedQuantity` | `<=` orderedQuantity (validate cộng dồn — xem Task 03) |
| `unitPriceSnapshot` | snapshot từ `SalesOrderItem.finalPrice` |
| `reason` | enum `ReturnReason` |
| `note` | |

**Không có `subtotalSnapshot`, không có `condition`** — đã loại bỏ theo `return.md` (Derived Data không cần thiết / thay bằng ghi chú tự do trong `note`).

### RecoveryInventory

| Field | Ghi chú |
| --- | --- |
| `code` | |
| `returnItemId` | |
| `createdFromReturnCode` | redundant reference tới `Return.code`, tránh join |
| `productCode` | snapshot |
| `productName` | snapshot |
| `productParameters` | snapshot |
| `quantity` | snapshot |
| `location` | sửa được |
| `status` | enum `RecoveryInventoryStatus`, sửa qua Workflow (Task 05) |
| `imageUrl` | `String?`, chỉ lưu URL — không xây upload (xem `setting.md` Future Policies) |
| `createdAt` / `updatedAt` | dùng `createdAt` làm mốc tính "Hàng tồn lâu", không thêm `receivedDate` |

---

## Enum cần tạo

```text
ReturnReason

WRONG_SIZE
WRONG_COLOR
WRONG_MODEL
PRODUCTION_DEFECT
INSTALLATION_DEFECT
CUSTOMER_CHANGED_MIND
OTHER
```

```text
RecoveryInventoryStatus

AVAILABLE

USED

DISPOSED
```

---

## Running Number

```text
RETURN

↓

RT000001
```

---

## Definition of Done

- [x] Return được tạo (đầy đủ field ở trên).
- [x] ReturnItem được tạo (đầy đủ field, không có `subtotalSnapshot`/`condition`).
- [x] RecoveryInventory được tạo (đầy đủ field, bao gồm `createdFromReturnCode`, `imageUrl`).
- [x] Enum đầy đủ.
- [x] Running Number hoạt động.
- [x] Prisma Migration thành công.
- [x] ERD đồng bộ.

---

# Task 01 — Data Model

## Mục tiêu

Hoàn thiện Data Model.

Bao gồm:

- Return
- ReturnItem
- RecoveryInventory

Định nghĩa:

- Quan hệ
- Validation
- Index
- Running Number

---

## Definition of Done

- [x] Một Return có nhiều ReturnItem.
- [x] ReturnItem thuộc đúng một SalesOrderItem.
- [x] RecoveryInventory sinh tự động từ ReturnItem.
- [x] RecoveryInventory độc lập với Warehouse.
- [x] Hoàn thành ERD.

---

# Task 02 — Return Creation

## Mục tiêu

Triển khai tạo Return.

Action:

```http
POST /returns
```

Điều kiện:

- SalesOrder phải DELIVERED.
- Chọn một hoặc nhiều SalesOrderItem.
- Cho phép trả một phần số lượng.

ERP tự động:

- Snapshot ReturnItem.
- Sinh RecoveryInventory — snapshot luôn `createdFromReturnCode` (từ `Return.code` vừa tạo).

Toàn bộ thực hiện trong **một transaction**.

---

## Snapshot

Snapshot:

- productCode
- productName
- productParameters
- orderedQuantity
- returnedQuantity
- unitPriceSnapshot

Không đọc lại Product.

Không đọc lại SalesOrderItem sau khi tạo.

---

## Definition of Done

- [x] Chỉ tạo được khi SalesOrder DELIVERED.
- [x] Snapshot đúng.
- [x] RecoveryInventory sinh tự động, có `createdFromReturnCode` đúng.
- [x] Transaction rollback đúng khi lỗi.

---

# Task 03 — Validation

## Mục tiêu

Đảm bảo dữ liệu Return hợp lệ.

Bao gồm:

- Không trả vượt số lượng.
- Validate cộng dồn nhiều lần Return.
- Không Return khi SalesOrder chưa DELIVERED.

---

## Business Rule

```text
SUM(ReturnItem.returnedQuantity)

<=

SalesOrderItem.orderedQuantity
```

Không chỉ validate từng ReturnItem riêng lẻ.

---

## Definition of Done

- [x] Validate cộng dồn.
- [x] Không Return vượt số lượng.
- [x] Validation đầy đủ.
- [x] Pass Review.

---

# Task 04 — Recovery Inventory

## Mục tiêu

Quản lý kho hàng thu hồi.

RecoveryInventory sinh tự động khi tạo Return.

Không liên quan Warehouse.

---

## Read API

```http
GET /recovery-inventory

GET /recovery-inventory/:id
```

Bao gồm:

- Search
- Filter Status
- Pagination

---

## Definition of Done

- [x] List.
- [x] Detail.
- [x] Search.
- [x] Filter.
- [x] Pagination.

---

# Task 05 — Workflow

## Mục tiêu

Quản lý vòng đời Recovery Inventory.

Action:

```http
POST /recovery-inventory/:id/mark-used

POST /recovery-inventory/:id/dispose
```

Không sửa Status trực tiếp.

**Cả hai Action chỉ thực hiện được khi status hiện tại là `AVAILABLE`.**

---

## mark-used

```text
AVAILABLE
↓
USED
```

Có thể nhập:

```text
usedForNote
```

Ví dụ:

```text
SO000231

Làm rèm mẫu

Showroom
```

Không FK.

Không Automation.

---

## dispose

```text
AVAILABLE
↓
DISPOSED
```

---

## Các chuyển trạng thái KHÔNG được phép

```text
USED      → DISPOSED   (không cho)
DISPOSED  → USED        (không cho)
USED      → AVAILABLE   (không cho)
DISPOSED  → AVAILABLE   (không cho)
```

Mọi Action đều yêu cầu status hiện tại phải là `AVAILABLE` — không có ngoại lệ, không chuyển chéo giữa `USED`/`DISPOSED`.

---

## Definition of Done

- [x] mark-used hoạt động (chỉ từ AVAILABLE).
- [x] dispose hoạt động (chỉ từ AVAILABLE).
- [x] Chặn đủ cả 4 chiều chuyển không hợp lệ ở trên.
- [x] Validation đầy đủ.

---

# Task 06 — Recovery Inventory Management

## Mục tiêu

Cho phép cập nhật thông tin vận hành.

Được sửa:

- location
- status
- imageUrl

Không được sửa:

- productCode
- productName
- productParameters
- quantity

Đây là Snapshot.

---

## Definition of Done

- [x] Chỉ sửa được các field cho phép.
- [x] Snapshot bất biến.
- [x] Không Delete RecoveryInventory.

---

# Task 07 — Dashboard Integration

## Mục tiêu

Cung cấp dữ liệu cho Dashboard.

Bao gồm:

- Return trong tháng.
- Tổng sản phẩm Return.
- Giá trị Return.
- Recovery Inventory hiện có.
- Hàng tồn lâu.
- Top lý do Return.
- Return theo khách hàng.

**Dashboard chỉ gọi qua `ReturnService`/`RecoveryInventoryService`** (method đọc, vd `getDashboardSummary()`) — không tự viết Prisma query, đúng pattern Module Ownership đã áp dụng cho Debt/Warehouse/Production ở Dashboard module.

Không tính lại Business Logic.

---

## Giá trị Return

```text
SUM(

returnedQuantity

×

unitPriceSnapshot

)
```

---

## Hàng tồn lâu

```text
daysInStock

=

NOW()

-

createdAt
```

Chỉ tính:

```text
status = AVAILABLE
```

---

## Definition of Done

- [x] Dashboard APIs đầy đủ.
- [x] Chỉ gọi qua Service, không tự viết Prisma query.
- [x] Không ghi dữ liệu.
- [x] Không ảnh hưởng Dashboard tài chính.

---

# Task 08 — Snapshot Integrity Review

## Mục tiêu

Kiểm tra tính độc lập của Snapshot.

Sau khi tạo Return:

- Đổi tên Product.
- Đổi Parameter.
- Đổi giá bán.

Return không thay đổi.

RecoveryInventory không thay đổi.

---

## Definition of Done

- [x] Product đổi tên → Return không đổi.
- [x] SalesOrderItem đổi → Return không đổi.
- [x] Snapshot hoạt động đúng.

---

# Task 09 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Kiểm tra:

- Business Flow
- Snapshot
- Workflow
- Validation
- Dashboard
- API
- Prisma
- ERD

Đảm bảo đồng bộ:

- knowledge/modules/return.md
- schema.prisma
- ERD

---

## Definition of Done

- [x] Không còn TODO.
- [x] Đồng bộ Knowledge.
- [x] Đồng bộ Prisma.
- [x] Đồng bộ ERD.
- [x] Pass Review.

---

# Module Dependencies

## Phụ thuộc

- Sales Order

## Module bị ảnh hưởng

- Dashboard

Return **không được thay đổi Business Rule** của:

- Sales Order
- Warehouse
- Production
- Debt

Nếu cần thay đổi phải dừng và xác nhận với người dùng.

---

# Commit Message

```text
feat(return): implement return management foundation
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
