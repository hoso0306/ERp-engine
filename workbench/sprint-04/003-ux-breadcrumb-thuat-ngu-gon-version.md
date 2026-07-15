# Milestone (Sprint 04) - 3 cải tiến UX nhỏ: Breadcrumb động + cố định, dịch thuật ngữ, gọn danh sách version

> **Tên file:** `workbench/sprint-04/003-ux-breadcrumb-thuat-ngu-gon-version.md`
> **Trạng thái:** ✅ HOÀN THÀNH (15/07/2026) — cả 4 việc đã code, test, verify UI thật qua Playwright.

---

# Bối cảnh

3 điểm phát hiện khi user dùng thử thật:

1. Breadcrumb chỉ hiện tên trang cha (vd "Sản phẩm"), không hiện tên bản ghi cụ thể (vd tên sản phẩm) — và không cố định khi cuộn trang dài nên mất luôn điểm định hướng.
2. Một số nhãn UI còn tiếng Anh khó hiểu (vd "Expression") trong khi "version"/"rule" đã quen thuộc nên giữ nguyên.
3. Danh sách Version (Quy tắc báo giá / Định mức vật liệu) hiện render **toàn bộ** không giới hạn, không phân trang — sẽ tăng nhanh hơn trước vì tính năng "Sửa = tự tách bản Nháp mới" (milestone `012` Việc 2 phần bổ sung) khiến số version tăng nhanh hơn cách làm cũ.

Đã khảo sát code thực tế để xác nhận phạm vi chính xác trước khi lên kế hoạch (chi tiết dưới đây), không suy đoán.

---

# Việc 1 — Breadcrumb động (hiện tên bản ghi cụ thể) + cố định khi cuộn ✅

## 1a. Cơ chế breadcrumb động

**Khảo sát:** `page-breadcrumb.tsx` hiện chỉ khớp tên tĩnh khai báo sẵn trong `navigation.ts` theo `pathname` — hoàn toàn không có cách nào hiện tên động (tên khách hàng, mã đơn hàng...). Đây là lỗ hổng chung cho **mọi trang chi tiết** trong app (không riêng Sản phẩm), nhưng may mắn: **tất cả các trang chi tiết đã dùng chung 1 component `PageHeader`** (`src/components/shared/page-header.tsx`) với prop `title` đã sẵn đúng tên/mã cần hiện (`customer.name`, `material.name`, `order.code`, `quotation.code`, `role.name`...). Nghĩa là chỉ cần sửa **1 chỗ trung tâm** (`PageHeader`) là toàn bộ ~10 trang chi tiết tự động có breadcrumb đúng, không cần sửa từng trang.

**Ngoại lệ cần xử lý riêng:**
- 2 trang con của Sản phẩm (`pricing-rule/versions/[versionId]`, `material-requirement/versions/[versionId]`) **không dùng `PageHeader`** (có heading tự dựng riêng) — cần thêm thủ công.
- Trang Công nợ (`debts/[id]`) truyền `title` dạng `"Công nợ — ${code}"` — nếu để nguyên sẽ hiện breadcrumb dư chữ ("Công nợ > Công nợ — DH00123"). Cần cho `PageHeader` 1 prop tuỳ chọn để override riêng nhãn breadcrumb khi khác với tiêu đề trang.

**Thiết kế:**
1. **Context mới** `src/context/breadcrumb-context.tsx`: `BreadcrumbProvider` (state `{ label, href? } | null`) + hook `useSetBreadcrumbExtra(extra)` — page/component gọi để "đăng ký" đoạn breadcrumb động, tự dọn khi unmount hoặc đổi.
2. Gắn `BreadcrumbProvider` vào `app-layout.tsx` (bọc quanh `SidebarProvider`, để cả `Header` lẫn `{children}` đều đọc/ghi được).
3. **`PageHeader`** (`page-header.tsx`): thêm `"use client"`, gọi `useSetBreadcrumbExtra({ label: breadcrumbLabel ?? title })` — thêm prop tuỳ chọn `breadcrumbLabel?: string` (mặc định dùng `title`, chỉ trang Công nợ cần truyền riêng).
4. **`PageBreadcrumb`** (`page-breadcrumb.tsx`):
   - `getPageTitle()` trả thêm `href` (không chỉ `title`) để đoạn tĩnh (vd "Sản phẩm") có thể bấm được khi không phải đoạn cuối.
   - Nếu `extra.label` trùng với title tĩnh (trường hợp trang danh sách, vd `/products` có `PageHeader title="Sản phẩm"` giống hệt nav) → bỏ qua, không hiện trùng lặp.
   - Nếu khác → hiện thêm 1 đoạn breadcrumb cuối cùng: `Trang chủ > Sản phẩm > {tên sản phẩm}`.
