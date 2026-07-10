# Milestone 07 (Sprint 02) - FE Hàng hoàn

> **Tên file:** `workbench/sprint-02/007-fe-hang-hoan.md`
>
> Bước 5 trong `roadmap.md`. Làm song song với Bước 4 (006 — FE Công nợ, đang thực hiện ở phiên khác) — hai module độc lập dữ liệu, không đụng file chung ngoài `navigation.ts` (cần chú ý conflict khi merge).

---

# Mục tiêu

Ghi nhận hàng khách trả sau khi đơn đã `DELIVERED`, quản lý Kho thu hồi (Recovery Inventory). Theo `knowledge/modules/return.md`. Return **không phải** module tài chính — không đụng Sales Order/Debt/Warehouse.

---

# Kết quả khảo sát (trước khi lập kế hoạch)

1. **BE đã hoàn chỉnh 100%, không cần sửa BE** (`apps/api/src/return/`):
   * `GET /returns` — danh sách, filter `search/salesOrderId/customerId/status`, phân trang, include `_count.items`.
   * `GET /returns/:id` — chi tiết, include `items` (kèm `recoveryInventory` từng item).
   * `POST /returns` — tạo (`salesOrderId, returnDate?, receivedBy?, note?, items:[{salesOrderItemId, returnedQuantity, reason, note?}]`). BE tự validate: đơn phải `DELIVERED`, cộng dồn `returnedQuantity` qua **tất cả** Return trước đó không vượt `orderedQuantity` (trả lỗi rõ ràng kèm số lượng còn lại tối đa).
   * `POST /returns/:id/complete` — một chiều `PROCESSING → COMPLETED`, quyền `return.update` (dùng chung, không có quyền `return.complete` riêng).
   * `GET /recovery-inventory`, `GET /recovery-inventory/:id` — filter `search/status`, quyền `return.view`.
   * `POST /recovery-inventory/:id/mark-used` (quyền `return.mark-used`, body `usedForNote?`), `POST /recovery-inventory/:id/dispose` (quyền `return.dispose`) — cả hai chỉ chạy khi `status=AVAILABLE`.
   * `PUT /recovery-inventory/:id` (quyền `return.update`) — chỉ sửa `location`/`imageUrl`/`status` thủ công (Management, khác Action mark-used/dispose).
   * Permission catalog đã có sẵn: `return: [view, create, update, mark-used, dispose]` (seed). Trong seed hiện tại **chỉ OWNER/ADMIN có đủ quyền `return.create/update/mark-used/dispose`** — không role nào khác (Kế toán, Kho...) được gán — giữ nguyên, không tự ý sửa seed ở milestone FE này (đúng nguyên tắc "chỉ đúng Task").
