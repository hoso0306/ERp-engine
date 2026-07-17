# Milestone (Sprint 04) - Chiết khấu theo Khách hàng×Sản phẩm, tái cấu trúc Discount Engine, VAT/Giảm thêm vào Công nợ

> **Tên file:** `workbench/sprint-04/005-chiet-khau-khach-hang-vat-bao-gia.md`
> **Trạng thái:** ✅ HOÀN THÀNH (17/07/2026)

---

# Bối cảnh

Từ câu hỏi về cột "Giá hệ thống" trên trang chi tiết báo giá, người dùng yêu cầu tái cấu trúc khá sâu Discount Engine của module Báo giá. Đã trao đổi và chốt các quyết định sau (16/07/2026):

1. **Bỏ cột "Giá hệ thống"** — chỉ còn "Giá bán" (= `systemPrice` do Pricing Engine tính, không đổi tên field trong code, chỉ đổi nhãn hiển thị + bỏ cột trùng lặp).
2. **Chiết khấu theo Khách hàng × Sản phẩm** (mới) **THAY THẾ HOÀN TOÀN** "CK nhóm" (`CustomerGroup.discountPercent`) — cấu hình riêng: khách A mua sản phẩm X được giảm bao nhiêu %, sản phẩm Y có thể không được giảm. Mặc định 0% nếu chưa cấu hình. Chỉ dùng đơn vị %.
3. **Thứ tự hiển thị/in cho khách**: Sản phẩm > Thông số > Giá bán > Chiết khấu > SL > Thành tiền > VAT > Chú thích (gồm cảnh báo Validation Rule + ghi chú tay nhập thêm).
4. **"Giảm thêm" chuyển từ cấp dòng sản phẩm lên cấp toàn báo giá** — chỉ giảm bằng **số tiền mặt** (bỏ %), áp trên **Tổng thanh toán** (đã gồm VAT), không còn ở từng dòng.
5. **Khoản Giảm thêm + VAT PHẢI phản ánh đúng vào Công nợ** (ví dụ đã chốt: Tổng tiền hàng 2.138.000 + VAT 171.040 − Giảm thêm 100.000 = Công nợ ghi nhận **2.209.040**, không phải 2.138.000 như hiện tại) — nghĩa là phải **mở lại phạm vi Sales Order/Receivable** đã cố tình để "ngoài phạm vi" ở milestone VAT trước (`004-vat-quy-tac-bao-gia.md`). `SalesOrder.totalAmount` (doanh thu sổ sách) **giữ nguyên** không đổi — chỉ `Receivable.totalAmount` là số tiền thực thu mới.
6. **Xoá `Customer.defaultDiscount`** — field có sẵn trong schema nhưng không được dùng ở đâu cả (xác nhận qua khảo sát), dọn dẹp luôn cho khỏi nhầm với cơ chế chiết khấu mới.

**Đã khảo sát xác nhận an toàn trước khi thiết kế** (không suy đoán):

- `CustomerGroup.discountPercent` chỉ được đọc ở đúng 1 chỗ trong toàn bộ backend (`quotation-workflow.service.ts` lúc `addItem`) — không Report/Dashboard/trang nào khác đụng tới → xoá field an toàn.
- Không có `CustomerGroup` CRUD form nào cho phép sửa `discountPercent` (chỉ là dropdown chọn nhóm) → không cần sửa form nào khác.
- `Receivable.totalAmount` và `SalesOrder.totalAmount` **hiện chỉ trùng nhau tình cờ** (cùng gán 1 biến `totalAmount` lúc tạo, `quotation-workflow.service.ts:1003-1052`) — không có code nào khác (Debt module, Dashboard, 2 trang chi tiết FE) đọc/so sánh hai giá trị này với nhau. Tách rời an toàn.
- `remainingAmount >= 0` CHECK constraint (Concurrency Rule, `debt.md`) chỉ ràng buộc nội bộ `Receivable.totalAmount − paidAmount`, không liên quan gì đến việc `totalAmount` bằng bao nhiêu lúc tạo → **không vi phạm** nguyên tắc concurrency đã chốt trong CLAUDE.md khi đổi công thức tính `Receivable.totalAmount`.
- `Customer.defaultDiscount` không được đọc bởi bất kỳ engine tính giá nào (kể cả trước đây) — chỉ có CRUD/Excel import-export tự tham chiếu chính nó. Xoá an toàn.

