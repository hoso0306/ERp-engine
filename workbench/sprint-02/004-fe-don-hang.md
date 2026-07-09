# Milestone 04 (Sprint 02) - FE Đơn hàng

> **Tên file:** `workbench/sprint-02/004-fe-don-hang.md`
>
> Bước 2 trong `roadmap.md`.

---

# Mục tiêu

Sau khi duyệt báo giá, người dùng nhìn thấy và vận hành được Đơn hàng — nhu cầu cấp thiết nhất từ Test lần 1 (`testlan1.md`). Đây là module trung tâm điều phối (Fulfillment) theo `knowledge/modules/order.md`.

---

# Kết quả khảo sát (trước khi lập kế hoạch)

1. **BE đã có sẵn đầy đủ, chỉ đọc + 4 action, không Create/Update/Delete thủ công** (`apps/api/src/sales-order/`):
   * `GET /sales-orders` — danh sách, filter `search/status/paymentStatus/customerId`, phân trang; include `_count.items`, `_count.productionOrders`.
   * `GET /sales-orders/:id` — chi tiết, include `items` (+ `parameters`, `bom.items`), `productionOrders` (+ `items`), `timeline`, `receivable`.
   * `POST /sales-orders/:id/ship` — không body, chỉ cho khi `status = PRODUCTION_COMPLETED`.
   * `POST /sales-orders/:id/deliver` — không body, chỉ cho khi `status = SHIPPED`; set `actualDeliveryDate` + kích hoạt `dueDate` công nợ.
   * `POST /sales-orders/:id/override` — `{ newStatus, reason, overrideBy? }`.
   * `POST /sales-orders/:id/cancel` — `{ reason, cancelledBy? }`; chặn nếu có Production Order đã `IN_PRODUCTION`/`PRODUCTION_COMPLETED`, hoặc đơn đã `CANCELLED`/`DELIVERED`. Cho phép huỷ đơn đã thu cọc (BE tự xử lý payload `paidAmount` + `refundNote` trong Timeline khi có).
   * Toàn bộ 6 endpoint đã gắn `AuthGuard` + `PermissionGuard` với key `sales-order.view/ship/deliver/cancel/override` (đã có sẵn trong `PERMISSION_CATALOG` của seed) — không cần chờ milestone nợ kỹ thuật riêng cho module này.
2. **Enum liên quan:** `SalesOrderStatus` (`IN_PRODUCTION → PRODUCTION_COMPLETED → SHIPPED → DELIVERED`, `CANCELLED`), `PaymentStatus` (`UNPAID → PARTIALLY_PAID → PAID`), `ProductionOrderStatus` (`PENDING/IN_PRODUCTION/PRODUCTION_COMPLETED/CANCELLED`), `SalesOrderTimelineAction` (`SALES_ORDER_CREATED, PRODUCTION_ORDERS_GENERATED, PRODUCTION_COMPLETED, SHIPPED, DELIVERED, PAYMENT_STATUS_CHANGED, MANUAL_OVERRIDE, CANCELLED`).
3. **`SALES_ORDER_INCLUDE` (service) hiện thiếu quan hệ `quotation`** — model có `quotation Quotation?` (back-reference từ `Quotation.salesOrderId`) nhưng chưa được include ở `findOne`, nên FE không có `quotationId` để bấm sang báo giá gốc (chỉ có `quotationCode` dạng text snapshot). Đã xác nhận với người dùng: thêm `quotation: { select: { id: true } }` vào include ở Task 01 — chỉ expose thêm field đọc, không đổi nghiệp vụ/snapshot rule.
4. **Đã xác nhận với người dùng:** trang chi tiết đơn hàng chỉ **xem** Phiếu sản xuất (trạng thái, sản phẩm, BOM cần), **không** thao tác Bắt đầu/Hoàn thành — Action đó thuộc Bước 3 (`005-fe-san-xuat-kho.md`, trang `/production`). BE cũng chưa có endpoint update status Production Order (chỉ có `syncProductionProgress` nội bộ, chưa expose HTTP) nên hiện tại không thể thao tác được kể cả nếu muốn.
5. **Progress SX, cảnh báo trễ giao đều là Derived Data tính ở FE, không lưu thêm:** `completedProductionOrders/totalProductionOrders` đã có sẵn trên `SalesOrder` (đúng nguyên tắc "Lưu Source Data, hiển thị Derived Data" — CLAUDE.md mục 13); trễ giao = `expectedDeliveryDate < today && status không phải DELIVERED/CANCELLED`, không gọi API riêng (có `getDelayedOrders()` ở service nhưng đó là API Dashboard — mục Bước 7, không dùng ở đây, list `/orders` tự so sánh ngày client-side).
6. **Không có FE nào cho Đơn hàng hiện tại** — menu "Đơn hàng" đang `disabled: true` trong `navigation.ts` (`requiredPermission: "sales-order.view"` đã khai báo sẵn).
7. UI pattern tái dùng: `components/shared` (`PageHeader`, `Loading`, `ErrorState`), `Tabs` (đã dùng ở `customers`, `products`), `Dialog` + `Textarea` cho Cancel/Override (pattern y hệt `quotations/[id]/page.tsx`), khối Timeline dạng `<ol>` inline (chưa tách component dùng chung — theo đúng cách Quotation đang làm, không tạo abstraction mới khi chỉ có 2 chỗ dùng).
8. **Link chéo 2 chiều:** Quotation → Order đã có sẵn (`quotation.salesOrderId` hiển thị ở `quotations/[id]/page.tsx` dòng 510-515, hiện chỉ là Badge tĩnh "Đã tạo đơn hàng", **chưa phải link bấm được** — sẽ nâng cấp thành link thật trong Task 03). Order → Quotation cần thêm include (mục 3).

