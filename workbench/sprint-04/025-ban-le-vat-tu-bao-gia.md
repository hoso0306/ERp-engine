# Milestone (Sprint 04) - Bán lẻ Vật tư trong Báo giá

> **Tên file:** `workbench/sprint-04/025-ban-le-vat-tu-bao-gia.md`
> **Trạng thái:** ✅ Code + test xong (28/07/2026) — `tsc --noEmit`/`next build`/`nest build` sạch cả BE+FE, đã test end-to-end qua service thật (báo giá có cả dòng Sản phẩm + Vật tư → Duyệt → verify SalesOrder/Production Order/cost-summary), dọn sạch data test. Còn 2 việc chờ người dùng: (1) tự xem qua UI thật (chưa có công cụ browser trong môi trường này để tự verify), (2) migration `20260728045821_material_retail_and_quotation_item_type` mới chạy DB dev local, chưa áp dụng lên VPS production.

---

# Bối cảnh

Xưởng Bạt bán "Bạt xếp" theo mô hình: khách đặt vải cắt theo diện tích (sản phẩm CTO bình thường), nhưng phụ kiện lắp đặt (U treo, puly, dây kéo, tay quay, mô tơ...) khách **mua lẻ** để tự lắp — số lượng không suy ra được từ công thức kỹ thuật cố định nên **không phù hợp Material Requirement/BOM**.

Qua nhiều phiên tư vấn (2026-07-28) đã chốt hướng:

1. Vật tư bán lẻ cần dòng riêng trong Báo giá (nút "Thêm vật tư" cạnh "Thêm sản phẩm"), dùng giá vốn (`MaterialPrice`) + giá bán lẻ (`Material.retailPrice`) đã có sẵn trên 15 vật tư phụ kiện (`NL000183`–`NL000197`, xem `workbench/sessions/2707.md`).
2. Một số vật tư (nhôm) giá vốn tính theo **kg** (đúng hoá đơn mua) nhưng bán lẻ cho khách lại cần theo **mét** (đơn vị khác đơn vị gốc) → cần thêm field quy đổi + giá bán lẻ theo đơn vị riêng, áp dụng cho **toàn bộ Material** (không riêng nhôm), vật tư nào không cần thì để trống.
3. Bản in Báo giá **giữ 1 bảng chung**, không tách nhóm Sản phẩm/Vật tư (đã chốt, xem phiên trước — không làm lại phần này).
4. Yêu cầu mới (2026-07-28): mỗi Material cần 1 cờ **"Cho phép bán lẻ"** — bật thì mới xuất hiện trong danh sách chọn ở nút "Thêm vật tư"; đồng thời tab "Vật tư" cần thêm bộ lọc **"Vật tư bán lẻ"**.

---

# Phạm vi

## A. Material — cho phép bán lẻ + quy đổi đơn vị bán lẻ

**Schema (`Material`), thêm field:**

| Field | Kiểu | Ghi chú |
|---|---|---|
| `isRetailable` | Boolean, default `false` | "Cho phép bán lẻ" — bật thì Material mới xuất hiện ở nút "Thêm vật tư" trong Báo giá |
| `retailUnitId` | String?, FK → `Unit` | Đơn vị bán lẻ. `null` = dùng chung `unitId` gốc (không cần quy đổi) |
| `retailConversionFactor` | Decimal?, nullable | Hệ số quy đổi: 1 đơn vị bán lẻ (`retailUnitId`) = bao nhiêu đơn vị gốc (`unitId`). Ví dụ nhôm: `unit=kg`, `retailUnit=mét`, `retailConversionFactor = 0.35` (1 mét thanh nhôm nặng 0,35kg) → bán 1 mét thì trừ kho 0,35kg. Bắt buộc khi `retailUnitId` khác `unitId`; để trống khi `retailUnitId = null` hoặc trùng `unitId` |
| `retailVatRate` | Decimal, default `0` | % VAT áp cho dòng vật tư khi bán lẻ (quyết định 2026-07-28 — mục 3). Mỗi Material tự khai báo mức riêng, giống cách `PricingRuleVersion.vatRate` đang làm cho sản phẩm |

`retailPrice` (đã có sẵn) giữ nguyên nghĩa nhưng đổi ngữ cảnh: từ nay là giá bán lẻ **theo `retailUnitId`** (nếu có set) thay vì luôn ngầm định theo `unitId` như hiện tại.