5. **2 trang con Sản phẩm** (pricing-rule/material-requirement version): gọi thêm `GET /products/:id` (đã có sẵn API) để lấy `product.name`, gọi `useSetBreadcrumbExtra({ label: product.name, href: `/products/${productId}` })` thủ công.
6. **`debts/[id]/page.tsx`**: truyền thêm `breadcrumbLabel={receivable.salesOrder.code}` cho `PageHeader` (giữ `title` đầy đủ như cũ trên trang, chỉ breadcrumb ngắn gọn hơn).

**Danh sách trang tự động được fix qua bước 3 (không cần sửa gì thêm):** `customers/[id]`, `materials/[id]`, `orders/[id]`, `production/[id]`, `quotations/[id]`, `returns/[id]`, `warehouse/receipts/[id]`, `settings/roles/[id]`, `products/[id]`.

## 1b. Cố định breadcrumb khi cuộn

**Khảo sát:** `Header` hiện không có `sticky`; layout dùng `min-h-svh` (cho phép cao hơn màn hình) nên khi nội dung trang dài, cả `Header` lẫn nội dung cuộn chung theo document — mất điểm định hướng đúng như bạn thấy.

**Fix:** thêm `sticky top-0 z-30 bg-background` vào `<header>` trong `header.tsx` (giữ nguyên `border-b bg-background` đã có). Đơn giản, không cần đổi cấu trúc layout/`SidebarInset`.

---

# Việc 2 — Dịch "Expression" → "Công thức" ✅

Đã rà toàn bộ codebase, xác nhận đúng 5 vị trí (không có chỗ nào khác dùng chữ này ở UI):

1. `apps/web/src/app/products/[id]/pricing-rule/versions/[versionId]/page.tsx:325` — label form `"Expression *"`.
2. `apps/web/src/app/products/[id]/material-requirement/versions/[versionId]/page.tsx:359` — tiêu đề cột bảng `"Expression"`.
3. `apps/web/src/app/products/[id]/material-requirement/versions/[versionId]/page.tsx:572` — cột trong `ExcelImportDialog` preview.
4. `apps/web/src/components/product/material-requirement-item-dialog.tsx:182` — label form `"Expression *"`.
5. `apps/web/src/components/product/pricing-rule-section.tsx:93` — tiêu đề cột bảng danh sách version.

Đổi thống nhất thành **"Công thức"** (đúng bản chất: chuỗi biểu thức tính toán). Không đổi tên biến/field trong code (`expression` field name giữ nguyên — chỉ đổi chữ hiển thị cho người dùng).

---

# Việc 3 — Gọn danh sách Version (ẩn ARCHIVED mặc định) ✅

**Khảo sát:** `pricing-rule-section.tsx` và `material-requirement-section.tsx` (cấu trúc giống hệt nhau) hiện render toàn bộ version trong 1 bảng phẳng, không giới hạn.

**Fix (áp dụng cho cả 2 file, độc lập, không tạo component dùng chung mới — giữ đúng phong cách hiện tại của 2 file này vốn đã tách riêng dù giống nhau):**
- Lọc `versions` thành 2 nhóm: `current` (status `DRAFT` hoặc `ACTIVE` — luôn hiện) và `archived` (status `ARCHIVED` — ẩn mặc định).
- Nếu `archived.length > 0`: hiện 1 dòng/nút **"Xem lịch sử (N phiên bản cũ)"** bên dưới bảng `current`, bấm vào mới render thêm bảng `archived` (state `showArchived`, toggle đơn giản, không cần phân trang thêm).
- Không đổi API, không đổi bất kỳ logic backend nào — chỉ ẩn/hiện phía FE.

