# Milestone (Sprint 04) - Thiết kế lại Dashboard: card hoá từng khối, cảnh báo dạng accordion, bộ lọc riêng từng khối

> **Tên file:** `workbench/sprint-04/027-thiet-ke-lai-dashboard-bo-loc-rieng.md`
> **Trạng thái:** ✅ Code xong (28/07/2026) — Backend: `tsc --noEmit` sạch, 385/385 test pass (thêm 7 test mới cho range/inRange). Frontend: `tsc --noEmit` + `next build` sạch (50 route). Còn 1 việc chờ user: tự xem qua UI thật (môi trường không có công cụ browser trong phiên này).
> **Tiếp nối:** `026-cai-tien-dashboard.md` (đã code xong, chưa deploy).

---

# Bối cảnh

Sau khi hoàn thành `026-cai-tien-dashboard.md`, user yêu cầu thiết kế lại UI/UX Dashboard theo 3 hướng:

1. Cảnh báo gom thành danh sách dạng accordion (bấm mới xổ), có số lượng bên cạnh mỗi loại.
2. Mỗi khối (Hôm nay/Kinh doanh/Sản xuất/Tổng công nợ/Hàng hoàn) bọc trong 1 card riêng (viền + màu), trực quan hơn.
3. Mỗi khối có bộ lọc thời gian **riêng, độc lập** với nhau — thay cho bộ lọc chung ở đầu trang hiện tại.

Mục 3 đảo ngược 2 quyết định đã chốt trước đó (`007-bo-loc-thoi-gian-dashboard.md`, 18/07/2026): khối Kinh doanh và khối Công nợ trước đó luôn all-time, không lọc. Đã hỏi lại trực tiếp và có quyết định mới ở dưới.

---

# Quyết định đã chốt (28/07/2026)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Bộ lọc chung đầu trang | **Bỏ hẳn.** Mỗi khối tự có filter + giá trị mặc định riêng. |
| 2 | Khối Kinh doanh — filter áp dụng vào đâu | **Cả 6 tile** (Doanh thu/Giá vốn/Lợi nhuận kế hoạch + Đơn đang SX/đã hoàn thành SX/đã giao) tính lại theo `createdAt` trong khoảng đã chọn — **đảo ngược quyết định all-time cũ**. Mặc định "Hôm nay". |
| 3 | Khối Tổng công nợ — filter áp dụng vào đâu | Các tile số dư cũ (Tổng phải thu/Đã thu/Còn phải thu/Quá hạn/Vượt hạn mức/Top khách nợ) **giữ nguyên all-time, không đổi theo filter** (đúng nguyên tắc report.md). Filter riêng chỉ áp vào **2 tile mới "phát sinh"** (xem mục 4). Mặc định "Tất cả". |
| 4 | Khối Công nợ chưa có số "phát sinh" để lọc | Thêm 2 tile mới: **"Nợ mới phát sinh"** (`SUM(Receivable.totalAmount)` của Receivable thuộc SalesOrder có `createdAt` trong khoảng, loại CANCELLED) và **"Tiền đã thu"** (tái dùng `DebtService.getCashInReport()` đã có sẵn cho Report A2) — đúng định nghĩa "Phát sinh" đã có ở `report.md` A4, không bịa nghiệp vụ mới. |
| 5 | Khối "Hôm nay" | Có filter riêng, mặc định "Hôm nay" nhưng đổi được. Đổi tên tiêu đề khối động theo preset đang chọn (vd chọn "Hôm qua" → tiêu đề đổi thành "Hôm qua"). |
| 6 | Khối Sản xuất | Filter riêng, mặc định **"Tất cả"** (khác với "Hôm nay" ngầm định trước đây qua bộ lọc chung). Giữ nguyên cấu trúc cũ: Chờ SX/Đang SX/Tiến độ tổng/Xưởng bận luôn tức thời không đổi theo filter; Hoàn thành/Huỷ đổi theo filter riêng của khối. |
| 7 | Khối Hàng hoàn | Filter riêng, mặc định **"Tất cả"**. Giữ nguyên cấu trúc cũ: Kho thu hồi khả dụng/Tồn kho thu hồi lâu luôn tức thời; Phiếu hoàn/SL/Giá trị hoàn + bảng Lý do/Khách trả nhiều đổi theo filter riêng của khối. |