**Validate khi lưu Material:**
- `isRetailable = true` → bắt buộc có `retailPrice > 0`.
- `retailUnitId` khác `unitId` → bắt buộc có `retailConversionFactor > 0`.
- `retailUnitId = unitId` hoặc `null` → `retailConversionFactor` phải để trống (tránh dữ liệu thừa gây hiểu nhầm).

**FE — Form Material (`apps/web/.../materials/...`):**
- Thêm switch "Cho phép bán lẻ".
- Bật switch → hiện thêm: dropdown "Đơn vị bán lẻ" (mặc định = đơn vị gốc), input "Hệ số quy đổi" (chỉ hiện khi đơn vị bán lẻ ≠ đơn vị gốc), input "Giá bán lẻ".

## B. Tab "Vật tư" — bộ lọc "Vật tư bán lẻ"

- Thêm filter (checkbox hoặc segmented control) "Vật tư bán lẻ" trên danh sách Material, lọc theo `isRetailable = true`.
- BE: `findAllMaterials()` thêm query param `isRetailable?: boolean`.

## C. Báo giá — nút "Thêm vật tư"

**Schema — `QuotationItem`:** hiện tại cột `productId` là bắt buộc (NOT NULL), gắn chặt CTO. Cần tách dòng PRODUCT/MATERIAL:

- Thêm `itemType` (Enum `QuotationItemType`: `PRODUCT` | `MATERIAL`, default `PRODUCT`).
- `productId` → đổi thành **nullable** (chỉ có khi `itemType = PRODUCT`).
- Thêm `materialId` (nullable, FK → `Material`, chỉ có khi `itemType = MATERIAL`) + snapshot `materialCode`/`materialName`/`unit` (theo đúng Snapshot Rule — giống cách `productCode`/`productName` đã làm).
- Các field giá (`systemPrice`, `discountPercent`, `finalPrice`, `subtotal`, `vatRate`, `vatAmount`...) **dùng chung** cho cả 2 loại dòng — dòng MATERIAL: `systemPrice` = `retailPrice` snapshot tại thời điểm thêm, `quantity` nhập theo `retailUnitId`.
- `pricingRuleVersionId`/`materialRequirementVersionId` chỉ có ý nghĩa với PRODUCT, để `null` ở dòng MATERIAL.
- `parameters` (CTO) không áp dụng cho dòng MATERIAL — quan hệ giữ nguyên, đơn giản là rỗng.

**Tương tự cho `SalesOrderItem`** khi Duyệt báo giá (snapshot y hệt cơ chế hiện có cho PRODUCT) — nhưng dòng MATERIAL **không có** `productionCenterId`/`productionCenterName` (bắt buộc với PRODUCT hiện tại) vì không sinh Production Order.

**API/FE:**
- Nút "Thêm vật tư" cạnh "Thêm sản phẩm" trên trang chi tiết Báo giá.
- Dialog chọn Material: chỉ liệt kê `isRetailable = true` và `isActive = true`; nhập số lượng; đơn giá auto-fill từ `retailPrice`, cho sửa tay (giống hành vi giá sản phẩm hiện tại).
- **Không áp Discount Engine** (quyết định 2026-07-28 — mục 2): giá dòng vật tư luôn khởi điểm = `retailPrice` snapshot, không tự tính `CustomerProductDiscount`. Người dùng vẫn sửa tay được `finalPrice` từng dòng nếu cần giảm giá thủ công.
- `vatRate` của dòng snapshot từ `Material.retailVatRate` tại thời điểm thêm dòng (như PRODUCT snapshot từ `PricingRuleVersion.vatRate`).
- Quyền hạn: dùng chung `quotation.create` hiện có, không thêm permission mới (quyết định 2026-07-28 — mục 5).

