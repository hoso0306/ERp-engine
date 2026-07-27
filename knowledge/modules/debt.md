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
totalAmount              // snapshot từ SalesOrder.grandTotal (KHÔNG phải totalAmount doanh thu — Sprint 04, chốt 16/07/2026)
paidAmount
remainingAmount
totalAmountBeforeVat     // track song song trước-VAT — xem "Track song song Trước VAT / Sau VAT"
remainingAmountBeforeVat // track song song trước-VAT — xem "Track song song Trước VAT / Sau VAT"
debtLimitSnapshot        // Credit Policy Snapshot
debtTermDaysSnapshot     // Credit Policy Snapshot
dueDate                  // NULL cho tới khi Delivered — xem "Due Date & Overdue Tracking"
closedWithoutVat         // 024-cong-no-vat-settlement.md — xem mục "Đóng công nợ (không xuất hóa đơn)"
createdAt
updatedAt
```

**`totalAmount` = `SalesOrder.grandTotal`, không phải `SalesOrder.totalAmount` (Sprint 04, chốt 16/07/2026).** `SalesOrder.totalAmount` là doanh thu sổ sách (không gồm VAT, không trừ Giảm thêm) — giữ nguyên công thức cũ, dùng cho Báo cáo doanh số. `grandTotal = totalAmount + totalVatAmount − discountAmount + shippingFee` (Phí vận chuyển, chốt 27/07/2026 — xem `quotation.md` mục "Phí vận chuyển") mới là số tiền hoá đơn thực tế khách phải trả — đây mới đúng là số tiền cần thu công nợ. Hai giá trị này **chỉ trùng nhau tình cờ** khi VAT = 0%, không có Giảm thêm và không có Phí vận chuyển; không có code nào khác so sánh trực tiếp hai field này với nhau.

### Track song song Trước VAT / Sau VAT

Khách trả tiền mặt không lấy hoá đơn thì không cần đóng phần VAT — kế toán cần theo dõi công nợ ở **cả 2 mức cùng lúc**, không chỉ một mức duy nhất.

```text
totalAmountBeforeVat     = SalesOrder.totalAmount - discountAmount + shippingFee, snapshot tại Approve
remainingAmountBeforeVat = totalAmountBeforeVat - (tổng Payment đã trừ vào track này)
```

- **Nguồn:** `SalesOrder.totalAmount - discountAmount + shippingFee` tại thời điểm `Quotation.approve()` — cùng nơi snapshot `totalAmount` (sau-VAT). `shippingFee` không chịu VAT nên cộng đều vào cả 2 mức, giữ đúng bất biến `totalAmount − totalAmountBeforeVat = totalVatAmount` (dùng để tính VAT phải nộp — xem `vat-settlement.service.ts`).
- **Cập nhật:** mỗi lần có `PaymentAllocation` mới cấn cho Receivable này, `remainingAmountBeforeVat` bị trừ theo `allocatedSubtotal` do `AllocationPolicy` tính (mặc định `BeforeVatFirstPolicy` — xem mục riêng phía trên), **không còn trừ đều theo full amount** như trước 023-cong-no-payment-allocation-fifo.
- **Không có `CHECK >= 0`** trên `remainingAmountBeforeVat` ở DB (khác với `remainingAmount`) — nhưng qua Allocation Engine, giá trị này **floor tại 0** (`BeforeVatFirstPolicy` chặn `allocatedSubtotal` không vượt quá phần còn lại), không tự nhiên âm nữa như thiết kế cũ.
- **Hiển thị song song ở mọi nơi có `totalAmount`/`remainingAmount`** trên tab Công nợ (danh sách, chi tiết Receivable, Owner Dashboard — tile "Tổng còn phải thu") và bản in Báo giá/Xác nhận đơn hàng (`Customer.getDebtSummary`).

**Không có field `status`.** Hiệu lực công nợ của Receivable hoàn toàn phụ thuộc vào `SalesOrder.status` — xem mục "Receivable không tự quyết định hiệu lực công nợ" bên dưới.

**`customerId` là Redundant Reference, không phải Derived Data — được phép lưu.** Về lý thuyết có thể lấy qua `salesOrderId → SalesOrder → customerId`, nhưng khác với Derived Data (giá trị tính toán, có công thức, có thể tính sai/quên cập nhật), đây chỉ là copy nguyên một ID **bất biến** (một Sales Order không thể đổi khách hàng sau khi tạo) — không có rủi ro lệch dữ liệu. Lý do giữ: Debt Monitoring cần query tổng hợp rất thường xuyên theo khách hàng (`SUM(remainingAmount) GROUP BY customerId`, "Top 10 khách nợ nhiều nhất", "khách vượt hạn mức") — nếu không có sẵn `customerId`, mọi query loại này đều phải join qua `SalesOrder`. Cùng nguyên tắc đã áp dụng cho `SalesOrderItem.productionCenterId/Name` và `Payment.salesOrderId/receivableId`.

Trong đó:

```text
remainingAmount = totalAmount - paidAmount
```

**`remainingAmount` là Derived Data, được phép lưu** (ngoại lệ hợp lệ theo nguyên tắc "Hiệu năng đọc" — CLAUDE.md mục 13):

- **Source Data:** `totalAmount`, `paidAmount`.
- **Thời điểm cập nhật:** mỗi khi có `PaymentAllocation` mới cấn cho Receivable này, trong cùng transaction ghi Payment.
- **Thành phần chịu trách nhiệm:** Allocation Engine (`DebtService`, xem "PaymentAllocation"/"Allocation Policy").
- **Lý do lưu:** Dashboard/Debt Monitoring đọc field này rất thường xuyên — tránh phải `SUM(PaymentAllocation)` mỗi lần hiển thị.

---

## Payment

Lưu toàn bộ lịch sử thu tiền. **Không còn 1-1 với `Receivable`** (023-cong-no-payment-allocation-fifo) — 1 Payment có thể cấn nhiều đơn (FIFO đa đơn), liên kết tới đơn hàng nào giờ đọc qua `PaymentAllocation`, không có `salesOrderId`/`receivableId` trực tiếp trên Payment nữa.

```text
code
type                 // NORMAL | REVERSAL — xem "Reverse Payment"
reversalOfPaymentId  // chỉ set khi type = REVERSAL, @unique (1 Payment chỉ bị reverse đúng 1 lần)
paymentDate
amount               // tổng cả phiếu thu — có thể lớn hơn số cấn cho 1 đơn cụ thể
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