---

# Việc 4 — Dialog "Thêm Item" (Định mức vật liệu): chọn vật tư khó, thiếu gợi ý biến, đổi tên ✅

**Khảo sát:** `material-requirement-item-dialog.tsx` — 3 vấn đề, đã xác nhận đúng qua code, không suy đoán.

## 4a. Ô chọn vật tư khó dùng (không tìm kiếm được)

- Hiện dùng `<Select>` (`ui/select.tsx`, dòng 166-178) — load sẵn 200 vật tư (`/materials?limit=200`) rồi liệt kê phẳng, không có ô tìm kiếm. Popup bị hẹp vì `SelectTrigger` không set width cố định (`w-fit`, dòng cn), khiến tên vật tư dài bị cắt/xuống dòng xấu như ảnh bạn gửi.
- **May mắn:** dự án đã có sẵn component đúng nhu cầu — `src/components/warehouse/material-typeahead.tsx` (`MaterialTypeahead`) — ô input gõ-để-tìm (debounce 300ms, gọi `/materials?search=...`), điều hướng bàn phím, hiển thị đã chọn kèm nút bỏ chọn. Đang dùng cho nghiệp vụ Kho.
- **Fix:** thay `<Select>` bằng `<MaterialTypeahead>` trong dialog này — bỏ hẳn việc tải sẵn 200 vật tư (`apiGet("/materials?limit=200")` ở `useEffect` dòng 80), để `MaterialTypeahead` tự gọi API tìm kiếm theo từ khoá. Cần điều chỉnh state `materialId` (string) → lưu thêm object `MaterialOption` đã chọn (để hiển thị lại đúng tên/mã khi mở dialog Sửa — hiện tại lúc edit chỉ có `item.materialId`, cần dùng `item.material` có sẵn trong props để khởi tạo).

## 4b. Thiếu gợi ý biến dưới ô Công thức (Expression)

- Trang cha (`material-requirement/versions/[versionId]/page.tsx` dòng 311-316) đã có đúng đoạn gợi ý "Biến có thể dùng trong Expression/Điều kiện: ..." (lọc `parameters.filter(p => p.usedInMaterial)`) — nhưng đoạn này chỉ hiện ở FORM CỦA TRANG CHA, không có trong dialog "Thêm Item" — đúng chỗ người dùng cần thấy nhất lúc gõ công thức.
- **Fix:** thêm đoạn gợi ý y hệt (cùng style `rounded-md bg-muted/50 p-3 text-xs`) ngay dưới ô Expression trong `material-requirement-item-dialog.tsx`, dùng lại prop `parameters` đã truyền sẵn vào dialog (lọc `usedInMaterial`). Mở rộng `ConditionParameter` (`condition-builder.tsx`) thêm field optional `usedInMaterial?: boolean` để lọc được (không phá các chỗ khác đang dùng `ConditionParameter` vì là field optional).

## 4c. Đổi tên "Item" → "Công thức vật tư"

Đồng bộ toàn bộ 5 vị trí đang gọi là "Item" trong luồng này (đổi nhất quán Thêm/Sửa/Xoá, không chỉ riêng nút bạn chỉ ra, để tránh lệch thuật ngữ giữa 3 hành động cùng 1 khái niệm):

1. `material-requirement-item-dialog.tsx:160` — `DialogTitle`: `"Thêm Item"` → `"Thêm công thức vật tư"`, `"Chỉnh sửa Item"` → `"Sửa công thức vật tư"`.
2. `material-requirement-item-dialog.tsx:146` — toast: `"Thêm Item thành công."` → `"Thêm công thức vật tư thành công."`.
3. `material-requirement-item-dialog.tsx:244` — nút submit: `"Thêm Item"` → `"Thêm công thức vật tư"`.
4. `.../page.tsx:345` — nút mở dialog: `"Thêm Item"` → `"Thêm công thức vật tư"`.
5. `.../page.tsx:546` — `ConfirmDialog title="Xoá Item"` → `"Xoá công thức vật tư"`.

