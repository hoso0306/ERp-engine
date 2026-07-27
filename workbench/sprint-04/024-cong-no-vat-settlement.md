# Milestone (Sprint 04) - Công nợ: VAT Settlement (xử lý VAT sau bán)

> **Tên file:** `workbench/sprint-04/024-cong-no-vat-settlement.md`
> **Trạng thái:** 🟡 Code + test xong (26/07/2026) — còn 2 việc chờ người dùng: (1) tự xem qua UI thật (chưa có công cụ browser trong môi trường này để tự verify), (2) migration `20260726040000_vat_settlement` mới chạy DB dev local, chưa áp dụng lên VPS production (gộp chung đợt với migration `20260726030000_payment_allocation_fifo` của Task 023 — cả 2 đang chờ cùng 1 lần deploy).

---

# Bối cảnh

Nghiệp vụ thực tế của xưởng có 2 chế độ thu tiền, **chọn ngay lúc thu, không phải đoán sau**:

- **Tiền mặt, không xuất hóa đơn** — khách trả xong, kế toán coi như **kết thúc nghiệp vụ** của đơn đó, không theo dõi phần VAT còn lại (không lưu "VAT tiềm năng").
- **Chuyển khoản, có hóa đơn** — dùng đúng luồng `Payment`/`PaymentAllocation` (Task 023), khách trả tới đâu tính tới đó, có thể trả hết cả VAT trong cùng vòng đời `Receivable` như bình thường.

Vấn đề: nếu khách đã đóng theo chế độ tiền mặt (đơn "đã xong"), sau đó (có thể vài tuần/tháng) quay lại yêu cầu xuất hóa đơn — hệ thống cần 1 cách xử lý phần VAT **mà không "hồi sinh"** `Receivable` đã đóng (nguyên tắc: một nghiệp vụ đã kết thúc thì không mở lại).

Thiết kế đã qua nhiều vòng thảo luận (25–26/07/2026, đề xuất ban đầu từ ChatGPT là "Invoice Order" — tạo hẳn 1 SalesOrder mới, bị bác bỏ vì rủi ro double-count doanh thu/sản lượng/lợi nhuận và đụng Production/Warehouse không cần thiết). Kết luận cuối: `VatSettlement` là **một chứng từ tài chính độc lập**, không phải một giao dịch bán hàng mới — người dùng đã **Xác nhận**.

---

# Phạm vi

## Trong phạm vi

- Schema: `VatSettlement`, `VatSettlementItem`, `VatSettlementTimeline` (bảng mới); `Payment.vatSettlementId` (nullable); `Receivable.closedWithoutVat` (boolean, mới); CHECK constraint ràng buộc Payment thuộc đúng 1 luồng.
- Backend: action **"Thu tiền mặt (không xuất hóa đơn)"** trên `Receivable`.
- Backend: tạo `VatSettlement` (chọn 1 hoặc nhiều `Receivable` đã `closedWithoutVat = true`, chưa thuộc settlement nào đang hoạt động).
- Backend: workflow `DRAFT → SENT → PAID → INVOICED`, ghi Timeline 2 nơi (`VatSettlementTimeline` + `SalesOrderTimeline` của từng đơn liên quan).
- Backend: khi `PAID` — tạo `Payment` (`vatSettlementId` set, `amount = totalAmount`, không qua `PaymentAllocation`), gán `VatSettlement.paymentId`.
- Backend: sinh PDF gửi khách (tái dùng pattern in ấn hiện có — `quotations/[id]/print`).
- API: `GET /customers/:id/eligible-for-vat-settlement` (danh sách Receivable đủ điều kiện); CRUD tối thiểu cho `VatSettlement` theo workflow trên.
- FE: 2 nút hành động rõ ràng trên `Receivable` detail — 🟢 "Thu tiền mặt (không xuất hóa đơn)" và 🔵 "Tạo VAT Settlement" (chỉ hiện khi có đơn đủ điều kiện); màn hình tạo/xem `VatSettlement` (chọn đơn, preview, gửi, đánh dấu thanh toán, nhập số hóa đơn); trang danh sách `VatSettlement` (gộp vào trang Công nợ dạng 1 tab, hoặc trang riêng — cần xác nhận vị trí).

## Ngoài phạm vi

- Tích hợp hóa đơn điện tử thật — V1 chỉ lưu `invoiceNumber`/`invoiceDate` do kế toán nhập tay sau khi xuất hóa đơn ngoài hệ thống.
- Thanh toán nhiều lần / một phần cho `VatSettlement` — **V1 khoá cứng: phải trả đủ 1 lần**. Nếu phát sinh nhu cầu thật mới mở rộng (đã chốt với người dùng — lý do: trường hợp hiếm, thêm PaymentAllocation/Partial/Dashboard cho case này tăng độ phức tạp không cần thiết ở V1).
- Reverse cho Payment của `VatSettlement` — không có trong V1 (khác `023`, nơi Reverse là yêu cầu chính).
- Sửa VAT ngay trên `SalesOrder` gốc (chỉ điều chỉnh, nếu cần, tại thời điểm tạo `VatSettlement`).