## PaymentAllocation

Cấn 1 Payment vào 1 Receivable. Một Payment có nhiều PaymentAllocation (cấn nhiều đơn); một Receivable cũng có nhiều PaymentAllocation (nhận tiền từ nhiều Payment khác nhau qua thời gian). Append-only, giống Payment — không sửa, không xoá.

```text
paymentId
receivableId
salesOrderId          // redundant reference — Receivable–SalesOrder là 1-1, tránh join khi lọc/ghi Timeline theo đơn
allocatedSubtotal      // phần cấn vào track trước-VAT của Receivable này
allocatedVat           // phần cấn vào track VAT của Receivable này
allocatedTotal          // = allocatedSubtotal + allocatedVat, = số tiền Payment này cấn cho ĐÚNG đơn này
createdAt
```

**`allocatedTotal` không nhất thiết bằng `Payment.amount`** — nếu Payment đó cấn cho nhiều đơn, mỗi `PaymentAllocation` chỉ giữ đúng phần của đơn mình. `GET /receivables/:id` hiển thị lịch sử thu tiền của 1 đơn qua danh sách `PaymentAllocation` (kèm `payment` lồng bên trong để lấy code/paymentDate/paymentMethod), không phải danh sách Payment thô.

## Allocation Policy — tách rời khỏi Allocation Engine