---

# Phạm vi

* `/orders` danh sách + `/orders/[id]` chi tiết (đọc, không CRUD thủ công — đúng nguyên tắc BE).
* Action: Gửi xe, Khách đã nhận, Huỷ đơn (kèm cảnh báo cọc), Manual Override.
* Bật menu Đơn hàng (bỏ `disabled: true`).
* Link chéo Quotation ⇄ Order.
* **Không** thao tác Phiếu sản xuất (Bắt đầu/Hoàn thành) — Bước 3.
* **Không** thao tác Kho, Công nợ (ghi nhận thanh toán) — các Bước sau.
* **Không** đổi API/schema ngoài 1 dòng include ở Task 01 (mục khảo sát 3).

---

# Quy trình làm việc

* Mỗi lần thực hiện 01 Task, xong dừng, tóm tắt, đề xuất commit, chờ Task tiếp theo.
* Build xanh + verify sống trước khi đóng từng task.

---

# Task 00 — `/orders` danh sách

## Nội dung

* Route `apps/web/src/app/orders/page.tsx`.
* Tabs trạng thái: Đang SX (`IN_PRODUCTION`) / SX xong (`PRODUCTION_COMPLETED`) / Đã gửi xe (`SHIPPED`) / Đã giao (`DELIVERED`) / Đã huỷ (`CANCELLED`) — gọi `GET /sales-orders?status=...`.
* Ô tìm kiếm (mã đơn/khách/SĐT/mã báo giá — theo `where.OR` đã hỗ trợ ở BE) + lọc theo ngày (client tự lọc theo `createdAt` hoặc `expectedDeliveryDate`, BE không có filter ngày sẵn nên lọc phía FE trên trang hiện tại — không thêm query param mới).
* Cột: mã đơn, khách hàng, tổng tiền (`totalAmount`), tiến độ SX (`completedProductionOrders`/`totalProductionOrders`, hiển thị "x/y"), trạng thái thanh toán (`paymentStatus` badge), ngày giao dự kiến (`expectedDeliveryDate`, đỏ + icon cảnh báo nếu quá hạn mà chưa `DELIVERED`/`CANCELLED`).
* `sales-order-status-badge.tsx` (component mới, đặt tại `components/sales-order/`, cùng pattern `quotation-status-badge.tsx`).
* Phân trang giống `products`/`customers`.

### Definition of Done

* [x] Danh sách tải đúng dữ liệu qua `lib/api.ts`, tabs lọc đúng trạng thái (verify sống: 6 đơn tổng, 2 đơn tab "Đang SX").
* [x] Đơn quá hạn giao hiển thị cảnh báo rõ ràng (logic `isOverdue` — verify code, chưa có dữ liệu seed quá hạn để chụp ảnh thật).
* [x] Build thành công.

**Commit**

```text
feat(web): sales order list page with status tabs and overdue warning
```

---

# Task 01 — `/orders/[id]` chi tiết

## Nội dung

