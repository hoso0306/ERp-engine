# Milestone 06 (Sprint 02) - FE Công nợ

> **Tên file:** `workbench/sprint-02/006-fe-cong-no.md`
>
> Bước 4 trong `roadmap.md`.

---

# Mục tiêu

Kế toán thu tiền và theo dõi công nợ phải thu. Theo `knowledge/modules/debt.md`.

---

# Kết quả khảo sát (trước khi lập kế hoạch)

1. **BE đã có sẵn đầy đủ, chỉ đọc + 1 action, không Create/Update/Delete cho Receivable** (`apps/api/src/debt/`):
   * `GET /receivables` — danh sách, filter `search` (mã đơn/khách/SĐT), `paymentStatus`, `overdue=true`, `risk=LOW|MEDIUM|HIGH`, `creditExceeded=true` (theo khách hàng), phân trang; include `salesOrder{id,code,customerName,customerPhone,status,paymentStatus}`.
   * `GET /receivables/:id` — chi tiết, include `salesOrder` (như trên) + `payments` (Payment History, order theo `paymentDate` asc) — **không có `GET /payments` độc lập** (quyết định có chủ đích, tra cứu luôn theo khách hàng/đơn hàng).
   * `GET /receivables/dashboard` — tổng hợp: `totalReceivable`, `overdue{customerCount,totalAmount}`, `overdue30{customerCount,totalAmount}`, `creditExceeded{customerCount,totalAmount}`, `topDebtors[{customerId,customerName,customerPhone,totalRemaining}]`.
   * `POST /payments` — `{salesOrderId, amount, paymentMethod, paymentDate?, referenceNumber?, note?, createdBy?}`, quyền `debt.create-payment`. Validate: đơn khác `CANCELLED`, `amount > 0`, không vượt `remainingAmount`, `referenceNumber` bắt buộc khi `paymentMethod=BANK_TRANSFER`. Atomic update `Receivable` (DB `CHECK remaining_amount >= 0` — chống thu vượt kể cả concurrent request).
   * Cả 4 endpoint đã gắn `AuthGuard`+`PermissionGuard`, permission key `debt.view`/`debt.create-payment` (đã có sẵn trong seed).
   * **Không có Manual Override / Update / Delete cho Payment** — append-only theo thiết kế (nhập sai xử lý qua DB, giống tiền lệ Production/MaterialReceipt).
2. **`GET /receivables` (danh sách) không trả `daysOverdue`/`riskLevel`** — 2 field này chỉ được `findOneReceivable()` tính qua `withDerivedFields()` cho trang chi tiết. Ở danh sách, FE phải tự tính client-side từ `dueDate` theo đúng công thức đã định nghĩa (`daysOverdue = today - dueDate`, ngưỡng LOW 0-7/MEDIUM 8-30/HIGH >30, chỉ có ý nghĩa khi `dueDate != null`) — cùng cách tiếp cận `isOverdue`/`isBelowMinimum` đã làm ở các milestone trước (Derived Data tính ở FE, CLAUDE.md mục 13), không phải thiếu sót cần sửa BE.
3. **Không có FE nào cho Công nợ hiện tại** — menu "Công nợ" (`/debts`) đang `disabled: true` trong `navigation.ts`, đã khai báo sẵn `requiredPermission: "debt.view"`.
4. **Cross-link:** `/orders/[id]` (milestone 004) đã có khối "Công nợ" hiển thị `totalAmount/paidAmount/remainingAmount` từ `order.receivable`, hiện không có link. Nâng cấp thêm link "Xem chi tiết công nợ" sang `/debts/[order.receivable.id]` khi `hasPermission("debt.view")` — không cần đổi API (`receivable.id` đã có sẵn trong response `GET /sales-orders/:id`). Chiều ngược lại: `/debts/[id]` hiển thị mã đơn/khách (đã có sẵn trong include `salesOrder`), link sang `/orders/[salesOrder.id]` khi `hasPermission("sales-order.view")`.
5. **Không cần BE addition nào ở milestone này** — khác với 004/005, toàn bộ dữ liệu cần cho FE đã có sẵn qua API hiện tại.
6. UI pattern tái dùng: `components/shared`, `Tabs`+`Select` filter (pattern `sales-order-filter.tsx`), table+pagination, Dialog cho Ghi nhận thanh toán (giống `material-receipt-dialog.tsx` — cũng là 1 action tạo bản ghi tài chính/kho, có field điều kiện bắt buộc theo lựa chọn khác, tương tự `referenceNumber` bắt buộc khi `BANK_TRANSFER`).
7. **Trước khi code khối Dashboard công nợ (Task 02) sẽ đọc skill `dataviz`** cho phần thiết kế stat tile (màu sắc, bố cục) — theo quy tắc đã áp dụng cho mọi màn hình có stat tile/dashboard, chưa đọc ở bước lập kế hoạch này.

