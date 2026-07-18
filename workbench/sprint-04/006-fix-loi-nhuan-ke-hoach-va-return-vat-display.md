# Milestone (Sprint 04) - Fix Lợi nhuận kế hoạch thiếu trừ Giảm thêm + Hiển thị VAT sai ở Return

> **Tên file:** `workbench/sprint-04/006-fix-loi-nhuan-ke-hoach-va-return-vat-display.md`
> **Trạng thái:** ✅ HOÀN THÀNH (18/07/2026)

---

# Bối cảnh

Phát sinh từ Review Nghiệp vụ Tài chính toàn hệ thống (18/07/2026, vai trò BA/Architect/CFO/Kế toán trưởng — không sửa code, chỉ review). Phát hiện 2 vấn đề đã được người dùng xác nhận sửa ngay, 2 vấn đề để nguyên (không thuộc phạm vi task này):

1. **[HIGH] `plannedProfit` không trừ `discountAmount`** (Giảm thêm cấp toàn báo giá) — `quotation-workflow.service.ts:1072`. Khi Sprint 04 (16-17/07/2026) thêm Giảm thêm cấp đơn, công thức `grandTotal` (dùng cho Receivable) đã trừ đúng, nhưng `plannedProfit` (dùng cho `SalesOrder.plannedProfit` → Dashboard KPI "Lợi nhuận kế hoạch" → Report A3 tương lai) bị bỏ sót, không trừ. Kết quả: mọi đơn có Giảm thêm > 0 có lợi nhuận kế hoạch bị thổi phồng đúng bằng số tiền Giảm thêm. **Người dùng xác nhận: sửa công thức + migrate lại dữ liệu cũ.**
2. **[MEDIUM] `return-item-table.tsx` hiển thị tổng giá trị hàng trả KHÔNG gồm VAT**, trong khi cùng trang chi tiết Return, `Return.totalValue` (đọc từ API, gắn nhãn "đã gồm VAT") hiển thị số khác — gây lẫn Net/Gross trên cùng màn hình. **Người dùng xác nhận: dùng thẳng `totalValue` từ API, bỏ tự tính ở FE.**
3. [LOW] Doanh thu không trừ hàng hoàn — đúng thiết kế đã chốt (`return.md`), không sửa (giữ nguyên theo yêu cầu người dùng).
4. [LOW] Report/Finance module chưa triển khai — ngoài phạm vi, không sửa ở đây.

Không đụng gì khác ngoài 2 việc đã xác nhận (Nguyên tắc 1 — CLAUDE.md: chỉ thực hiện đúng Task được giao).

---

# Phạm vi

## Trong phạm vi

- `quotation-workflow.service.ts`: sửa công thức `plannedProfit`.
- Migration dữ liệu: backfill `SalesOrder.plannedProfit` cho các đơn cũ có `discountAmount > 0`.
- `return-item-table.tsx` + `returns/[id]/page.tsx`: bỏ tự tính tổng ở FE, dùng thẳng `totalValue` (đã gồm VAT) từ API.
- Test: bổ sung case `plannedProfit` có trừ `discountAmount`.
- Cập nhật `knowledge/modules/order.md` mục "Planned Financials" cho khớp công thức mới.

## Ngoài phạm vi (không đụng trong task này)

- Return tự động trừ doanh thu/công nợ — giữ nguyên thiết kế hiện tại.
- Report module, Operating Expense/Net Profit, Actual Cost — chưa làm.

---

# Quyết định kỹ thuật

- Công thức mới: `plannedProfit = totalAmount − plannedCost − discountAmount` (giữ nguyên `totalAmount`/`plannedCost` như cũ, chỉ thêm trừ `discountAmount` — biến này đã có sẵn trong scope hàm `approve()`, không cần đọc thêm dữ liệu).
- Migration dữ liệu: không phải thay đổi schema (không có cột mới) → không dùng `prisma migrate`, dùng một script SQL một lần (`UPDATE sales_orders SET planned_profit = total_amount - planned_cost - discount_amount WHERE discount_amount > 0`), chạy qua `prisma db execute`. Chỉ ảnh hưởng đơn có `discountAmount > 0` — các đơn còn lại không đổi.
- `ReturnItemTable`: nhận thêm prop `totalValue: number` (đã gồm VAT, từ `Return.totalValue` API trả về) để hiển thị dòng tổng ở footer, thay vì tự tính `Σ returnedQuantity × unitPriceSnapshot`. Component vẫn tự tính `subtotal` **từng dòng** (không gồm VAT) để hiển thị cột "Thành tiền" — đây là đúng, không đổi (VAT không hiển thị theo dòng ở bảng Return vì `ReturnItem` không được thiết kế hiển thị VAT per-line ở UI này, chỉ tổng). Đổi nhãn dòng tổng thành "Tổng giá trị hàng trả (đã gồm VAT)" cho nhất quán với khối thông tin đầu trang.

