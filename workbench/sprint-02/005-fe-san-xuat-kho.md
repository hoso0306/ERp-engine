# Milestone 05 (Sprint 02) - FE Sản xuất + Kho

> **Tên file:** `workbench/sprint-02/005-fe-san-xuat-kho.md`
>
> Bước 3 trong `roadmap.md`.

---

# Mục tiêu

Quản đốc xưởng thao tác Phiếu sản xuất (Bắt đầu/Hoàn thành); thủ kho nhập nguyên liệu và theo dõi tồn kho. Theo `knowledge/modules/production.md` + `knowledge/modules/warehouse.md`.

---

# Kết quả khảo sát (trước khi lập kế hoạch)

1. **BE Production đã có sẵn, chỉ đọc + 2 action, không Create/Update/Delete/Override** (`apps/api/src/production/`):
   * `GET /production-orders` — danh sách, filter `search/status/productionCenterId`, phân trang; include `_count.items`, `salesOrder{id,code,customerName}`.
   * `GET /production-orders/:id` — chi tiết, include `items`, `timeline`, `salesOrder{id,code,customerName,customerPhone,status}`.
   * `POST /production-orders/:id/start` — chỉ cho khi `status=PENDING`; trong transaction gọi `WarehouseService.issueForProductionOrder()` xuất kho theo BOM trước khi chuyển `IN_PRODUCTION` — **nếu thiếu tồn kho, toàn bộ rollback, ném `BadRequestException` với message mô tả rõ** (vd `Không đủ tồn kho nguyên liệu "Vải". Tồn hiện tại: 50, cần: 120.`) — FE chỉ cần toast thẳng `err.message`, không cần parse `errorCode` như case Quotation stale-pricing.
   * `POST /production-orders/:id/complete` — chỉ cho khi `status=IN_PRODUCTION`; tự gọi `SalesOrderService.syncProductionProgress()` cập nhật Sales Order.
   * Cả 4 endpoint đã gắn `AuthGuard`+`PermissionGuard`, permission key `production.view/start/complete` (đã có sẵn trong seed, role "Sản xuất" có đủ 3 quyền này + `warehouse.view`).
   * **Không có Manual Override cho Production Order** (quyết định có chủ đích ghi ở `production.md` — Complete là one-way, không rollback). Không làm Override ở milestone này.
2. **`ProductionOrderItem` hiện không có thông số (parameters) hay BOM vật tư** — chỉ `productCode/productName/quantity`. Dữ liệu này nằm ở `SalesOrderItemParameter`/`OrderBOM` (Sales Order module), chỉ truy cập qua `GET /sales-orders/:id` (quyền `sales-order.view`). **Đã xác nhận với người dùng:** role "Sản xuất" trong seed **không có** `sales-order.view` (chỉ có `production.*` + `warehouse.view`) — nếu FE gọi chéo sang API đơn hàng, quản đốc sẽ bị 403 ngay trên phiếu của chính mình. **Quyết định:** thêm nhỏ ở BE `ProductionOrderService.findOne()` — join thêm `parameters` (từ `SalesOrderItemParameter` theo `salesOrderItemId`) và `bomMaterials` (từ `OrderBOM.items` theo `salesOrderItemId`, chỉ lấy `materialCode/materialName/materialUnit/quantity` — **không** kèm `unitPrice/lineTotal` vì Production không quan tâm chi phí) vào từng item. Cùng cách tiếp cận `WarehouseService.issueForProductionOrder()` đã tự đọc `OrderBOM` — không phải tiền lệ mới, không cần quyền mới.
3. **`WarehouseService.getCurrentStock()` hiện thiếu field `minimumStock`** trong `select` (chỉ có `code/name/currentStock/isActive/unit`) — cần cho cảnh báo "dưới mức tối thiểu" ở roadmap. Thêm 1 dòng vào select, không đổi logic. (Khác với `GET /materials/:id` — API của Product module — đã có sẵn `minimumStock`, nhưng đó là API riêng, không dùng cho trang `/warehouse` vì Warehouse cần endpoint riêng theo đúng module.)
4. **BE Warehouse còn lại** (`apps/api/src/warehouse/`):
   * `POST /material-receipts` — tạo phiếu nhập (`materialId, quantity, supplierName?, note?, createdBy?`), quyền `warehouse.receipt`. Validate: Material phải `ACTIVE`, `quantity > 0`. Tự sinh 1 `WarehouseTransaction` (IN) + cộng `Material.currentStock` trong transaction. **Không có Update/Delete** — nhập sai phải xử lý qua DB (quyết định có chủ đích, ghi ở `warehouse.md`), FE không cần (và không được) làm nút Sửa/Xoá.
   * `GET /material-receipts`, `GET /material-receipts/:id` — quyền `warehouse.view`.
   * `GET /warehouse/transactions` — filter `materialId/direction/transactionType/productionOrderId`, quyền `warehouse.view`.
   * `GET /warehouse/stock` — filter `search`, quyền `warehouse.view` (xem mục khảo sát 3 — cần thêm `minimumStock`).
   * `GET /materials?search=` (Product module, không cần token — nợ kỹ thuật đã ghi nhận ở milestone 003) dùng để chọn Material khi tạo Phiếu nhập, tái dùng pattern `CustomerTypeahead` (`components/quotation/customer-typeahead.tsx`) → viết `MaterialTypeahead` tương tự, chỉ gợi ý Material `isActive=true`.
