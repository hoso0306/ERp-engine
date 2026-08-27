# Đề xuất: Return nới điều kiện tạo + phân bổ khách/công ty chịu + tác động Doanh thu/Doanh số/Công nợ

> **Tên file:** `workbench/sessions/2026-08-26-return-doanh-thu-cong-no-de-xuat.md`
> **Trạng thái:** 📝 ĐỀ XUẤT — CHƯA XÁC NHẬN, CHƯA CODE. Bản tổng hợp đầy đủ sau nhiều vòng trao đổi (26-27/08/2026).
> **Cập nhật lần cuối:** 27/08/2026

---

# Bối cảnh

Người dùng muốn:

1. Cho phép tạo Return ngay cả khi `SalesOrder` chưa `DELIVERED` (đơn còn đang sản xuất).
2. Khi tạo Return, phân bổ rõ **khách hàng chịu bao nhiêu / công ty chịu bao nhiêu** cho giá trị hàng hoàn, và phần công ty chịu sẽ **giảm công nợ khách hàng** — có dấu vết kiểm tra lại nhưng **không** làm sai lệch báo cáo dòng tiền mặt thật.
3. Doanh thu, doanh số theo nhân viên phải phản ánh đúng phần công ty thực sự chịu (không phải trừ toàn bộ giá trị hoàn).
4. Xem lại đơn hàng cũ của khách phải biết ngay đơn nào có hàng hoàn, hoàn sản phẩm gì, giá bao nhiêu.

**Lưu ý — đây là đảo ngược quyết định đã chốt trước đó:**

- `return.md`: "Return **không phải** module tài chính... Return không làm thay đổi doanh thu/lợi nhuận/công nợ."
- `workbench/sprint-04/006-fix-loi-nhuan-ke-hoach-va-return-vat-display.md` dòng 14, 33: quyết định "Doanh thu không trừ hàng hoàn" (18/07/2026) nay bị đảo ngược.

---

# Quyết định đã chốt (qua nhiều vòng hỏi đáp 26-27/08/2026)

| Điểm quyết định | Lựa chọn đã chốt |
|---|---|
| Điều kiện tạo Return | Cho phép ở mọi trạng thái `SalesOrder`, chỉ chặn khi `CANCELLED` (không còn giới hạn DELIVERED-only) |
| Cách trừ doanh thu | **Sửa trực tiếp** công thức KPI "Tổng doanh thu kế hoạch" hiện có — không tạo KPI "Doanh thu thuần" song song |
| Doanh thu trừ bao nhiêu | Chỉ trừ **phần công ty chịu** (`Return.totalValue − customerBorneAmount`), không trừ toàn bộ giá trị hoàn |
| Doanh số theo nhân viên | Cần — khối mới riêng, đặt dưới khối Kinh doanh trên Dashboard |
| Khối này lọc thế nào | Bộ lọc riêng, mặc định **"Tháng này"**, sửa được theo ngày tuỳ ý; chỉ hiện nhân viên có phát sinh doanh số trong khoảng lọc |
| Tổng doanh số theo khách hàng | Chưa cần đợt này (tính năng mới, chưa tồn tại — để sau) |
| Hiển thị "đã hoàn sản phẩm nào, giá bn" khi xem/in đơn hàng | Cả trang web lẫn bản in PDF |
| Badge cảnh báo Return trên danh sách đơn hàng | Icon/badge trên dòng đơn có Return (không thêm cột số liệu riêng) |
| Cơ chế giảm công nợ | **Manual Adjustment** (giảm thẳng `Receivable.totalAmount`/`remainingAmount`, ghi Timeline) — **không** tạo `Payment` thật, để không làm sai báo cáo dòng tiền mặt |
| Thời điểm phân bổ khách/công ty chịu | **Ngay trong luồng tạo phiếu hoàn** (không đợi xử lý xong với khách) |
| "Chọn Xưởng gánh chi phí" (ý ban đầu) | **Bỏ** — thay bằng ô nhập **Lý do** (giải trình vì sao công ty chịu phần chi phí), không gắn với Production Center cụ thể |
| Số bước bấm ở luồng tạo | **Gộp làm 1** — sau khi xác nhận % khách chịu + lý do, bấm **1 nút duy nhất** để tạo Return và (nếu có phần công ty chịu) tự động giảm công nợ luôn, không tách thêm 1 nút "tạo phiếu thu" riêng |

---

# Luồng nghiệp vụ chi tiết — Tạo phiếu hoàn (thiết kế mới)