---

# Việc 1 — Business Logic: sửa công thức `plannedProfit`

- [x] `quotation-workflow.service.ts`: sửa dòng tính `plannedProfit` trong `approve()`, trừ thêm `quotation.discountAmount`.
- [x] Cập nhật comment tại chỗ tính (đang ghi "computed once, never re-derived" — giữ nguyên ý, chỉ sửa công thức).

# Việc 2 — Migration dữ liệu: backfill `plannedProfit` cho đơn cũ

- [x] Khảo sát: đếm số `SalesOrder` hiện có `discountAmount > 0` trong DB dev trước khi chạy (để biết phạm vi ảnh hưởng thật). Kết quả: **1 bản ghi** — `SO000009` (`totalAmount=981.750`, `plannedCost=0`, `discountAmount=50.000`, `plannedProfit` cũ = 981.750).
- [x] Viết script SQL một lần: `UPDATE sales_orders SET planned_profit = total_amount - planned_cost - discount_amount WHERE discount_amount > 0`.
- [x] Chạy qua `prisma db execute` vào DB dev, đối chiếu số dòng bị ảnh hưởng đúng bằng số đếm ở bước khảo sát (1 dòng).
- [x] Verify lại bằng tay: `SO000009.plannedProfit` sau backfill = **931.750** = 981.750 − 0 − 50.000 (đúng công thức mới). Script tạm (`survey-tmp.js`, `backfill-tmp.sql`) đã xoá khỏi `apps/api/` sau khi verify, không commit vào repo.

# Việc 3 — FE: `ReturnItemTable` dùng thẳng `totalValue` từ API

- [x] `return-item-table.tsx`: thêm prop `totalValue: number`, bỏ biến tự tính `grandTotal` hiện tại, dùng `totalValue` cho dòng tổng footer, đổi nhãn thành "Tổng giá trị hàng trả (đã gồm VAT)".
- [x] `returns/[id]/page.tsx`: truyền `totalValue={Number(ret.totalValue)}` khi render `<ReturnItemTable />`.

# Việc 4 — Test & Build

- [x] `quotation-workflow.service.spec.ts`: thêm test case trong `describe('QuotationWorkflowService.approve()')` — approve báo giá có `discountAmount = 300.000`, assert `salesOrder.create` được gọi với `plannedProfit = 2.000.000 − 0 − 300.000 = 1.700.000`.
- [x] `tsc --noEmit` sạch api + web.
- [x] `npx jest` toàn bộ suite api — **261/261 pass** (260 gốc + 1 test mới).
- [x] `next build` — build thành công, 26 route, không lỗi.

# Việc 5 — Cập nhật knowledge docs

- [x] `knowledge/modules/order.md` mục "Planned Financials": sửa công thức `plannedProfit = totalAmount - plannedCost` → `plannedProfit = totalAmount - plannedCost - discountAmount` (ghi rõ nguồn: Giảm thêm cấp toàn báo giá, snapshot từ Quotation tại Approve).

# Việc 6 — Verify thực tế

- [x] Verify công thức mới trên dữ liệu thật (không mock): backfill trực tiếp trên DB dev qua Prisma Client thật (không phải test giả lập) — `SO000009` cho kết quả đúng công thức (xem Việc 2). Tương đương verify "tạo mới rồi Approve" về mặt công thức, vì `approve()` và script backfill dùng cùng một phép tính.
- [x] `tsc`/`jest`/`next build` xác nhận code hoạt động đúng ở mức có thể kiểm chứng không cần trình duyệt.
- [ ] **Chưa verify được — cần bạn xác nhận trực tiếp** (môi trường này không có trình duyệt/tài khoản đăng nhập, và có dev server đang chạy sẵn ở cổng 3001 nên không tự ý reset seed data để lấy mật khẩu mới): tạo một báo giá mới có Giảm thêm > 0 → Approve qua UI thật → xác nhận `plannedProfit` hiện đúng trên Dashboard "Lợi nhuận kế hoạch"; mở một phiếu hoàn có VAT > 0 → xác nhận "Giá trị phiếu hoàn" (đầu trang) và "Tổng giá trị hàng trả" (cuối bảng) nay khớp nhau.

---

Sau khi hoàn thành hết Việc 1-6: báo cáo tổng kết (file đã sửa, kết quả test, commit message đề xuất) và dừng, chờ lệnh tiếp theo — không tự ý làm việc khác.
