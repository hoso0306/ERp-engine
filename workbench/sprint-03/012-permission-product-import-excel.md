# Milestone (Sprint 03) - Gắn quyền Product + Import Excel Matrix/BOM

> **Tên file:** `workbench/sprint-03/012-permission-product-import-excel.md`
> **Trạng thái:** ĐÃ DUYỆT — chờ lệnh bắt đầu code.

---

# Bối cảnh

Sau khi hoàn thành milestone `011-pricing-bom-engine.md`, review phát hiện 2 việc còn thiếu, độc lập với Task 10/11 đã xong:

1. **Lỗ hổng thật:** toàn bộ `ProductModule` (10 controller — Product, Material, Unit, ProductType, ProductParameter, PricingRule, MaterialRequirement, ProductionCenter, ValidationRule, DerivedParameter) hiện **không có `@UseGuards` nào** — bất kỳ ai cũng gọi được API sửa Matrix/BOM/kích hoạt version mà không cần đăng nhập. Mọi module nghiệp vụ khác (Quotation, SalesOrder, Warehouse, Debt...) đều bắt buộc `@UseGuards(AuthGuard, PermissionGuard)`.
2. `knowledge/modules/permission.md` liệt kê Product là module phải dùng Permission, nhưng phần "Action Permission" chưa từng viết mục Product — và `PERMISSION_CATALOG` trong `prisma/seed.ts` không có key `product.*`. Đây là lỗ hổng thiết kế có thật, không chỉ thiếu code.
3. Sales cần cách nhập bảng giá/định mức vật tư nhanh hơn nhập tay từng ô — Import Excel bổ trợ trực tiếp cho Price Matrix editor và Material Requirement editor đã làm ở Task 10.

---

# Việc 1 — Gắn quyền cho module Product ✅ HOÀN THÀNH (13/07/2026)

## Bộ Action (đã chốt)

```
product.view / create / update / delete / activate / export
production-center.view / create / update / delete   (tách riêng khỏi "production")
```

`activate` = kích hoạt Pricing Rule Version / Material Requirement Version — tách riêng khỏi `update` cùng logic Quotation tách `approve` khỏi `update`, vì đây là hành động đổi giá/định mức đang chạy live cho cả doanh nghiệp.

`production-center` tách khỏi resource `production` hiện có (vốn chỉ có `view/start/complete` cho ProductionOrder, khác mục đích với CRUD xưởng sản xuất).

## Phân quyền theo Role (đã chốt)

| Role | product.view | product create/update/delete | product.activate | product.export | production-center.view | production-center create/update/delete |
|---|---|---|---|---|---|---|
| OWNER, ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✓ (mặc định qua `viewKeys()`) | ✗ | ✗ **(chốt: chỉ owner/admin)** | ✗ | ✓ | ✗ |
| SALES | ✓ **(thêm mới — bắt buộc để chọn sản phẩm khi tạo báo giá)** | ✗ | ✗ | ✗ | ✗ | ✗ |
| PRODUCTION | ✓ **(thêm mới — xem BOM/định mức vật tư)** | ✗ | ✗ | ✗ | ✓ **(thêm mới)** | ✗ |
| WAREHOUSE, ACCOUNTANT, VIEWER | không đổi | ✗ | ✗ | ✗ | không đổi | ✗ |

`activate` không nằm trong nhóm filter `['approve','override','cancel']` của MANAGER — giữ nguyên logic seed hiện tại là tự động đúng, không cần thêm rule loại trừ.

PRODUCTION role có `production-center.view` (xem danh sách xưởng khi làm việc) nhưng không có create/update/delete — quản lý xưởng vẫn chỉ OWNER/ADMIN.

## Việc làm

1. Cập nhật `knowledge/modules/permission.md`: thêm mục "Product" và "Production Center" vào phần Action Permission (giữ tài liệu là nguồn sự thật).
2. `prisma/seed.ts`:
   - Thêm `product: ['view','create','update','delete','activate','export']` và `production-center: ['view','create','update','delete']` vào `PERMISSION_CATALOG`.
   - Sửa `SALES` role: thêm `'product.view'`.
   - Sửa `PRODUCTION` role: thêm `'product.view'`, `'production-center.view'`.