## Bước 0
Tab "Hàng hoàn" → bấm **"Tạo phiếu hoàn"** → mở form.

## Bước 1 — Chọn đơn & sản phẩm (giữ nguyên UI hiện có, chỉ nới điều kiện)

- **Chọn đơn hàng**: ô tìm kiếm (typeahead) — bỏ giới hạn chỉ `DELIVERED`, cho chọn mọi đơn trừ `CANCELLED`.
- Bảng sản phẩm của đơn hiện ra: tick checkbox từng dòng cần hoàn (dòng đã hoàn hết bị khoá).
- Mỗi dòng đã tick: nhập **số lượng hoàn** (≤ số còn lại), chọn **Lý do hoàn** (bắt buộc, danh mục có sẵn), **Ghi chú dòng** (tuỳ chọn).
- Thông tin chung: **Ngày trả**, **Người nhận**, **Ghi chú chung**.
- Nút **"Tiếp theo"** (đổi tên từ "Tạo phiếu hoàn" cũ — vì bước này chưa submit) → validate hợp lệ (≥1 sản phẩm tick, số lượng > 0 và ≤ max, lý do đã chọn) → mở Bước 2.

## Bước 2 — Xác nhận giá trị & phân bổ trách nhiệm (MỚI, thay cho submit trực tiếp)

Hiển thị:
- Danh sách sản phẩm hoàn đã chọn: tên SP, số lượng, đơn giá, thành tiền từng dòng.
- **Tổng giá trị phiếu hoàn** (`Return.totalValue`, đã gồm VAT).
- 2 ô nhập liên kết 2 chiều (sửa ô này tự tính ô kia):
  - **Tỷ lệ % khách chịu**
  - **Số tiền khách chịu**
  - Mặc định đề xuất: **100% khách chịu** (an toàn — không tự ý giảm công nợ nếu kế toán không chủ động chỉnh).
- Dòng tự tính, không cho sửa trực tiếp: **"Công ty chịu = Tổng giá trị − Số tiền khách chịu"**.
- Nếu "Công ty chịu" > 0 → hiện thêm ô **Lý do công ty chịu chi phí** (bắt buộc, vd "Lỗi sản xuất — cắt sai kích thước"). Nếu = 0 → ẩn ô này.
- Nút **"Tạo phiếu hoàn"** (submit thật sự, duy nhất) — bấm thì:
  1. `POST /returns` — tạo `Return` + `ReturnItem` + `RecoveryInventory` như luồng cũ, lưu thêm `customerBorneAmount` và `companyBorneReason` (nếu có) trên `Return`.
  2. **Nếu công ty chịu > 0**: FE gọi tiếp `POST /receivables/:id/manual-adjustment` (amount = phần công ty chịu, reason = `companyBorneReason`) — 2 lệnh gọi API tuần tự do FE điều phối (không phải Return service gọi thẳng sang Debt service — giữ ranh giới module độc lập), nhưng với người dùng chỉ là **1 lần bấm**.
  3. Nếu bước 2 lỗi nhưng bước 1 đã thành công → Return vẫn giữ nguyên, không rollback — kế toán dùng nút dự phòng ở trang chi tiết Return để giảm công nợ lại sau.
  4. Thành công → chuyển sang trang chi tiết Return.

## Trang chi tiết Return (sau khi tạo)

- Hiển thị đầy đủ: sản phẩm hoàn, lý do, số tiền khách chịu / công ty chịu + lý do công ty chịu.
- **Nút dự phòng "Điều chỉnh giảm công nợ"** — dùng khi bước 2 lúc tạo bị lỗi/bỏ qua, hoặc cần điều chỉnh thêm sau này. Mở dialog Manual Adjustment, gợi ý sẵn số tiền còn lại chưa điều chỉnh.
- Nút **"Hoàn tất"** (action `complete` có sẵn) — chuyển `PROCESSING → COMPLETED`, không đổi gì thêm về tài chính.

---

# Phạm vi kỹ thuật theo module

## A. Return module

- `apps/api/src/return/return.service.ts:154` — bỏ chặn `status !== DELIVERED`, chỉ chặn khi `CANCELLED`.
- `apps/web/src/components/sales-order/sales-order-typeahead.tsx:27` — bỏ hard-code filter `status="DELIVERED"` ở màn chọn đơn khi tạo Return.
- Schema `Return` (dòng 1694): thêm
  - `ownerName String?` — snapshot từ `SalesOrder.ownerName` lúc tạo.
  - `customerBorneAmount Decimal` — số tiền khách chịu, nhập ở Bước 2.
  - `companyBorneReason String?` — lý do công ty chịu phần còn lại (NULL nếu khách chịu 100%).