---

# Thiết kế kỹ thuật

## A. Backend — mỗi khối tự nhận `from`/`to` riêng qua endpoint riêng

Hiện FE chỉ gọi 1 endpoint `GET /dashboard/overview` (combined). Đổi sang gọi **5 endpoint riêng đã có sẵn nhưng đang không dùng** (`/dashboard/sales`, `/production`, `/debt`, `/returns`, `/alerts`) + 1 endpoint mới (`/dashboard/today`), mỗi endpoint tự nhận `from`/`to` qua query, độc lập với nhau. `GET /dashboard/overview` giữ nguyên (không xoá) để không phá endpoint cũ nếu chỗ khác đang dùng — nhưng FE Dashboard sẽ không gọi nó nữa.

**Sửa từng service:**

- `SalesOrderService.getDashboardSummary(range?)` — thêm tham số `range?: {from?, to?}`, khi có thì thêm `createdAt` vào where của cả `aggregate` (3 tile tiền) lẫn `groupBy` (3 tile đếm). Không truyền = all-time (giữ tương thích ngược cho nơi khác đang gọi không truyền range).
- `DashboardService.getSalesDashboard(range?)` — forward range xuống trên.
- `DebtService` — thêm method mới `getReceivablesInRangeSummary(from, to)` → `{ newReceivableCount, newReceivableAmount, cashIn }` (tái cấu trúc từ đúng logic đang nằm trong `getDebtReport()`, để 1 nơi định nghĩa duy nhất — sửa `getDebtReport()` gọi lại method mới này thay vì tự viết query riêng).
- `DashboardService.getDebtDashboard()` — thêm gọi `getReceivablesInRangeSummary(from, to)` khi FE truyền range, gộp vào response.
- `ProductionOrderService.getDashboardSummary(range?)`, `ReturnService.getDashboardSummary(range?)` — đã sẵn nhận range, không cần đổi gì.
- `DashboardService.getTodaySummary(range?)` — đổi từ hard-code "hôm nay" sang nhận `range?` tuỳ chọn, mặc định "hôm nay" khi không truyền (giữ đúng hành vi cũ khi FE không truyền gì).
- `DashboardController` — mỗi route (`/sales`, `/production`, `/debt`, `/returns`) parse thêm `from`/`to` từ query (dùng lại đúng `parseRange()` đã có), forward xuống Service. Thêm route mới `GET /dashboard/today?from=&to=`.

## B. Frontend

### B1. Bộ lọc riêng từng khối

Mở rộng `DashboardRangeFilter` thêm preset thứ 4 **"Tất cả"** (`dateFrom`/`dateTo` là `string | undefined` thay vì luôn có giá trị). Dùng 1 component này cho cả 5 khối, chỉ khác state/default:

| Khối | State mặc định |
|---|---|
| Hôm nay | `{from: hôm nay, to: hôm nay}` |
| Kinh doanh | `{from: hôm nay, to: hôm nay}` |
| Sản xuất | `undefined` (Tất cả) |
| Tổng công nợ | `undefined` (Tất cả) |
| Hàng hoàn | `undefined` (Tất cả) |

`dashboard/page.tsx` không còn giữ 1 state `dateFrom`/`dateTo` chung — xoá hẳn, không gọi `/dashboard/overview` nữa. Thay vào đó mỗi Panel component tự quản lý state filter + tự fetch dữ liệu của mình (dùng `useEffect` theo state filter riêng), nhận thêm props filter UI để render `DashboardRangeFilter` ngay trong card của mình. `AlertsPanel` fetch riêng từ `/dashboard/alerts` (không có filter, giữ nguyên toàn bộ thời gian).

### B2. Card hoá từng khối

