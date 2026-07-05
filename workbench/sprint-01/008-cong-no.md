# Sprint 01 — Module Công nợ

> **Tên file:** `workbench/sprint-01/008-cong-no.md`

---

# Mục tiêu

Hoàn thành nền tảng Module Công nợ (Accounts Receivable), bao gồm cả theo dõi rủi ro công nợ (Debt Monitoring).

Module này quản lý:

- Công nợ phải thu
- Lịch sử thanh toán
- Trạng thái thanh toán
- Hạn thanh toán, quá hạn, hạn mức tín dụng (theo dõi, cảnh báo)
- Dữ liệu Dashboard

Không quản lý:

- Công nợ phải trả
- Kế toán
- Sổ cái
- Refund
- Chặn bán hàng khi vượt hạn mức (V1 chỉ cảnh báo, để dành V2)

Đọc kỹ `knowledge/modules/debt.md` trước khi bắt đầu — mọi quyết định thiết kế đã chốt ở đó.

---

# Task 00 — Schema Migration

## Mục tiêu

Chuẩn bị schema cho Module Debt.

Bao gồm:

- Receivable
- Payment
- Enum PaymentMethod
- Running Number
- CHECK constraint (Concurrency Rule)
- Prisma Migration
- Đồng bộ ERD

---

## Enum cần thêm

### PaymentMethod

```text
CASH
BANK_TRANSFER
```

---

## Models cần thêm

### Receivable

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `salesOrderId` | `String` | UNIQUE — 1 SalesOrder chỉ 1 Receivable |
| `customerId` | `String` | Redundant reference (không phải Derived Data) — xem debt.md |
| `totalAmount` | `Decimal` | snapshot từ `SalesOrder.totalAmount` |
| `paidAmount` | `Decimal` | default 0 |
| `remainingAmount` | `Decimal` | Derived, có justification — xem debt.md |
| `debtLimitSnapshot` | `Decimal` | Credit Policy Snapshot — copy từ `Customer.debtLimit` lúc tạo |
| `debtTermDaysSnapshot` | `Int` | Credit Policy Snapshot — copy từ `Customer.debtTermDays` lúc tạo |
| `dueDate` | `DateTime?` | NULL lúc tạo, set khi SalesOrder Delivered |
| `createdAt` / `updatedAt` | `DateTime` | |

**Không có field `status`.**

**CHECK constraint bắt buộc** (viết tay trong migration.sql, xem Task 03 — Concurrency Rule):

```sql
CHECK (remaining_amount >= 0)
```

### Payment

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `code` | `String` | Running Number: PT000001 |
| `salesOrderId` | `String` | giữ cùng `receivableId` — lý do hiệu năng |
| `receivableId` | `String` | |
| `paymentDate` | `DateTime` | |
| `amount` | `Decimal` | > 0 |
| `paymentMethod` | `PaymentMethod` | |
| `referenceNumber` | `String?` | bắt buộc khi `BANK_TRANSFER` (validate ở tầng Application, Task 03) |
| `note` | `String?` | |
| `createdBy` | `String?` | |
| `createdAt` | `DateTime` | |

---

## Running Number

| Model | Prefix |
|--------|--------|
| Payment | PT |

Ví dụ:

```text
PT000001
PT000002
```

---

## Definition of Done

- [x] Receivable đã tạo (đầy đủ field, bao gồm `dueDate`, `debtLimitSnapshot`, `debtTermDaysSnapshot`).
- [x] Payment đã tạo.
- [x] Enum `PaymentMethod` đã tạo.
- [x] `Receivable.salesOrderId` là UNIQUE.
- [x] CHECK constraint `remaining_amount >= 0` đã thêm.
- [x] Running Number PT hoạt động.
- [x] Prisma Migration thành công.
- [x] ERD đồng bộ.

---

# Task 01 — Data Model

## Mục tiêu

Thiết kế Data Model.

Bao gồm:

- Receivable
- Payment

Định nghĩa:

- Quan hệ dữ liệu
- Validation
- Index
- Snapshot

---

## Business Rule

Một SalesOrder sinh đúng một Receivable.

Một Receivable có nhiều Payment.

Không có ReceivableStatus.

`SalesOrder.paymentStatus` là nguồn sự thật duy nhất.

`customerId` trên Receivable là Redundant Reference, không phải Derived Data (xem debt.md).

---

## Definition of Done

- [x] Quan hệ dữ liệu đầy đủ.
- [x] Không có ReceivableStatus.
- [x] Payment Snapshot đúng theo knowledge.
- [x] Receivable Snapshot (Credit Policy) đúng theo knowledge.
- [x] Hoàn thành ERD.

