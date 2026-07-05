# Module Công nợ (Accounts Receivable)

> **Tên file:** `knowledge/modules/debt.md`

---

# Mục đích

Quản lý toàn bộ công nợ phải thu của khách hàng.

Công nợ phát sinh **ngay khi Sales Order được tạo** — không đợi giao hàng.

Module này chịu trách nhiệm:

- Ghi nhận các lần thu tiền
- Theo dõi số tiền đã thu
- Theo dõi số tiền còn phải thu
- Cập nhật trạng thái thanh toán
- Theo dõi hạn thanh toán, quá hạn, hạn mức tín dụng (Debt Monitoring)
- Cung cấp dữ liệu cho Dashboard

Không chịu trách nhiệm:

- Báo giá
- Sản xuất
- Kho
- Kế toán tổng hợp
- Sổ cái
- Hoàn tiền (Refund)
- Chặn bán hàng khi vượt hạn mức (V1 chỉ cảnh báo — xem "Credit Limit Monitoring")

---

# Vai trò trong ERP

Debt là Receivable Layer.

Module này không quyết định:

- giá bán
- sản xuất
- giao hàng

Module chỉ quản lý:

- phải thu
- đã thu
- còn nợ
- rủi ro công nợ (quá hạn, vượt hạn mức)

---

# Business Flow

```text
Quotation Approved
        ↓
Sales Order được tạo
        ↓
Receivable được sinh (đồng thời — xem "Thời điểm sinh Receivable")
        ↓ snapshot Credit Policy (debtLimitSnapshot, debtTermDaysSnapshot)
        ↓ dueDate = NULL
Payment (có thể xảy ra bất cứ lúc nào, kể cả trước khi Delivered — vd khách đặt cọc)
        ↓
Receivable cập nhật (paidAmount / remainingAmount)
        ↓
SalesOrder.paymentStatus (ERP tự tính)

...song song...

Sales Order Delivered
        ↓
dueDate = actualDeliveryDate + debtTermDaysSnapshot
        ↓
daysOverdue / riskLevel có thể tính được (Derived, xem "Due Date & Overdue Tracking")
```

`Delivered` **không còn là mốc sinh Receivable** — nó chỉ là mốc **kích hoạt `dueDate`**. Xem "Thời điểm sinh Receivable" và "Due Date & Overdue Tracking" bên dưới.

---

# Triết lý thiết kế

Sales Order chỉ lưu:

```text
paymentStatus
```

Toàn bộ lịch sử thu tiền được lưu tại Module Debt.

Sales Order không lưu:

- số tiền đã thu
- số lần thanh toán

Các giá trị này được tính từ Payment.

---

# Phạm vi quản lý

## Quản lý

- Công nợ phải thu
- Thu tiền
- Lịch sử thu tiền
- Số dư công nợ
- Hạn thanh toán, quá hạn, hạn mức tín dụng (theo dõi, cảnh báo — không chặn ở V1)

## Không quản lý

- Công nợ phải trả
- Sổ cái
- Phiếu kế toán
- Hạch toán
- Refund

---

# Thời điểm sinh Receivable

**Receivable được ERP sinh đồng thời với Sales Order** — trong cùng transaction của `Quotation.approve()` (cùng chỗ đang sinh `SalesOrder` + `ProductionOrder`), không đợi tới khi giao hàng (`Delivered`).

Lý do: doanh nghiệp sản xuất theo đơn hàng rất thường xuyên có nhu cầu **thu tiền đặt cọc** ngay sau khi chốt đơn, trước khi sản xuất xong:

```text
Sales Order 20.000.000
        ↓
Receivable 20.000.000 (paidAmount = 0)
        ↓
Khách đặt cọc 10.000.000 (trong lúc đang sản xuất, chưa giao hàng)
```

Nếu đợi tới `Delivered` mới sinh Receivable, ERP sẽ không có chỗ nào để ghi nhận khoản đặt cọc này.

**Đây là thay đổi chạm vào code đã ship của module Quotation** (giống tiền lệ Production Order đã sinh sẵn trong `Quotation.approve()`) — đã thống nhất trước khi code: `QuotationWorkflowService.approve()` phải sinh thêm `Receivable` trong cùng transaction đang có.