---

# Quyết định kỹ thuật (đã chốt với người dùng, 26/07/2026)

1. **Không tạo Sales Order mới / không có "Invoice Order"** — bác bỏ phương án ban đầu vì rủi ro double-count doanh thu/sản lượng/lợi nhuận trên Production/Warehouse/Report, và vì bản chất đây là 1 chứng từ tài chính, không phải giao dịch bán hàng.
2. **`Receivable.closedWithoutVat`** (boolean, default `false`) — set `true` khi dùng action "Thu tiền mặt (không xuất hóa đơn)". Dùng để: (a) lọc danh sách đơn đủ điều kiện tạo `VatSettlement`, (b) phân biệt "đóng vì đã trả đủ cả VAT" (đóng bình thường qua luồng thường) với "đóng vì chủ động bỏ qua phần VAT".
3. **Action "Thu tiền mặt (không xuất hóa đơn)"**: set `remainingAmount = 0`, `closedWithoutVat = true`, `paymentStatus = PAID` — **ngay lập tức**, dù `paidAmount` có thể mới bằng `totalAmountBeforeVat` (chưa bằng `totalAmount` có VAT). **Không cần nhập lý do** — đây là 1 nhánh workflow hợp lệ đã định nghĩa sẵn (kế toán chủ động chọn chế độ lúc thu tiền), không phải Manual Override/exception.
4. **1 Receivable chỉ được thuộc tối đa 1 `VatSettlement` đang hoạt động** (chưa `INVOICED`, chưa huỷ) tại một thời điểm — validate ở service khi tạo `VatSettlementItem`.
5. **`VatSettlement` không lưu `paidAmount`/`paidAt`/`paymentMethod` trực tiếp** — chỉ lưu `paymentId` (nullable), trỏ sang `Payment` khi đã thu. `Payment` là **nguồn sự thật duy nhất** về tiền — tránh 2 nơi cùng lưu trạng thái thanh toán (rủi ro lệch số liệu).
6. **`Payment` cho `VatSettlement` không đi qua `PaymentAllocation`/`Receivable`** — `Payment.vatSettlementId` set trực tiếp, **không** tạo `PaymentAllocation` nào, **không** đụng `remainingAmount` của `Receivable` đã đóng (không "hồi sinh" nghiệp vụ đã kết thúc). Một `Payment` chỉ thuộc **đúng 1** trong 2 luồng: có ít nhất 1 `PaymentAllocation` (luồng Receivable, Task 023) HOẶC có `vatSettlementId` (luồng VatSettlement) — validate ở Application trong cùng transaction tạo Payment (không cần CHECK constraint DB phức tạp vì quyết định ngay lúc tạo, không có rủi ro concurrency giữa 2 luồng này).
7. **`VatSettlementItem` chỉ lưu `receivableId`** (không lưu thêm `salesOrderId`) — vì `Receivable`–`SalesOrder` là 1–1 (`Receivable.salesOrderId @unique` đã có), ra `SalesOrder` chỉ cần join, tránh lưu trùng dữ liệu.
8. **`VatSettlementItem.amount`** = `receivable.totalAmount - receivable.totalAmountBeforeVat` tại thời điểm tạo — **snapshot**, không đổi sau đó dù `Receivable` (đã đóng, bất biến) có gì thay đổi (không thể, vì đã đóng).
9. **Workflow Action Driven**: `Tạo → DRAFT`, `Gửi khách → SENT`, `Ghi nhận thanh toán → PAID` (trigger tạo `Payment` theo mục 6), `Đánh dấu đã xuất hóa đơn → INVOICED` (nhập `invoiceNumber`/`invoiceDate`).
10. **Timeline ghi 2 nơi**: `VatSettlementTimeline` (lịch sử nội bộ đầy đủ: Created/Sent/Paid/Invoiced) **và** thêm 1 dòng vào `SalesOrderTimeline` của từng đơn liên quan (qua `VatSettlementItem`) ở các mốc quan trọng (tạo, thu tiền, xuất hóa đơn) — để mở đơn hàng gốc vẫn thấy dấu vết.
11. **UI**: 2 nút hành động rõ ràng thay "Ghi nhận thanh toán" chung chung — 🟢 "Thu tiền mặt (không xuất hóa đơn)" và 🔵 "Tạo VAT Settlement" — để kế toán hiểu ngay đang đi nhánh nào, không cần nhớ trạng thái nội bộ hệ thống.

---

# Việc 1 — Schema & Migration

