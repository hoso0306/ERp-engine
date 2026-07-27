# Module VAT Settlement (xử lý VAT sau bán)

> **Tên file:** `knowledge/modules/vat-settlement.md`

---

# Mục đích

Xử lý phần VAT còn lại của những công nợ mà khách hàng đã trả theo chế độ **"tiền mặt, không xuất hóa đơn"**, nhưng sau đó (có thể vài tuần/tháng) quay lại yêu cầu xuất hóa đơn.

Module này chịu trách nhiệm:

- Ghi nhận việc "đóng" một Receivable theo chế độ tiền mặt không xuất hóa đơn.
- Gom nhiều Receivable đã đóng như vậy (cùng khách hàng) vào một chứng từ VAT Settlement.
- Theo dõi workflow Gửi khách → Ghi nhận thanh toán → Đánh dấu đã xuất hóa đơn.
- Ghi Timeline ở cả VAT Settlement lẫn từng Sales Order liên quan.

Không chịu trách nhiệm:

- Tích hợp hóa đơn điện tử thật (V1 chỉ lưu `invoiceNumber`/`invoiceDate` nhập tay).
- Refund/hoàn tiền.
- Sổ cái, hạch toán kế toán tổng hợp.

---

# Vai trò trong ERP

VAT Settlement là **một chứng từ tài chính độc lập, không phải một giao dịch bán hàng mới**.

Phương án ban đầu ("Invoice Order" — tạo hẳn một Sales Order mới cho phần VAT) đã bị bác bỏ vì rủi ro double-count doanh thu/sản lượng/lợi nhuận trên Production/Warehouse/Report, và vì bản chất nghiệp vụ này không phải một lần bán hàng mới.

---

# Bối cảnh nghiệp vụ

Xưởng có 2 chế độ thu tiền, **chọn ngay lúc thu, không phải đoán sau**:

```text
Tiền mặt, không xuất hóa đơn
    → khách trả xong, kế toán coi nghiệp vụ của đơn đó đã KẾT THÚC
    → không theo dõi phần VAT còn lại

Chuyển khoản, có hóa đơn
    → dùng đúng luồng Payment/PaymentAllocation (Module Debt)
    → khách trả tới đâu tính tới đó, có thể trả hết cả VAT trong cùng vòng đời Receivable
```

Nếu khách đã đóng theo chế độ tiền mặt, sau đó quay lại xin hóa đơn, ERP cần một cách xử lý phần VAT **mà không "hồi sinh"** Receivable đã đóng — một nghiệp vụ đã kết thúc thì không mở lại (nguyên tắc chung của hệ thống).

---

# Business Flow

```text
Receivable (đang mở, thuộc Module Debt)
        ↓ Action "Đóng công nợ (không xuất hóa đơn)"
Receivable.remainingAmount = 0, closedWithoutVat = true
SalesOrder.paymentStatus = PAID
        ↓ (có thể vài tuần/tháng sau — khách quay lại xin hóa đơn)
Action "Tạo VAT Settlement" — chọn 1 hoặc nhiều Receivable đã closedWithoutVat, cùng khách hàng
        ↓
VatSettlement (DRAFT) + VatSettlementItem (snapshot amount = phần VAT từng đơn)
        ↓ Gửi khách
VatSettlement (SENT)
        ↓ Ghi nhận thanh toán
VatSettlement (PAID) — tạo đúng 1 Payment, vatSettlementId set trực tiếp
        ↓ Đánh dấu đã xuất hóa đơn (nhập invoiceNumber/invoiceDate)
VatSettlement (INVOICED)
```

---

# Action "Đóng công nợ (không xuất hóa đơn)"

Thuộc Module Debt (`DebtService.closeReceivableWithoutVat()`), vì đây là thao tác trên chính `Receivable` — không đợi có VAT Settlement mới cần action này.

```http
POST /receivables/:id/close-without-vat
```

Hiệu ứng, **ngay lập tức**:

```text
Receivable.remainingAmount        = 0
Receivable.remainingAmountBeforeVat = giữ nguyên (KHÔNG reset — dùng để tính VatSettlementItem.amount sau này)
Receivable.closedWithoutVat        = true
SalesOrder.paymentStatus           = PAID
```

