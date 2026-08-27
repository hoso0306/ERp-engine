# Đề xuất: Return nới điều kiện tạo + tác động Doanh thu/Doanh số/Công nợ

> **Tên file:** `workbench/sessions/2026-08-26-return-doanh-thu-cong-no-de-xuat.md`
> **Trạng thái:** 📝 ĐỀ XUẤT — CHƯA XÁC NHẬN, CHƯA CODE. Lưu lại để xem lại sau.
> **Ngày:** 26/08/2026

---

# Bối cảnh

Người dùng muốn:

1. Cho phép tạo Return ngay cả khi `SalesOrder` chưa `DELIVERED` (đơn còn đang sản xuất).
2. Khi tạo Return, phải ảnh hưởng tới doanh thu, doanh số nhân viên, doanh số khách hàng, và công nợ khách hàng.

**Lưu ý quan trọng — đây là đảo ngược quyết định đã chốt trước đó:**

- `return.md`: "Return **không phải** module tài chính... Return không làm thay đổi doanh thu/lợi nhuận/công nợ."
- `workbench/sprint-04/006-fix-loi-nhuan-ke-hoach-va-return-vat-display.md` dòng 14, 33: *"Doanh thu không trừ hàng hoàn — đúng thiết kế đã chốt (`return.md`), không sửa (giữ nguyên theo yêu cầu người dùng)."* — quyết định này (18/07/2026) nay bị đảo ngược theo yêu cầu mới.

Toàn bộ trao đổi làm rõ nghiệp vụ đã qua 2 vòng hỏi-đáp với người dùng (AskUserQuestion) — các lựa chọn đã chốt được ghi dưới đây.

---

# Quyết định đã chốt (qua hỏi đáp)

| Điểm quyết định | Lựa chọn đã chốt |
|---|---|
| "Hoàn khi đơn chưa sản xuất xong" là gì? | Vẫn là Return — chỉ nới điều kiện trạng thái (không phải Huỷ một phần đơn hàng) |
| Cách trừ doanh thu | Trừ ở **tầng Dashboard/Report**, **sửa trực tiếp** KPI "Tổng doanh thu kế hoạch" hiện có (không tạo KPI mới song song) — **không** tạo "đơn hàng âm" giả (tránh phá nguyên tắc Immutable Document của SalesOrder) — *cập nhật 27/08/2026* |
| Giảm công nợ | Qua **Action riêng** (Manual Adjustment ở Debt module), gọi từ màn Return, **gợi ý sẵn số tiền** = `Return.totalValue` nhưng **cho sửa tay** |
| Doanh số theo nhân viên | **Cần** — thêm bảng Ranking group theo `ownerName` |
| Tổng doanh số theo khách hàng | **Chưa cần đợt này** (tính năng mới, hiện không tồn tại — có thể làm sau) |
| Hiển thị "đã hoàn sản phẩm nào, giá bn" khi xem/in đơn hàng | **Cả web lẫn PDF** |

---

# Phạm vi kỹ thuật (đề xuất, dựa trên code thực tế đã kiểm tra)

## A. Return module — nới điều kiện tạo

- `apps/api/src/return/return.service.ts:154` — hiện chặn `salesOrder.status !== SalesOrderStatus.DELIVERED`. Đổi thành: chỉ chặn khi `status === CANCELLED`.
- Schema (`schema.prisma`, model `Return` dòng 1694): thêm field `ownerName String?` — snapshot từ `SalesOrder.ownerName` lúc tạo Return (cùng khuôn các field snapshot khác: `customerName`, `salesOrderCode`...).
- `ReturnService.create()`: copy `salesOrder.ownerName` → `return.ownerName`.
- **FE — bổ sung 27/08/2026:** `apps/web/src/components/sales-order/sales-order-typeahead.tsx:27` đang hard-code lọc `status="DELIVERED"` khi chọn đơn ở màn "Tạo phiếu hoàn" (`returns/new/page.tsx`) — phải sửa cùng lúc với BE, nếu không FE vẫn chỉ cho chọn đơn đã giao dù BE đã cho phép trạng thái khác.
- Cập nhật `knowledge/modules/return.md`:
  - Bỏ rule "chỉ tạo khi DELIVERED" (dòng 199, 554) → thay bằng "chỉ chặn khi CANCELLED".
  - Sửa đoạn "Return không làm thay đổi doanh thu/công nợ" (dòng 566-570, 586-592) — ghi rõ ngoại lệ mới: Return không tự sửa `SalesOrder`/`Receivable` (vẫn Immutable Document), nhưng **bị trừ ở tầng Dashboard tổng hợp**, và **có thể** kích hoạt giảm công nợ qua Manual Adjustment (hành động chủ động của kế toán, không tự động).

## B. Dashboard — sửa KPI có sẵn + 1 bảng mới (cập nhật 27/08/2026)

**Đã đổi so với đề xuất ban đầu:** không thêm KPI "Doanh thu thuần" song song — **sửa trực tiếp** công thức của KPI "Tổng doanh thu kế hoạch" hiện có, không tạo thêm số liệu mới. Chỉ còn 1 con số doanh thu duy nhất trên Dashboard.