5. **`ProductionOrderStatusBadge` đã có sẵn** (`components/sales-order/production-order-status-badge.tsx`, dựng ở milestone 004) — tái dùng thẳng, không tạo lại.
6. **Không có FE nào cho Sản xuất/Kho hiện tại** — 2 menu "Sản xuất" (`/production`) và "Kho" (`/warehouse`) đang `disabled: true` trong `navigation.ts`, đã khai báo sẵn `requiredPermission` đúng (`production.view`, `warehouse.view`).
7. **Cross-link:** `/orders/[id]` (milestone 004) đã hiển thị danh sách Phiếu SX dạng text — nâng cấp mỗi mã phiếu thành link sang `/production/[id]` (nếu user có `production.view`). Chiều ngược lại: `/production/[id]` hiển thị mã đơn/khách (đã có sẵn trong include `salesOrder`), link sang `/orders/[salesOrder.id]` chỉ khi user có `sales-order.view` — không ép quyền mới theo đúng khảo sát mục 2. `WarehouseTransaction` có `materialReceiptId`/`productionOrderId` — Lịch sử giao dịch kho link sang đúng chứng từ nguồn (Phiếu nhập hoặc Phiếu SX) theo quyền tương ứng.
8. UI pattern tái dùng: `components/shared`, `Tabs`, table+pagination pattern (`sales-order-table.tsx`), Dialog cho tạo Phiếu nhập, expand-row BOM (đã làm ở `sales-order-item-table.tsx`, tái dùng ý tưởng cho BOM Production — bớt cột giá).

---

# Phạm vi

* `/production` danh sách + `/production/[id]` chi tiết (đọc) + Action Bắt đầu/Hoàn thành.
* BE nhỏ: enrich `parameters`+`bomMaterials` (không giá) vào `ProductionOrderService.findOne()`; thêm `minimumStock` vào `WarehouseService.getCurrentStock()`.
* `/warehouse`: Tồn kho, Phiếu nhập vật tư (tạo + danh sách + chi tiết), Lịch sử giao dịch kho.
* Bật 2 menu Sản xuất + Kho, cross-link Đơn hàng ⇄ Phiếu SX ⇄ giao dịch kho.
* **Không** làm Manual Override cho Production Order (BE không hỗ trợ, có chủ đích).
* **Không** làm Sửa/Xoá Phiếu nhập kho (BE không hỗ trợ, có chủ đích).
* **Không** đổi API/schema ngoài 2 chỗ nhỏ ở mục khảo sát 2 và 3 (chỉ thêm field đọc, không đổi Business Rule).

---

# Quy trình làm việc

* Mỗi lần thực hiện 01 Task, xong dừng, tóm tắt, đề xuất commit, chờ Task tiếp theo.
* Build xanh + verify sống trước khi đóng từng task.