- [x] `prisma/schema.prisma`: model `VatSettlement` (`id`, `code`, `customerId`, `status`, `paymentId?`, `invoiceNumber?`, `invoiceDate?`, `totalAmount`, `createdAt`, `updatedAt`), enum `VatSettlementStatus { DRAFT SENT PAID INVOICED }`.
- [x] Model `VatSettlementItem` (`id`, `vatSettlementId`, `receivableId`, `amount`).
- [x] Model `VatSettlementTimeline` (theo đúng khuôn `SalesOrderTimeline`: `id`, `vatSettlementId`, `action`, `actorType`, `payload`, `createdBy`, `createdByName`, `createdAt`).
- [x] `Payment`: thêm `vatSettlementId String? @unique @map(...)`; validate "đúng 1 trong 2 luồng" là **Application-only** (theo Quyết định #6) — Postgres CHECK constraint không tham chiếu được bảng `PaymentAllocation` khác, nên không khả thi ở mức DB.
- [x] `Receivable`: thêm `closedWithoutVat Boolean @default(false)`.
- [x] `RunningNumber`: thêm loại `VAT_SETTLEMENT` (prefix `VS`) — đã seed vào DB dev. Migration: `20260726040000_vat_settlement`, đã áp dụng DB dev local (`prisma migrate status` sạch), **chưa lên VPS production**.

# Việc 2 — Backend: action "Thu tiền mặt (không xuất hóa đơn)"

- [x] Method `DebtService.closeReceivableWithoutVat()`: set `remainingAmount = 0`, `remainingAmountBeforeVat` giữ nguyên giá trị hiện tại, `closedWithoutVat = true`, cập nhật `SalesOrder.paymentStatus = PAID`. Ghi `SalesOrderTimeline` (action `PAYMENT_STATUS_CHANGED`, payload `event: "CLOSED_WITHOUT_VAT"`).
- [x] Validate: chỉ áp dụng khi `SalesOrder.status != CANCELLED` và `Receivable` chưa `closedWithoutVat`. API: `POST /receivables/:id/close-without-vat`.

# Việc 3 — Backend: tạo `VatSettlement`

- [x] `GET /receivables/eligible-for-vat-settlement/:customerId` (đổi path so với đề xuất ban đầu `GET /customers/:id/eligible-for-vat-settlement` — giữ trong `ReceivableController`, cùng tiền lệ `open-by-customer` ở Task 023, không đụng `customer.controller.ts`): `Receivable` có `closedWithoutVat = true`, chưa thuộc `VatSettlement` active nào (`status != INVOICED`).
- [x] `POST /vat-settlements`: nhận `customerId`, `receivableIds[]`; tính `totalAmount` = SUM(`totalAmount - totalAmountBeforeVat` của từng receivable); tạo `VatSettlement` (`status = DRAFT`) + `VatSettlementItem[]`. Service riêng `VatSettlementService` (tách khỏi `DebtService`, cùng module `debt`).

# Việc 4 — Backend: workflow status

- [x] `POST /vat-settlements/:id/send` → `SENT`.
- [x] `POST /vat-settlements/:id/confirm-payment` → tạo `Payment` (Quyết định #6, dùng chung Running Number `PAYMENT`), set `paymentId`, `status = PAID`.
- [x] `POST /vat-settlements/:id/mark-invoiced` → nhận `invoiceNumber`/`invoiceDate`, `status = INVOICED`.
- [x] Mỗi bước: ghi `VatSettlementTimeline` + `SalesOrderTimeline` (action `VAT_SETTLEMENT_UPDATED`, payload phân biệt qua `event`) cho từng đơn liên quan.

# Việc 5 — Backend: sinh PDF

- [x] Trang in `vat-settlements/[id]/print` — tái dùng pattern `quotations/[id]/print/page.tsx` (in từ trình duyệt, không server-render), layout đơn giản hơn (không cần bảng tham số sản phẩm).

# Việc 6 — FE: 2 nút hành động trên Receivable detail

- [x] `debts/[id]/page.tsx`: nút 🟢 "Thu tiền mặt (không xuất hóa đơn)" (chỉ hiện khi `remainingAmount > 0` và chưa `closedWithoutVat`, dùng `ConfirmDialog` có sẵn — không cần lý do), nút 🔵 "Tạo VAT Settlement" (chỉ hiện khi `closedWithoutVat = true`, điều hướng sang `/vat-settlements/new?receivableId=...`).

# Việc 7 — FE: màn hình tạo/xem VatSettlement

- [x] `/vat-settlements/new`: đọc `?receivableId=` (vào từ Receivable detail) → xác định khách hàng → hiện toàn bộ danh sách đủ điều kiện của khách đó (checkbox, pre-check đúng đơn nguồn) → xác nhận → `POST /vat-settlements`. (Chưa làm entry point chọn-nhiều-đơn từ trang Khách hàng — Việc 6 chỉ yêu cầu entry trên Receivable detail, không đụng `customers/[id]/page.tsx`.)
- [x] `/vat-settlements/[id]`: hiển thị trạng thái (`VatSettlementStatusBadge`), danh sách đơn, nút hành động theo đúng workflow (Gửi khách/Ghi nhận thanh toán/Đánh dấu đã xuất hóa đơn — mỗi nút mở dialog nhập liệu tương ứng), Timeline, nút "In".
- [x] Vị trí trang danh sách `VatSettlement`: **gộp vào `/debts` dạng tab mới "VAT Settlement"** (`ReceivableFilter` mở rộng thêm tab, `debts/page.tsx` fetch/render riêng `VatSettlementTable` khi tab này active) — đã xác nhận 26/07/2026.

# Việc 8 — Test & Build

- [x] Test: action đóng không-VAT set đúng field (`debt.service.spec.ts`); tạo settlement tính đúng `totalAmount`; xác nhận thanh toán tạo đúng `Payment` (không đụng `Receivable`); chặn 1 đơn vào 2 settlement active; chặn `Receivable` chưa `closedWithoutVat` được chọn (`vat-settlement.service.spec.ts`, 8 test mới).
- [x] `tsc --noEmit` sạch cả api + web, `npx jest` 313/313 pass, `next build` thành công (route `/vat-settlements/new`, `/vat-settlements/[id]`, `/vat-settlements/[id]/print` build OK).

# Việc 9 — Cập nhật knowledge docs

- [x] `knowledge/modules/debt.md`: thêm mục "Thu tiền mặt không xuất hóa đơn" + field `closedWithoutVat` vào danh sách Receivable + link sang doc mới.
- [x] Tạo `knowledge/modules/vat-settlement.md` riêng — mô tả đầy đủ business flow, data model, workflow, validation, Business Rule, theo đúng khuôn các module khác.

# Việc 10 — Verify thực tế

- [x] **Không thể test qua trình duyệt** — môi trường không có công cụ điều khiển browser. Verify bằng script tạm (`scripts-tmp/verify-vat-settlement.ts`, đã xoá sau khi chạy xong — theo tiền lệ Task 023) gọi thẳng `DebtService`/`VatSettlementService` thật lên **DB dev thật**, dựng fixture riêng (1 Customer test + 2 SalesOrder/Receivable — không đụng dữ liệu demo có sẵn):
  - `closeReceivableWithoutVat`: đúng `remainingAmount = 0`, giữ nguyên `remainingAmountBeforeVat`, `closedWithoutVat = true`, `SalesOrder.paymentStatus = PAID`; chặn đóng lần 2.
  - `getEligibleReceivables`: chỉ đúng Receivable đã `closedWithoutVat`.
  - `create()`: tính đúng `totalAmount`/`VatSettlementItem.amount`; chặn Receivable chưa `closedWithoutVat`; chặn Receivable đã thuộc settlement active khác; cho phép lại sau khi settlement cũ đã `INVOICED`.
  - `send()`/`confirmPayment()`/`markInvoiced()`: đúng chuyển trạng thái DRAFT→SENT→PAID→INVOICED; `confirmPayment` tạo đúng 1 `Payment` với `vatSettlementId`, **không** tạo `PaymentAllocation`, **không** đụng `Receivable` (kể cả Receivable khác của cùng khách hàng — kiểm tra riêng, không bị ảnh hưởng).
  - Timeline: đúng 4 dòng `SalesOrderTimeline` (`VAT_SETTLEMENT_UPDATED`, đúng thứ tự CREATED/SENT/PAID/INVOICED) cho đơn liên quan; đơn khác cùng khách không nhận dòng nào.
  - **Lưu ý:** fixture để lại trong DB dev (Customer `KH000018` — đã soft-delete để không hiện trong danh sách khách hàng bình thường, SalesOrder `SO000012`/`SO000013`, VatSettlement `VS000001`, Payment `PT000009`) — giữ nguyên theo nguyên tắc append-only, không có API xoá cho các entity này.
- [ ] **Chưa xem bằng mắt trên UI thật** (`/debts` tab VAT Settlement, `/debts/[id]` 2 nút mới, `/vat-settlements/new`, `/vat-settlements/[id]`, `/vat-settlements/[id]/print`) — cần người dùng tự kiểm tra giao diện trước khi coi tính năng hoàn thiện 100%, đặc biệt 3 trang mới (chưa từng render thực tế, chỉ mới qua `tsc`/`next build`).

---

Sau khi hoàn thành hết Việc 1-10: báo cáo tổng kết (file đã sửa, kết quả test, commit message đề xuất, giới hạn nếu có) và dừng, chờ lệnh tiếp theo.