Khi 1 khoản tiền `allocatedTotal` được cấn cho 1 Receivable, cần quyết định bao nhiêu vào `allocatedSubtotal` (trước-VAT), bao nhiêu vào `allocatedVat`. Logic này tách thành 1 interface riêng (`AllocationPolicy`), độc lập với Allocation Engine (phần chọn Receivable nào được cấn, cấn bao nhiêu) — đổi chính sách sau này (vd chia theo tỷ lệ subtotal:vat của đơn) chỉ cần viết class mới, không sửa Engine.

**Chính sách mặc định — `BeforeVatFirstPolicy`:**

```text
subtotalAvailable = max(receivable.remainingAmountBeforeVat, 0)
allocatedSubtotal  = min(allocatedTotal, subtotalAvailable)
allocatedVat       = allocatedTotal - allocatedSubtotal
```

Trừ hết phần trước-VAT của Receivable trước, dư mới trừ vào VAT — khách trả tiền mặt không lấy hoá đơn thì chỉ cần trả tới mức trước-VAT. **`remainingAmountBeforeVat` floor tại 0** qua đường Allocation Engine (không âm) — khác hành vi trước 023-cong-no-payment-allocation-fifo (khi đó trừ đều `remainingAmount` và `remainingAmountBeforeVat` cùng số tiền, có thể để `remainingAmountBeforeVat` âm). Chưa có nhu cầu chọn Policy khác qua UI — đang gán cứng 1 instance trong `DebtService`.

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

Payment **không snapshot thêm field hiển thị nào**:

- `amount`, `paymentMethod`, `paymentDate`, `referenceNumber` là dữ liệu gốc (Source Data) của chính Payment.
- `salesOrderId`, `receivableId` là Redundant Reference (copy ID bất biến).
- Khi cần hiển thị tên khách hàng / mã đơn hàng, đọc qua `salesOrderId → SalesOrder.customerName/code` — bản thân `SalesOrder` đã là snapshot bất biến, không cần lưu bản sao thứ hai trên Payment.

> Ghi chú lịch sử: bản trước của tài liệu từng ghi Payment snapshot `customerName`/`salesOrderCode` — đã bỏ vì schema không có 2 field này và không cần (SalesOrder đã bất biến).

Payment sau khi tạo là append-only — không sửa, không xoá (xem Business Rule).

Receivable snapshot (Credit Policy — xem mục riêng ở trên):

```text
totalAmount
debtLimitSnapshot
debtTermDaysSnapshot
```

---

# Workflow

Không có Workflow đổi Status thủ công.

**2 luồng tạo Payment** (023-cong-no-payment-allocation-fifo), cùng dùng chung 1 Allocation Engine bên trong `DebtService`:

```http
POST /payments            # theo 1 đơn cụ thể — vào từ trang chi tiết Receivable
POST /payments/allocate   # theo khách hàng — mặc định FIFO nhiều đơn, cho sửa tay
```

- `POST /payments`: contract không đổi so với trước 023 (`salesOrderId`, `amount`, `paymentMethod`, ...) — Engine cấn 100% vào đúng đơn đó.
- `POST /payments/allocate`: nhận `customerId`, `amount`, và `allocations?: {receivableId, amount}[]` tuỳ chọn. Nếu không truyền `allocations`, Engine tự tính FIFO (`ORDER BY Receivable.createdAt ASC`, chỉ tính đơn `status != CANCELLED` và `remainingAmount > 0`). Nếu có truyền, dùng đúng giá trị kế toán nhập — validate tổng phải khớp `amount`, từng dòng không vượt `remainingAmount` của đúng đơn đó. Không được thanh toán vượt tổng công nợ hiện tại của khách hàng (SUM `remainingAmount` các đơn còn mở) — ở cả 2 trường hợp.
- `GET /receivables/open-by-customer/:customerId`: danh sách đơn còn nợ của 1 khách hàng, sort FIFO — phục vụ preview trước khi xác nhận `POST /payments/allocate`.