---

# Task 00 — `/production` danh sách

## Nội dung

* Route `apps/web/src/app/production/page.tsx`.
* Tabs trạng thái: Chờ SX (`PENDING`) / Đang SX (`IN_PRODUCTION`) / Hoàn thành (`PRODUCTION_COMPLETED`) / Đã huỷ (`CANCELLED`) / Tất cả — `GET /production-orders?status=...`.
* Lọc theo xưởng (`productionCenterId`, dropdown từ `GET /production-centers`) + tìm kiếm (mã phiếu/mã đơn/khách — BE đã hỗ trợ `where.OR`).
* Cột: mã phiếu, đơn hàng (mã + khách, từ `salesOrder`), xưởng (`productionCenterName`), số sản phẩm (`_count.items`), trạng thái (`ProductionOrderStatusBadge` tái dùng).
* Phân trang giống các trang trước.

### Definition of Done

* [x] Danh sách tải đúng dữ liệu qua `lib/api.ts`, tabs + lọc xưởng hoạt động đúng (verify sống: 6 phiếu tổng, menu "Sản xuất" hiển thị sạch không badge).
* [x] Build thành công.

**Commit**

```text
feat(web): production order list page with center and status filters
```

---

# Task 01 — BE enrich items + `/production/[id]` chi tiết

## Nội dung

* **BE:** sửa `ProductionOrderService.findOne()` (`apps/api/src/production/production-order.service.ts`) — sau khi lấy `productionOrder`, với danh sách `salesOrderItemId` của `items`, query thêm `salesOrderItemParameter` (theo `salesOrderItemId`, order theo `displayOrder`) và `orderBOM.items` (theo `salesOrderItemId`, chỉ select `materialCode/materialName/materialUnit/quantity`) rồi gắn vào từng item dưới dạng `parameters`/`bomMaterials`. Áp dụng cho cả `findAll` không cần (chỉ chi tiết mới cần).
* Route `apps/web/src/app/production/[id]/page.tsx`.
* Khối thông tin chung: mã phiếu, xưởng, trạng thái (badge), đơn hàng liên quan (mã + khách — link sang `/orders/[salesOrder.id]` chỉ khi `hasPermission("sales-order.view")`, không thì hiển thị text), ngày bắt đầu/hoàn thành.
* Danh sách sản phẩm: `productCode/productName/quantity` + thông số (`parameters`) + BOM vật tư cần (expand row, chỉ `materialCode/materialName/quantity/unit` — không giá, khác với `sales-order-item-table.tsx`).
* Timeline (`PRODUCTION_ORDER_CREATED/STARTED/COMPLETED/CANCELLED`).

### Definition of Done

* [x] Vào từ danh sách, xem đúng thông tin + thông số + BOM vật tư (không giá) + Timeline của 1 phiếu thật (verify sống PO SX000001: 3 thông số + 5 dòng BOM đúng số liệu, đối chiếu trực tiếp qua API).
* [x] User không có `sales-order.view` không thấy link đơn hàng (chỉ text), user có quyền thấy link bấm được (verify code — `hasPermission` gate nhất quán với pattern các trang trước; verify sống bằng Owner — có đủ quyền, link hiện đúng).
* [x] Build thành công.

**Commit**

```text
feat(web): production order detail with product specs, bom materials, timeline
```

---

# Task 02 — Action Bắt đầu / Hoàn thành

## Nội dung

* Nút **"Bắt đầu sản xuất"** (hiện khi `status=PENDING`, quyền `production.start`) → `POST /:id/start`, confirm trước khi gọi. Lỗi thiếu tồn kho → toast thẳng `err.message` (BE đã trả message rõ ràng, không cần parse thêm).
* Nút **"Hoàn thành"** (hiện khi `status=IN_PRODUCTION`, quyền `production.complete`) → `POST /:id/complete`, confirm trước khi gọi.
* Không có nút Override/Huỷ (đúng thiết kế V1).

### Definition of Done

