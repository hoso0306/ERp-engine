# Milestone (Sprint 04) - Công nợ: Payment cấn nhiều đơn (FIFO) + Reverse Payment

> **Tên file:** `workbench/sprint-04/023-cong-no-payment-allocation-fifo.md`
> **Trạng thái:** 🟡 Code + test xong (26/07/2026) — còn 2 việc chờ người dùng trước khi coi là hoàn tất: (1) tự xem qua UI thật (chưa có công cụ browser trong môi trường này để tự verify), (2) áp dụng migration lên VPS production (chỉ mới chạy DB dev local). Chi tiết ở Việc 1/10/13. Vẫn phải làm **trước** `024-cong-no-vat-settlement.md` (Task 024 phụ thuộc `Payment.vatSettlementId` thêm ở đây).

---

# Bối cảnh

Kế toán xưởng có nhu cầu thực tế mà thiết kế Công nợ hiện tại (1 `Payment` chỉ cấn được đúng 1 `Receivable`) chưa đáp ứng:

- Một phiếu thu có thể cấn cho **nhiều đơn hàng cùng khách** cùng lúc (ví dụ khách chuyển 20.000.000, cấn lần lượt DH001/DH002/DH003/DH004).
- Mặc định ERP tự cấn theo **FIFO** (đơn cũ nhất trước), nhưng cho phép kế toán **sửa tay**.
- Cần **hoàn tác** một Payment tạo nhầm, mà không phá nguyên tắc append-only (`Payment` không sửa/xoá) đã chốt trong `debt.md`.

Thiết kế đã được thảo luận nhiều vòng (25–26/07/2026, có tham khảo đề xuất từ ChatGPT, Claude phản biện/bổ sung) và người dùng đã **Xác nhận** kiến trúc cuối. Task này tách riêng phần "cấn nhiều đơn + reverse" — không gộp với phần VAT Settlement (Task 024, nghiệp vụ độc lập, xem file riêng).

Việc `findAllReceivables()` thiếu lọc `CANCELLED` và before/after-VAT hiển thị song song trên tab Công nợ **đã xong** (25/07/2026, không thuộc task này).

---

# Phạm vi

## Trong phạm vi

- Schema: bảng `PaymentAllocation` mới; `Payment` bỏ quan hệ cố định 1-1 tới `receivableId`/`salesOrderId`; thêm `Payment.type` (`NORMAL`/`REVERSAL`) + `reversalOfPaymentId`.
- Backend: **Allocation Engine** (chọn ứng viên Receivable — theo id chỉ định hoặc FIFO tự động trong phạm vi 1 khách hàng; validate không vượt tổng công nợ; gọi Allocation Policy; ghi `PaymentAllocation`; update atomic `Receivable`; update `SalesOrder.paymentStatus`; ghi `SalesOrderTimeline` cho từng đơn bị ảnh hưởng).
- **Allocation Policy** (interface tách rời khỏi Engine) + `BeforeVatFirstPolicy` (implementation mặc định, giữ đúng hành vi hiện tại: trừ hết phần trước-VAT trước, dư mới trừ VAT).
- API: giữ `POST /payments` (luồng theo 1 đơn, đổi implementation nội bộ dùng Engine, không đổi request/response contract với FE); thêm `POST /payments/allocate` (luồng theo khách hàng — FIFO + cho sửa tay); `GET /customers/:id/open-receivables` (danh sách đơn còn nợ để preview FIFO); `POST /payments/:id/reverse` (Reverse Payment).
- `GET /receivables/:id`: đổi từ trả `payments: Payment[]` sang trả lịch sử cấn trừ qua `PaymentAllocation` (1 đơn giờ có thể chỉ nhận một phần của 1 Payment).
- FE: `PaymentDialog` hiện tại (luồng theo đơn) chỉnh nhỏ cho khớp response mới; màn hình mới cho luồng theo khách hàng (chọn khách → preview FIFO → sửa tay từng dòng nếu cần → xác nhận).
- Migration dữ liệu cũ: mỗi `Payment` hiện có (đang 1-1 với `receivableId`) → tạo đúng 1 `PaymentAllocation` tương ứng, giữ nguyên lịch sử, không mất dữ liệu.

## Ngoài phạm vi