3. Gắn `@UseGuards(AuthGuard, PermissionGuard)` ở class-level cho cả 10 controller trong `ProductModule`, và `@RequirePermission('...')` từng handler theo map:
   - GET → `product.view` (riêng ProductionCenterController → `production-center.view`)
   - POST (tạo mới) → `product.create` (riêng ProductionCenterController → `production-center.create`)
   - PATCH → `product.update` (riêng ProductionCenterController → `production-center.update`)
   - DELETE → `product.delete` (riêng ProductionCenterController → `production-center.delete`)
   - `.../activate` → `product.activate`
   - `.../preview` → `product.view` (chỉ tính toán, không ghi dữ liệu)
   - `.../export` → `product.export`
4. `PricingEngineController` (`/pricing-engine/calculate`, module riêng ngoài ProductModule): `@UseGuards(AuthGuard, PermissionGuard)` + `@RequirePermission('product.view')`.
5. Chạy `npx prisma db seed` để áp dụng permission mới cho Role hiện có.

## Test

- Gọi thử các endpoint Product bằng token của từng Role (SALES, PRODUCTION, VIEWER, WAREHOUSE) xác nhận đúng bị chặn/cho phép theo bảng trên.
- Test không có token → 401 ở mọi endpoint Product.
- Test SALES gọi được `/pricing-engine/calculate` và xem được danh sách Product (không vỡ luồng tạo báo giá).

## Kết quả thực hiện

**File đã sửa:**
- `knowledge/modules/permission.md` — thêm mục "Product" và "Production Center" vào Action Permission.
- `apps/api/prisma/seed.ts` — thêm `product.*`, `production-center.*` vào `PERMISSION_CATALOG`; SALES thêm `product.view`; PRODUCTION thêm `product.view` + `production-center.view`.
- `apps/api/src/product/*.controller.ts` (10 file) — gắn `@UseGuards(AuthGuard, PermissionGuard)` + `@RequirePermission(...)` từng handler.
- `apps/api/src/pricing-engine/pricing-engine.controller.ts` — gắn guard + `product.view`.
- `apps/api/src/product/product.module.ts`, `apps/api/src/pricing-engine/pricing-engine.module.ts` — import thêm `PermissionModule` (thiếu thì Nest crash lúc khởi động do `AuthGuard`/`PermissionGuard` không resolve được dependency — phát hiện khi chạy thử thật, không phải trong kế hoạch ban đầu).

**Đã chạy `npx prisma db seed`** — xác nhận qua query trực tiếp DB: đúng 100% bảng phân quyền đã chốt (OWNER/ADMIN đủ quyền; MANAGER/VIEWER chỉ `view`; SALES/PRODUCTION có thêm `product.view` tương ứng; WAREHOUSE/ACCOUNTANT không đổi).

**Đã test thật bằng token JWT thật của từng Role** (không chỉ đọc code): tạo user tạm cho SALES/PRODUCTION/WAREHOUSE/VIEWER/MANAGER, gọi curl thật qua API đang chạy — toàn bộ kết quả đúng như bảng phân quyền: không token → 401; WAREHOUSE xem Product → 403; MANAGER/SALES tạo Product → 403; MANAGER/SALES activate pricing version → 403 (đúng chốt "chỉ owner/admin"); PRODUCTION xem production-center → 200 nhưng tạo mới → 403; SALES gọi `pricing-engine/calculate` → không bị chặn quyền. Đã xoá user test tạm sau khi xong.

**192/192 test API vẫn pass**, `tsc` sạch.

**Lưu ý phụ:** trong lúc test `product.activate`, đã kích hoạt thật version v6 (Draft) của SP000003 trên DB dev cục bộ (tác dụng phụ của việc gọi API thật, không phải cố ý đổi dữ liệu nghiệp vụ) — v6 có sẵn Price Matrix đã điền từ lúc test Task 10 trước đó nên không phải dữ liệu rác. Không ảnh hưởng gì ngoài môi trường dev.

**Đề xuất commit message:**
```
fix(permission): gắn AuthGuard/PermissionGuard cho toàn bộ ProductModule

- Thêm resource product.* và production-center.* vào Permission catalog
- Vá lỗ hổng: 10 controller Product trước đây không yêu cầu đăng nhập
- Cấp product.view cho SALES/PRODUCTION để không vỡ luồng báo giá/sản xuất
```