**`remainingAmount` = 0 dù `paidAmount` có thể mới bằng `totalAmountBeforeVat` (chưa bằng `totalAmount` có VAT)** — đây là một override có chủ đích, khác với công thức Derived Data thông thường `remainingAmount = totalAmount - paidAmount` (xem `debt.md`). Kế toán chủ động quyết định bỏ qua phần chênh lệch VAT, không phải lỗi tính toán.

**Không cần nhập lý do** — đây là một nhánh workflow hợp lệ đã định nghĩa sẵn (kế toán chủ động chọn chế độ lúc thu tiền), không phải Manual Override.

Validate:

- `SalesOrder.status != CANCELLED`.
- `Receivable.closedWithoutVat` chưa `true` (không đóng 2 lần).
- **`Receivable.remainingAmountBeforeVat <= 0`** (rà soát mô hình công nợ, chốt 27/07/2026) — chỉ cho đóng khi khách đã trả ĐỦ phần gốc trước-VAT. Không có validate này, kế toán có thể bấm đóng khi còn nợ gốc dở dang: `remainingAmount` (sau VAT) bị set về 0 ngay dù khách còn nợ tiền thật (không chỉ riêng VAT), khiến khách đó biến mất khỏi mọi nơi tính công nợ (Dashboard, danh sách, theo khách hàng — tất cả đều lấy `remainingAmount` làm nguồn sự thật duy nhất). Nếu còn nợ gốc, phải thu tiếp qua Payment bình thường (`POST /payments`/`POST /payments/allocate`) trước, không dùng action này để "tất toán" nợ gốc dở dang.

Ghi `SalesOrderTimeline` (action `PAYMENT_STATUS_CHANGED`, tái sử dụng — payload có `event: "CLOSED_WITHOUT_VAT"`).

---

# Dữ liệu quản lý

## VatSettlement

```text
code
customerId          // redundant reference, cùng convention Receivable.customerId
status              // DRAFT | SENT | PAID | INVOICED
paymentId           // set khi đã ghi nhận thanh toán, trỏ sang Payment
invoiceNumber        // nhập tay sau khi xuất hóa đơn ngoài hệ thống
invoiceDate
totalAmount          // = SUM(VatSettlementItem.amount)
createdAt
updatedAt
```

**Không lưu `paidAmount`/`paidAt`/`paymentMethod` trực tiếp** — chỉ lưu `paymentId`, trỏ sang `Payment` khi đã thu. `Payment` là **nguồn sự thật duy nhất** về tiền, tránh 2 nơi cùng lưu trạng thái thanh toán.

## VatSettlementItem

```text
vatSettlementId
receivableId          // KHÔNG lưu thêm salesOrderId — Receivable–SalesOrder là 1-1, join thẳng khi cần
amount                 // snapshot = receivable.totalAmount - receivable.totalAmountBeforeVat, tại thời điểm tạo
createdAt
```

**`amount` là Snapshot, không đổi sau đó** — dù `Receivable` liên quan (đã đóng, bất biến) có gì thay đổi (không thể xảy ra, vì đã đóng).

**Một Receivable chỉ thuộc tối đa 1 VatSettlement đang hoạt động** (chưa `INVOICED`) tại một thời điểm — validate ở Application khi tạo (`VatSettlementService.create()`), không phải CHECK constraint DB (Prisma CHECK không tham chiếu được bảng khác).

## VatSettlementTimeline

Theo đúng khuôn `SalesOrderTimeline`: `id`, `vatSettlementId`, `action` (`VAT_SETTLEMENT_CREATED`/`SENT`/`PAID`/`INVOICED`/`CANCELLED`), `actorType`, `payload`, `createdBy`, `createdByName`, `createdAt`.

## Payment (mở rộng)

`Payment.vatSettlementId` (nullable) — set khi Payment này được tạo cho một VAT Settlement (action "Ghi nhận thanh toán").

**Một Payment chỉ thuộc đúng 1 trong 2 luồng:**