- `ReturnService.create()`: nhận thêm `customerBorneAmount`, `companyBorneReason`; snapshot `ownerName`; validate `0 <= customerBorneAmount <= totalValue`.
- Thêm method đọc `ReturnService.getTotalReturnValue(dateRange?, groupBy?: 'ownerName')` — trả về **phần công ty chịu** (`totalValue - customerBorneAmount`), không phải tổng `totalValue` thô — Dashboard gọi qua đây.
- FE Bước 2 (mới): component dialog/step hiển thị bảng sản phẩm + input % / số tiền khách chịu liên kết 2 chiều + ô lý do có điều kiện + nút submit gộp.
- Cập nhật `knowledge/modules/return.md`:
  - Bỏ rule "chỉ tạo khi DELIVERED" (dòng 199, 554).
  - Sửa đoạn "Return không làm thay đổi doanh thu/công nợ" (dòng 566-570, 586-592): Return không tự sửa `SalesOrder` (vẫn Immutable), nhưng lưu `customerBorneAmount`/`companyBorneReason`, và **tự động** kích hoạt Manual Adjustment giảm công nợ đúng phần công ty chịu ngay lúc tạo (không còn "chỉ tham khảo, kế toán tự làm sau" như bản cũ).

## B. Debt module — Manual Adjustment (xây mới hoàn toàn)

- `POST /receivables/:id/manual-adjustment` — body `{ amount, reason }`.
- Giảm atomic `totalAmount` + `remainingAmount` (Prisma `decrement`, giữ CHECK `remaining_amount >= 0` có sẵn — không cho giảm vượt).
- Bắt buộc `reason`, lưu actor + thời gian + `oldValue`/`newValue` (khuôn Manual Override — CLAUDE.md mục 5).
- Schema: thêm `SalesOrderTimelineAction.DEBT_MANUAL_ADJUSTED` (không tái dùng `MANUAL_OVERRIDE` — action đó dành cho đổi `SalesOrder.status`). Payload: `{ amount, reason, returnCode }`.
- **Không tạo `Payment`/`PaymentAllocation`** — đảm bảo báo cáo dòng tiền mặt ("Tiền đã thu hôm nay", Cash in report) không bị ảnh hưởng, vì các báo cáo đó chỉ đọc từ bảng `Payment`.
- Sửa `RECEIVABLE_DETAIL_INCLUDE` (`debt.service.ts` dòng 85-108) — hiện **không include Timeline**, chỉ có `allocations`. Thêm include Timeline lọc `DEBT_MANUAL_ADJUSTED`, hiển thị thành khối **"Lịch sử điều chỉnh công nợ"** trên trang chi tiết Receivable, cạnh "Lịch sử thu tiền" — để kiểm tra lại được sau này.
- Cần API tra `receivableId` theo `salesOrderId` (Return chỉ có `salesOrderId`, cần map sang đúng Receivable) — có thể tái dùng logic đã có trong `DebtService` (Receivable 1-1 với SalesOrder).

## C. Dashboard

- Sửa công thức KPI "Tổng doanh thu kế hoạch" (Sales Overview) thành: `SUM(SalesOrder.totalAmount) − SUM(Return.totalValue − Return.customerBorneAmount)` — tức trừ đúng phần công ty chịu, gọi qua `ReturnService.getTotalReturnValue()`.
- Khối mới **"Doanh số theo nhân viên"**: 1 card riêng, đặt ngay dưới khối Kinh doanh (`sales-overview-panel.tsx`).
  - Công thức mỗi dòng: `SUM(SalesOrder.totalAmount) GROUP BY ownerName − SUM(phần công ty chịu) GROUP BY ownerName`.
  - Chỉ hiện nhân viên có phát sinh doanh số trong khoảng lọc (tự nhiên loại trừ khi group theo `createdAt` trong range).
  - Bộ lọc riêng, mặc định **"Tháng này"**, sửa được theo ngày tuỳ ý → dùng `shared/date-range-filter.tsx` (có preset `today/week/month/all/custom`), **không** dùng `dashboard-range-filter.tsx` (chỉ có 4 preset ngắn, không có "Tháng này") — đúng comment sẵn có trong `dashboard-range-filter.tsx` dòng 77-82.
  - Endpoint mới `GET /dashboard/sales/by-employee?from=&to=`, panel mới `employee-revenue-panel.tsx` tự quản lý filter/fetch (đúng kiến trúc "mỗi Panel tự chủ" từ `027-thiet-ke-lai-dashboard-bo-loc-rieng.md`).