**Thay đổi kiến trúc chạm vào Sales Order module đã ship:** API cũ

```http
POST /sales-orders/:id/record-payment
```

(cho phép client set thẳng `paymentStatus`) **bị loại bỏ hoàn toàn**. API này hợp lý ở thời điểm chưa có Debt module, nhưng từ nay `SalesOrder.paymentStatus` chỉ được ERP tự tính từ `Payment`.

```text
Create Payment (1 hoặc N Receivable)
↓
Insert Payment
↓
Với TỪNG Receivable được cấn:
    AllocationPolicy.split() → allocatedSubtotal/allocatedVat
    ↓
    Insert PaymentAllocation
    ↓
    Update Receivable (atomic, xem "Concurrency Rule")
    ↓
    Tính lại SalesOrder.paymentStatus (của đúng đơn này)
    ↓
    Ghi SalesOrderTimeline (PAYMENT_STATUS_CHANGED, amount = allocatedTotal của đơn này)
```

## Reverse Payment

Hoàn tác 1 Payment tạo nhầm — **không sửa/xoá Payment gốc** (append-only giữ nguyên), tạo bút toán đảo chiều:

```http
POST /payments/:id/reverse
```

```text
Payment gốc (type=NORMAL) → có N PaymentAllocation
        ↓ reverse
Payment mới (type=REVERSAL, reversalOfPaymentId = payment gốc, amount luôn dương)
        ↓
Với TỪNG PaymentAllocation của Payment gốc:
    Tạo PaymentAllocation đối xứng (cùng receivableId/allocatedSubtotal/allocatedVat/allocatedTotal)
    ↓
    Receivable: CỘNG lại (paidAmount -= amount, remainingAmount += amount, remainingAmountBeforeVat += allocatedSubtotal)
    ↓
    Tính lại SalesOrder.paymentStatus
    ↓
    Ghi SalesOrderTimeline
```

Chặn: hoàn tác một Payment `type = REVERSAL` (không cho reverse-of-reverse); hoàn tác một Payment đã từng bị reverse trước đó (`reversalOfPaymentId` @unique — 1 Payment chỉ bị reverse đúng 1 lần).

---

# Đóng công nợ (không xuất hóa đơn)

Kế toán có thể chọn ngay lúc thu tiền: nếu khách trả tiền mặt và không lấy hóa đơn, coi nghiệp vụ của Receivable đó **đã kết thúc**, không tiếp tục theo dõi phần VAT còn lại như công nợ bình thường.

```http
POST /receivables/:id/close-without-vat
```

Set `remainingAmount = 0` **ngay lập tức** (dù `paidAmount` có thể mới bằng `totalAmountBeforeVat`, chưa bằng `totalAmount` có VAT), `remainingAmountBeforeVat` **giữ nguyên** (không reset), `closedWithoutVat = true`, `SalesOrder.paymentStatus = PAID`. Không cần nhập lý do — đây là một nhánh workflow hợp lệ đã định nghĩa sẵn, không phải Manual Override.

**Có thể hoàn tác nếu bấm nhầm** (`reopenReceivableClosedWithoutVat()`, bổ sung 26/07/2026 sau khi rà soát mô hình công nợ):

```http
POST /receivables/:id/reopen-without-vat
```

Đối xứng với action đóng — cũng không cần lý do (undo của 1 action bình thường, giống Reverse Payment, không phải Manual Override). Vì action đóng không đụng `paidAmount`, khôi phục chỉ cần tính lại đúng công thức Derived Data gốc, không cần snapshot riêng:

```text
remainingAmount = totalAmount - paidAmount
paymentStatus   = computePaymentStatus(paidAmount, totalAmount)
closedWithoutVat = false
```