```text
có PaymentAllocation (luồng Receivable thông thường, xem debt.md)
        HOẶC
có vatSettlementId (luồng VAT Settlement)
```

Validate ở Application, trong cùng transaction tạo Payment — không CHECK constraint DB phức tạp (không có rủi ro concurrency giữa 2 luồng vì quyết định ngay lúc tạo, chỉ 1 nơi trong code tạo Payment cho VAT Settlement).

**Payment của VAT Settlement KHÔNG tạo `PaymentAllocation`, KHÔNG đụng `Receivable`** (không "hồi sinh" nghiệp vụ đã đóng bằng `closedWithoutVat`) — Engine cấn trừ thông thường (`DebtService`) hoàn toàn không được gọi ở luồng này.

---

# Workflow

Một chiều `DRAFT → SENT → PAID → INVOICED`, mỗi bước là 1 Action:

```http
POST /vat-settlements                       # Tạo (DRAFT)
POST /vat-settlements/:id/send              # Gửi khách → SENT
POST /vat-settlements/:id/confirm-payment   # Ghi nhận thanh toán → PAID (tạo Payment)
POST /vat-settlements/:id/mark-invoiced     # Đánh dấu đã xuất hóa đơn → INVOICED
POST /vat-settlements/:id/cancel            # Huỷ (chỉ khi DRAFT) → CANCELLED
```

**V1 khóa cứng: phải trả đủ 1 lần** — không có thanh toán nhiều lần/một phần cho VatSettlement (khác Module Debt, nơi FIFO đa đơn là yêu cầu chính). Lý do: trường hợp hiếm, thêm PaymentAllocation/Partial/Dashboard cho case này tăng độ phức tạp không cần thiết ở V1 — mở rộng sau nếu phát sinh nhu cầu thật.

**Không có Reverse cho Payment của VatSettlement ở V1** (khác `Payment` thường, nơi Reverse Payment là yêu cầu chính — xem `debt.md`).

**`CANCELLED` (bổ sung 26/07/2026, theo rà soát mô hình công nợ)** — huỷ khi tạo nhầm (sai khách/sai đơn) trước khi gửi khách. Chỉ cho phép từ `DRAFT` (chưa gửi khách, chưa có `Payment` nào gắn vào) nên an toàn tuyệt đối, không đụng gì downstream. Giữ bản ghi lại (đổi `status`, không xoá) — Receivable nguồn tự động "nhả ra" khỏi `getEligibleReceivables()` (CANCELLED nằm trong nhóm trạng thái không còn "đang hoạt động", cùng với `INVOICED`), có thể đưa vào một VatSettlement mới. Không cho huỷ khi đã `SENT`/`PAID`/`INVOICED`.

Mỗi bước ghi Timeline **2 nơi**:

```text
VatSettlementTimeline           (lịch sử nội bộ đầy đủ)
        +
SalesOrderTimeline (action VAT_SETTLEMENT_UPDATED, payload.event phân biệt CREATED/SENT/PAID/INVOICED/CANCELLED)
        của TỪNG SalesOrder liên quan (qua VatSettlementItem → Receivable → SalesOrder)
```

Để mở đơn hàng gốc vẫn thấy dấu vết — không tách 4 `SalesOrderTimelineAction` riêng, dùng chung 1 action, phân biệt qua `payload.event` (cùng cách `PAYMENT_STATUS_CHANGED` dùng chung 1 action cho nhiều tình huống).

---

# Danh sách đủ điều kiện

```http
GET /receivables/eligible-for-vat-settlement/:customerId
```

Trả về `Receivable` của 1 khách hàng: `closedWithoutVat = true`, `SalesOrder.status != CANCELLED`, chưa thuộc `VatSettlement` nào đang hoạt động (`status != INVOICED`).

Đặt trong `ReceivableController` (không phải `CustomerController`/`VatSettlementController`) — cùng tiền lệ `GET /receivables/open-by-customer/:customerId` (023-cong-no-payment-allocation-fifo): giữ đúng module ownership, không đụng `customer.controller.ts`.

---

# Read API

```http
GET /vat-settlements                # danh sách, filter customerId/status, pagination
GET /vat-settlements/:id            # chi tiết — kèm items (join Receivable/SalesOrder), payment, timeline
```