---

# Ghi chú thực hiện (đã xác nhận với người dùng 16/07/2026)

- **Migration Việc 1 sẽ làm mất dữ liệu chiết khấu cũ** trên mọi báo giá/đơn hàng đang tồn tại trong DB dev (`DROP COLUMN` các field cũ, không backfill vì 2 cơ chế khác bản chất) — **đã được chấp nhận**, đây là DB dev.
- **Việc 8** (đồng bộ trang Order/Sales Order): trước khi sửa, khảo sát thực tế `orders/[id]/page.tsx` + `sales-order-item-table.tsx` xem có bảng chi tiết dòng cần đồng bộ hiển thị không — quy mô thật sẽ được báo lại đầu Việc 8, không áng chừng trước.
- **Nhịp báo cáo**: báo cáo theo cụm, không dừng sau từng Việc — cụm 1: Việc 1-3 (nền tảng dữ liệu), cụm 2: Việc 4-6 (logic tính toán), cụm 3: Việc 7-9 (hiển thị + docs), cụm 4: Việc 10-11 (test + verify). Sau mỗi cụm, đánh dấu ✅ các mục đã xong trong file này rồi báo cáo ngắn gọn, tiếp tục cụm sau mà không chờ lệnh (đã được uỷ quyền chạy tuần tự tới hết).

---

# Thiết kế dữ liệu

## Model mới: `CustomerProductDiscount`

```prisma
model CustomerProductDiscount {
  id              String   @id @default(cuid())
  customerId      String   @map("customer_id")
  productId       String   @map("product_id")
  discountPercent Decimal  @map("discount_percent") @db.Decimal(5, 2)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  customer Customer @relation(fields: [customerId], references: [id])
  product  Product  @relation(fields: [productId], references: [id])

  @@unique([customerId, productId])
  @@map("customer_product_discounts")
}
```

Đây là **Master Data** (giống Pricing Rule) — không versioned, CRUD đơn giản. Khi thêm/sửa dòng báo giá, hệ thống **snapshot** % này vào `QuotationItem.discountPercent` (giống hệt cách `groupDiscount` cũ hoạt động) — sửa cấu hình sau đó không ảnh hưởng báo giá đã tạo.

## `QuotationItem` — bỏ 5 field, thêm 2 field

Bỏ: `groupDiscount`, `additionalDiscountPercent`, `additionalDiscountAmount`, `discountReason`, `discountBy`.
Thêm: `discountPercent` (snapshot từ `CustomerProductDiscount`, default 0), `note` (Chú thích tay, nullable).

`finalPrice`/`subtotal` giữ nguyên ý nghĩa, công thức đơn giản hơn: `finalPrice = round(systemPrice × (1 − discountPercent/100))`.

## `SalesOrderItem` — đồng bộ

Bỏ: `groupDiscount` (đổi tên → `discountPercent`), `additionalDiscountPercent`, `additionalDiscountAmount`.
Thêm: `discountPercent`, `vatRate`, `vatAmount`, `note` (snapshot đầy đủ tại Approve, đúng Snapshot Rule).

## `Quotation` — thêm 3 field (Giảm thêm cấp toàn báo giá)

`discountAmount` (số tiền mặt, default 0), `discountReason`, `discountBy`. Validate: `discountAmount ≤ Tổng tiền hàng + Tổng VAT` (không cho âm), bắt buộc `discountReason` khi `discountAmount > 0` — cùng logic `validateDiscountFields` cũ, chỉ bỏ nhánh %.