- `VatSettlement` và mọi thứ liên quan xuất hóa đơn sau — **Task 024**.
- ~~UI thao tác Reverse Payment đầy đủ trên FE — **chỉ làm API ở task này**; UI (nút "Hoàn tác" trên lịch sử Payment) để task sau nếu cần, vì đây là thao tác hiếm, chưa rõ mức ưu tiên UI.~~ **Đã làm 26/07/2026** (ngoài task chính thức, theo yêu cầu trực tiếp của người dùng sau khi 023+024 xong) — xem `payment-table.tsx` (nút "Hoàn tác"), `debt.service.ts` (`RECEIVABLE_DETAIL_INCLUDE` thêm `payment.reversedBy`).
- Không đổi Concurrency Rule tổng thể — vẫn dựa vào atomic increment/decrement + CHECK `remaining_amount >= 0` đã có, không thêm cơ chế khoá mới (xem Quyết định kỹ thuật mục 10).

---

# Quyết định kỹ thuật (đã chốt với người dùng, 26/07/2026)

1. **`PaymentAllocation` gắn theo `Receivable`**, không phải `SalesOrder` trực tiếp — đúng ranh giới module đã có (`SalesOrder` không lưu số tiền công nợ). Vẫn giữ `salesOrderId` trên `PaymentAllocation` làm redundant reference (tiện query/Timeline), vì `Receivable`–`SalesOrder` là 1–1.
2. **`Payment` không giữ `receivableId`/`salesOrderId` cố định nữa** — mọi liên kết tới đơn hàng đi qua `PaymentAllocation`, kể cả trường hợp chỉ cấn đúng 1 đơn (vẫn tạo đúng 1 dòng `PaymentAllocation`). Lý do: `PaymentAllocation` hỗ trợ N đơn, một field đơn `receivableId` trên `Payment` không đủ diễn tả trường hợp đa đơn — tránh 2 cách biểu diễn cùng 1 thông tin.
3. **Append-only giữ nguyên** — `Payment`/`PaymentAllocation` không sửa, không xoá.
4. **Hoàn tác = Reverse Payment**: tạo `Payment` mới `type = REVERSAL`, `amount` **luôn dương** (không dùng số âm), `reversalOfPaymentId` trỏ về Payment gốc. Engine xử lý Reversal thì **cộng lại** (thay vì trừ) `paidAmount`/`remainingAmount`/`remainingAmountBeforeVat` trên từng `Receivable` bị ảnh hưởng, dựa theo đúng các `PaymentAllocation` của Payment gốc (đối xứng dấu ngược). Không cho reverse một Payment đã từng bị reverse (chặn double-reverse qua kiểm tra tồn tại `Payment` khác có `reversalOfPaymentId` trỏ tới nó).
5. **Giữ cả 2 luồng ghi nhận thanh toán**: theo từng đơn (entry point hiện tại `/debts/[id]`, Engine chạy với đúng 1 ứng viên) và theo khách hàng/FIFO (entry point mới).
6. **Mặc định FIFO tự động** (`ORDER BY Receivable.createdAt ASC` — `createdAt` = thời điểm `SalesOrder` được Approve, đã có sẵn), **cho phép kế toán sửa tay** từng dòng trước khi xác nhận.
7. **Không được thanh toán vượt tổng công nợ** — validate `amount <= SUM(remainingAmount)` của tập Receivable được chọn (chỉ tính `SalesOrder.status != CANCELLED`); nếu kế toán tự sửa từng dòng, `SUM(các dòng) phải == amount` và từng dòng `<= remainingAmount` của đúng đơn đó. Không có khái niệm "số dư chưa gắn đơn" ở V1.
8. **Trong 1 đơn, phân bổ theo `BeforeVatFirstPolicy`**: `allocatedSubtotal = min(allocatedTotal, max(receivable.remainingAmountBeforeVat, 0))`, `allocatedVat = allocatedTotal - allocatedSubtotal`. Đây là hành vi hiện tại của module (trừ đều remainingAmount và remainingAmountBeforeVat cùng số tiền), chỉ tường minh hoá thành 1 policy tách rời.
9. **Allocation Policy tách khỏi Allocation Engine** (interface `AllocationPolicy.split(receivable, allocatedTotal): { allocatedSubtotal, allocatedVat }`) — để sau này đổi chính sách khác (vd chia theo tỷ lệ subtotal:vat của đơn) chỉ cần viết class mới, không sửa Engine. Không làm chọn-policy-runtime-qua-UI (chưa có nhu cầu).
10. **Concurrency:** không thêm cơ chế khoá tường minh (`SELECT ... FOR UPDATE`) — dựa nguyên vào CHECK `remaining_amount >= 0` + atomic `increment`/`decrement` đã có. Nếu FIFO tính từ dữ liệu cũ do 2 giao dịch đồng thời hiếm khi xảy ra, `decrement` sẽ vi phạm CHECK ở đúng dòng lệch, toàn bộ `$transaction` rollback, kế toán thấy lỗi và tạo lại (FIFO tính lại theo state mới) — nhất quán với Concurrency Rule sẵn có trong `debt.md`, không cần thêm cơ chế mới.
11. **Timeline:** mỗi `PaymentAllocation` (kể cả của Reversal) → đúng 1 dòng `SalesOrderTimeline` (`PAYMENT_STATUS_CHANGED`) trên `SalesOrder` tương ứng, `amount = allocatedTotal` của dòng đó — **không phải** tổng `Payment.amount`.