---

# Task 02 — Receivable Integration

## Mục tiêu

Tích hợp Receivable vào luồng tạo SalesOrder.

**Đây là thay đổi vào module Quotation đã triển khai.**

Receivable được ERP sinh tự động trong cùng transaction:

```text
Quotation.approve()

↓

SalesOrder

↓

Receivable (snapshot debtLimitSnapshot, debtTermDaysSnapshot từ Customer; dueDate = NULL)
```

Không có Create API cho Receivable.

**Không ghi Timeline riêng cho việc tạo Receivable** — gộp vào payload có sẵn của `SalesOrderTimeline` action `SALES_ORDER_CREATED`:

```json
{ "quotationCode": "BG000001", "receivableCreated": true }
```

---

## Definition of Done

- [x] Receivable sinh tự động.
- [x] Cùng transaction với SalesOrder.
- [x] Snapshot `debtLimitSnapshot`/`debtTermDaysSnapshot` từ Customer đúng tại thời điểm tạo.
- [x] `dueDate = NULL` lúc tạo.
- [x] Payload `SALES_ORDER_CREATED` có thêm `receivableCreated: true`, không tạo action Timeline mới.
- [x] Rollback toàn bộ nếu lỗi.
- [x] Không có Create API.

---

# Task 03 — Payment API

## Mục tiêu

Triển khai ghi nhận thanh toán.

API:

```http
POST /payments
```

Thay thế hoàn toàn:

```http
POST /sales-orders/:id/record-payment
```

(API cũ và `RecordPaymentDto` bị xoá khỏi `SalesOrderService`/`SalesOrderController`.)

---

## Business Flow

```text
Create Payment
↓
Insert Payment
↓
Update Receivable (atomic — xem Concurrency Rule)
↓
Update SalesOrder.paymentStatus
↓
SalesOrderTimeline
↓
Commit
```

Toàn bộ thực hiện trong một transaction.

---

## Validation

- SalesOrder != CANCELLED.
- amount > 0.
- amount <= remainingAmount.
- BANK_TRANSFER bắt buộc referenceNumber.

---

## Concurrency Rule

Một Receivable không được phép thu vượt công nợ — kể cả Retry, Double click, Concurrent request.

**Cơ chế bắt buộc (đã chốt ở debt.md, không phải chỉ nguyên tắc chung chung):**

1. `CHECK (remaining_amount >= 0)` ở DB (đã khai báo ở Task 00).
2. Update Receivable bằng phép toán atomic ngay trong câu SQL — dùng Prisma `increment`/`decrement`:
   ```ts
   prisma.receivable.update({
     where: { id },
     data: {
       paidAmount: { increment: amount },
       remainingAmount: { decrement: amount },
     },
   });
   ```
   **Không** đọc `remainingAmount` ra, so sánh ở application, rồi ghi đè giá trị đã tính toán thủ công (read → calculate → write) — đây là pattern KHÔNG được chấp nhận vì có race condition.

Nhờ atomic update + CHECK constraint, nếu 2 request concurrent cùng ghi vào một Receivable, Postgres serialize qua row lock; request nào khiến số dư âm sẽ bị chặn ngay ở DB.

---

## Definition of Done

- [x] Payment API hoạt động.
- [x] API cũ `record-payment` và `RecordPaymentDto` đã bị xoá.
- [x] Validation đầy đủ.
- [x] Update Receivable dùng Prisma `increment`/`decrement` (atomic), không đọc-tính-ghi.
- [x] CHECK constraint chặn đúng khi có race condition (test cụ thể: 2 request concurrent cùng thu gần hết `remainingAmount`, chỉ 1 request thành công).
- [x] Rollback đúng khi lỗi.

---

# Task 04 — Payment Synchronization

## Mục tiêu

ERP tự cập nhật:

- paidAmount
- remainingAmount
- SalesOrder.paymentStatus

Không cho phép FE sửa trực tiếp paymentStatus.

---

## Derived Data

remainingAmount là Derived Data.

Source:

```text
totalAmount
paidAmount
```

Được cập nhật bởi:

```text
PaymentService.create()
```

Lý do lưu:

Dashboard/Debt Monitoring đọc trực tiếp, không SUM Payment mỗi lần.

---

## Definition of Done

- [x] paidAmount cập nhật đúng.
- [x] remainingAmount cập nhật đúng.
- [x] paymentStatus cập nhật đúng.
- [x] Không sửa trực tiếp paymentStatus.

---

# Task 05 — Timeline

## Mục tiêu