**Xuất kho vật tư bán lẻ — ĐÃ BỎ KHỎI PHẠM VI (phát hiện khi triển khai, 2026-07-28):**
- `knowledge/modules/warehouse.md`: toàn bộ module Kho **đã tạm gỡ khỏi triển khai từ 18/07/2026** — `WarehouseModule` không được import vào `app.module.ts` (API `/warehouse/*` trả 404), `ProductionOrderService.start()` cũng đã bỏ gọi xuất kho. Nguyên tắc đang áp dụng: "kho tắt là không ghi" — không tạo `WarehouseTransaction` nào trong giai đoạn này.
- Vì vậy dòng MATERIAL bán lẻ **không xuất/hoàn kho** ở milestone này, nhất quán với cách PRODUCT hiện tại cũng không xuất kho. Không thêm `salesOrderItemId` hay đụng gì vào `WarehouseModule`/`WarehouseTransaction`.
- Khi doanh nghiệp bật lại Kho (task riêng theo checklist trong `warehouse.md`), cần bổ sung thêm bước xuất/hoàn kho cho dòng MATERIAL vào đúng checklist đó — ghi chú lại ở đây để không quên.

**Bản in:** giữ nguyên 1 bảng chung như đã chốt trước — dòng MATERIAL hiển thị cùng bảng với dòng PRODUCT, các cột thông số (Rộng/Cao) để trống ở dòng MATERIAL (không tách nhóm).

---

# Quyết định (đã chốt 2026-07-28)

1. **Thời điểm xuất kho:** lúc Duyệt báo giá (Approve). Ghi chú: quản lý tồn kho hiện **không phải trọng tâm** của phần mềm — implement đơn giản (có `WarehouseTransaction` để lưu vết + cập nhật `currentStock`), không xây thêm validate/cảnh báo tồn kho phức tạp ở milestone này.
2. **Chiết khấu:** không áp Discount Engine cho dòng vật tư — giá cố định theo `retailPrice`, sửa tay được từng dòng.
3. **VAT:** thêm field `retailVatRate` riêng trên `Material` (mỗi vật tư tự khai mức riêng).
4. **Hoàn kho khi huỷ đơn:** tự động tạo `WarehouseTransaction` IN ngược lại khi SalesOrder chuyển `CANCELLED`.
5. **Quyền hạn:** dùng chung `quotation.create`, không thêm permission mới.

---

# Ngoài phạm vi (không làm ở milestone này)

- Sản phẩm "Bạt xếp" (CTO cắt vải theo diện tích) — công thức cắt theo khổ 1,5m vẫn chưa chốt nghiệp vụ thật (xem tư vấn trước), **tách task riêng**, không gộp vào đây.
- Tách bảng Sản phẩm/Vật tư trên bản in — đã bị từ chối ở phiên trước, không làm lại.
- Không đổi field `retailPrice`/đơn vị của các Material đã tạo trước đó (49 → 8 vật tư vải, 15 phụ kiện) — chỉ thêm field mới, dữ liệu cũ giữ nguyên (`retailUnitId = null` mặc định = không đổi hành vi).

---

# Thứ tự triển khai đề xuất

1. **Migration + BE Material:** thêm 3 field (`isRetailable`, `retailUnitId`, `retailConversionFactor`) + validate + filter `isRetailable` trong `findAllMaterials()`.
2. **FE Material:** switch "Cho phép bán lẻ" + field quy đổi trong form, cột/badge "Bán lẻ" + filter trong danh sách (tab Vật tư).
3. **Migration + BE Quotation/SalesOrder:** thêm `itemType`, nullable hoá `productId`, thêm `materialId` + snapshot fields trên cả `QuotationItem` và `SalesOrderItem`; API thêm dòng MATERIAL (create/update/delete), tính giá theo `retailPrice` snapshot.
4. ~~BE Warehouse: xuất kho trực tiếp cho dòng MATERIAL~~ — **bỏ khỏi phạm vi** (xem mục "Xuất kho vật tư bán lẻ" ở trên — module Kho đang tắt).
5. **FE Báo giá:** nút "Thêm vật tư" + dialog chọn vật tư + hiển thị dòng MATERIAL trong bảng chi tiết + bản in (dùng chung bảng hiện có).
6. Test end-to-end: tạo báo giá có cả dòng Sản phẩm + Vật tư → Duyệt → kiểm tra SalesOrder, xuất kho, không sinh Production Order cho dòng vật tư.

---

# Đã triển khai (28/07/2026)

