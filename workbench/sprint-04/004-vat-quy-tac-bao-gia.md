# Milestone (Sprint 04) - VAT trong Quy tắc báo giá

> **Tên file:** `workbench/sprint-04/004-vat-quy-tac-bao-gia.md`
> **Trạng thái:** ✅ CODE HOÀN THÀNH (16/07/2026) — build/test sạch, còn chờ bạn verify UI thật (Việc 9, phần dưới) vì môi trường thực hiện không có trình duyệt/tài khoản đăng nhập.

---

# Bối cảnh

Người dùng muốn thêm 1 ô thiết lập **VAT** cho sản phẩm trong màn "Quy tắc báo giá", đưa vào Pricing Engine để cả **Preview giá** (Cấu hình sản phẩm) lẫn **Báo giá** đều hiện VAT và cộng vào giá tổng.

Đã khảo sát: VAT là khái niệm hoàn toàn mới, chưa tồn tại ở đâu trong hệ thống (`product.md`, `quotation.md`, schema đều không có). Đã trao đổi và chốt 3 quyết định với người dùng (16/07/2026):

1. **Thứ tự tính:** VAT tính **sau** Discount Engine — `vatAmount = subtotal × vatRate` (subtotal đã là giá sau chiết khấu × số lượng) → `Tổng thanh toán = subtotal + vatAmount`.
2. **Lưu trữ:** `vatRate` thuộc `PricingRuleVersion` (versioned, snapshot xuống `QuotationItem` giống `systemPrice` — đúng Nguyên tắc 7 & 8 trong CLAUDE.md).
3. **Hiển thị:** VAT hiện theo từng dòng báo giá (mỗi sản phẩm có thể khác thuế suất) + thêm dòng Tổng VAT / Tổng thanh toán ở cuối phiếu.

---

# Phạm vi

## Trong phạm vi

- Product module: `PricingRuleVersion.vatRate`, form nhập, `previewPrice()`.
- Pricing Engine: trả `vatRate` pass-through (không tự tính amount, không gộp vào `systemPrice`).
- Quotation module: `QuotationItem.vatRate` + `vatAmount`, tính trong `addItem`/`updateItem`/`recalculatePrices`, hiển thị ở Dialog thêm/sửa dòng, bảng dòng báo giá (trang chi tiết) và bản in.

## Ngoài phạm vi (không đụng trong task này)

- **SalesOrder / SalesOrderItem / Receivable / Debt module.** Business Snapshot Rule hiện tại tính "Doanh thu" (`totalAmount`) từ `subtotal` (giá trước thuế) — đúng theo nguyên tắc kế toán (VAT là khoản thu hộ Nhà nước, không phải doanh thu công ty). Việc công nợ/hoá đơn Sales Order có cần cộng thêm VAT khách phải trả hay không là quyết định nghiệp vụ riêng, ảnh hưởng tới cơ chế concurrency của `Receivable.remainingAmount` (đã ghi chú "không được sửa lại" trong CLAUDE.md) — **cần task riêng, có xác nhận riêng.**
- Dashboard, Report modules — không đọc field mới.
- `quotation-table.tsx` (danh sách báo giá) — cột tổng vẫn là `subtotal` trước thuế như hiện tại (chỉ số tham khảo nhanh trong danh sách), không đổi.

---

# Quyết định kỹ thuật

- `vatRate`: `Decimal(5,2)`, đơn vị %, khoảng 0–100, `default 0` (không nullable — giống `groupDiscount`).
- Pricing Engine **không** gộp VAT vào `systemPrice`/`rawPrice` — chỉ trả `vatRate` pass-through từ config. Nơi tiêu thụ tự tính `vatAmount` đúng tại điểm cần trong pipeline của mình (Preview: trước Discount Engine vì Preview không có khách hàng/chiết khấu; Quotation: sau Discount Engine).
- Product Preview: `vatAmount = round(systemPrice × vatRate / 100)`, `priceWithVat = systemPrice + vatAmount`.
- Quotation: `vatAmount = round(subtotal × vatRate / 100)` (extended theo số lượng, cùng cách `subtotal` đã extend `finalPrice`).
- `QuotationItem` lưu `vatRate` (snapshot rate tại thời điểm tính) + `vatAmount` (số tiền). **Không** thêm field tổng cấp `Quotation` — tổng VAT/tổng thanh toán toàn báo giá tính trực tiếp ở FE từ danh sách items (chi phí tính rẻ, đúng Nguyên tắc 13 — không lưu Derived Data khi không cần).

---

# Việc 1 — Schema & Migration ✅

- [x] `PricingRuleVersion.vatRate` (`apps/api/prisma/schema.prisma`)
- [x] `QuotationItem.vatRate`, `QuotationItem.vatAmount` (`apps/api/prisma/schema.prisma`)
- [x] `npx prisma migrate dev --name pricing_rule_vat` → `20260716152607_pricing_rule_vat`

---

# Việc 2 — Pricing Engine ✅

File: `apps/api/src/pricing-engine/pricing-engine.service.ts`

- [x] `PricingConfig.vatRate: number`
- [x] `PricingCalcResult.vatRate: number`
- [x] `toConfig()`: đọc `version.vatRate`
- [x] `calculatePrice()`: trả `vatRate` pass-through trong kết quả
- [x] `calculate()` (API cũ giữ chữ ký cho Quotation/Controller): pass `vatRate` sang `CalculatePriceResultDto`
- [x] `apps/api/src/pricing-engine/dto/calculate-price.dto.ts`: thêm `vatRate` vào `CalculatePriceResultDto`

---