---

# Việc 2 — Import Excel cho Price Matrix + BOM ✅ HOÀN THÀNH (14/07/2026)

## Nguyên tắc chung (đã chốt)

**Upload → Preview (validate toàn bộ, không ghi DB) → chỉ cho Áp dụng khi 0 lỗi.** Không cho áp dụng một phần khi còn dòng lỗi — bắt sửa hết mới cho áp dụng, áp dụng cho cả Matrix lẫn BOM. Chỉ cho phép trên version **DRAFT**. Parse Excel bằng ExcelJS (đã có sẵn dependency, dùng cho export) — không thêm thư viện parse Excel ở FE.

## A. Import Price Matrix

- Nút "Tải mẫu Excel" trên `PriceMatrixEditor` → xuất file cột = tham số ENUM của sản phẩm + cột "Đơn giá", điền sẵn dữ liệu hiện có (tái dùng cách `exportProduct` đang làm).
- API mới: `POST /products/:productId/pricing-rule/versions/:versionId/matrix/import-preview` (multipart) → parse, khớp tổ hợp ENUM hợp lệ → trả `{ rows, errors }`, **không ghi DB**.
- Áp dụng: tái dùng nguyên `PATCH .../matrix` đã có (Task 10) — FE gửi `rows` đã preview lên, không cần endpoint ghi riêng.
- FE: nếu `errors.length > 0` → chỉ hiển thị bảng lỗi (dòng, lý do), nút "Áp dụng" disabled. 0 lỗi → cho áp dụng.

## B. Import BOM (Material Requirement)

- Nút "Tải mẫu Excel" trên trang Material Requirement version → cột: Mã vật tư, Expression, Condition, Hao hụt (%), Round Step, Ghi chú.
- API mới:
  - `POST /products/:productId/material-requirement/versions/:versionId/items/import-preview` — parse, khớp `Mã vật tư` với Material có sẵn (**không tự tạo Material mới** nếu mã không tồn tại — báo lỗi rõ) → `{ rows, errors }`.
  - `PUT /products/:productId/material-requirement/versions/:versionId/items` (endpoint mới, bulk) — nhận danh sách đã preview, **upsert theo materialId** (chốt: mặc định upsert — dòng vật tư có sẵn không nằm trong file thì giữ nguyên, không xoá; không có tuỳ chọn "thay thế toàn bộ" ở bản này, tránh tổng quát hoá sớm).
- FE: cùng rule chặn như Matrix — có lỗi thì không cho áp dụng.

## Việc làm

1. DTO chung cho import-preview: `{ rows: Array<{...dữ liệu đã parse}>, errors: Array<{ row: number; message: string }> }`.
2. Service method parse Excel — validate từng dòng, gom hết lỗi (không dừng ở lỗi đầu tiên) để FE hiển thị đầy đủ một lần.
3. 2 endpoint `import-preview` (Matrix + BOM) + 1 endpoint `PUT` bulk items mới cho BOM.
4. FE: component Upload dùng chung (dialog chọn file → gọi preview → bảng kết quả, dòng lỗi tô đỏ kèm lý do → nút "Áp dụng" chỉ bật khi sạch lỗi).
5. Test: file hợp lệ áp dụng đúng dữ liệu; file có ít nhất 1 dòng sai → toàn bộ bị chặn, không ghi phần đúng; import BOM giữ nguyên dòng cũ không có trong file (đúng rule upsert).

## Kết quả thực hiện