## `SalesOrder` — thêm 4 field (snapshot tại Approve)

`totalVatAmount` (= sum item.vatAmount), `discountAmount`, `discountReason`, `discountBy` (copy từ Quotation), `grandTotal` (= `totalAmount + totalVatAmount − discountAmount`) — **đây là Derived Data hợp lệ theo Nguyên tắc 13 (Snapshot)**: số tiền hoá đơn thực tế tại thời điểm Approve, bất biến, không tính lại được từ đâu khác sau này.

`totalAmount` (doanh thu) **giữ nguyên công thức cũ** — không cộng VAT, không trừ Giảm thêm.

## `Receivable` — không đổi schema, đổi GIÁ TRỊ khởi tạo

`totalAmount`/`remainingAmount` lúc tạo = `salesOrder.grandTotal` (thay vì `salesOrder.totalAmount` như hiện tại).

## Xoá hẳn

- `Customer.defaultDiscount` (+ mọi chỗ dùng: DTO, service, Excel import/export, form FE).
- `CustomerGroup.discountPercent` (+ mọi chỗ dùng: quotation-workflow.service.ts, quotation detail/print FE).

---

# Thiết kế API/UI mới

- **Customer module**: `GET/POST/PATCH/DELETE /customers/:id/product-discounts` — CRUD chiết khấu theo sản phẩm. FE: card mới "Chiết khấu sản phẩm" trên trang chi tiết khách hàng (trang này hiện chưa có tab nào, khảo sát xác nhận) — bảng liệt kê sản phẩm đã cấu hình + nút thêm (dùng lại `ProductTypeahead` đã có sẵn từ module Báo giá) + input %.
- **Lookup discount khi thêm dòng báo giá**: `GET /customers/:customerId/product-discounts/lookup?productId=` trả `{ discountPercent }` (0 nếu chưa cấu hình) — Quotation Item Dialog gọi song song với `/pricing-engine/calculate` để preview trước khi lưu. **Không** gộp vào Pricing Engine — giữ đúng ranh giới kiến trúc đã chốt ("Pricing Rule chỉ dùng để tính giá bán", chiết khấu là chuyện của khách hàng).
- **Action mới cấp Quotation**: `POST /quotations/:id/discount` `{ amount, reason, by }` — Action-driven (Nguyên tắc 4), chỉ khi DRAFT/SENT. Không cần Timeline riêng — audit đã có sẵn trong 3 field `discountAmount/discountReason/discountBy` (đúng tiền lệ đã chốt trong `quotation.md`: "Giảm giá thêm đã có audit riêng trong Discount Engine — không cần log vào Timeline").
- **Quotation Item Dialog**: bỏ hẳn khối "Giảm thêm" (pct/amt/reason/by), thay bằng hiển thị "Chiết khấu" read-only (lookup ở trên) + thêm ô "Ghi chú" (Chú thích, freeform, optional).
- **Quotation detail page**: thêm nút/dialog mới "Giảm thêm" (cấp đơn) — amount + reason + by, hiện gần khối tổng kết cuối bảng.
- **Bảng dòng báo giá + bản in**: đổi thứ tự cột theo đúng yêu cầu: Sản phẩm > Thông số > Giá bán > Chiết khấu > SL > Thành tiền > VAT > Chú thích. Cột "Chú thích" gộp `warnings` (cảnh báo Validation Rule, màu amber) + `note` (chữ thường).
- **Tổng kết báo giá**: thêm dòng "Giảm thêm" (nếu có) trước dòng "Tổng thanh toán" cuối cùng.

---

# Việc 1 — Schema & Migration