Không có Update/Delete API — chỉ tạo mới và chuyển trạng thái qua các Action ở trên.

---

# In ấn

```http
/vat-settlements/:id/print
```

Tái dùng pattern "in từ trình duyệt" của `quotations/:id/print` (không dùng service PDF-generation server-side). Đây là chứng từ nội bộ theo dõi phần VAT thu sau — layout đơn giản hơn Báo giá/Xác nhận đơn hàng (không cần đầy đủ bảng tham số sản phẩm).

---

# Business Rule

- VatSettlement là 1 chứng từ tài chính độc lập, không phải giao dịch bán hàng mới — không tạo SalesOrder mới.
- `Receivable.closedWithoutVat` chỉ set qua action "Đóng công nợ (không xuất hóa đơn)", không tự động.
- Action đóng không-VAT set `remainingAmount = 0` ngay lập tức, giữ nguyên `remainingAmountBeforeVat`, set `paymentStatus = PAID` — không cần lý do.
- **Chỉ cho đóng khi `remainingAmountBeforeVat <= 0`** (rà soát mô hình công nợ, chốt 27/07/2026) — đã thu đủ phần gốc trước-VAT. Nếu còn nợ gốc dở dang, chặn và báo lỗi, bắt phải thu tiếp qua Payment bình thường trước.
- **Có thể hoàn tác action đóng không-VAT** (`reopenReceivableClosedWithoutVat()`, bổ sung 26/07/2026) — đối xứng, cũng không cần lý do (undo của action bình thường, không phải Manual Override). Khôi phục `remainingAmount = totalAmount - paidAmount`, `paymentStatus` tính lại từ `computePaymentStatus()`. Chặn nếu Receivable đã thuộc 1 VatSettlement **chưa CANCELLED** (đã có chứng từ tài chính khác phụ thuộc vào trạng thái "đã đóng" này).
- Một Receivable chỉ thuộc tối đa 1 VatSettlement đang hoạt động (chưa `INVOICED` và chưa `CANCELLED`) tại một thời điểm.
- VatSettlementItem.amount là snapshot tại thời điểm tạo, không đổi sau đó.
- VatSettlement không lưu paidAmount/paidAt/paymentMethod — chỉ lưu paymentId, Payment là nguồn sự thật duy nhất.
- Payment của VatSettlement không tạo PaymentAllocation, không đụng Receivable.
- Một Payment chỉ thuộc đúng 1 trong 2 luồng: có PaymentAllocation HOẶC có vatSettlementId — validate Application, trong cùng transaction tạo Payment.
- Workflow một chiều DRAFT → SENT → PAID → INVOICED, không có bước lùi giữa các trạng thái này. **Ngoại lệ:** DRAFT có thể chuyển sang CANCELLED (huỷ) — không tính là "bước lùi" vì CANCELLED là trạng thái kết thúc riêng, không quay lại được DRAFT/SENT/PAID/INVOICED từ đó.
- V1: trả đủ 1 lần, không Reverse cho Payment của VatSettlement. Có action Huỷ nhưng chỉ từ DRAFT.
- Mỗi mốc quan trọng (kể cả Huỷ) ghi VatSettlementTimeline + SalesOrderTimeline (action VAT_SETTLEMENT_UPDATED) cho từng đơn liên quan.

---

# Module Dependencies

## Phụ thuộc

- Debt (`Receivable.closedWithoutVat`, `Payment.vatSettlementId`, action `closeReceivableWithoutVat()`) — 2 field/method này thuộc `DebtService`/schema chung, VAT Settlement chỉ đọc/dùng, không sở hữu.
- Customer (đọc `customerId` — redundant reference, không @relation).

## Module bị ảnh hưởng

- Sales Order: nhận thêm `SalesOrderTimelineAction.VAT_SETTLEMENT_UPDATED`.
- Debt: schema `Receivable`/`Payment` mở rộng thêm field (xem `debt.md`).

Không được thay đổi Business Rule hoặc Data Model của Module Debt ngoài phạm vi đã thống nhất ở đây.

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