---

# Test

- **Việc 4a:** mở dialog Thêm/Sửa công thức vật tư → gõ từ khoá (mã hoặc tên) → thấy kết quả lọc đúng, chọn được, hiển thị lại đúng vật tư đã chọn kèm nút bỏ chọn. Mở dialog Sửa 1 item có sẵn → ô vật tư hiện đúng vật tư đang gán (không bị trống).
- **Việc 4b:** mở dialog → thấy đúng danh sách biến hiện dưới ô Công thức, khớp với thông số sản phẩm có `usedInMaterial = true`.
- **Việc 4c:** rà lại bằng `grep "Item"` trong 2 file trên, xác nhận không còn sót chữ "Item" nào ở text hiển thị người dùng (biến/field code giữ nguyên, không đổi).

- **Việc 1a:** vào từng trang chi tiết trong danh sách ở trên → breadcrumb hiện đúng "Trang chủ > [Nhóm] > [Tên/Mã bản ghi]", đoạn giữa bấm được quay lại danh sách. Vào trang danh sách (vd `/products`) → breadcrumb KHÔNG bị lặp "Sản phẩm > Sản phẩm". Vào 2 trang version con → hiện đúng tên sản phẩm cha.
- **Việc 1b:** cuộn 1 trang dài (vd Quy tắc báo giá có nhiều Rule) → breadcrumb luôn hiện ở đầu màn hình.
- **Việc 2:** rà lại 5 vị trí đã đổi đúng "Công thức", không sót chữ "Expression" nào khác qua `grep`.
- **Việc 3:** test với version có cả DRAFT/ACTIVE/ARCHIVED → mặc định chỉ hiện current, bấm "Xem lịch sử" mới hiện ARCHIVED. Test sản phẩm chỉ có 1 version ACTIVE, không có ARCHIVED nào → không hiện nút "Xem lịch sử" (tránh nút thừa vô nghĩa).
- Chạy `tsc --noEmit`, kiểm tra UI thật qua Playwright (screenshot breadcrumb + sticky + danh sách version thu gọn).

---

# Kết quả thực hiện

**File mới:**
- `apps/web/src/context/breadcrumb-context.tsx` — `BreadcrumbProvider` + hook `useSetBreadcrumbExtra()`.

**File đã sửa:**
- `apps/web/src/components/layout/app-layout.tsx` — gắn `BreadcrumbProvider`.
- `apps/web/src/components/shared/page-header.tsx` — gọi `useSetBreadcrumbExtra`, thêm prop `breadcrumbLabel`.
- `apps/web/src/components/shared/page-breadcrumb.tsx` — `getPageTitle()` trả thêm `href`, dedup khi trùng tên trang danh sách, đoạn giữa bấm được khi có đoạn động theo sau.
- `apps/web/src/app/products/[id]/pricing-rule/versions/[versionId]/page.tsx`, `.../material-requirement/versions/[versionId]/page.tsx` — gọi `GET /products/:id` lấy tên sản phẩm, đăng ký breadcrumb thủ công; đổi label "Expression" → "Công thức" (thêm 1 vị trí phát sinh ngoài kế hoạch: dòng gợi ý biến "Biến có thể dùng trong Expression/Điều kiện").
- `apps/web/src/app/debts/[id]/page.tsx` — truyền `breadcrumbLabel` riêng cho `PageHeader`.
- `apps/web/src/components/layout/header.tsx` — thêm `sticky top-0 z-30`.
- `apps/web/src/components/product/pricing-rule-section.tsx`, `material-requirement-section.tsx` — tách `current`/`archived`, toggle "Xem lịch sử (N phiên bản cũ)"; đổi cột "Expression" → "Công thức".
- `apps/web/src/components/product/material-requirement-item-dialog.tsx` — thay `<Select>` bằng `<MaterialTypeahead>` (bỏ hẳn `apiGet("/materials?limit=200")`), thêm hộp gợi ý biến dưới ô Công thức, đổi toàn bộ nhãn "Item" → "công thức vật tư" (bao gồm 2 vị trí phát sinh ngoài kế hoạch: toast lỗi "Expression là bắt buộc" và validate message).
- `apps/web/src/components/product/condition-builder.tsx` — thêm field optional `usedInMaterial?: boolean` vào `ConditionParameter`.
- `apps/web/src/app/products/[id]/material-requirement/versions/[versionId]/page.tsx` — đổi nút "Thêm Item" → "Thêm công thức vật tư", `ConfirmDialog title="Xoá Item"` → "Xoá công thức vật tư", 2 toast xoá cũng đổi theo (phát sinh ngoài kế hoạch, cùng tinh thần Việc 4c).