2. **Dashboard Return đã có sẵn ở BE nhưng chưa lộ endpoint riêng** — `ReturnService.getDashboardSummary/getAgingRecoveryInventory/getTopReturnReasons/getReturnsByCustomer` chỉ được **Dashboard module** gọi gộp vào `GET /dashboard/overview` (dùng ở Bước 7 — FE Dashboard trang chủ). **Roadmap Bước 5 không liệt kê khối Dashboard riêng cho `/returns`** (khác với Công nợ có "Dashboard công nợ" ngay trong màn hình) → milestone này **không** làm khối thống kê trên `/returns`, số liệu Return sẽ hiện ở Dashboard trang chủ (Bước 7).
3. **Không có FE nào cho Hàng hoàn hiện tại** — menu "Hàng hoàn" (`/returns`) đang `disabled: true` trong `navigation.ts`, đã khai báo sẵn `requiredPermission: "return.view"`.
4. **Không có `SalesOrderTypeahead`** hiện tại (chỉ có `CustomerTypeahead`, `MaterialTypeahead` cùng pattern). Cần dựng mới để chọn đơn hàng `DELIVERED` khi tạo phiếu hoàn từ trang `/returns` (không đi từ trang chi tiết đơn) — tái dùng đúng pattern debounce 300ms + `GET /sales-orders?search=&status=DELIVERED&limit=10`.
5. **`RecoveryInventory` không có include ngược về `Return`** (chỉ có `returnItemId` FK + `createdFromReturnCode` string đã snapshot sẵn). **Quyết định:** hiển thị `createdFromReturnCode` dạng text (mono), **không** làm link bấm sang `/returns/[id]` — tránh phải thêm BE enrich không cần thiết cho một thao tác chỉ phục vụ thống kê/truy vết bằng mắt (đúng "Return chỉ phục vụ thống kê", không cần điều hướng sâu). Có thể bổ sung sau nếu người dùng thấy thiếu.
6. **`ReturnItem.productParameters`** là JSON snapshot (`{name,label,value,unit,displayOrder}[]`) — hiển thị giống cách `SalesOrderItemTable` hiển thị `parameters`, không cần component mới.
7. **`unitPriceSnapshot` × `returnedQuantity`** tính runtime ở FE (không có `subtotalSnapshot` — đúng CLAUDE.md mục 13, đã ghi rõ trong `return.md`).
8. **Cross-link đã có tiền lệ** ở milestone 004: khối "Phiếu sản xuất" trong `/orders/[id]`. Áp dụng cùng pattern: thêm khối "Hàng hoàn" (danh sách Return của đơn, nếu có) + nút "Tạo phiếu hoàn" khi `status=DELIVERED` và có quyền `return.create`.
9. UI pattern tái dùng: `PageHeader/Loading/ErrorState/EmptyState` (`components/shared`), `Tabs` (như `/warehouse`), table + phân trang (`sales-order-table.tsx`), expand-row cho thông số/BOM (`sales-order-item-table.tsx`), Dialog xác nhận Action (như `/production` Start/Complete), badge pattern (`sales-order-status-badge.tsx`).
10. **Vietnamese label cần định nghĩa mới:**
    * `ReturnStatus`: PROCESSING → "Đang xử lý", COMPLETED → "Hoàn tất".
    * `RecoveryInventoryStatus`: AVAILABLE → "Còn trong kho", USED → "Đã sử dụng", DISPOSED → "Đã thanh lý".
    * `ReturnReason`: WRONG_SIZE → "Sai kích thước", WRONG_COLOR → "Sai màu", WRONG_MODEL → "Sai mẫu", PRODUCTION_DEFECT → "Lỗi sản xuất", INSTALLATION_DEFECT → "Lỗi lắp đặt", CUSTOMER_CHANGED_MIND → "Khách đổi ý", OTHER → "Khác".

---

# Phạm vi

* `/returns` danh sách (2 tab: **Phiếu hoàn** mặc định, **Kho thu hồi**), lọc theo trạng thái + tìm kiếm.
* `/returns/[id]` chi tiết: header + danh sách ReturnItem (thông số, SL đặt/trả, đơn giá, thành tiền runtime, lý do, ghi chú) + Recovery Inventory sinh ra từ từng item + Action "Hoàn tất xử lý".
* `/returns/new?salesOrderId=` — tạo phiếu hoàn: chọn đơn (typeahead nếu vào từ `/returns`, prefill nếu vào từ `/orders/[id]`), chọn items + số lượng (giới hạn theo số đã trả cộng dồn) + lý do + ghi chú.
* Tab "Kho thu hồi": danh sách RecoveryInventory (lọc trạng thái + tìm kiếm) + Action **Đánh dấu đã sử dụng** / **Thanh lý** + Dialog **Sửa** (location/imageUrl).
* Bật menu "Hàng hoàn". Cross-link: `/orders/[id]` thêm khối "Hàng hoàn" (danh sách + nút "Tạo phiếu hoàn" khi `DELIVERED`); `/returns/[id]` link ngược về đơn gốc.
* **Không** làm khối Dashboard trên `/returns` (đẩy sang Bước 7 — Dashboard trang chủ, đã có BE sẵn).
* **Không** đổi BE/schema/permission seed — toàn bộ API đã sẵn sàng.
* **Không** làm trang chi tiết riêng cho Recovery Inventory — quản lý inline trong bảng + Dialog (đủ đơn giản theo đúng mức độ nghiệp vụ — "chủ yếu để thống kê, đừng làm nặng").

---

# Quy trình làm việc

* Mỗi lần thực hiện 01 Task, xong dừng, tóm tắt, đề xuất commit, chờ Task tiếp theo.
* Build xanh + verify sống trước khi đóng từng task.
* Chú ý: milestone 006 (Công nợ) chạy song song ở phiên khác — trước khi sửa `navigation.ts` ở Task 04, `git pull`/kiểm tra diff để tránh conflict với thay đổi dòng "Công nợ".

---

# Task 00 — `ReturnStatusBadge`, `RecoveryInventoryStatusBadge` + `/returns` danh sách (tab Phiếu hoàn)

## Nội dung