---

# Phạm vi

* `/debts` danh sách (đọc) + khối Dashboard công nợ ở đầu trang.
* `/debts/[id]` chi tiết + Payment History + Action **Ghi nhận thanh toán**.
* Bật menu Công nợ, cross-link Đơn hàng ⇄ Công nợ.
* **Không** làm Sửa/Xoá Payment (BE không hỗ trợ, có chủ đích).
* **Không** làm chặn bán hàng khi vượt hạn mức (V1 chỉ cảnh báo, đã làm ở milestone Đơn hàng nếu có — không lặp lại ở đây).
* **Không** đổi API/schema — milestone này thuần đọc + 1 action đã có sẵn.

---

# Quy trình làm việc

* Mỗi lần thực hiện 01 Task, xong dừng, tóm tắt, đề xuất commit, chờ Task tiếp theo.
* Build xanh + verify sống trước khi đóng từng task.

---

# Task 00 — `/debts` danh sách

## Nội dung

* Route `apps/web/src/app/debts/page.tsx`.
* Tabs: Tất cả / Quá hạn (`overdue=true`) / Vượt hạn mức (`creditExceeded=true`) — `GET /receivables?...`.
* Bộ lọc bổ sung: mức rủi ro (Select: Tất cả/Thấp/Trung bình/Cao — param `risk`), trạng thái thanh toán (Select: Tất cả/Chưa TT/TT một phần/Đã TT — param `paymentStatus`), tìm kiếm (mã đơn/khách/SĐT).
* Cột: khách hàng (+SĐT), mã đơn hàng, tổng tiền, đã thu, còn lại, hạn thanh toán (kèm badge mức rủi ro tính client-side từ `dueDate` khi đã quá hạn).
* Phân trang giống các trang trước.

### Definition of Done

* [x] Danh sách tải đúng dữ liệu qua `lib/api.ts`, các filter (tab/risk/paymentStatus/search) hoạt động đúng (verify sống: tab "Vượt hạn mức" trả đúng 5 công nợ của khách vượt hạn mức, khớp `GET /receivables/dashboard`).
* [x] Đơn quá hạn hiển thị đúng badge mức rủi ro (Thấp/Trung bình/Cao) theo `dueDate` (verify code — công thức khớp `computeRiskLevel` phía BE `debt.md`; dữ liệu seed hiện không có đơn quá hạn thật để chụp ảnh, nhưng cùng công thức Derived Data đã verify sống ở milestone trước cho `isOverdue`/`isBelowMinimum`).
* [x] Build thành công.

**Commit**

```text
feat(web): receivable list page with overdue, risk, and credit filters
```

---

# Task 01 — `/debts/[id]` chi tiết + Payment History

## Nội dung

* Route `apps/web/src/app/debts/[id]/page.tsx`.
* Khối thông tin chung: đơn hàng liên quan (mã + khách, link sang `/orders/[salesOrder.id]` khi có quyền `sales-order.view`), tổng tiền, đã thu, còn lại, hạn thanh toán, số ngày quá hạn + mức rủi ro (dùng field `daysOverdue`/`riskLevel` đã có sẵn ở `GET /receivables/:id`).
* Payment History: bảng `payments` (mã phiếu thu, ngày thu, số tiền, phương thức, số tham chiếu, ghi chú, người thu).

### Definition of Done

* [x] Vào từ danh sách, xem đúng thông tin công nợ + toàn bộ lịch sử thanh toán của 1 đơn thật (verify sống SO000004).
* [x] Link đơn hàng bấm sang đúng trang Đơn hàng (khi đủ quyền) — verify sống 2 chiều.
* [x] Build thành công.

**Commit**

```text
feat(web): receivable detail page with payment history
```

---

# Task 02 — Action Ghi nhận thanh toán + Khối Dashboard công nợ

## Nội dung