* [x] Bắt đầu SX thành công khi đủ tồn kho → chuyển `IN_PRODUCTION`, kho bị trừ đúng (verify sống: tạo 5 phiếu nhập +20 mỗi vật tư, Start trừ đúng theo BOM — 16/15/18/19/19, khớp 20 - nhu cầu).
* [x] Bắt đầu SX khi thiếu tồn kho → lỗi hiển thị rõ ràng, phiếu giữ nguyên `PENDING` (verify sống: toast `Không đủ tồn kho nguyên liệu "Khung nhôm". Tồn hiện tại: 0, cần: 4.`, phiếu vẫn PENDING).
* [x] Hoàn thành SX → chuyển `PRODUCTION_COMPLETED`; Đơn hàng liên quan cập nhật đúng `completedProductionOrders` (verify sống: SO000001 `completedProductionOrders 1/1` sau khi Complete).
* [x] Build thành công.

**Commit**

```text
feat(web): production order start/complete actions
```

---

# Task 03 — BE thêm `minimumStock` + `/warehouse` Tồn kho

## Nội dung

* **BE:** thêm `minimumStock: true` vào `select` của `WarehouseService.getCurrentStock()` (`apps/api/src/warehouse/warehouse.service.ts`).
* Route `apps/web/src/app/warehouse/page.tsx` (tab mặc định "Tồn kho", 2 tab còn lại thêm ở Task 04/05).
* Bảng tồn kho: mã, tên, đơn vị, tồn hiện tại, mức tối thiểu, badge cảnh báo đỏ nếu `currentStock < minimumStock` (khi `minimumStock` khác null) — logic Derived Data tính ở FE, không lưu thêm (đúng CLAUDE.md mục 13).
* Tìm kiếm theo mã/tên (BE đã hỗ trợ).

### Definition of Done

* [x] Danh sách tồn kho tải đúng, vật tư dưới mức tối thiểu có cảnh báo rõ ràng (verify code + verify sống dữ liệu thật qua API — `minimumStock` trả đúng, seed hiện tại đa số `null` nên chưa có badge đỏ thật để chụp, logic `isBelowMinimum` đã kiểm chứng đúng công thức).
* [x] Build thành công.

**Commit**

```text
feat(web): warehouse stock list with minimum stock warning
```

---

# Task 04 — `/warehouse` Phiếu nhập vật tư

## Nội dung

* `MaterialTypeahead` (`components/warehouse/material-typeahead.tsx`) — tái dùng pattern `CustomerTypeahead`, gọi `GET /materials?search=&isActive=true` (`MaterialQueryDto` đã hỗ trợ sẵn `isActive`).
* Dialog **"Tạo phiếu nhập"** (quyền `warehouse.receipt`): chọn vật tư (typeahead), số lượng (>0), nhà cung cấp (tuỳ chọn), ghi chú → `POST /material-receipts`.
* Tab "Phiếu nhập vật tư" trong `/warehouse`: danh sách (mã phiếu, vật tư, số lượng, nhà cung cấp, ngày tạo), phân trang, tìm kiếm.
* `/warehouse/receipts/[id]` chi tiết: đầy đủ thông tin phiếu + `WarehouseTransaction` liên quan (từ include `transaction` đã có sẵn ở BE).

### Definition of Done

* [x] Tạo phiếu nhập thành công → tồn kho vật tư tương ứng tăng đúng số lượng (verify sống: tạo 5 phiếu nhập thật qua UI, tồn kho tăng đúng +20 mỗi vật tư).
* [x] Danh sách + chi tiết phiếu nhập hiển thị đúng.
* [x] Build thành công.

**Commit**

```text
feat(web): material receipt creation, list, and detail
```

---

# Task 05 — `/warehouse` Lịch sử giao dịch kho

## Nội dung

* Tab "Lịch sử giao dịch" trong `/warehouse`: danh sách `WarehouseTransaction` (thời gian, vật tư, hướng — Nhập/Xuất badge, loại — Nhập kho/Xuất SX, số lượng), lọc theo vật tư + loại giao dịch.
* Mỗi dòng link sang chứng từ nguồn: `materialReceiptId` → `/warehouse/receipts/[id]`; `productionOrderId` → `/production/[id]` (chỉ khi có quyền `production.view`).