**Chặn nếu Receivable đã thuộc 1 VAT Settlement chưa `CANCELLED`** — lúc đó đã có chứng từ tài chính khác (đã gửi khách/đã thu/đã xuất hóa đơn) phụ thuộc vào trạng thái "đã đóng" này, mở lại sẽ phá Snapshot của `VatSettlementItem.amount`. Một VAT Settlement từng tạo rồi huỷ (`CANCELLED`, chưa gửi khách) thì không chặn.

Nếu sau này khách quay lại yêu cầu xuất hóa đơn, phần VAT còn lại được xử lý qua **VAT Settlement** — một chứng từ tài chính độc lập, không phải giao dịch bán hàng mới, không "hồi sinh" Receivable đã đóng. Xem chi tiết đầy đủ (schema `VatSettlement`/`VatSettlementItem`, workflow, `Payment.vatSettlementId`) tại **[`vat-settlement.md`](vat-settlement.md)**.

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
Create Payment (1 hoặc N Receivable)
↓
BEGIN TRANSACTION
↓
Insert Payment
↓
Với TỪNG Receivable: Insert PaymentAllocation → Update Receivable (atomic) → Update SalesOrder.paymentStatus → Ghi SalesOrderTimeline
↓
COMMIT
```

Nếu thất bại ở bất kỳ Receivable nào (vd CHECK constraint chặn), rollback toàn bộ — không có Payment/PaymentAllocation "một nửa".

---

# Concurrency Rule

**Không được thu vượt công nợ, kể cả khi retry/double-click/concurrent request.** Không chỉ kiểm tra ở tầng Application — phải đảm bảo ở tầng Database:

1. **`CHECK` constraint ở DB:** `remaining_amount >= 0` trên bảng `receivables` (khai báo trong migration).
2. **Update kiểu atomic, không phải Read → Calculate → Write:** dùng phép cộng/trừ ngay trong câu SQL (Prisma `increment`/`decrement`), ví dụ `paidAmount: { increment: amount }`, `remainingAmount: { decrement: amount }` — không đọc `remainingAmount` ra so sánh trong code rồi ghi đè giá trị đã tính.

Nhờ đó, nếu 2 request cùng ghi vào một Receivable, Postgres tự serialize qua row lock; request nào khiến `remainingAmount` âm sẽ bị `CHECK` constraint chặn ngay ở DB, không phụ thuộc vào việc Application có kiểm tra đúng hay không.

**Luồng theo khách hàng (FIFO đa đơn) không thêm khoá tường minh (`SELECT ... FOR UPDATE`).** Nếu FIFO tính allocation từ dữ liệu cũ do 2 giao dịch đồng thời hiếm khi xảy ra, `decrement` sẽ vi phạm CHECK ở đúng dòng lệch, toàn bộ transaction rollback — kế toán thấy lỗi và tạo lại (FIFO tính lại theo state mới). Đủ an toàn nhờ cơ chế atomic + CHECK ở trên, không cần thêm cơ chế khoá.

---

# Timeline

Không tạo `PaymentTimeline` hay `ReceivableTimeline` riêng — `Payment`/`PaymentAllocation` tự nó đã là bản ghi bất biến (append-only, không sửa/xoá), nên không cần thêm bảng lịch sử cho chính nó.

Ghi tiếp vào `SalesOrderTimeline`, tái sử dụng action đã có sẵn `PAYMENT_STATUS_CHANGED` (không tạo action mới) — **ghi 1 dòng cho MỖI đơn bị ảnh hưởng**, không phải 1 dòng cho cả Payment (023-cong-no-payment-allocation-fifo: 1 Payment có thể cấn N đơn → N dòng Timeline, mỗi dòng ở đúng `SalesOrderTimeline` của đơn đó).

**Ghi mỗi khi có PaymentAllocation mới — không chỉ khi `paymentStatus` thực sự đổi giá trị.** Một Sales Order có thể nhận nhiều lần cấn trừ nằm trong cùng một khoảng `PARTIALLY_PAID`, nhưng mỗi lần đều là một sự kiện tiền thật đã về, bắt buộc phải có Timeline (Timeline First — CLAUDE.md mục 6).

Payload:

```json
{
  "paymentCode": "PT000001",
  "amount": 5000000,
  "fromStatus": "PARTIALLY_PAID",
  "toStatus": "PARTIALLY_PAID"
}
```

**`amount` = `allocatedTotal` của đúng đơn này**, không phải tổng `Payment.amount` (có thể lớn hơn nếu Payment đó còn cấn cho đơn khác).

`fromStatus` và `toStatus` có thể giống nhau — đó là tín hiệu hợp lệ cho biết payment này không làm đổi trạng thái, không phải lỗi.

**Reverse Payment** ghi cùng action `PAYMENT_STATUS_CHANGED`, payload thêm `reversalOf` (code của Payment gốc), `amount` mang giá trị âm (thể hiện tiền bị trừ ngược lại).

Việc tạo Receivable cũng ghi Timeline, nhưng **gộp vào payload của `SALES_ORDER_CREATED`** đã có sẵn — xem mục "Thời điểm sinh Receivable".

---

# Validation

Create Payment (theo 1 đơn — `POST /payments`)

- Sales Order **khác `CANCELLED`** (không yêu cầu phải `DELIVERED` — Receivable/Payment có thể phát sinh ngay từ khi đơn `IN_PRODUCTION`/`SHIPPED`/`DELIVERED`, chỉ chặn khi đơn đã huỷ).
- `amount > 0`.
- Không vượt `remainingAmount`.
- `referenceNumber` bắt buộc khi `paymentMethod = BANK_TRANSFER`.

Create Payment theo khách hàng (`POST /payments/allocate`, 023-cong-no-payment-allocation-fifo)

- `amount > 0`, `referenceNumber` bắt buộc khi `BANK_TRANSFER` (giống trên).
- Không được vượt tổng `remainingAmount` của các đơn còn mở của khách hàng.
- Nếu truyền `allocations` (cấn tay): tổng các dòng phải khớp chính xác `amount`; từng dòng không vượt `remainingAmount` của đúng đơn đó, đơn phải thuộc đúng khách hàng đang chọn, `status != CANCELLED`.

Reverse Payment (`POST /payments/:id/reverse`)

- Payment tồn tại, `type = NORMAL` (không cho reverse một Payment đã là REVERSAL).
- Payment chưa từng bị reverse trước đó.

---

# Receivable không tự quyết định hiệu lực công nợ

`Receivable` không phải nguồn quyết định công nợ có còn hiệu lực hay không — `SalesOrder.status` mới là nguồn sự thật duy nhất.

Nếu `SalesOrder.status = CANCELLED`:

- `Receivable` **vẫn được giữ nguyên** để phục vụ lịch sử — không xoá.
- `Receivable` **không còn được tính vào công nợ đang mở** (xem "Dashboard Rule").

**Sales Order được phép Cancel kể cả khi đã thu tiền cọc** (`Receivable.paidAmount > 0`) — quyết định đã chốt với người dùng 05/07/2026 (thay thế rule cũ "chặn Cancel nếu đã thu tiền", vốn tạo deadlock: đơn đã cọc không bao giờ huỷ được vì Refund không có trong V1).

Điều kiện huỷ vẫn theo `order.md` (mọi Production Order còn `PENDING`). Khi `paidAmount > 0`, luồng như sau:

```text
Cancel (đơn đã có tiền cọc)
    ↓