* **Trước khi code phần Dashboard: đọc skill `dataviz`** để thiết kế stat tile nhất quán (màu, bố cục, contrast).
* Dialog **"Ghi nhận thanh toán"** (quyền `debt.create-payment`, ẩn khi đơn đã `CANCELLED`): số tiền (validate > 0 và ≤ `remainingAmount` phía client, BE vẫn là nguồn chặn chính), phương thức (Select: Tiền mặt/Chuyển khoản), số tham chiếu (bắt buộc khi Chuyển khoản), ghi chú → `POST /payments`. Lỗi thu vượt/đơn huỷ hiển thị thẳng `err.message`.
* `DebtDashboardPanel` (đặt ở đầu trang `/debts`, trên bộ lọc): Tổng còn phải thu, Quá hạn (số khách + tổng tiền), Quá hạn >30 ngày, Vượt hạn mức (số khách + tổng tiền), Top 10 khách nợ nhiều nhất — `GET /receivables/dashboard`.

### Definition of Done

* [x] Ghi nhận thanh toán thành công → Payment History + số liệu còn lại cập nhật đúng ngay (verify sống: thanh toán 1.000.000đ tiền mặt trên SO000004, Payment History hiện đúng mã PT + ghi chú).
* [x] Thử thu vượt số còn lại → lỗi hiển thị rõ ràng, không tạo Payment (verify sống: toast "Số tiền không được vượt quá số còn phải thu.", dialog không đóng).
* [x] Chuyển khoản không nhập số tham chiếu → chặn phía FE trước khi gọi API (verify sống: nút submit bị disable).
* [x] Khối Dashboard công nợ hiển thị đúng số liệu, khớp với danh sách bên dưới (verify sống: top debtors đúng khách, tab Vượt hạn mức khớp `creditExceeded`).
* [x] Build thành công.

**Commit**

```text
feat(web): record payment action and debt dashboard panel
```

---

# Task 03 — Bật menu + Link chéo

## Nội dung

* `config/navigation.ts`: bỏ `disabled: true` ở mục "Công nợ".
* `apps/web/src/app/orders/[id]/page.tsx` (milestone 004): thêm link "Xem chi tiết công nợ" sang `/debts/[order.receivable.id]` trong khối Công nợ, chỉ khi `hasPermission("debt.view")`.

### Definition of Done

* [x] Menu "Công nợ" bấm được, không còn badge "Đang phát triển" (verify sống — menu text chỉ còn "Công nợ").
* [x] Từ Đơn hàng bấm sang đúng trang Công nợ tương ứng (khi đủ quyền) và ngược lại (verify sống 2 chiều).
* [x] Build thành công.

**Commit**

```text
feat(web): enable debt menu and cross-link with orders
```

---

# Task 04 — Hoàn thiện Milestone

* [x] Toàn bộ Task 00–03 xong, build API + web xanh (`tsc --noEmit` cả 2 app + `next build` production đều pass; route `/debts`, `/debts/[id]` build thành công).
* [x] Verify sống luồng chính bằng Playwright headless thật (đăng nhập `owner@erp.local` thật):
  * Menu "Công nợ" hiển thị sạch, không còn badge "Đang phát triển".
  * `/debts`: Dashboard panel đúng số liệu (top debtors đúng khách hàng); tab "Vượt hạn mức" trả đúng 5 công nợ khớp `creditExceeded`.
  * Chi tiết công nợ SO000004: thử thu vượt số còn lại → toast lỗi đúng, không tạo Payment; chọn Chuyển khoản không nhập số tham chiếu → nút submit tự disable; ghi nhận thanh toán hợp lệ (1.000.000đ tiền mặt) → Payment History cập nhật đúng ngay (mã PT + ghi chú hiển thị).
  * Link chéo Đơn hàng ⇄ Công nợ hoạt động đúng cả 2 chiều (verify bằng click thật + kiểm tra URL).
  * 0 lỗi console/page trong toàn bộ phiên verify.
* [x] Cập nhật `roadmap.md` mục Tiến độ.
* [x] Tự review. Dừng.

**Lưu ý vận hành phát sinh khi verify (không phải thay đổi nghiệp vụ):** đã ghi nhận 1 khoản thanh toán thật 1.000.000đ (tiền mặt) cho SO000004 trong lúc verify sống — dữ liệu demo hợp lệ, không cần revert.

**Commit**

```text
chore(web): complete debt FE milestone
```

---

# Thứ tự thực hiện đề xuất

Task 00 → 01 → 02 → 03 → 04.

---

# Milestone tiếp theo

Sau milestone này: `007-fe-hang-hoan.md` — FE Hàng hoàn (theo `roadmap.md` Bước 5).