**Migration:** `20260728045821_material_retail_and_quotation_item_type` — thêm `Material.isRetailable/retailUnitId/retailConversionFactor/retailVatRate`; thêm enum `QuotationItemType` + `itemType`/`materialId`/`materialCode`/`materialName`/`materialUnit` trên `QuotationItem` và `SalesOrderItem`; nullable hoá `productId`/`productCode`/`productName`/`productTypeId`/`productionCenterId` trên `SalesOrderItem` (chỉ bắt buộc khi `itemType=PRODUCT`). Đã chạy migration + generate Prisma Client trên DB dev, **chưa áp dụng production**.

**BE:**
- `product.service.ts`: `validateRetailConfig()` + wire vào `createMaterial`/`updateMaterial`; filter `isRetailable` trong `findAllMaterials()`.
- `quotation-workflow.service.ts`: thêm `addMaterialItem()`/`updateMaterialItem()`; sửa `approve()` — validate + tính giá vốn riêng cho dòng MATERIAL (không qua BOM), gộp vào `plannedCost`/`plannedProfit` chung, tạo `SalesOrderItem` riêng cho dòng MATERIAL (không có `productionCenterId`, không vào `centerMap` → không sinh Production Order); sửa `estimateItemsCost()` (dùng ở cost-summary + danh sách báo giá) để tính giá vốn vật tư từ `MaterialPrice` mặc định × hệ số quy đổi; sửa vòng lặp đổi khách hàng (discount recalc) và `recalculatePrices()` để bỏ qua dòng MATERIAL.
- `quotation.controller.ts`: thêm route `POST/PATCH /quotations/:id/material-items[/:itemId]` (dùng chung quyền `quotation.update`, xoá dùng chung route `DELETE /items/:itemId` sẵn có).
- `return.service.ts`: chặn tạo Return cho dòng MATERIAL (ngoài phạm vi, báo lỗi rõ ràng).
- `sales-order.service.ts`: báo cáo B2 (`getRevenueByProduct`)/B4 (`getGrowthByProductType`) lọc `itemType=PRODUCT`, loại trừ dòng vật tư bán lẻ khỏi báo cáo theo sản phẩm/loại sản phẩm.

**FE:**
- `material-form.tsx`/`material-edit-form.tsx`: switch "Cho phép bán lẻ" + chọn đơn vị bán lẻ + hệ số quy đổi (chỉ hiện khi khác đơn vị gốc) + % VAT bán lẻ.
- `materials/page.tsx` + `material-table.tsx`: filter "Vật tư bán lẻ" + badge trong danh sách.
- `materials/[id]/page.tsx`: hiển thị thông tin bán lẻ (đơn vị, hệ số quy đổi, VAT).
- `material-typeahead.tsx` (dùng chung với Kho): thêm prop `onlyRetailable` để lọc vật tư khi chọn trong Báo giá.
- Mới: `material-item-dialog.tsx` — dialog "Thêm/Sửa vật tư".
- `quotations/[id]/page.tsx`: nút "Thêm vật tư" cạnh "Thêm sản phẩm"; `onEdit`/`onDuplicate` rẽ nhánh theo `itemType`.
- `quotation-item-table.tsx` + `print/page.tsx`: hiển thị dòng MATERIAL trong cùng 1 bảng (đã chốt không tách nhóm) — cột "Thông số" hiện đơn vị thay vì tham số CTO.

**Đã verify:** `tsc --noEmit` sạch (API + Web), `nest build`/`next build` pass. Test end-to-end qua service thật (bootstrap `AppModule`, gọi trực tiếp `QuotationWorkflowService`, bypass HTTP/auth): tạo báo giá có 1 dòng Sản phẩm (SP000036, có Pricing Rule + Material Requirement thật) + 1 dòng Vật tư (NL000184, bật tạm `isRetailable` rồi revert lại sau test) → sửa số lượng dòng vật tư → xem cost-summary → Gửi → Duyệt. Xác nhận: giá vốn dòng vật tư tính đúng (giá vốn mặc định × hệ số quy đổi), `SalesOrder.plannedCost` = tổng đúng cả 2 dòng, chỉ sinh **đúng 1** Production Order (cho dòng Sản phẩm), dòng MATERIAL không xuất hiện trong bất kỳ `ProductionOrderItem` nào, `productionCenterId` của dòng MATERIAL = null. Đã dọn sạch toàn bộ data test tạo ra.

**Chưa làm:** tự test qua UI trình duyệt thật (môi trường này không có công cụ browser).