- Thêm method đọc mới `ReturnService.getTotalReturnValue(dateRange?, groupBy?: 'ownerName')` — Dashboard gọi qua đây, đúng nguyên tắc "Module Ownership" (`dashboard.md`: không tự SUM bảng của module khác).
- **KPI "Tổng doanh thu kế hoạch" (sửa công thức hiện có):** `SUM(SalesOrder.totalAmount) − SUM(Return.totalValue)` toàn công ty — thay cho công thức cũ chỉ `SUM(SalesOrder.totalAmount)`. Không đổi tên KPI, không thêm KPI song song.
- **Khối mới — "Doanh số theo nhân viên"** (bổ sung 27/08/2026): 1 card riêng, đặt **ngay dưới khối Kinh doanh** (`sales-overview-panel.tsx`) trên trang Dashboard. Công thức mỗi dòng: `SUM(SalesOrder.totalAmount) GROUP BY ownerName − SUM(Return.totalValue) GROUP BY ownerName`, lọc theo `createdAt` trong khoảng filter của khối này.
  - **Chỉ hiển thị nhân viên có phát sinh doanh số trong khoảng đã chọn** — không liệt kê nhân viên có `ownerName` nhưng không có đơn nào rơi vào khoảng lọc (tự nhiên loại trừ khi group theo `createdAt` trong range, không cần thêm logic ẩn/hiện riêng).
  - **Bộ lọc riêng, độc lập với khối Kinh doanh**, nhưng dùng component khác: khối Kinh doanh đang dùng `dashboard-range-filter.tsx` (4 preset ngắn: Hôm nay/Hôm qua/7 ngày/Tất cả, không có Tháng này). Khối này cần **mặc định "Tháng này", sửa được theo ngày tuỳ ý** → phải dùng `shared/date-range-filter.tsx` (đã có sẵn preset `today/week/month/all/custom`, đang dùng ở các trang list như `sales-order-filter.tsx`, `receivable-filter.tsx`) — đúng comment sẵn có trong `dashboard-range-filter.tsx` dòng 77-82 chỉ rõ khi nào dùng component nào.
  - Endpoint mới, ví dụ `GET /dashboard/sales/by-employee?from=&to=` — panel `employee-revenue-panel.tsx` (mới) tự quản lý state filter + tự fetch, theo đúng kiến trúc "mỗi Panel tự chủ" đã áp dụng từ `027-thiet-ke-lai-dashboard-bo-loc-rieng.md`.
- Cần cập nhật `knowledge/modules/dashboard.md` mục "Sales Overview": sửa công thức "Tổng doanh thu kế hoạch" (dòng 123) + thêm mô tả khối mới "Doanh số theo nhân viên" (vị trí, filter riêng, điều kiện chỉ hiện nhân viên có phát sinh).

## C. SalesOrder detail (web) + bản in PDF — hiển thị "Đã hoàn"

- Đọc thêm (read-time join, **không sửa** `SalesOrder`): `Return`/`ReturnItem` theo `salesOrderId` của đơn đang xem — dữ liệu đã có sẵn (`Return.salesOrderId`), không cần đổi data model.
- Thêm khối **"Đã hoàn"** trên trang chi tiết SalesOrder (web) và bản in PDF: sản phẩm, số lượng hoàn, đơn giá (`unitPriceSnapshot`), giá trị dòng.

## C2. Danh sách đơn hàng — badge cảnh báo "có hàng hoàn" (bổ sung 27/08/2026)

Phát sinh từ câu hỏi người dùng: mở danh sách đơn cũ của 1 khách (tab "Đơn hàng" trên trang chi tiết Customer, hoặc trang `/orders` chung) hiện **chưa** biết đơn nào có Return nếu không bấm vào từng đơn — đã kiểm tra code thực tế, cả 2 nơi dùng chung 1 component bảng `SalesOrderTable` (`apps/web/src/components/sales-order/sales-order-table.tsx`), hiện không có cột/dấu hiệu nào cho Return.

Quyết định: dùng **icon/badge cảnh báo** trên dòng đơn có Return (không thêm cột số liệu riêng).

- BE: `GET /sales-orders` (dùng chung cho cả trang `/orders` và `CustomerOrdersTab`) trả thêm field `hasReturn: boolean` cho mỗi đơn — tính bằng `EXISTS` theo `salesOrderId`, không lưu thêm field trong DB (đúng nguyên tắc không lưu Derived Data khi tính trực tiếp chi phí thấp — CLAUDE.md mục 13).
- FE: `SalesOrderTable` — thêm icon nhỏ (vd cạnh mã đơn) khi `hasReturn === true`, kèm tooltip "Đơn có hàng hoàn". Áp dụng đồng thời cho cả 2 nơi vì dùng chung component.

## D. Debt module — Manual Adjustment (xây mới hoàn toàn, chưa có code)