* `components/return/return-status-badge.tsx` — PROCESSING (vàng/outline) / COMPLETED (xanh lá), export `RETURN_STATUS_LABEL`.
* `components/return/recovery-inventory-status-badge.tsx` — AVAILABLE (xanh dương) / USED (xám) / DISPOSED (đỏ nhạt), export `RECOVERY_STATUS_LABEL`.
* `components/return/return-reason-label.ts` — map `ReturnReason` → nhãn tiếng Việt (dùng chung cho form tạo + trang chi tiết).
* Route `apps/web/src/app/returns/page.tsx`: `Tabs` gồm "Phiếu hoàn" (mặc định) / "Kho thu hồi" (nội dung Task 03).
* Tab "Phiếu hoàn": lọc trạng thái (Tất cả / Đang xử lý / Hoàn tất), tìm kiếm (mã phiếu/mã đơn/khách — BE hỗ trợ sẵn), phân trang giống các trang trước.
* Cột: mã phiếu, đơn hàng gốc (mã, link `/orders/[id]` nếu `hasPermission("sales-order.view")` else text), khách hàng, ngày trả (`returnDate`), số dòng SP (`_count.items`), trạng thái (badge).
* Nút "Tạo phiếu hoàn" (quyền `return.create`) ở `PageHeader.actions` → điều hướng `/returns/new`.

### Definition of Done

* [x] Danh sách tải đúng dữ liệu qua `lib/api.ts`, lọc trạng thái + tìm kiếm hoạt động đúng (verify sống: 1 phiếu có sẵn hiển thị đúng, sau khi tạo thêm hiển thị 2 phiếu).
* [x] Build thành công.

**Commit**

```text
feat(web): return list page with status filter and search
```

---

# Task 01 — `/returns/[id]` chi tiết

## Nội dung

* Route `apps/web/src/app/returns/[id]/page.tsx`.
* Khối thông tin chung: mã phiếu, trạng thái (badge), đơn hàng gốc (link nếu đủ quyền), khách hàng, ngày trả, người nhận (`receivedBy`), ghi chú.
* Danh sách ReturnItem: sản phẩm (mã/tên) + thông số (`productParameters`, cùng cách hiển thị `SalesOrderItemTable`), SL đặt / SL trả, đơn giá snapshot, thành tiền (runtime = SL trả × đơn giá), lý do (nhãn VN), ghi chú dòng; mỗi dòng hiện Recovery Inventory sinh ra (mã, số lượng, trạng thái badge, vị trí nếu có).
* Action **"Hoàn tất xử lý"** — hiện khi `status=PROCESSING`, quyền `return.update`, confirm dialog (`"Chốt xong vụ việc này với khách? Không ảnh hưởng tài chính, không thể quay lại."`) → `POST /returns/:id/complete`.

### Definition of Done

* [x] Xem đúng thông tin + danh sách item + Recovery Inventory liên quan của 1 phiếu thật (verify sống RT000004: đúng đơn giá, SL đặt/trả 2/1, thành tiền, lý do, badge Thu hồi "Còn trong kho").
* [x] Hoàn tất xử lý chuyển đúng `PROCESSING → COMPLETED`, nút biến mất sau khi hoàn tất (verify sống: toast "Đã hoàn tất xử lý.", badge chuyển "Hoàn tất", nút ẩn đúng).
* [x] Build thành công.

**Commit**

```text
feat(web): return detail with items, recovery inventory, and complete action
```

---

# Task 02 — `SalesOrderTypeahead` + `/returns/new` tạo phiếu hoàn

## Nội dung

* `components/sales-order/sales-order-typeahead.tsx` — tái dùng pattern `CustomerTypeahead`, gọi `GET /sales-orders?search=&status=DELIVERED&limit=10`, hiển thị mã đơn + khách hàng.
* Route `apps/web/src/app/returns/new/page.tsx`:
  * Đọc `?salesOrderId=` từ query string. Có sẵn → load luôn qua `GET /sales-orders/:id` (bỏ qua bước chọn). Không có → hiện `SalesOrderTypeahead` (chỉ tìm đơn `DELIVERED`).
  * Sau khi có đơn: gọi thêm `GET /returns?salesOrderId=` để tính số lượng đã trả cộng dồn theo từng `salesOrderItemId` (SUM `returnedQuantity` qua tất cả Return trước đó).
  * Bảng chọn item: mỗi `SalesOrderItem` hiện SL đã đặt, đã trả trước đó, còn lại tối đa; checkbox để chọn trả + input số lượng (validate `1 <= n <= còn lại`, disable nếu còn lại = 0) + select Lý do (bắt buộc khi đã chọn) + input ghi chú dòng (tuỳ chọn).
  * Field chung: ngày trả (mặc định hôm nay), người nhận (`receivedBy`, tuỳ chọn), ghi chú chung (tuỳ chọn).
  * Submit → `POST /returns`, lỗi hiển thị thẳng `err.message` (BE đã trả message rõ ràng cho case vượt số lượng). Thành công → điều hướng `/returns/[id mới]`.