Không tạo PaymentTimeline.

Không tạo ReceivableTimeline.

Tiếp tục sử dụng:

```text
SalesOrderTimeline
```

Action:

```text
PAYMENT_STATUS_CHANGED
```

---

## Business Rule

Timeline được ghi **mỗi lần tạo Payment**.

Không phụ thuộc paymentStatus có thay đổi hay không.

Payload:

```text
paymentCode
amount
fromStatus
toStatus
```

---

## Definition of Done

- [x] Timeline sinh mỗi Payment.
- [x] Payload đầy đủ.
- [x] Không tạo Timeline mới (kể cả cho Receivable — xem Task 02).

---

# Task 06 — Cancel Rule

## Mục tiêu

Đồng bộ với SalesOrder.

**Task này sửa `SalesOrderService.cancel()`** (đã ship) — thêm điều kiện chặn dựa trên `Receivable.paidAmount`.

Business Rule:

Nếu:

```text
Receivable.paidAmount > 0
```

↓

Không cho phép:

```text
SalesOrder.cancel()
```

Refund không thuộc phạm vi Sprint 01.

---

## Definition of Done

- [x] `SalesOrderService.cancel()` đã sửa, load thêm `Receivable` để kiểm tra.
- [x] Block Cancel đúng Business Rule.
- [x] Không xử lý Refund.
- [x] Đồng bộ SalesOrder.

---

# Task 07 — Debt Read API

## Mục tiêu

API phục vụ tra cứu công nợ.

```http
GET /receivables
GET /receivables/:id
```

---

## Chi tiết

`GET /receivables`:
- Search theo khách hàng (tên/SĐT) hoặc mã Sales Order.
- Filter theo `paymentStatus`.
- Filter `overdue=true` (dueDate đã qua, dựa trên daysOverdue > 0).
- Filter `risk=LOW|MEDIUM|HIGH` (riskLevel — xem Task 08).
- Filter `creditExceeded=true` (khách hàng có tổng remainingAmount vượt debtLimit — xem Task 08).
- Pagination.

`GET /receivables/:id`:
- Chi tiết Receivable.
- Kèm danh sách Payment (Payment History) lồng bên trong.

**Không có `GET /payments` độc lập ở V1** — xem lý do trong `debt.md` mục "Read API". Nếu cần đối soát cắt ngang theo ngày/phương thức thanh toán, để dành cho Module Report (V2).

Không có Create/Update/Delete API cho Receivable.

---

## Definition of Done

- [x] List Receivable — search, filter, pagination.
- [x] Detail Receivable — kèm Payment History.
- [x] Filter `overdue`, `risk`, `creditExceeded` hoạt động đúng.
- [x] Không có `GET /payments` riêng, không có Create/Update/Delete Receivable.

---

# Task 08 — Debt Monitoring

## Mục tiêu

Triển khai theo dõi hạn thanh toán và hạn mức tín dụng — dữ liệu phục vụ Task 07 (Read API) và Task 09 (Dashboard).

**Đây là thay đổi chạm thêm vào `SalesOrderService.deliver()`** (đã ship) — set `Receivable.dueDate` trong cùng transaction đang set `actualDeliveryDate`.

---

## dueDate

```text
Receivable tạo         → dueDate = NULL
SalesOrder Delivered   → dueDate = actualDeliveryDate + debtTermDaysSnapshot
```

Dùng `debtTermDaysSnapshot` (đã snapshot ở Task 02) — **không đọc lại `Customer.debtTermDays`** tại thời điểm Delivered.

## daysOverdue, riskLevel (Derived — không lưu DB)

```text
daysOverdue = today - dueDate   (chỉ tính khi dueDate != NULL)

riskLevel:
  0-7 ngày quá hạn    → LOW
  8-30 ngày quá hạn   → MEDIUM
  > 30 ngày quá hạn   → HIGH
```

## Credit Limit Monitoring (Derived — không lưu DB, tính theo Customer)

```sql
SUM(Receivable.remainingAmount)
GROUP BY Receivable.customerId
-- chỉ tính Receivable thuộc SalesOrder.status != CANCELLED
```

So sánh với `Customer.debtLimit` hiện tại (không phải snapshot).

**V1 chỉ cảnh báo, không chặn** tạo Quotation/SalesOrder khi vượt hạn mức. Không thêm validation chặn ở `Quotation.approve()`.

---

## Definition of Done