**File đã sửa/thêm:**
- `apps/api/src/product/product.service.ts` — inject `ExcelService`; thêm `loadEnumParamsForPricing()` (helper), `exportPriceMatrixTemplate()`, `previewPriceMatrixImport()`, `exportMaterialRequirementTemplate()`, `previewMaterialRequirementImport()`, `bulkUpsertMaterialRequirementItems()`.
- `apps/api/src/product/dto/bulk-upsert-material-requirement-items.dto.ts` (mới).
- `apps/api/src/product/pricing-rule.controller.ts` — thêm `GET .../matrix/template`, `POST .../matrix/import-preview` (permission `product.update`, FileInterceptor).
- `apps/api/src/product/material-requirement.controller.ts` — thêm `GET .../items/template`, `POST .../items/import-preview`, `PUT .../items` (bulk upsert) — cùng permission `product.update`.
- `apps/api/src/product/product-excel-import.service.spec.ts` (mới, 20 test case) — build workbook thật bằng ExcelJS (không mock `ExcelService`), test round-trip đọc/parse/validate cho cả Matrix và BOM, cùng bulk upsert (update tồn tại + tạo mới + giữ nguyên dòng không có trong file).
- `apps/web/src/components/product/excel-import-dialog.tsx` (mới) — dialog dùng chung generic `<T>`: đọc file → gọi API preview → bảng preview + bảng lỗi đỏ → nút Áp dụng chỉ bật khi 0 lỗi → `onApply` gọi API ghi riêng của từng màn hình.
- `apps/web/src/components/product/price-matrix-editor.tsx` — thêm nút "Nhập từ Excel", gắn `ExcelImportDialog`, áp dụng qua `PATCH .../matrix` có sẵn.
- `apps/web/src/app/products/[id]/material-requirement/versions/[versionId]/page.tsx` — thêm nút "Nhập từ Excel", gắn `ExcelImportDialog`, áp dụng qua `PUT .../items` mới.

**Quyết định khi code (không lệch thiết kế, chỉ cụ thể hoá):**
- Template Matrix hiển thị theo **label** của option ENUM (dễ đọc/nhập tay hơn value dạng code), khi import khớp theo cả value lẫn label (không phân biệt hoa/thường) để linh hoạt.
- `import-preview` của cả Matrix lẫn BOM đều kiểm tra version phải DRAFT trước khi parse — tránh preview vô nghĩa trên version không sửa được.
- Endpoint template + import-preview dùng permission `product.update` (không dùng `product.view`) — vì hai endpoint này chỉ có giá trị đi kèm khả năng sửa/áp dụng, nhất quán với quyền của `PATCH .../matrix`.
- Dòng trống hoàn toàn ở cuối file Excel được bỏ qua âm thầm (không tính là lỗi) — tránh dòng thừa Excel hay giữ lại gây lỗi giả.

**Test:**
- 20 test mới (`product-excel-import.service.spec.ts`) + toàn bộ suite cũ: **217/217 pass**. `tsc --noEmit` sạch cả API lẫn Web.
- Verify API thật (JWT thật, gọi qua server đang chạy): Matrix — preview đúng 4/4 dòng hợp lệ, phát hiện đúng giá trị ENUM sai, Apply qua `PATCH .../matrix` ghi đúng 4 dòng. BOM — preview đúng 1 dòng hợp lệ + báo lỗi rõ mã vật tư không tồn tại (không tự tạo), Apply qua `PUT .../items` upsert đúng: dòng có sẵn được update, 4 dòng khác không nằm trong file **giữ nguyên** (đúng rule upsert, không xoá).
- Verify UI thật bằng Playwright (screenshot xem trực tiếp): dialog mở đúng, đọc file hiển thị bảng preview + toast, trường hợp có lỗi hiển thị đúng dòng/lý do màu đỏ và khoá nút Áp dụng, trường hợp hợp lệ bấm Áp dụng ghi đúng dữ liệu và đóng dialog.
- Đã xoá toàn bộ version DRAFT/file Excel tạm sinh ra trong lúc test.

**Đề xuất commit message:**
```
feat(product): import Excel cho Price Matrix và Material Requirement

- Thêm luồng Upload → Preview (validate, không ghi DB) → Áp dụng khi 0 lỗi
- Price Matrix: khớp tổ hợp ENUM theo value/label, tái dùng PATCH .../matrix có sẵn
- BOM: khớp Mã vật tư có sẵn (không tự tạo), upsert qua PUT .../items mới,
  giữ nguyên dòng không có trong file
- Component ExcelImportDialog dùng chung cho cả 2 màn hình
```

---

# Quy trình làm việc

Theo đúng quy ước dự án: mỗi lần 1 Task, xong dừng lại tóm tắt + đề xuất commit message, chờ lệnh làm Task tiếp theo. Việc 1 và Việc 2 độc lập nhau, có thể làm theo thứ tự bất kỳ — đề xuất làm Việc 1 (lỗ hổng bảo mật) trước.