**Không ghi Timeline riêng cho việc tạo Receivable.** Vì Receivable luôn sinh cùng lúc, cùng transaction với SalesOrder, không phải một business event độc lập — gộp vào payload có sẵn của `SalesOrderTimeline` action `SALES_ORDER_CREATED`:

```json
{
  "quotationCode": "BG000001",
  "receivableCreated": true
}
```

Không tạo action Timeline mới cho việc này.

---

# Credit Policy Snapshot

`Customer` đã có sẵn 2 field chính sách tín dụng (từ Module Customer, chưa từng được dùng tới cho đến module này):

```text
Customer.debtLimit       // hạn mức nợ tối đa
Customer.debtTermDays    // số ngày được nợ, default 30
```

**Không tạo field mới trùng nghĩa** (vd `creditLimit`, `paymentTermDays`) — dùng lại đúng tên đã có để tránh một khái niệm nhưng hai cách đặt tên.

Khi Receivable được tạo (đồng thời với SalesOrder), ERP **snapshot cả hai giá trị này** vào Receivable:

```text
Receivable.debtLimitSnapshot      // copy từ Customer.debtLimit tại thời điểm tạo
Receivable.debtTermDaysSnapshot   // copy từ Customer.debtTermDays tại thời điểm tạo
```

**Phải snapshot cả hai cùng lúc, không chỉ một.** Đây đều là chính sách tín dụng của khách hàng tại thời điểm bán — nếu chỉ snapshot `debtLimit` mà để `debtTermDays` đọc sống (live) từ `Customer` sau này, đơn hàng cũ sẽ vô tình bị áp policy mới khi Customer đổi điều khoản thanh toán, vi phạm nguyên tắc Snapshot & Document Design (CLAUDE.md mục 7: "Master Data thay đổi không ảnh hưởng đến chứng từ cũ").

Ví dụ minh hoạ tại sao phải snapshot `debtTermDays`:

```text
01/07  Customer.debtTermDays = 30
       ↓
       SalesOrder + Receivable tạo → debtTermDaysSnapshot = 30
       ↓
03/07  Kế toán đổi Customer.debtTermDays = 15 (áp dụng cho đơn MỚI sau ngày này)
       ↓
05/07  Delivered → dueDate = 05/07 + 30 ngày (dùng snapshot, không dùng giá trị 15 mới)
```

Đơn cũ giữ đúng điều khoản đã bán; đơn tạo sau 03/07 mới dùng 15 ngày.

**Đây là nhóm khái niệm mở rộng được** — nếu sau này cần thêm chính sách tín dụng khác (vd `allowPartialPayment`, `lateFeePercent`), chỉ cần snapshot thêm field mới vào cùng nhóm này, không cần đổi triết lý thiết kế. Hiện tại **không** thêm các field này — chưa có nhu cầu thật.

---

# Dữ liệu quản lý

## Receivable

Một Sales Order sinh đúng một Receivable.

```text
salesOrderId
customerId              // redundant reference — xem lý do bên dưới
totalAmount              // snapshot từ SalesOrder.totalAmount tại thời điểm tạo
paidAmount
remainingAmount
debtLimitSnapshot        // Credit Policy Snapshot
debtTermDaysSnapshot     // Credit Policy Snapshot
dueDate                  // NULL cho tới khi Delivered — xem "Due Date & Overdue Tracking"
createdAt
updatedAt
```

**Không có field `status`.** Hiệu lực công nợ của Receivable hoàn toàn phụ thuộc vào `SalesOrder.status` — xem mục "Receivable không tự quyết định hiệu lực công nợ" bên dưới.

**`customerId` là Redundant Reference, không phải Derived Data — được phép lưu.** Về lý thuyết có thể lấy qua `salesOrderId → SalesOrder → customerId`, nhưng khác với Derived Data (giá trị tính toán, có công thức, có thể tính sai/quên cập nhật), đây chỉ là copy nguyên một ID **bất biến** (một Sales Order không thể đổi khách hàng sau khi tạo) — không có rủi ro lệch dữ liệu. Lý do giữ: Debt Monitoring cần query tổng hợp rất thường xuyên theo khách hàng (`SUM(remainingAmount) GROUP BY customerId`, "Top 10 khách nợ nhiều nhất", "khách vượt hạn mức") — nếu không có sẵn `customerId`, mọi query loại này đều phải join qua `SalesOrder`. Cùng nguyên tắc đã áp dụng cho `SalesOrderItem.productionCenterId/Name` và `Payment.salesOrderId/receivableId`.