**Rà soát bổ sung ngoài kế hoạch ban đầu:** lúc `grep` lại để verify, phát hiện thêm 2 vị trí "Expression" và 2 vị trí "Item" trong toast/thông báo lỗi mà bản kế hoạch gốc chưa liệt kê hết — đã sửa luôn cho nhất quán (cùng bản chất đổi thuật ngữ/tên gọi đã duyệt, không phải quyết định mới).

**Test:**
- `tsc --noEmit` sạch cả API lẫn Web.
- Verify UI thật bằng Playwright trên SP000003 (có 6 version Pricing Rule ARCHIVED + 1 ACTIVE, 2 Material Requirement ARCHIVED + 1 ACTIVE — ca thật, không phải dựng riêng):
  - Breadcrumb trang chi tiết sản phẩm: "Trang chủ > Sản phẩm > [Cửa lưới] Hệ 27 - Khung trắng/ghi/cafe" — đúng, "Sản phẩm" bấm được.
  - Cả 2 bảng version (Pricing Rule, Material Requirement) mặc định chỉ hiện version current, nút "Xem lịch sử (N phiên bản cũ)" hiện đúng số lượng, bấm vào hiện đủ toàn bộ ARCHIVED với dữ liệu chính xác.
  - Vào trang version con: breadcrumb hiện đúng tên sản phẩm cha; cột/label "Công thức" đã thay "Expression".
  - Cuộn trang xuống 800px: breadcrumb vẫn cố định ở đầu màn hình (so sánh trước/sau).
  - Dialog "Thêm công thức vật tư": tiêu đề, nút submit đúng tên mới; gõ "lưới" lọc đúng còn 2 kết quả; chọn xong hiện đúng vật tư kèm nút bỏ chọn; hộp gợi ý biến "socanh, mausac, chieucao, chieurong" hiện đúng dưới ô Công thức.
- Đã dọn toàn bộ version Nháp phát sinh lúc test (dùng tính năng "Sửa" để tạo bản test rồi xoá sau khi xong).

**Lưu ý:** trong lúc thực hiện, phát hiện milestone `002-sanh-cho-trang-chu.md` đã được code xong song song (không phải do tôi làm trong task này) — đã đọc lại, xác nhận không xung đột với các thay đổi ở đây (file `page-breadcrumb.tsx`/`header.tsx` cùng bị 2 việc chạm vào nhưng nội dung bổ sung cho nhau, không ghi đè mất phần nào).

**Đề xuất commit message:**
```
fix(web): breadcrumb động + cố định, dịch "Expression", gọn danh sách version, sửa dialog thêm công thức vật tư

- Breadcrumb hiện tên bản ghi cụ thể (qua PageHeader) thay vì chỉ tên trang cha, cố định khi cuộn
- Dịch "Expression" -> "Công thức" toàn bộ màn hình Quy tắc báo giá/Định mức vật liệu
- Ẩn version ARCHIVED mặc định, gom vào "Xem lịch sử" để danh sách gọn hơn
- Dialog thêm công thức vật tư: đổi ô chọn vật tư sang MaterialTypeahead (tìm kiếm được),
  thêm gợi ý biến, đổi tên "Item" -> "công thức vật tư"
```

---

# Quy trình làm việc

Theo đúng quy ước dự án: làm xong dừng lại tóm tắt + đề xuất commit message, chờ lệnh. 4 việc độc lập nhau, có thể làm chung 1 lượt (đều nhỏ, rủi ro thấp) hoặc tách riêng theo lệnh của bạn.