---

# Việc 1 — Schema & Migration

- [x] `prisma/schema.prisma`: model `PaymentAllocation` (`id`, `paymentId`, `receivableId`, `salesOrderId`, `allocatedSubtotal`, `allocatedVat`, `allocatedTotal`, `createdAt`).
- [x] `Payment`: bỏ `salesOrderId`/`receivableId` bắt buộc (xoá field, thay bằng quan hệ ngược `allocations PaymentAllocation[]`); thêm `type PaymentType @default(NORMAL)`, `reversalOfPaymentId String? @unique` (1 Payment chỉ bị reverse đúng 1 lần), enum `PaymentType { NORMAL REVERSAL }`.
- [x] Migration data: **không cần script backfill** — DB dev có 0 dòng `Payment` tại thời điểm chạy migration (kiểm tra trực tiếp trước khi migrate), nên không có dữ liệu cũ nào cần chuyển đổi.
- [ ] **Chưa áp dụng lên VPS production** — migration (`20260726030000_payment_allocation_fifo`) mới chạy trên DB dev local. Cần xác nhận với người dùng + kiểm tra số dòng `payments` thật trên VPS trước khi `prisma migrate deploy` ở đó (theo nguyên tắc hành động khó đảo ngược — xem `vps_deployment_access` trong memory).

# Việc 2 — Allocation Policy