- [x] `CustomerProductDiscount` model mới
- [x] `QuotationItem`: bỏ 5 field cũ, thêm `discountPercent`, `note`
- [x] `SalesOrderItem`: bỏ 3 field cũ, thêm `discountPercent`, `vatRate`, `vatAmount`, `note`
- [x] `Quotation`: thêm `discountAmount`, `discountReason`, `discountBy`
- [x] `SalesOrder`: thêm `totalVatAmount`, `discountAmount`, `discountReason`, `discountBy`, `grandTotal`
- [x] Xoá `Customer.defaultDiscount`, xoá `CustomerGroup.discountPercent`
- [x] `npx prisma migrate dev --name customer_product_discount_and_order_discount` (chạy qua `migrate diff` + `migrate deploy` do môi trường non-interactive)

# Việc 2 — Customer module: CRUD Chiết khấu Khách hàng×Sản phẩm

- [ ] DTO create/update `CustomerProductDiscount`
- [ ] Service: list/create/update/delete, validate `discountPercent` 0–100, unique (customerId, productId)
- [ ] Controller (nested `/customers/:id/product-discounts`)
- [ ] Endpoint lookup: `GET /customers/:id/product-discounts/lookup?productId=`
- [ ] FE: card "Chiết khấu sản phẩm" trên trang chi tiết khách hàng + dialog thêm/sửa (dùng lại `ProductTypeahead`)

# Việc 3 — Dọn dẹp: xoá `Customer.defaultDiscount` và `CustomerGroup.discountPercent`

- [x] `customer.service.ts`: bỏ toàn bộ validate/gán/export/import liên quan `defaultDiscount` (8 vị trí đã khảo sát)
- [x] `create-customer.dto.ts` / `update-customer.dto.ts`: bỏ field
- [x] `customer-form.tsx` / `customer-edit-form.tsx` / `customers/[id]/page.tsx`: bỏ input/hiển thị
- [x] `prisma/seed.ts`: bỏ field khỏi seed data
- [x] `quotation-workflow.service.ts`: bỏ đọc `customerGroup.discountPercent` (thay bằng lookup `CustomerProductDiscount` — xem Việc 4)
- [ ] FE quotation detail + print: bỏ hiển thị `customerGroup.discountPercent`/CK nhóm (dời sang Việc 7 — sửa cùng lúc với reorder cột, tránh sửa 2 lần)

# Việc 4 — Quotation module: Discount Engine mới (per-item)

- [x] `addItem()`/`updateItem()`/`recalculatePrices()`: thay lookup `customerGroup.discountPercent` bằng lookup `CustomerProductDiscount(customerId, productId)`, snapshot vào `discountPercent`
- [x] `calcFinalPrice()` rút gọn còn 1 tham số chiết khấu (bỏ 3 tham số cũ)
- [x] Bỏ toàn bộ logic `additionalDiscountPercent/Amount/discountReason/discountBy` cấp item khỏi `addItem`/`updateItem` (kể cả `validateDiscountFields` cũ — thay bằng version mới ở Việc 5)
- [x] `create-quotation-item.dto.ts`/`update-quotation-item.dto.ts`: bỏ field discount cũ, thêm `note?: string`

# Việc 5 — Quotation module: Giảm thêm cấp toàn báo giá

- [x] `Quotation` DTO/action mới: `POST /quotations/:id/discount`
- [x] Validate: chỉ DRAFT/SENT, `discountAmount ≥ 0`, `discountAmount ≤ Tổng tiền hàng + Tổng VAT`, bắt buộc `discountReason` khi `discountAmount > 0`
- [ ] FE: dialog "Giảm thêm" cấp đơn trên trang chi tiết báo giá (dời sang Việc 7 — cùng lúc với cập nhật interface trang, tránh sửa 2 lần; Việc 7 tự liệt kê lại mục này)

# Việc 6 — Approve(): VAT + Giảm thêm vào SalesOrder/Receivable