# Việc 3 — Product module (Pricing Rule Version CRUD + Preview) ✅

Files: `apps/api/src/product/dto/{create,update}-pricing-rule-version.dto.ts`, `apps/api/src/product/product.service.ts`

- [x] DTO create/update thêm `vatRate?: number`
- [x] `createPricingRuleVersion()`: validate 0–100, lưu field (default 0)
- [x] `updatePricingRuleVersion()`: validate 0–100 khi có gửi lên, cập nhật field
- [x] `duplicatePricingRuleVersion()`: copy `vatRate` từ bản nguồn
- [x] `previewPrice()`: trả thêm `vatRate`, `vatAmount`, `priceWithVat`

---

# Việc 4 — Quotation module (Discount Engine + VAT) ✅

File: `apps/api/src/quotation/quotation-workflow.service.ts`

- [x] Helper `calcVatAmount(subtotal, vatRate)`
- [x] `addItem()`: lấy `vatRate` từ `priceResult`, tính `vatAmount`, lưu cả hai
- [x] `updateItem()`: `vatRate` chỉ đổi khi tham số đổi (đi theo `pricingRuleVersionId`); `vatAmount` luôn tính lại theo `subtotal` mới (giống cách `subtotal` luôn tính lại dù tham số không đổi — số lượng/chiết khấu có thể đổi)
- [x] `recalculatePrices()`: tính lại `vatRate`/`vatAmount` cho toàn bộ dòng theo version ACTIVE hiện tại

---

# Việc 5 — FE: Pricing Rule Version page ✅

File: `apps/web/src/app/products/[id]/pricing-rule/versions/[versionId]/page.tsx`

- [x] `PricingRuleVersion` interface + `PreviewResult` interface thêm field VAT
- [x] Input "Thuế VAT (%)" cạnh "Làm tròn giá" (chỉ sửa được khi DRAFT, theo đúng pattern các field khác)
- [x] Preview: hiện dòng VAT (x%) + "Giá đã gồm VAT"

---

# Việc 6 — FE: Quotation Item Dialog ✅

File: `apps/web/src/components/quotation/quotation-item-dialog.tsx`

- [x] Nhận `vatRate` từ response `/pricing-engine/calculate`
- [x] `ExistingItem` interface thêm `vatRate` (khởi tạo state khi mở dialog sửa, giống cách `systemPrice` được set ngay trước khi debounce tính lại)
- [x] Tính `vatAmount`/`grandTotal` phía client (mirror logic BE) để preview trước khi submit
- [x] Hiện dòng VAT + "Tổng thanh toán" trong khối price preview

---

# Việc 7 — FE: Bảng dòng báo giá + Bản in ✅

Files: `apps/web/src/components/quotation/quotation-item-table.tsx`, `apps/web/src/app/quotations/[id]/print/page.tsx`, `apps/web/src/app/quotations/[id]/page.tsx`

- [x] `quotation-item-table.tsx`: cột VAT theo dòng + đổi 1 dòng "Tổng cộng" thành 3 dòng (Tổng tiền hàng / Tổng VAT / **Tổng thanh toán**) — chỉ hiện 3 dòng khi có VAT > 0, giữ "Tổng cộng" như cũ khi không có VAT (tương thích ngược, không gây rối UI cho sản phẩm chưa cấu hình VAT)
- [x] `print/page.tsx`: tương tự (cột VAT + 3 dòng tổng ở `tfoot`, cùng logic chỉ hiện khi có VAT)
- [x] `app/quotations/[id]/page.tsx`: `QuotationItem` interface thêm `vatRate`, `vatAmount`

---

# Việc 8 — Test & Build ✅

- [x] `pricing-engine.service.spec.ts`: thêm 2 case VAT pass-through (config có VAT → result trả đúng rate không ảnh hưởng systemPrice; mặc định 0 khi không set)
- [x] `tsc --noEmit` sạch cho cả `apps/api` và `apps/web` (sau `prisma generate` lại Client)
- [x] `npx jest pricing-engine bom-engine quotation-workflow product` — 77/77 pass
- [x] `eslint` các file đã sửa ở web — không phát sinh lỗi/warning mới (đối chiếu bằng `git stash` chạy lại trên bản gốc: cùng 4 lỗi + 1 warning `set-state-in-effect`/`formatParams` **đã có từ trước**, không liên quan VAT)

---

# Việc 9 — Verify thực tế

**Đã verify được (không cần UI):**

- [x] Migration áp thành công vào DB dev (`erp` @ localhost:5432), Prisma Client generate lại đồng bộ schema.
- [x] Backend boot thật (`nest start`) — toàn bộ DI graph resolve thành công, tất cả route map đúng, **0 lỗi runtime** từ các thay đổi (PricingEngineService, ProductService, QuotationWorkflowService đều khởi tạo và wire bình thường). Server dừng do `EADDRINUSE :3001` — cho thấy có sẵn 1 tiến trình dev khác (có thể của bạn) đang chạy, không phải lỗi của code.

**Chưa verify được — cần bạn xác nhận trực tiếp (môi trường này không có trình duyệt lẫn tài khoản đăng nhập để tự thao tác UI):**

- [ ] Vào 1 sản phẩm có Pricing Rule Version DRAFT → nhập VAT → Preview → xác nhận hiện đúng VAT + giá gồm VAT.
- [ ] Kích hoạt version → tạo báo giá với sản phẩm đó → xác nhận Dialog thêm dòng hiện VAT.
- [ ] Xem trang chi tiết báo giá + bản in → xác nhận Tổng VAT / Tổng thanh toán đúng.