`debt.md` mục "Ghi chú" đã dự tính tính năng này (V2) nhưng chưa triển khai — nay triển khai theo yêu cầu:

- `POST /receivables/:id/manual-adjustment` — body `{ amount, reason }`.
- Giảm atomic cả `totalAmount` và `remainingAmount` (Prisma `decrement`, giữ nguyên CHECK constraint `remaining_amount >= 0` đã có — không cho giảm vượt).
- Bắt buộc `reason`, lưu actor (`createdBy`) + thời gian + `oldValue`/`newValue` — đúng khuôn Manual Override (CLAUDE.md mục 5).
- Schema: thêm `SalesOrderTimelineAction.DEBT_MANUAL_ADJUSTED` (không tái dùng `MANUAL_OVERRIDE` — action đó dành cho đổi `SalesOrder.status`, ngữ nghĩa khác). Payload gồm `{ amount, reason, returnCode }` — `returnCode` để biết điều chỉnh này đến từ phiếu hoàn nào.
- **Quan trọng — đã phát hiện lỗ hổng UX khi review:** `GET /receivables/:id` hiện tại (`debt.service.ts`, `RECEIVABLE_DETAIL_INCLUDE` dòng 85-108) **không include Timeline**, chỉ include `allocations` (lịch sử thu tiền qua `PaymentAllocation`). Nếu chỉ ghi Timeline mà không hiển thị đúng chỗ kế toán xem (trang Receivable), sẽ khó kiểm tra lại sau này.
  → **Cần sửa `RECEIVABLE_DETAIL_INCLUDE`**: thêm include Timeline lọc theo action `DEBT_MANUAL_ADJUSTED`, hiển thị thành khối **"Lịch sử điều chỉnh công nợ"** ngay trên trang chi tiết Receivable, đặt cạnh khối "Lịch sử thu tiền" hiện có.
- FE: nút **"Giảm công nợ theo hoàn"** trên trang chi tiết Return → mở dialog Manual Adjustment (thuộc Debt UI), truyền sẵn `salesOrderId` (từ `Return.salesOrderId`) + `suggestedAmount = Return.totalValue`, cho sửa tay trước khi xác nhận.
- Return service **không** gọi sang Debt service trực tiếp — chỉ FE điều hướng, giữ ranh giới 2 module độc lập (đúng nguyên tắc Return chỉ đọc SalesOrder, không phụ thuộc module tài chính).

## Ngoài phạm vi (đã xác nhận không làm đợt này)

- "Tổng doanh số theo khách hàng" — tính năng mới, hiện Customer module không có field/API nào tính tổng `SalesOrder.totalAmount` theo khách hàng (đã kiểm tra `customer.service.ts`, chỉ có `getDebtSummary()` tính công nợ còn lại từ `Receivable`, không phải doanh số đã bán). Để dành làm sau nếu cần.

---

# Việc cần làm khi bắt đầu code (checklist)

- [ ] `return.service.ts` — nới điều kiện trạng thái tạo Return
- [ ] `sales-order-typeahead.tsx` — bỏ hard-code lọc `status="DELIVERED"` ở màn chọn đơn khi tạo Return
- [ ] Schema: `Return.ownerName`, `SalesOrderTimelineAction.DEBT_MANUAL_ADJUSTED`
- [ ] Migration Prisma
- [ ] `ReturnService.create()` — snapshot `ownerName`
- [ ] `ReturnService.getTotalReturnValue()` — method đọc mới
- [ ] Dashboard: sửa công thức KPI "Tổng doanh thu kế hoạch" (trừ Return)
- [ ] Dashboard: `GET /dashboard/sales/by-employee` + panel mới `employee-revenue-panel.tsx` (dùng `shared/date-range-filter.tsx`, mặc định "Tháng này"), đặt dưới khối Kinh doanh
- [ ] SalesOrder detail (web) — khối "Đã hoàn"
- [ ] Bản in PDF đơn hàng — khối "Đã hoàn"
- [ ] `GET /sales-orders` — thêm field `hasReturn`
- [ ] FE `SalesOrderTable` — icon/badge cảnh báo dòng đơn có Return
- [ ] Debt module: API `POST /receivables/:id/manual-adjustment`
- [ ] `RECEIVABLE_DETAIL_INCLUDE` — thêm Timeline lọc `DEBT_MANUAL_ADJUSTED`
- [ ] FE Receivable detail — khối "Lịch sử điều chỉnh công nợ"
- [ ] FE Return detail — nút "Giảm công nợ theo hoàn" + dialog Manual Adjustment
- [ ] Cập nhật tài liệu: `return.md`, `dashboard.md`, `debt.md`
- [ ] Test: Return tạo được ở mọi trạng thái trừ CANCELLED; Dashboard KPI đúng số; Manual Adjustment không cho giảm vượt `remainingAmount`; Timeline hiển thị đúng ở Receivable detail

---

Chưa xác nhận triển khai — chờ người dùng review lại và quyết định thứ tự ưu tiên / có điều chỉnh gì thêm không.