- Cập nhật `knowledge/modules/dashboard.md` mục "Sales Overview": sửa công thức doanh thu kế hoạch (dòng 123) + thêm mô tả khối "Doanh số theo nhân viên".

## D. SalesOrder detail (web) + bản in PDF — hiển thị "Đã hoàn"

- Đọc thêm (read-time join, không sửa `SalesOrder`): `Return`/`ReturnItem` theo `salesOrderId` của đơn đang xem.
- Thêm khối **"Đã hoàn"** trên trang chi tiết SalesOrder (web) và bản in PDF: sản phẩm, số lượng hoàn, đơn giá, giá trị dòng.

## E. Danh sách đơn hàng — badge cảnh báo "có hàng hoàn"

- `GET /sales-orders` — trả thêm field `hasReturn: boolean` (tính bằng `EXISTS`, không lưu DB).
- FE `SalesOrderTable` (dùng chung `/orders` + tab "Đơn hàng" của Customer) — icon nhỏ cạnh mã đơn khi `hasReturn = true`, kèm tooltip "Đơn có hàng hoàn".

## Ngoài phạm vi (đã xác nhận không làm đợt này)

- "Tổng doanh số theo khách hàng" — Customer module hiện không có field/API nào tính tổng `SalesOrder.totalAmount` theo khách hàng (chỉ có `getDebtSummary()` tính công nợ còn lại). Để dành làm sau nếu cần.
- Gắn trách nhiệm cụ thể theo Xưởng/Production Center cho phần công ty chịu — đã bỏ, thay bằng ô Lý do tự do.

---

# Việc cần làm khi bắt đầu code (checklist)

- [ ] `return.service.ts` — nới điều kiện trạng thái tạo Return
- [ ] `sales-order-typeahead.tsx` — bỏ hard-code lọc `status="DELIVERED"`
- [ ] Schema: `Return.ownerName`, `Return.customerBorneAmount`, `Return.companyBorneReason`, `SalesOrderTimelineAction.DEBT_MANUAL_ADJUSTED`
- [ ] Migration Prisma
- [ ] `ReturnService.create()` — nhận `customerBorneAmount`/`companyBorneReason`, validate, snapshot `ownerName`
- [ ] `ReturnService.getTotalReturnValue()` — trả về phần công ty chịu, không phải totalValue thô
- [ ] FE — Bước 2 mới trong luồng tạo Return: bảng sản phẩm + % /số tiền khách chịu liên kết 2 chiều + ô lý do điều kiện + nút submit gộp (tạo Return + gọi Manual Adjustment nếu có phần công ty chịu)
- [ ] Debt module: API `POST /receivables/:id/manual-adjustment`
- [ ] `RECEIVABLE_DETAIL_INCLUDE` — thêm Timeline lọc `DEBT_MANUAL_ADJUSTED`
- [ ] FE Receivable detail — khối "Lịch sử điều chỉnh công nợ"
- [ ] FE Return detail — nút dự phòng "Điều chỉnh giảm công nợ"
- [ ] Dashboard: sửa công thức "Tổng doanh thu kế hoạch" (trừ phần công ty chịu)
- [ ] Dashboard: `GET /dashboard/sales/by-employee` + panel `employee-revenue-panel.tsx` (dùng `shared/date-range-filter.tsx`, mặc định "Tháng này"), đặt dưới khối Kinh doanh
- [ ] SalesOrder detail (web) — khối "Đã hoàn"
- [ ] Bản in PDF đơn hàng — khối "Đã hoàn"
- [ ] `GET /sales-orders` — thêm field `hasReturn`
- [ ] FE `SalesOrderTable` — icon/badge cảnh báo dòng đơn có Return
- [ ] Cập nhật tài liệu: `return.md`, `dashboard.md`, `debt.md`
- [ ] Test: Return tạo được ở mọi trạng thái trừ CANCELLED; validate `customerBorneAmount` trong khoảng hợp lệ; Manual Adjustment tự động chạy đúng khi công ty chịu > 0 và không chạy khi = 0; Manual Adjustment không tạo Payment/không ảnh hưởng cash report; Dashboard KPI + bảng nhân viên tính đúng theo phần công ty chịu; Timeline hiển thị đúng ở Receivable detail; badge `hasReturn` đúng

---

Chưa xác nhận triển khai — chờ người dùng review lại toàn bộ và quyết định có điều chỉnh gì thêm không.