* **BE (nhỏ):** thêm `quotation: { select: { id: true } }` vào `SALES_ORDER_INCLUDE` (`apps/api/src/sales-order/sales-order.service.ts`) — chỉ expose thêm field đọc, không đổi Business Rule/Snapshot.
* Route `apps/web/src/app/orders/[id]/page.tsx`.
* Khối thông tin chung: mã đơn, mã báo giá gốc (link sang `/quotations/[quotationId]` nếu có), khách hàng + SĐT (snapshot), trạng thái đơn (badge), trạng thái thanh toán (badge), ngày giao dự kiến/thực tế, `ownerName`, ghi chú.
* Danh sách `items`: sản phẩm, thông số (`parameters`), số lượng, đơn giá, thành tiền — kèm BOM từng dòng (`bom.items`) dạng expand/accordion, tương tự cách `products/[id]` hiển thị BOM Product (đọc, không sửa — đây là chứng từ bất biến theo `order.md` mục "Immutable Document").
* Danh sách Phiếu sản xuất liên quan (`productionOrders`): mã phiếu, xưởng (`productionCenterName`), trạng thái (badge riêng `production-order-status-badge.tsx`) — **chỉ xem**, không có nút Action (đúng xác nhận đã chốt).
* Khối tóm tắt công nợ: đọc trực tiếp `receivable` (nếu có) — `totalAmount`, `paidAmount`, `remainingAmount`; nếu `receivable` null (đơn huỷ trước khi có công nợ hoặc dữ liệu cũ) hiển thị "Chưa có công nợ".
* Timeline đầy đủ (`timeline`, đã `orderBy createdAt asc`) — inline `<ol>` giống `quotations/[id]/page.tsx`, map nhãn theo `SalesOrderTimelineAction`.

### Definition of Done

* [x] Vào từ danh sách, xem đúng toàn bộ thông tin + BOM + Phiếu SX + công nợ + Timeline của 1 đơn thật (verify sống 4 đơn thật: DELIVERED, CANCELLED+cọc, IN_PRODUCTION; BOM expand test trên đơn có 5 dòng BOM — đúng số dòng).
* [x] Link mã báo giá gốc bấm sang đúng trang Quotation (verify sống, cả 2 chiều).
* [x] Build thành công.

**Commit**

```text
feat(web): sales order detail page with items, production orders, debt summary, timeline
```

---

# Task 02 — Actions theo Workflow

## Nội dung

* Nút **"Gửi xe"** (hiện khi `status = PRODUCTION_COMPLETED`, quyền `sales-order.ship`) → `POST /:id/ship`, confirm trước khi gọi.
* Nút **"Khách đã nhận"** (hiện khi `status = SHIPPED`, quyền `sales-order.deliver`) → `POST /:id/deliver`, confirm trước khi gọi.
* Nút **"Huỷ đơn"** (hiện khi `status` không phải `CANCELLED`/`DELIVERED`, quyền `sales-order.cancel`) → dialog nhập lý do bắt buộc (giống Cancel Quotation). **Nếu `receivable.paidAmount > 0`:** thêm dòng cảnh báo bắt buộc đọc trong dialog: *"Đơn hàng đã thu cọc. ERP sẽ đóng công nợ. Việc hoàn tiền thực hiện ngoài hệ thống."* trước khi cho bấm xác nhận (không phải checkbox riêng — chỉ hiển thị rõ, xác nhận bằng nút Submit như Quotation).
* Nút **"Override"** (quyền `sales-order.override`) → dialog chọn trạng thái mới (`SalesOrderStatus`, loại trừ trạng thái hiện tại) + lý do bắt buộc + người thực hiện tuỳ chọn, giống hệt pattern `quotations/[id]/page.tsx` Task 08.
* Toast lỗi lịch sự khi BE từ chối (vd huỷ đơn đã có PO bắt đầu SX, ship khi chưa đủ điều kiện).

### Definition of Done

* [x] Gửi xe / Khách đã nhận / Huỷ / Override đều gọi đúng API, cập nhật lại trang sau khi thành công (verify sống chuỗi Override IN_PRODUCTION→PRODUCTION_COMPLETED→Ship→Deliver trên SO000001, và Cancel trên SO000006 — cả 4 action pass, UI cập nhật đúng ngay sau mỗi bước).
* [x] Huỷ đơn đã thu cọc hiển thị đúng cảnh báo (verify code + đối chiếu timeline có sẵn của đơn CANCELLED cũ có cọc: đúng payload `paidAmount`/`refundNote`); Huỷ đơn không cọc không hiện cảnh báo (verify sống SO000006).
* [x] Build thành công.

**Commit**