Trong đó:

```text
remainingAmount = totalAmount - paidAmount
```

**`remainingAmount` là Derived Data, được phép lưu** (ngoại lệ hợp lệ theo nguyên tắc "Hiệu năng đọc" — CLAUDE.md mục 13):

- **Source Data:** `totalAmount`, `paidAmount`.
- **Thời điểm cập nhật:** mỗi khi `PaymentService.create()` chạy, trong cùng transaction ghi Payment.
- **Thành phần chịu trách nhiệm:** `PaymentService.create()`.
- **Lý do lưu:** Dashboard/Debt Monitoring đọc field này rất thường xuyên — tránh phải `SUM(Payment)` mỗi lần hiển thị.

---

## Payment

Lưu toàn bộ lịch sử thu tiền.

```text
code
salesOrderId        // giữ cùng receivableId — lý do hiệu năng, tránh join
receivableId
paymentDate
amount
paymentMethod
referenceNumber
note
createdBy
createdAt
```

Ví dụ

```text
PT000001

5.000.000
```

---

# Due Date & Overdue Tracking

## dueDate — vòng đời

```text
Receivable tạo         → dueDate = NULL
        ↓
SalesOrder Delivered   → dueDate = actualDeliveryDate + debtTermDaysSnapshot
```

**Không tính `dueDate` ngay khi tạo Receivable** — vì hàng chưa giao thì chưa bắt đầu tính hạn thanh toán. Đây là lý do `dueDate` tách rời khỏi thời điểm tạo Receivable dù cả hai đều liên quan tới SalesOrder.

**Đây là thay đổi chạm thêm vào `SalesOrderService.deliver()`** (đã ship) — cùng transaction đang set `actualDeliveryDate`, ERP set thêm `Receivable.dueDate`.

## daysOverdue, riskLevel — Derived, không lưu

Khác với `remainingAmount`, hai giá trị này **không được lưu** — tính runtime mỗi lần đọc, vì chi phí tính rất thấp (một phép trừ ngày) và không phục vụ Snapshot:

```text
daysOverdue = today - dueDate   (chỉ tính khi dueDate != NULL)

riskLevel:
  0-7 ngày quá hạn    → LOW
  8-30 ngày quá hạn   → MEDIUM
  > 30 ngày quá hạn   → HIGH
```

Nếu `dueDate = NULL` (chưa Delivered): không có `daysOverdue`/`riskLevel` — đơn chưa giao thì chưa thể "quá hạn".

Ngưỡng LOW/MEDIUM/HIGH ở trên là mặc định V1, có thể điều chỉnh theo nhu cầu thực tế khi vận hành.

---

# Credit Limit Monitoring

**Không có field `creditLimitExceeded` trên Receivable.** Vượt hạn mức là trạng thái của **Customer** (tổng hợp), không phải của một Receivable đơn lẻ:

```text
Ví dụ:
Hạn mức khách A: 100 triệu
Đơn 1 còn nợ: 60 triệu   (không vượt)
Đơn 2 còn nợ: 50 triệu   (không vượt)
→ Tổng còn nợ: 110 triệu → VƯỢT hạn mức 100 triệu
```

Tính bằng:

```sql
SUM(Receivable.remainingAmount)
GROUP BY Receivable.customerId
-- chỉ tính Receivable thuộc SalesOrder.status != CANCELLED
```

So sánh với `Customer.debtLimit` (giá trị hiện tại, không phải snapshot — vì đây là kiểm tra tình trạng **hiện tại** của khách hàng, khác với `debtLimitSnapshot` trên từng Receivable dùng để biết hạn mức tại thời điểm bán).

## V1: chỉ cảnh báo, không chặn

Khi khách vượt hạn mức, ERP **không chặn** tạo Quotation/SalesOrder mới. Chỉ hiển thị cảnh báo, người dùng (Owner/Sale) tự quyết định có tiếp tục hay không:

```text
⚠️ Khách đã vượt hạn mức công nợ
Hạn mức: 100.000.000
Đang nợ: 132.000.000
Bạn vẫn muốn tiếp tục?
```