### Definition of Done

* [x] Danh sách giao dịch tải đúng, lọc theo vật tư/loại hoạt động đúng.
* [x] Link sang chứng từ nguồn đúng (Phiếu nhập hoặc Phiếu SX) — verify sống: sau khi Start production, tab "Lịch sử giao dịch" hiện đúng "Xuất sản xuất" kèm link "Xem phiếu SX".
* [x] Build thành công.

**Commit**

```text
feat(web): warehouse transaction history with source document links
```

---

# Task 06 — Bật menu + Link chéo

## Nội dung

* `config/navigation.ts`: bỏ `disabled: true` ở "Sản xuất" và "Kho".
* `apps/web/src/app/orders/[id]/page.tsx` (milestone 004): nâng cấp mỗi mã Phiếu SX trong khối "Phiếu sản xuất" thành link sang `/production/[id]` (chỉ khi `hasPermission("production.view")`, không thì giữ text như hiện tại).

### Definition of Done

* [x] 2 menu bấm được, không còn badge "Đang phát triển" (verify sống — menu text chỉ còn "Sản xuất"/"Kho").
* [x] Từ Đơn hàng bấm sang đúng Phiếu SX tương ứng (khi đủ quyền) — verify sống: link `/production/[id]` tồn tại và đúng trên trang `/orders/[id]`.
* [x] Build thành công.

**Commit**

```text
feat(web): enable production and warehouse menus, cross-link with orders
```

---

# Task 07 — Hoàn thiện Milestone

* [x] Toàn bộ Task 00–06 xong, build API + web xanh (`tsc --noEmit` cả 2 app + `next build` production đều pass; route `/production`, `/production/[id]`, `/warehouse`, `/warehouse/receipts/[id]` build thành công).
* [x] Verify sống luồng chính bằng Playwright headless thật (đăng nhập `owner@erp.local` thật):
  * Menu "Sản xuất"/"Kho" hiển thị sạch, không còn badge "Đang phát triển".
  * Start Phiếu SX (SX000001) khi tồn kho = 0 → toast lỗi đúng nội dung BE trả, phiếu giữ nguyên `PENDING`.
  * Tạo 5 Phiếu nhập vật tư qua UI thật (mỗi vật tư +20) → tồn kho tăng đúng.
  * Start lại cùng phiếu → thành công, chuyển `IN_PRODUCTION`; đối chiếu số liệu API: tồn kho sau khi trừ đúng theo BOM (16/15/18/19/19 = 20 − nhu cầu từng vật tư).
  * Tab "Lịch sử giao dịch" hiện đúng giao dịch Xuất sản xuất kèm link "Xem phiếu SX".
  * Complete phiếu → chuyển `PRODUCTION_COMPLETED`; `/orders/[id]` của SO000001 hiện đúng `completedProductionOrders 1/1` và link Đơn hàng → Phiếu SX hoạt động đúng.
  * 0 lỗi console/page ngoài 1 lỗi 400 dự kiến (từ chính bước test Start thất bại có chủ đích ở trên).
* [x] Cập nhật `roadmap.md` mục Tiến độ.
* [x] Tự review. Dừng.

**Lưu ý vận hành phát sinh khi verify (không phải thay đổi nghiệp vụ):**
* Dữ liệu dev bị đổi thật do verify sống thật (đúng DoD, không phải bug): SX000001 (Phiếu SX của SO000001) → chuyển `PENDING` → `PRODUCTION_COMPLETED`; 5 vật tư (Khung nhôm, Lưới chống muỗi, Tay nắm cửa lưới, Dây rèm, Bi trượt) được nhập thêm 20 đơn vị mỗi loại rồi bị trừ theo BOM, tồn kho hiện tại: 16/19/19/15/18. Đây là dữ liệu demo hợp lệ, không cần revert.

**Commit**

```text
chore(web): complete production and warehouse FE milestone
```

---

# Thứ tự thực hiện đề xuất

Task 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07.

---

# Milestone tiếp theo

Sau milestone này: `006-fe-cong-no.md` — FE Công nợ (theo `roadmap.md` Bước 4).