- [x] Tính `totalVatAmount = sum(item.vatAmount)`, `grandTotal = totalAmount + totalVatAmount − quotation.discountAmount`
- [x] Validate `grandTotal ≥ 0` trước khi cho Approve (chặn rõ ràng, không âm thầm)
- [x] `SalesOrder.create()`: lưu thêm `totalVatAmount`, `discountAmount`, `discountReason`, `discountBy`, `grandTotal`
- [x] `SalesOrderItem.create()`: lưu `discountPercent`, `vatRate`, `vatAmount`, `note` (bỏ field cũ)
- [x] `Receivable.create()`: `totalAmount`/`remainingAmount` = `grandTotal` (thay vì `totalAmount` doanh thu như hiện tại)

# Việc 7 — FE: Reorder cột + Chú thích + Tổng kết

- [x] `quotation-item-dialog.tsx`: bỏ khối Giảm thêm cũ, hiện "Chiết khấu" read-only (lookup mới) + ô "Ghi chú"
- [x] `quotation-item-table.tsx`: đổi thứ tự cột, đổi "Giá hệ thống"+"CK nhóm"+"Giá bán" → "Giá bán"+"Chiết khấu", thêm cột "Chú thích"
- [x] `print/page.tsx`: tương tự + thêm dòng "Giảm thêm" trong tfoot trước "TỔNG THANH TOÁN"
- [x] `app/quotations/[id]/page.tsx`: cập nhật interface, thêm nút/dialog Giảm thêm cấp đơn (đồng thời bỏ hiển thị "CK nhóm" — dọn nốt phần Việc 3/4 đã dời sang đây)

# Việc 8 — FE: Order/SalesOrder detail (đồng bộ hiển thị)

- [x] `orders/[id]/page.tsx` + `sales-order-item-table.tsx`: cập nhật interface theo field mới, hiện VAT/Chiết khấu/Giảm thêm — khảo sát đầu Việc 8 xác nhận bảng dòng đã có sẵn (Sản phẩm/Thông số/Giá bán/SL/Thành tiền + dòng Tổng cộng), đồng bộ thêm cột Chiết khấu/VAT/Chú thích + breakdown Tổng tiền hàng/Tổng VAT/Giảm thêm/Tổng thanh toán giống bảng báo giá

# Việc 9 — Cập nhật knowledge docs

- [x] `knowledge/modules/quotation.md`: viết lại mục "Discount Engine" theo cơ chế mới
- [x] `knowledge/modules/customer.md`: thêm mục "Chiết khấu sản phẩm"
- [x] `knowledge/modules/debt.md`: cập nhật mô tả `Receivable.totalAmount` = snapshot từ `SalesOrder.grandTotal` (không phải `totalAmount`)

# Việc 10 — Test & Build

- [x] Cập nhật `quotation-workflow.service.spec.ts` (approve, discount engine mới) — thay 3 test chiết khấu bổ sung cấp dòng cũ bằng 7 test mới (Discount Engine per-item + `discount()` action)
- [x] `tsc --noEmit` sạch api + web
- [x] `npx jest` toàn bộ suite liên quan (quotation, customer, debt) — 31/31 pass; chạy luôn toàn bộ suite dự án — 260/260 pass
- [x] `nest build` (api) + `next build` (web) — cả hai build thành công

# Việc 11 — Verify thực tế

- [x] Cấu hình chiết khấu 1 sản phẩm cho 1 khách hàng → tạo báo giá → xác nhận đúng % áp dụng — verify qua API thật (server dev + Postgres dev thật, không mock): cấu hình 15% cho KH000007 × SP000036, thêm dòng báo giá → `discountPercent=15`, `finalPrice=981750=round(1155000×0.85)` đúng. Thứ tự cột đã review qua code (Việc 7), không click-through được UI trong môi trường này (không có trình duyệt/Playwright cài sẵn để tự động hoá).
- [x] Áp Giảm thêm cấp đơn → Approve → xác nhận Receivable đúng bằng Tổng thanh toán − Giảm thêm — verify qua API thật: `discountAmount=50000` → Approve → `SalesOrder.grandTotal=981750+78540-50000=1010290`, `Receivable.totalAmount=1010290` (khác `totalAmount` doanh thu 981750) — khớp chính xác công thức đã thiết kế.