Lý do không chặn ở V1: có nhiều trường hợp hợp lệ cần bán vượt hạn mức (khách VIP, khách quen có lịch sử trả đúng hẹn) — nếu chặn cứng, Owner sẽ phải liên hệ kế toán mở khoá mỗi lần, gây phiền hà không cần thiết.

**V2 (chưa làm ở Sprint này):** thêm Company Setting `Debt Policy` cho phép cấu hình:

```text
○ Chỉ cảnh báo (mặc định V1)
○ Chặn tạo đơn
○ Chặn Approve
```

Chỉ khi đó mới thêm validation chặn thật vào `Quotation.approve()`.

---

# Payment Method

V1

```text
CASH

BANK_TRANSFER
```

Sau này bổ sung:

```text
CARD

EWALLET
```

`referenceNumber` **bắt buộc khi `paymentMethod = BANK_TRANSFER`**, **không bắt buộc khi `CASH`** — xem mục Validation.

---

# Running Number

```text
Payment

↓

PT000001
```

---

# Snapshot Rule

Payment snapshot:

```text
customerName

salesOrderCode

amount

paymentMethod
```

Sau khi tạo. Không đọc lại Sales Order.

Receivable snapshot (Credit Policy — xem mục riêng ở trên):

```text
totalAmount
debtLimitSnapshot
debtTermDaysSnapshot
```

---

# Workflow

Không có Workflow đổi Status thủ công.

Payment được tạo thủ công qua:

```http
POST /payments
```

**Thay đổi kiến trúc chạm vào Sales Order module đã ship:** API cũ

```http
POST /sales-orders/:id/record-payment
```

(cho phép client set thẳng `paymentStatus`) **bị loại bỏ hoàn toàn**. API này hợp lý ở thời điểm chưa có Debt module, nhưng từ nay `SalesOrder.paymentStatus` chỉ được ERP tự tính từ `Payment`.

```text
Create Payment
↓
Insert Payment
↓
Update Receivable (paidAmount += amount, remainingAmount tính lại — atomic, xem "Concurrency Rule")
↓
Tính lại SalesOrder.paymentStatus
↓
Ghi SalesOrderTimeline (PAYMENT_STATUS_CHANGED)
```

---

# Payment Status

ERP tự tính.

```text
paidAmount = 0          → UNPAID
0 < paidAmount < total   → PARTIALLY_PAID
paidAmount >= total      → PAID
```

Người dùng không sửa trực tiếp.

---

# Transaction Boundary

```text
Create Payment
↓
BEGIN TRANSACTION
↓
Insert Payment
↓
Update Receivable (atomic increment/decrement)
↓
Update SalesOrder.paymentStatus
↓
Ghi SalesOrderTimeline (PAYMENT_STATUS_CHANGED)
↓
COMMIT
```

Nếu thất bại, rollback toàn bộ.

---

# Concurrency Rule

**Không được thu vượt công nợ, kể cả khi retry/double-click/concurrent request.** Không chỉ kiểm tra ở tầng Application — phải đảm bảo ở tầng Database:

1. **`CHECK` constraint ở DB:** `remaining_amount >= 0` trên bảng `receivables` (khai báo trong migration).
2. **Update kiểu atomic, không phải Read → Calculate → Write:** dùng phép cộng/trừ ngay trong câu SQL (Prisma `increment`/`decrement`), ví dụ `paidAmount: { increment: amount }`, `remainingAmount: { decrement: amount }` — không đọc `remainingAmount` ra so sánh trong code rồi ghi đè giá trị đã tính.

Nhờ đó, nếu 2 request cùng ghi vào một Receivable, Postgres tự serialize qua row lock; request nào khiến `remainingAmount` âm sẽ bị `CHECK` constraint chặn ngay ở DB, không phụ thuộc vào việc Application có kiểm tra đúng hay không.

---

# Timeline

Không tạo `PaymentTimeline` hay `ReceivableTimeline` riêng — `Payment` tự nó đã là bản ghi bất biến (append-only, không sửa/xoá), nên không cần thêm bảng lịch sử cho chính nó.

Ghi tiếp vào `SalesOrderTimeline`, tái sử dụng action đã có sẵn `PAYMENT_STATUS_CHANGED` (không tạo action mới).