- [x] `dueDate` được set đúng khi Delivered, dùng `debtTermDaysSnapshot`.
- [x] `daysOverdue`/`riskLevel` tính đúng, chỉ áp dụng khi `dueDate != NULL`.
- [x] Vượt hạn mức tính đúng theo tổng `remainingAmount` của Customer, không phải theo từng Receivable riêng lẻ.
- [x] Không chặn tạo đơn/Approve khi vượt hạn mức (chỉ dữ liệu cảnh báo).
- [x] Không lưu `daysOverdue`/`riskLevel`/credit-exceeded vào DB.

---

# Task 09 — Dashboard Integration

## Mục tiêu

Cung cấp dữ liệu cho Dashboard.

---

## Business Rule

Receivable không quyết định hiệu lực công nợ.

SalesOrder mới là nguồn sự thật.

Dashboard tính công nợ đang mở bằng:

```text
SalesOrder
JOIN Receivable
WHERE SalesOrder.status != CANCELLED
```

Receivable của đơn hàng đã huỷ vẫn được giữ lại để phục vụ lịch sử, không tính vào công nợ đang mở.

## Owner Dashboard

Dựa trên Task 08 (Debt Monitoring), tổng hợp:

```text
Tổng còn phải thu
Quá hạn (số khách, tổng tiền)
Quá hạn > 30 ngày
Khách vượt hạn mức (số khách, tổng tiền)
Top 10 khách nợ nhiều nhất
```

---

## Definition of Done

- [x] Dashboard Rule đúng (join + loại trừ CANCELLED).
- [x] Owner Dashboard: đủ 5 chỉ số ở trên.
- [x] Không cộng sai công nợ (đơn CANCELLED không lẫn vào).

---

# Task 10 — Validation

## Mục tiêu

Kiểm tra toàn bộ Business Rule.

Bao gồm:

- Không thanh toán vượt công nợ (Application + Database level).
- Không thanh toán đơn CANCELLED.
- Payment không Update.
- Payment không Delete.
- Receivable sinh đúng một lần.
- SalesOrder.paymentStatus luôn đồng bộ.
- Cancel bị chặn đúng khi `paidAmount > 0`.
- `dueDate`/`daysOverdue`/`riskLevel` đúng vòng đời (Task 08).

---

## Definition of Done

- [x] Validation đầy đủ.
- [x] Pass Review.

---

# Task 11 — Hoàn thiện Module

## Mục tiêu

Review toàn bộ Module.

Kiểm tra:

- Business Flow
- Snapshot (Payment + Credit Policy Snapshot trên Receivable)
- Transaction Boundary
- Concurrency Rule
- Validation
- Timeline
- Dashboard / Debt Monitoring
- API
- Prisma
- ERD

Đảm bảo đồng bộ:

- knowledge/modules/debt.md
- schema.prisma
- ERD

---

## Snapshot Integrity Review

- [x] Customer đổi tên → Payment snapshot không đổi.
- [x] Customer đổi `debtLimit`/`debtTermDays` sau khi Receivable đã tạo → `debtLimitSnapshot`/`debtTermDaysSnapshot` của Receivable cũ không đổi.
- [x] SalesOrder đổi trạng thái → Payment cũ không đổi.
- [x] Receivable luôn đồng bộ với Payment.
- [x] remainingAmount luôn chính xác, không bao giờ âm.
- [x] Rollback đúng khi transaction thất bại.

---

## Definition of Done

- [x] Không còn TODO.
- [x] Đồng bộ Knowledge.
- [x] Đồng bộ Prisma.
- [x] Đồng bộ ERD.
- [x] Snapshot Integrity Review pass.
- [x] Pass Review.

---

# Module Dependencies

## Phụ thuộc

- Customer (đọc `debtLimit`/`debtTermDays` để snapshot)
- Quotation
- SalesOrder

---

## Module bị ảnh hưởng

- Sales Order:
  - bỏ API `record-payment` (`SalesOrderController`/`SalesOrderService`/`RecordPaymentDto`)
  - `cancel()` — thêm kiểm tra `Receivable.paidAmount`
  - `deliver()` — thêm set `Receivable.dueDate`
- Dashboard

Không được thay đổi Business Rule hoặc Data Model của các Module trên ngoài phạm vi đã thống nhất ở đây.

Nếu cần thay đổi phải dừng và xác nhận với người dùng.

---

# Commit Message

```text
feat(debt): implement accounts receivable foundation
```

---

# Sau khi hoàn thành

Claude phải trả về:

- Các Task đã hoàn thành.
- Các file đã thay đổi.
- Commit Message.
- Những thay đổi kiến trúc (nếu có).
- Các điểm cần xác nhận trước khi sang Module Dashboard.

Sau đó dừng và chờ Task tiếp theo.