UI hiển thị cảnh báo bắt buộc xác nhận:
"Đơn hàng đã thu cọc. ERP sẽ đóng công nợ.
 Việc hoàn tiền thực hiện ngoài hệ thống."
    ↓
SalesOrder → CANCELLED (cascade PO như production.md)
    ↓
Receivable giữ nguyên bản ghi — tự động ra khỏi công nợ mở
(theo rule sẵn có: chỉ tính Receivable của SalesOrder.status != CANCELLED)
    ↓
Payment giữ nguyên (append-only, không xoá, không sửa)
    ↓
Timeline (CANCELLED) payload: { reason, paidAmount, refundNote: "Refund handled outside ERP" }
```

- **Không thêm field/status mới** — "đóng công nợ" chính là hệ quả của rule lọc theo `SalesOrder.status` đã có, không cần cơ chế riêng.
- Hoàn hay giữ cọc là quyết định của Owner **ngoài hệ thống** — ERP chỉ giữ dấu vết đầy đủ (Payment + Timeline) để đối chiếu.
- Báo cáo/Dashboard cần chú ý: tiền đã thu của đơn CANCELLED vẫn nằm trong "Tiền mặt về" (Payment là sự kiện tiền thật, không xoá) — nếu cần, Report hiển thị dòng chú thích riêng, không tự trừ.

---

# Business Rule

- Một Sales Order chỉ có một Receivable.
- Receivable được ERP sinh đồng thời với SalesOrder, trong transaction `Quotation.approve()` — không đợi Delivered.
- Receivable snapshot `debtLimitSnapshot`/`debtTermDaysSnapshot` từ Customer tại thời điểm tạo (Credit Policy Snapshot).
- `dueDate` = NULL lúc tạo, chỉ được set khi SalesOrder chuyển `DELIVERED` (`actualDeliveryDate + debtTermDaysSnapshot`).
- `daysOverdue`/`riskLevel` là Derived Data, không lưu, tính runtime, chỉ có ý nghĩa khi `dueDate != NULL`.
- Vượt hạn mức tín dụng là trạng thái tổng hợp theo Customer (`SUM(remainingAmount)` của các Receivable còn hiệu lực so với `Customer.debtLimit`), không phải field trên từng Receivable.
- V1 chỉ cảnh báo khi vượt hạn mức, không chặn tạo đơn/Approve.
- Một Receivable có nhiều `PaymentAllocation` (nhận cấn trừ từ nhiều Payment khác nhau qua thời gian).
- Một Payment có nhiều `PaymentAllocation` (023-cong-no-payment-allocation-fifo: cấn cho nhiều đơn của cùng khách hàng, mặc định FIFO, cho sửa tay).
- Payment/PaymentAllocation không được sửa số tiền sau khi tạo, không được xoá — hoàn tác dùng Reverse Payment (bút toán đảo chiều mới), không sửa/xoá bản gốc.
- Payment chỉ được tạo thủ công, qua `POST /payments` (theo 1 đơn) hoặc `POST /payments/allocate` (theo khách hàng) — không còn API set thẳng `SalesOrder.paymentStatus`.
- SalesOrder.paymentStatus được ERP tự tính từ Payment (qua PaymentAllocation).
- remainingAmount luôn >= 0 — enforce bằng CHECK constraint ở DB, không chỉ validate ở Application.
- Update Receivable phải atomic (increment/decrement), không đọc-tính-ghi.
- Không được thanh toán vượt tổng công nợ hiện tại — kiểm tra ở cả 2 luồng (theo 1 đơn: không vượt `remainingAmount` của đơn đó; theo khách hàng: không vượt SUM `remainingAmount` các đơn còn mở).
- Create Payment chỉ bị chặn khi Sales Order đã `CANCELLED`.
- Sales Order được Cancel kể cả khi đã thu cọc (điều kiện PO theo order.md) — kèm cảnh báo bắt buộc xác nhận; Receivable ra khỏi công nợ mở theo rule lọc status sẵn có; Payment giữ nguyên; hoàn tiền xử lý ngoài ERP; Timeline ghi `paidAmount` + refundNote.
- Receivable không tự quyết định hiệu lực công nợ — SalesOrder.status là nguồn sự thật. Receivable của đơn đã Cancel vẫn giữ để phục vụ lịch sử, không tính vào công nợ đang mở.
- referenceNumber bắt buộc khi paymentMethod = BANK_TRANSFER.
- Mỗi PaymentAllocation đều ghi SalesOrderTimeline (PAYMENT_STATUS_CHANGED) trên đúng đơn đó, kể cả khi paymentStatus không đổi.
- customerId trên Receivable là Redundant Reference (copy ID bất biến để tránh join), không phải Derived Data.
- Toàn bộ thao tác nằm trong một transaction.
- `GET /receivables` (danh sách trên tab Công nợ) luôn lọc `SalesOrder.status != CANCELLED` — cùng định nghĩa "công nợ đang mở" dùng chung với Dashboard/Report, không có ngoại lệ nào hiển thị lại Receivable của đơn đã huỷ.
- `allocatedSubtotal`/`allocatedVat` (trên từng PaymentAllocation) do `AllocationPolicy` quyết định — mặc định `BeforeVatFirstPolicy`, trừ hết phần trước-VAT của Receivable trước, dư mới trừ vào VAT, floor tại 0 (xem "Allocation Policy").

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
Tổng còn phải thu (kèm song song mức trước-VAT — totalReceivableBeforeVat)
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
GET /receivables/open-by-customer/:customerId
```