### Definition of Done

* [x] Tạo phiếu hoàn thành công cho 1+ item của đơn `DELIVERED` thật, số lượng RecoveryInventory sinh ra đúng theo item đã chọn (verify sống: SO000004 → RT000004 + RecoveryInventory RT000004-1 đúng số lượng).
* [x] Trả vượt số lượng còn lại → lỗi rõ ràng, không tạo được (verify sống: nhập 6 khi còn lại tối đa 1 → toast `Số lượng trả của "..." phải từ 1 đến 1.`, vẫn ở trang tạo).
* [x] Vào từ `/orders/[id]` (prefill `salesOrderId`) bỏ qua bước chọn đơn; vào trực tiếp `/returns/new` phải chọn đơn qua typeahead trước (verify sống cả 2 luồng bằng SO000004 và SO000001).
* [x] Build thành công.

**Sửa phát sinh khi verify:** `Select` chọn Lý do trả hàng dùng `value={sel.reason || undefined}` gây console warning "changing the uncontrolled value state of Select to be controlled" (chuyển từ `undefined` sang string khi người dùng chọn). Sửa còn `value={sel.reason}` (luôn controlled bằng chuỗi rỗng ban đầu, cùng pattern các Select khác trong dự án) — verify lại xác nhận hết warning, dropdown vẫn hiển thị đúng placeholder.

**Commit**

```text
feat(web): create return flow with order item selection and quantity validation
```

---

# Task 03 — Tab "Kho thu hồi" (Recovery Inventory) + Action

## Nội dung

* Trong `apps/web/src/app/returns/page.tsx`, tab "Kho thu hồi": lọc trạng thái (Tất cả / Còn trong kho / Đã sử dụng / Đã thanh lý), tìm kiếm (mã/mã SP/mã phiếu gốc — BE hỗ trợ sẵn).
* Cột: mã, sản phẩm (tên + mã + thông số rút gọn), số lượng, vị trí (`location`), nguồn (`createdFromReturnCode`, text mono — xem khảo sát mục 5), trạng thái (badge), ảnh (nếu có `imageUrl`, hiện link "Xem ảnh" mở tab mới).
* Action theo dòng (chỉ hiện khi `status=AVAILABLE`):
  * **"Đánh dấu đã sử dụng"** (quyền `return.mark-used`) → Dialog nhập `usedForNote` tuỳ chọn → `POST /recovery-inventory/:id/mark-used`.
  * **"Thanh lý"** (quyền `return.dispose`) → confirm dialog → `POST /recovery-inventory/:id/dispose`.
  * **"Sửa"** (quyền `return.update`, hiện mọi trạng thái) → Dialog sửa `location` + `imageUrl` → `PUT /recovery-inventory/:id`.

### Definition of Done

* [x] Danh sách tải đúng, lọc trạng thái + tìm kiếm hoạt động đúng.
* [x] Đánh dấu đã sử dụng / Thanh lý chuyển đúng trạng thái, nút Action tương ứng biến mất sau khi chuyển (verify sống: RT000004-1 AVAILABLE→USED qua "Đã sử dụng", 1 item khác AVAILABLE→DISPOSED qua "Thanh lý", cả 2 badge + nút cập nhật đúng ngay).
* [x] Sửa vị trí/ảnh lưu đúng, không đổi dữ liệu snapshot (verify code — Dialog chỉ gửi `location`/`imageUrl`, khớp `UpdateRecoveryInventoryDto`; không verify sống riêng thao tác Sửa do đã verify sống đủ mark-used/dispose cùng cơ chế Dialog).
* [x] Build thành công.

**Commit**

```text
feat(web): recovery inventory tab with mark-used, dispose, and edit actions
```

---

# Task 04 — Bật menu + Cross-link với Đơn hàng

## Nội dung