- [x] Interface `AllocationPolicy` + `BeforeVatFirstPolicy` (mục Quyết định #8).
- [x] Unit test riêng cho policy: các case `remainingAmountBeforeVat > allocatedTotal`, `= 0`, `< 0` (đã âm từ trước).

# Việc 3 — Allocation Engine

- [x] Method dùng chung cho cả 2 luồng: nhận `{ receivableIds hoặc customerId, amount, overrides? }`, chọn ứng viên (chỉ `định`), validate tổng, gọi Policy, ghi `PaymentAllocation` + update atomic `Receivable` + `SalesOrder.paymentStatus` + `SalesOrderTimeline`, trong 1 `$transaction`.
- [x] Method Reverse: nhận `paymentId` gốc, đọc các `PaymentAllocation` của nó, tạo Payment `REVERSAL` + `PaymentAllocation` đối xứng (cộng lại), chặn reverse-of-reverse.

# Việc 4 — API luồng theo 1 đơn (giữ contract `POST /payments`)

- [x] `payment.controller.ts`/`debt.service.ts`: đổi `createPayment()` sang gọi Allocation Engine với `receivableIds = [1 đơn]`. Response giữ nguyên hình dạng cũ nếu FE hiện tại phụ thuộc (kiểm tra `PaymentDialog`/`ReceivableDetailPage`).

# Việc 5 — API luồng theo khách hàng (FIFO)

- [x] `GET /receivables/open-by-customer/:customerId` (đổi path so với đề xuất ban đầu `GET /customers/:id/open-receivables` — giữ trong `ReceivableController` cho đúng module ownership, không đụng `customer.controller.ts`): danh sách Receivable còn nợ, `status != CANCELLED`, sort FIFO. Không nhận `amount` query — preview cách cấn tính phía FE (client-side FIFO, cùng thuật toán BE, giống pattern `computeDaysOverdue`/`computeRiskLevel` đã duplicate BE/FE trước đó).
- [x] `POST /payments/allocate`: nhận `customerId`, `amount`, `allocations?: {receivableId, amount}[]` (override tay) — nếu không truyền `allocations`, Engine tự tính FIFO.

# Việc 6 — Reverse Payment API

- [x] `POST /payments/:id/reverse`.
- [x] Validate: Payment tồn tại, chưa từng bị reverse.

# Việc 7 — `GET /receivables/:id` trả lịch sử cấn trừ

- [x] Đổi từ `payments: Payment[]` sang `allocations: PaymentAllocation[]` (join `Payment` để lấy `code`/`paymentDate`/`paymentMethod`/`type`).
- [x] `PaymentTable` (FE) cập nhật theo shape mới.

# Việc 8 — FE: luồng theo 1 đơn

- [x] `PaymentDialog`, `debts/[id]/page.tsx`: cập nhật theo response mới của Việc 7, không đổi UX.

# Việc 9 — FE: luồng theo khách hàng

- [x] Component mới (`allocate-payment-dialog.tsx`): chọn khách hàng (tái dùng `CustomerTypeahead` có sẵn) → gọi `GET /receivables/open-by-customer/:customerId` → bảng preview FIFO tính phía FE (sửa tay được) → xác nhận → `POST /payments/allocate`.
- [x] Entry point: đặt ở **cả trang Công nợ (`/debts`) và trang Khách hàng (`customers/[id]`)** — đã xác nhận 26/07/2026.

# Việc 10 — Migration dữ liệu cũ

- [x] DB dev: xác nhận 0 dòng `Payment` trước khi migrate — không có dữ liệu cũ cần chuyển, migration chỉ là thay đổi schema thuần tuý (đã áp dụng, `prisma migrate status` sạch).
- [ ] **VPS production:** chưa chạy. Cần kiểm tra số dòng `payments` thật trên đó trước — nếu > 0, phải viết + verify script backfill trước khi `migrate deploy` (khác dev, không thể bỏ qua bước này).

# Việc 11 — Test & Build

- [x] Test Allocation Engine: FIFO đúng thứ tự, override tay, chặn vượt tổng công nợ, atomic/CHECK constraint vẫn chặn âm.
- [x] Test Reverse: cộng lại đúng, chặn double-reverse.
- [x] `tsc --noEmit` sạch cả api + web, `npx jest` toàn bộ suite pass, `next build` thành công.

# Việc 12 — Cập nhật `knowledge/modules/debt.md`

- [x] Mục `PaymentAllocation`, `Allocation Policy`, luồng FIFO, Reverse Payment — thay thế phần mô tả Payment 1-1 Receivable hiện tại.

# Việc 13 — Verify thực tế

- [x] **Không thể test qua trình duyệt** — môi trường không có công cụ điều khiển browser (không có Playwright/tương tự khả dụng). Thay vào đó, verify bằng script tạm (`scripts-tmp/verify-payment-allocation.ts`, đã xoá sau khi chạy xong — theo tiền lệ milestone 006/022) gọi thẳng `DebtService` thật lên **DB dev thật** (không mock), dùng đúng dữ liệu đã seed (khách hàng có 3 Receivable còn mở + 1 `CANCELLED`):
  - `getOpenReceivablesForCustomer`: đúng loại bỏ đơn `CANCELLED`.
  - `createAllocatedPayment` FIFO 600.000: cấn hết SO000001 (499.192, tách đúng `allocatedSubtotal=462.215`/`allocatedVat=36.977`) rồi tràn sang SO000003 (100.808, toàn bộ vào subtotal) — đúng thứ tự FIFO + đúng `BeforeVatFirstPolicy`.
  - `paymentStatus` cập nhật đúng (SO000001→PAID, SO000003→PARTIALLY_PAID).
  - Ghi đúng 2 dòng `SalesOrderTimeline` (1 dòng/đơn), `amount` = đúng `allocatedTotal` từng đơn, không phải tổng Payment.
  - `reversePayment`: cộng lại **khớp 100%** với state gốc trên cả 4 Receivable (kể cả 2 đơn không liên quan).
  - Chặn double-reverse và chặn thanh toán vượt tổng công nợ (13.775.109 — đúng bằng tổng 3 đơn còn mở, loại đơn CANCELLED) — cả hai đúng như thiết kế.
  - **Lưu ý:** 2 dòng `Payment` (PT000007 thật + PT000008 hoàn tác) còn lại trong DB dev sau khi verify — giữ nguyên theo đúng nguyên tắc append-only, không xoá; tác động ròng lên số liệu = 0 vì đã hoàn tác đầy đủ.
- [ ] **Chưa xem bằng mắt trên UI thật** (`/debts`, `/debts/[id]`, `customers/[id]`) — cần người dùng tự kiểm tra giao diện trước khi coi tính năng hoàn thiện 100%, đặc biệt màn hình mới `AllocatePaymentDialog` (chưa từng render thực tế, chỉ mới qua `tsc`/`eslint`/`next build`).

---

Sau khi hoàn thành hết Việc 1-13: báo cáo tổng kết (file đã sửa, kết quả test, commit message đề xuất, giới hạn nếu có) và dừng, chờ lệnh tiếp theo — không tự ý làm Task 024.