```text
feat(web): sales order workflow actions (ship, deliver, cancel, override)
```

---

# Task 03 — Bật menu + Link chéo

## Nội dung

* `config/navigation.ts`: bỏ `disabled: true` ở mục "Đơn hàng".
* `quotations/[id]/page.tsx`: nâng cấp khối hiển thị `salesOrderId` (dòng ~510) từ Badge tĩnh "Đã tạo đơn hàng" thành link bấm được sang `/orders/[salesOrderId]`.
* Ẩn nút Action theo quyền đã làm ở Task 02 — rà lại đảm bảo nhất quán `hasPermission()` như các trang khác (không có nút nào lộ ra khi thiếu quyền).

### Definition of Done

* [x] Menu "Đơn hàng" bấm được, không còn badge "Đang phát triển" (verify sống — menu text chỉ còn "Đơn hàng").
* [x] Từ Báo giá đã duyệt bấm sang đúng Đơn hàng tương ứng và ngược lại (verify sống 2 chiều, click thật + waitForURL).
* [x] Build thành công.

**Commit**

```text
feat(web): enable order menu and cross-link with quotation
```

---

# Task 04 — Hoàn thiện Milestone

* [x] Toàn bộ Task 00–03 xong, build API + web xanh (`tsc --noEmit` cả 2 app + `next build` production đều pass).
* [x] Verify sống luồng chính bằng Playwright headless thật (đăng nhập `owner@erp.local` thật, không phải chỉ đọc code):
  * Danh sách `/orders`: 6 đơn tổng, tab "Đang SX" lọc đúng còn 2 đơn.
  * Chi tiết đơn DELIVERED / CANCELLED (đã có cọc từ trước) / IN_PRODUCTION: đủ khối info, items+BOM (expand đúng 5 dòng BOM trên đơn có BOM), Phiếu SX chỉ xem, khối Công nợ (cả 2 nhánh có/không `receivable`), Timeline đúng nhãn + payload.
  * Chuỗi thao tác thật trên SO000001: Override (`IN_PRODUCTION`→`PRODUCTION_COMPLETED`, lý do bắt buộc) → **Gửi xe** (→`SHIPPED`) → **Khách đã nhận** (→`DELIVERED`, `actualDeliveryDate` được set) — cả 4 bước cập nhật UI đúng ngay lập tức, không lỗi console.
  * **Huỷ đơn** trên SO000006 (không cọc): dialog không hiện cảnh báo cọc (đúng), lý do bắt buộc, huỷ thành công → Timeline ghi đúng lý do, nút Action ẩn hết sau khi huỷ.
  * Link chéo Quotation ⇄ Order cả 2 chiều (BG000003 ⇄ SO000002), có `waitForURL` xác nhận điều hướng thật.
  * Menu "Đơn hàng" không còn badge "Đang phát triển".
  * 0 lỗi console/page trong toàn bộ phiên verify.
* [x] Cập nhật `roadmap.md` mục Tiến độ.
* [x] Tự review. Dừng.

**Lưu ý vận hành phát sinh khi verify (đã báo người dùng, không phải thay đổi nghiệp vụ):**
* API dev server (cổng 3001) đang chạy từ phiên trước đó **không** ở chế độ `--watch` nên không tự nhận code mới — đã tắt tiến trình cũ (PID 1988) và khởi động lại bằng `nest start --watch` để BE áp dụng thay đổi include `quotation` ở Task 01. Các trang FE khác không bị ảnh hưởng vì Next.js dev (cổng 3000) đã tự hot-reload.
* Dữ liệu seed dev bị đổi thật do thao tác verify sống (không phải bug, là kết quả đúng của tính năng): SO000001 → chuyển từ `IN_PRODUCTION` sang `DELIVERED` (qua Override + Ship + Deliver); SO000006 → chuyển sang `CANCELLED`. Cả hai đều có thể đưa về trạng thái khác qua Manual Override nếu cần dữ liệu demo khác.
* Mật khẩu tài khoản `owner@erp.local` trong DB dev local đã được xác nhận lại với người dùng và đặt về giá trị người dùng cung cấp trước khi verify.

**Commit**

```text
chore(web): complete sales order FE milestone
```

---

# Thứ tự thực hiện đề xuất

Task 00 → 01 → 02 → 03 → 04.

---

# Milestone tiếp theo

Sau milestone này: `005-fe-san-xuat-kho.md` — FE Sản xuất + Kho (theo `roadmap.md` Bước 3).