Bọc mỗi `<section>` hiện tại (Hôm nay/Kinh doanh/Sản xuất/Tổng công nợ/Hàng hoàn) trong 1 wrapper card dùng chung: `rounded-xl border bg-card p-4 sm:p-6 shadow-sm` (dùng token theme có sẵn `bg-card`/`border`, tự đổi đúng theo Light/Dark — không tự bịa palette mới). Có thể thêm dải màu nhỏ bên trái (`border-l-4`) theo tông đã dùng sẵn trong code (`text-destructive` cho cảnh báo/nguy hiểm, tông xanh dương nhạt mặc định cho các khối còn lại) để phân biệt nhẹ, không lòe loẹt — phù hợp phần mềm nghiệp vụ nội bộ.

### B3. Cảnh báo dạng accordion

Component mới `alert-group.tsx` — 1 dòng tiêu đề (icon + nhãn + badge số lượng), bấm để xổ/thu danh sách chi tiết bên dưới. Dùng lại đúng pattern `ChevronDown`/`ChevronRight` + `useState` đã có sẵn ở `receivable-by-customer-table.tsx` (không thêm thư viện Accordion mới, dự án chưa có sẵn — giữ nhất quán, nhẹ).

5 nhóm: Khách nợ quá hạn / Khách vượt hạn mức / Đơn trễ giao / Báo giá chưa phản hồi / Phiếu SX trễ hạn. Nhóm nào 0 cảnh báo thì ẩn hẳn dòng đó (không hiện "(0)"). Mặc định tất cả **thu gọn** (đúng yêu cầu "bấm mới xổ xuống").

---

# Checklist thực hiện

## Backend
- [x] `sales-order.service.ts`: `getDashboardSummary(range?)` nhận range.
- [x] `debt.service.ts`: `getReceivablesInRangeSummary(from, to)` (mới) + refactor `getDebtReport()` gọi lại.
- [x] `dashboard.service.ts`: `getSalesDashboard(range?)`, `getDebtDashboard()` gộp `inRange`, `getTodaySummary(range?)`.
- [x] `dashboard.controller.ts`: parse `from`/`to` cho `/sales`, `/production`, `/debt`, `/returns`; thêm route `GET /dashboard/today`.
- [x] Test: cập nhật/thêm cho các thay đổi trên.

## Frontend
- [x] `dashboard-range-filter.tsx`: thêm preset "Tất cả".
- [x] `dashboard-card.tsx` (mới): wrapper card dùng chung cho 5 khối.
- [x] `alert-group.tsx` (mới): accordion 1 nhóm cảnh báo.
- [x] `alerts-panel.tsx`: đổi sang dùng `alert-group.tsx`, tự fetch `/dashboard/alerts`.
- [x] `today-summary-bar.tsx`: thêm filter riêng, tự fetch `/dashboard/today`, đổi tên card theo preset.
- [x] `sales-overview-panel.tsx`: thêm filter riêng, tự fetch `/dashboard/sales`, 6 tile đổi theo filter.
- [x] `production-overview-panel.tsx`: thêm filter riêng (mặc định Tất cả), tự fetch `/dashboard/production`.
- [x] `debt-overview-panel.tsx`: thêm filter riêng (mặc định Tất cả), tự fetch `/dashboard/debt`, thêm 2 tile "phát sinh".
- [x] `return-overview-panel.tsx`: thêm filter riêng (mặc định Tất cả), tự fetch `/dashboard/returns`.
- [x] `dashboard/page.tsx`: xoá state/filter chung, xoá gọi `/dashboard/overview`, mỗi Panel tự chủ.

## Kiểm thử
- [x] `tsc --noEmit` + `next build` + `nest build` sạch, `npx jest` pass.
- [ ] Verify tay qua UI thật (user tự làm, môi trường không có công cụ browser).

---

# Ghi chú

Toàn bộ điểm mở đã được xác nhận qua 2 vòng hỏi (28/07/2026). Không tự quyết thêm gì ngoài phạm vi đã chốt ở trên.