- `GET /receivables`: list, search theo khách hàng/mã Sales Order, filter theo `paymentStatus`, `overdue=true`, `risk=LOW|MEDIUM|HIGH`, `creditExceeded=true` (theo khách hàng), pagination. **Luôn lọc `SalesOrder.status != CANCELLED`** — cùng rule "công nợ đang mở" áp dụng cho Dashboard (xem "Dashboard Rule"), không có tham số nào bật lại việc hiển thị Receivable của đơn đã huỷ. Mỗi item trả kèm `totalAmountBeforeVat`/`remainingAmountBeforeVat` (xem "Track song song Trước VAT / Sau VAT").
- `GET /receivables/:id`: chi tiết, kèm danh sách `PaymentAllocation` (Payment History) lồng bên trong — mỗi dòng kèm `payment` (code/paymentDate/paymentMethod/...) và `allocatedTotal` (số tiền Payment đó cấn cho ĐÚNG đơn này, không phải tổng Payment). **Không có `GET /payments` độc lập ở V1**. Lý do: kế toán luôn tra cứu theo khách hàng/đơn hàng trước, không có nhu cầu xem toàn bộ Payment của hệ thống trên một màn hình. Nếu sau này cần báo cáo/đối soát cắt ngang theo ngày hoặc phương thức thanh toán, việc đó thuộc về Module Report (V2), không mở rộng ở đây.
- `GET /receivables/open-by-customer/:customerId`: danh sách Receivable còn nợ của 1 khách hàng, sort FIFO (`createdAt asc`) — phục vụ preview trước khi xác nhận `POST /payments/allocate` (023-cong-no-payment-allocation-fifo).

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
- Điều chỉnh giảm công nợ thủ công (Manual Adjustment) — vd doanh nghiệp quyết định giảm nợ sau khi nhận hàng hoàn (xem `return.md`): giảm `Receivable.totalAmount`, bắt buộc lý do + người thực hiện + ghi Timeline, theo đúng khuôn Manual Override (CLAUDE.md mục 5)
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
  - `cancel()` không chặn theo `Receivable.paidAmount` — nhưng phải trả về thông tin cọc đã thu để UI hiển thị cảnh báo xác nhận, và ghi `paidAmount` + refundNote vào Timeline payload
  - `deliver()` cần set thêm `Receivable.dueDate`
- Dashboard
- VAT Settlement (module mới, `vat-settlement.md`) — mở rộng schema `Receivable` (`closedWithoutVat`) và `Payment` (`vatSettlementId`), đọc action `closeReceivableWithoutVat()` của `DebtService`.

Không được thay đổi Business Rule hoặc Data Model của các Module trên ngoài phạm vi đã thống nhất ở đây.

Nếu cần thay đổi thêm phải dừng và xác nhận với người dùng.

---

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