**Ghi mỗi khi có Payment mới — không chỉ khi `paymentStatus` thực sự đổi giá trị.** Một Sales Order có thể nhận nhiều Payment nằm trong cùng một khoảng `PARTIALLY_PAID`, nhưng mỗi lần đều là một sự kiện tiền thật đã về, bắt buộc phải có Timeline (Timeline First — CLAUDE.md mục 6).

Payload:

```json
{
  "paymentCode": "PT000001",
  "amount": 5000000,
  "fromStatus": "PARTIALLY_PAID",
  "toStatus": "PARTIALLY_PAID"
}
```

`fromStatus` và `toStatus` có thể giống nhau — đó là tín hiệu hợp lệ cho biết payment này không làm đổi trạng thái, không phải lỗi.

Việc tạo Receivable cũng ghi Timeline, nhưng **gộp vào payload của `SALES_ORDER_CREATED`** đã có sẵn — xem mục "Thời điểm sinh Receivable".

---

# Validation

Create Payment

- Sales Order **khác `CANCELLED`** (không yêu cầu phải `DELIVERED` — Receivable/Payment có thể phát sinh ngay từ khi đơn `IN_PRODUCTION`/`SHIPPED`/`DELIVERED`, chỉ chặn khi đơn đã huỷ).
- `amount > 0`.
- Không vượt `remainingAmount`.
- `referenceNumber` bắt buộc khi `paymentMethod = BANK_TRANSFER`.

---

# Receivable không tự quyết định hiệu lực công nợ

`Receivable` không phải nguồn quyết định công nợ có còn hiệu lực hay không — `SalesOrder.status` mới là nguồn sự thật duy nhất.

Nếu `SalesOrder.status = CANCELLED`:

- `Receivable` **vẫn được giữ nguyên** để phục vụ lịch sử — không xoá.
- `Receivable` **không còn được tính vào công nợ đang mở** (xem "Dashboard Rule").

**Sales Order không được phép Cancel nếu đã thu tiền** (`Receivable.paidAmount > 0`) — chặn ngay ở `SalesOrderService.cancel()`. Quyết định có chủ đích để tránh mở luồng Refund trong Sprint 1. Nếu chưa thu đồng nào (`paidAmount = 0`), Cancel vẫn diễn ra bình thường.

---

# Business Rule

- Một Sales Order chỉ có một Receivable.
- Receivable được ERP sinh đồng thời với SalesOrder, trong transaction `Quotation.approve()` — không đợi Delivered.
- Receivable snapshot `debtLimitSnapshot`/`debtTermDaysSnapshot` từ Customer tại thời điểm tạo (Credit Policy Snapshot).
- `dueDate` = NULL lúc tạo, chỉ được set khi SalesOrder chuyển `DELIVERED` (`actualDeliveryDate + debtTermDaysSnapshot`).
- `daysOverdue`/`riskLevel` là Derived Data, không lưu, tính runtime, chỉ có ý nghĩa khi `dueDate != NULL`.
- Vượt hạn mức tín dụng là trạng thái tổng hợp theo Customer (`SUM(remainingAmount)` của các Receivable còn hiệu lực so với `Customer.debtLimit`), không phải field trên từng Receivable.
- V1 chỉ cảnh báo khi vượt hạn mức, không chặn tạo đơn/Approve.
- Một Receivable có nhiều Payment.
- Payment không được sửa số tiền sau khi tạo, không được xoá.
- Payment chỉ được tạo thủ công, qua `POST /payments` — không còn API set thẳng `SalesOrder.paymentStatus`.
- SalesOrder.paymentStatus được ERP tự tính từ Payment.
- remainingAmount luôn >= 0 — enforce bằng CHECK constraint ở DB, không chỉ validate ở Application.
- Update Receivable phải atomic (increment/decrement), không đọc-tính-ghi.
- Một Payment chỉ cập nhật Receivable đúng một lần.
- Create Payment chỉ bị chặn khi Sales Order đã `CANCELLED`.
- Sales Order không được Cancel nếu Receivable.paidAmount > 0.
- Receivable không tự quyết định hiệu lực công nợ — SalesOrder.status là nguồn sự thật. Receivable của đơn đã Cancel vẫn giữ để phục vụ lịch sử, không tính vào công nợ đang mở.
- referenceNumber bắt buộc khi paymentMethod = BANK_TRANSFER.
- Mỗi Payment đều ghi SalesOrderTimeline (PAYMENT_STATUS_CHANGED), kể cả khi paymentStatus không đổi.
- customerId trên Receivable là Redundant Reference (copy ID bất biến để tránh join), không phải Derived Data.
- Toàn bộ thao tác nằm trong một transaction.