* `config/navigation.ts`: bỏ `disabled: true` ở "Hàng hoàn" (kiểm tra diff trước khi sửa — tránh conflict với milestone 006 đang chạy song song, có thể cũng sửa dòng "Công nợ" cùng file).
* `apps/web/src/app/orders/[id]/page.tsx`: thêm khối "Hàng hoàn" (sau khối Công nợ, trước Timeline) — hiện danh sách Return của đơn này (`GET /returns?salesOrderId=`) nếu có, mỗi dòng link `/returns/[id]` (nếu `hasPermission("return.view")`); nút **"Tạo phiếu hoàn"** hiện khi `order.status === "DELIVERED"` và `hasPermission("return.create")` → điều hướng `/returns/new?salesOrderId=${order.id}`.

### Definition of Done

* [x] Menu "Hàng hoàn" bấm được, không còn badge "Đang phát triển" (verify sống).
* [x] Từ đơn `DELIVERED` bấm "Tạo phiếu hoàn" → vào đúng `/returns/new` với đơn đã prefill; sau khi tạo, quay lại `/orders/[id]` thấy đúng Return mới trong khối "Hàng hoàn" (verify sống: SO000004 hiện đúng RT000004 + RT000003 với badge trạng thái).
* [x] Build thành công.

**Commit**

```text
feat(web): enable returns menu, cross-link with sales order detail
```

---

# Task 05 — Hoàn thiện Milestone

* [x] Toàn bộ Task 00–04 xong, build API + web xanh (`tsc --noEmit` cả 2 app pass; `next build` production pass — route `/returns`, `/returns/[id]`, `/returns/new` build thành công).
* [x] Verify sống luồng chính bằng Playwright thật (đăng nhập `owner@erp.local` thật, mật khẩu do người dùng cung cấp — không đoán/không tự reset):
  * Menu "Hàng hoàn" hiển thị sạch, không còn badge.
  * Tạo phiếu hoàn thật cho đơn `DELIVERED` (SO000004) → RT000004 + Recovery Inventory RT000004-1 sinh đúng số lượng.
  * Thử trả vượt số lượng còn lại (6 khi tối đa 1) → toast lỗi đúng nội dung BE trả, không tạo được, vẫn ở trang tạo.
  * Đánh dấu đã sử dụng RT000004-1, Thanh lý 1 Recovery Inventory khác → trạng thái đúng, nút Action ẩn đúng sau khi chuyển.
  * Hoàn tất xử lý RT000004 → chuyển `COMPLETED`, nút biến mất, badge cập nhật đúng.
  * Cross-link `/orders/[id]` ⇄ `/returns/[id]` hoạt động đúng cả hai chiều (SO000004 hiện đúng cả RT000004 lẫn RT000003 có sẵn trước đó).
  * Phát hiện + sửa 1 console warning (Select uncontrolled→controlled ở form tạo phiếu hoàn — xem Task 02); verify lại xác nhận 0 lỗi console sau khi sửa (ngoại trừ 1 lỗi 400 dự kiến từ bước test trả vượt số lượng có chủ đích).
* [x] Cập nhật `roadmap.md` mục Tiến độ.
* [x] Tự review. Dừng.

**Lưu ý vận hành phát sinh khi verify (không phải thay đổi nghiệp vụ):**
* Dữ liệu dev bị đổi thật do verify sống thật (đúng DoD, không phải bug): SO000004 có thêm 1 Return mới RT000004 (trạng thái `COMPLETED`) + Recovery Inventory RT000004-1 (trạng thái `USED`). Đây là dữ liệu demo hợp lệ, không cần revert.
* Một Recovery Inventory có sẵn từ trước (RT000003-1, không phải do milestone này tạo) bị thao tác "Thanh lý" nhầm do script verify bấm nút đầu tiên tìm thấy thay vì chỉ nhắm dữ liệu mới tạo. Đã xác nhận lại với người dùng và revert về `AVAILABLE` qua API ngay sau khi phát hiện — không còn ảnh hưởng dữ liệu dev dùng chung.
* Nhiều milestone khác (006 Công nợ, 009 Dashboard) chạy song song trên cùng máy/DB dev trong lúc thực hiện milestone này — không phát hiện xung đột file (`navigation.ts` được session khác sửa thêm dòng Người dùng/Vai trò trong lúc verify, không đụng dòng "Hàng hoàn" của milestone này).

**Commit**

```text
chore(web): complete returns FE milestone
```

---

# Thứ tự thực hiện đề xuất

Task 00 → 01 → 02 → 03 → 04 → 05.

---

# Milestone tiếp theo

Sau milestone này: `008-bao-cao.md` — Báo cáo BE+FE (theo `roadmap.md` Bước 6), trừ khi milestone 006 (Công nợ) chưa xong thì chờ hợp nhất trước.