---

# Dashboard Rule

Dashboard tính công nợ đang mở từ:

```text
SalesOrder
    JOIN Receivable
    WHERE SalesOrder.status != CANCELLED
```

Đọc trực tiếp `Receivable.totalAmount` / `paidAmount` / `remainingAmount` — **không SUM lại từ Payment**.

**Không được cộng thẳng toàn bộ `Receivable` mà bỏ qua điều kiện lọc theo `SalesOrder.status`** — nếu không, công nợ của các đơn đã `CANCELLED` (dù `paidAmount = 0`) sẽ bị tính nhầm vào tổng công nợ đang mở.

## Owner Dashboard (Debt Monitoring)

Màn hình tổng quan công nợ dành cho Owner, dựa trên các giá trị Derived ở mục "Due Date & Overdue Tracking" và "Credit Limit Monitoring":

```text
Tổng còn phải thu
Quá hạn (số khách, tổng tiền)
Quá hạn > 30 ngày (riskLevel = HIGH)
Khách vượt hạn mức (số khách, tổng tiền)
Top 10 khách nợ nhiều nhất
```

Tất cả đều tính runtime từ `Receivable` (kèm `dueDate`/`debtLimitSnapshot`) JOIN `SalesOrder` (lọc `status != CANCELLED`) JOIN `Customer` (lấy `debtLimit` hiện tại để so sánh) — không lưu thêm bảng thống kê riêng ở V1.

---

# Read API

```http
GET /receivables
GET /receivables/:id
```

- `GET /receivables`: list, search theo khách hàng/mã Sales Order, filter theo `paymentStatus`, `overdue=true`, `risk=LOW|MEDIUM|HIGH`, `creditExceeded=true` (theo khách hàng), pagination.
- `GET /receivables/:id`: chi tiết, kèm danh sách Payment (Payment History) lồng bên trong — **không có `GET /payments` độc lập ở V1**. Lý do: kế toán luôn tra cứu theo khách hàng/đơn hàng trước, không có nhu cầu xem toàn bộ Payment của hệ thống trên một màn hình. Nếu sau này cần báo cáo/đối soát cắt ngang theo ngày hoặc phương thức thanh toán, việc đó thuộc về Module Report (V2), không mở rộng ở đây.

Không có Create/Update/Delete API cho Receivable (chỉ ERP tự sinh/tự cập nhật).

---

# Quan hệ dữ liệu

```text
Customer (debtLimit, debtTermDays)
        │ snapshot tại thời điểm tạo
        ▼
Quotation.approve()
        │
        ├──► SalesOrder
        │        │
        │        ▼ (Delivered → set dueDate)
        └──► Receivable (debtLimitSnapshot, debtTermDaysSnapshot, dueDate)
                 │
                 ▼
              Payment
```

---

# Ghi chú

Module này chỉ quản lý Công nợ phải thu.

Nếu sau này cần:

- Công nợ phải trả
- Thuế
- Kế toán
- Sổ cái
- Hoàn tiền (Refund) khi Cancel đơn đã thu tiền
- Chặn bán hàng khi vượt hạn mức (Company Setting Debt Policy)
- Báo cáo/đối soát Payment cắt ngang (theo ngày, theo phương thức thanh toán)

sẽ phát triển thành Accounting Module / Report Module (V2).

---

# Module Dependencies

## Phụ thuộc

- Customer (đọc `debtLimit`/`debtTermDays` để snapshot)
- SalesOrder
- Quotation (Receivable được sinh trong `Quotation.approve()`)

## Module bị ảnh hưởng

- Sales Order:
  - bỏ API `record-payment`
  - `cancel()` cần kiểm tra thêm `Receivable.paidAmount`
  - `deliver()` cần set thêm `Receivable.dueDate`
- Dashboard

Không được thay đổi Business Rule hoặc Data Model của các Module trên ngoài phạm vi đã thống nhất ở đây.

Nếu cần thay đổi thêm phải dừng và xác nhận với người dùng.

---

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
