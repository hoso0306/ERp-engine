# Milestone (Sprint 04) - Cải tiến Dashboard (rà soát so với ERP lớn)

> **Tên file:** `workbench/sprint-04/026-cai-tien-dashboard.md`
> **Trạng thái:** ✅ Code xong (28/07/2026) — Backend: `tsc --noEmit` sạch, 378/378 test pass (bao gồm test mới cho 3 service), seed đã chạy trên DB dev local (permission `sales-order.view-cost` + 2 Settings key mới). Frontend: `tsc --noEmit` + `next build` sạch. Còn 2 việc chờ người dùng: (1) tự xem qua UI thật (chưa có công cụ browser trong môi trường này để tự verify), (2) `pnpm -r lint` hiện đang fail sẵn trên `main` (lỗi `react-hooks/set-state-in-effect`, pre-existing ở nhiều trang trước cả task này) — 3 effect mới thêm ở `production`/`returns`/`debts/by-customer` theo đúng pattern cũ đang dùng, không phải lỗi mới phát sinh, nhưng chưa được dọn.

---

# Bối cảnh

Rà soát tab Dashboard (28/07/2026) so với cách trình bày của các ERP lớn (SAP Business One, Odoo, NetSuite, Misa...). Dashboard hiện đã tách vai rõ với module Report (`knowledge/modules/dashboard.md` + `report.md`: Dashboard = "hôm nay cần xử lý gì", Report = phân tích/xu hướng/so sánh kỳ — đã có đủ 11 trang report FE). Rà soát tập trung vào phần thuộc trách nhiệm Dashboard, không lấn sang việc Report đã làm.

Đã thống nhất làm toàn bộ 8 đề xuất bên dưới. File này lên kế hoạch kỹ thuật cho từng mục và liệt kê câu hỏi nghiệp vụ cần trả lời trước khi code (theo `01-tong-quan-du-an.md` mục 10 — không code khi thiết kế chưa được xác nhận).

---

# Danh sách thay đổi

## 1. Đổi nhãn phân biệt "Đang sản xuất" / "Hoàn thành SX" giữa khối Kinh doanh và Sản xuất

**Vấn đề đã xác minh trong code:**
- Khối Kinh doanh: `SalesOrderService.getDashboardSummary()` — đếm `SalesOrder` theo `status` (`IN_PRODUCTION`, `PRODUCTION_COMPLETED`), **all-time**.
- Khối Sản xuất: `ProductionOrderService.getDashboardSummary()` — đếm `ProductionOrder` theo `status`, "Đang SX" **tức thời**, "Hoàn thành" **theo bộ lọc ngày** (`completedAt`).

Một `SalesOrder` có thể có nhiều `ProductionOrder` → hai con số "Đang sản xuất" không bằng nhau về bản chất, cùng tên đặt sát nhau dễ gây hiểu nhầm là sai số liệu.

**Quyết định:** chỉ đổi nhãn hiển thị (FE, không đổi API/logic):
- Khối Kinh doanh: "Đang sản xuất" → **"Đơn đang SX"**, "Hoàn thành SX" → **"Đơn đã hoàn thành SX"** (tính theo đơn hàng, all-time).
- Khối Sản xuất: giữ "Đang sản xuất"/"Đã hoàn thành" nhưng làm rõ hơn trong `sub`: đổi `sub="hiện tại"` → **"phiếu SX, hiện tại"**, và với "Đã hoàn thành" đổi sub sang **"phiếu SX, {label khoảng ngày}"**.

**Phạm vi kỹ thuật:** FE only — `sales-overview-panel.tsx`, `production-overview-panel.tsx`. Không đổi BE.

---

## 2. Thêm chú thích "toàn bộ thời gian — không áp dụng bộ lọc" cho khối Kinh doanh

Khối "Tổng công nợ" đã có mẫu chú thích này (`debt-overview-panel.tsx` dòng 65). Áp dụng tương tự cho khối "Kinh doanh" vì 3 tile tiền (doanh thu/giá vốn/lợi nhuận kế hoạch) và 3 tile đếm trạng thái đều all-time, không đổi theo bộ lọc đầu trang — hiện chưa có chú thích nên dễ hiểu nhầm là đang lọc theo "Hôm nay".

**Phạm vi kỹ thuật:** FE only — `sales-overview-panel.tsx`. Không đổi BE.

---

## 3. Mở rộng khối Cảnh báo

Hai cảnh báo mới, cùng cơ chế với cảnh báo hiện có (chỉ cảnh báo, không tạo Workflow — đúng `dashboard.md` mục "Alerts").

### 3a. Báo giá gửi khách lâu chưa phản hồi

- **Nguồn:** `Quotation.status = SENT` + `QuotationTimeline` action `QUOTATION_SENT` (lấy `createdAt` làm mốc "ngày gửi"). Đã xác minh: `QuotationTimelineAction` có sẵn giá trị `QUOTATION_SENT`.
- **Điều kiện cảnh báo:** `today - ngày gửi >= N ngày`, với N đọc từ **Settings** (theo đúng convention đã có ở `setting.md` — `Settings.Dashboard.upcomingDueDays` là ví dụ tương tự cho Debt). Đề xuất thêm key mới `Settings.Dashboard.quotationPendingDays`, không hard-code.
- **Thuộc Module Ownership:** cần bổ sung method đọc mới ở `QuotationService` (ví dụ `getPendingResponseQuotations(days)`), Dashboard chỉ gọi qua, không tự query.

### 3b. Phiếu sản xuất trễ so với mốc "cần hoàn thành"

- **Quyết định (28/07/2026):** hạn sản xuất = `ProductionOrder.createdAt` + **2 ngày** (SLA cố định, tính từ lúc sinh phiếu). Đây là **Derived Data tính runtime**, không lưu field mới (đúng "Nguyên tắc 13 — Data Design Principles": suy ra được từ `createdAt` với chi phí thấp, không cần snapshot). Không đổi schema `ProductionOrder`.
- **Điều kiện cảnh báo:** `status IN (PENDING, IN_PRODUCTION)` (chưa `PRODUCTION_COMPLETED`/`CANCELLED`) **VÀ** `createdAt <= now - N ngày`.
- **Số ngày N (mặc định 2) đọc từ Settings** — theo đúng convention đã có ở `setting.md` (vd `Settings.Dashboard.upcomingDueDays`), không hard-code trong code. Đề xuất key mới `Settings.Dashboard.productionOrderSlaDays`, `defaultValue = 2`. Đây là quyết định kỹ thuật áp dụng đúng quy tắc đã có sẵn trong dự án (không phải điểm cần hỏi thêm) — nếu muốn hard-code cố định 2 ngày không cho chỉnh qua Cài đặt, cần nói rõ để đổi lại cách làm này.

**Phạm vi kỹ thuật:** BE (Quotation module: method đọc mới; Settings: key mới; Dashboard: gọi qua `getAlerts()`) + FE (`alerts-panel.tsx` thêm 2 loại alert).

---

## 4. Chuyển khối Cảnh báo lên đầu trang

Đổi thứ tự render trong `dashboard/page.tsx`: `AlertsPanel` lên trước `SalesOverviewPanel` (thay vì cuối cùng như hiện tại) — vì đây là khối trả lời đúng câu hỏi cốt lõi "hôm nay cần xử lý gì" của Dashboard.

**Phạm vi kỹ thuật:** FE only — đổi thứ tự component trong `dashboard/page.tsx`.

---

## 5. Dải tổng hợp nhanh "Hôm nay"

Thêm 1 dải số ở đầu trang (trên các khối hiện có): số đơn hàng mới, tiền đã thu, số đơn đã giao xe — **luôn cố định "hôm nay"**, không đổi theo bộ lọc đầu trang (khác các khối Sản xuất/Hàng hoàn — quyết định 28/07/2026: giữ đúng nghĩa đen của tên gọi "Hôm nay").

**Nguồn dữ liệu từng số (đã xác nhận):**
- **Đơn mới:** `COUNT(SalesOrder)` theo `createdAt` = hôm nay, loại `CANCELLED` (đúng quy tắc loại trừ ở `report.md`).
- **Tiền đã thu:** `SUM(Payment.amount)` theo `paymentDate` = hôm nay (đã có method tương tự ở Report A2 — tái dùng qua `PaymentService`/`DebtService`, không viết lại logic).
- **Đơn đã giao xe:** đổi tên tile thành **"Đơn đã giao xe"** (không dùng nhãn mơ hồ "Đơn giao"). Nguồn: `SalesOrderTimeline` action `SHIPPED`, `createdAt` = hôm nay (COUNT distinct `salesOrderId`) — đã xác minh model `SalesOrderTimeline` có sẵn action này, `SalesOrder` không có cột `shippedAt` riêng nên phải đọc qua Timeline, đúng Module Ownership (qua `SalesOrderService`).

**Phạm vi kỹ thuật:** BE (method đọc mới ở `SalesOrderService`, tái dùng phần tiền đã thu từ Debt/Payment) + FE (dải UI mới, đặt trên `AlertsPanel` sau khi áp dụng mục 4).

---

## 6. Đồng bộ permission gating cho khối Kinh doanh và `alerts.delayedOrders`

Hiện `production`/`debt`/`returns` bị ẩn (trả `null`) theo quyền tương ứng ở `dashboard.controller.ts`, nhưng `sales` (toàn bộ khối Kinh doanh) và `alerts.delayedOrders` thì không — đã được ghi chú lại trong code (`dashboard/page.tsx` dòng 17: "ghi nhận, không tự sửa BE").

**⚠️ Xung đột đã phát hiện với `permission.md` (dòng 501-512):** tài liệu quy định rõ **"Dashboard không có permission riêng cho từng KPI... không tạo thêm permission `dashboard.xxx` nào"** — chỉ được hỏi lại đúng quyền `view` sẵn có của module sở hữu dữ liệu (mẫu hiện có: `warehouse.view`, `debt.view`, `return.view`, `production.view`). Đã trao đổi và **chốt phá lệ có chủ đích** cho riêng khối Kinh doanh (28/07/2026):

**Quyết định — đổi tên theo đúng convention đã có sẵn trong codebase (phát hiện khi rà `apps/api/prisma/seed.ts`):**

Codebase đã có sẵn **đúng pattern này** cho `quotation`: permission `quotation.view-cost` — "xem giá vốn/lợi nhuận ước tính của báo giá, dữ liệu tài chính nhạy cảm. Tách riêng khỏi `view` vì chỉ OWNER/ADMIN được thấy — SALES có `view` nhưng KHÔNG có `view-cost` (lọc trừ tường minh ở role SALES)". Đây chính xác là khái niệm người dùng muốn cho Sales Order → dùng lại tên **`sales-order.view-cost`** thay vì `viewFinancials` để nhất quán naming convention `<resource>.view-cost` đã thiết lập, thay vì tạo một cái tên mới.

- Thêm `'view-cost'` vào `PERMISSION_CATALOG['sales-order']` (`apps/api/prisma/seed.ts` dòng 22): `['view', 'ship', 'deliver', 'cancel', 'override', 'view-cost']`.
- Ẩn theo `sales-order.view-cost`: **toàn bộ khối Kinh doanh** (cả 6 tile lẫn bảng "Đơn hàng gần đây") — thiếu quyền này thì ẩn hết, không ẩn riêng lẻ từng tile.
- `sales-order.view-cost` là quyền **độc lập hoàn toàn** với `sales-order.view` (đúng cách `quotation.view-cost` đang hoạt động — không phụ thuộc `quotation.view`).
- `alerts.delayedOrders` (đơn trễ giao — không có số tiền) ẩn theo **`sales-order.view`** (không phải `view-cost`) — đúng bản chất đây là trạng thái vận hành, không phải dữ liệu tài chính.
- **Gán Role mặc định — theo đúng tiền lệ `quotation.view-cost`:** chỉ OWNER/ADMIN có (qua `allKeys()`). Role `SALES` **không** được thêm `sales-order.view-cost` (dù đã có `sales-order.view`) — nhất quán với việc SALES role hiện đã bị lọc trừ `quotation.view-cost`. `MANAGER`/`VIEWER` dùng `viewKeys()` (chỉ lấy `.view`) nên tự động **không** có `view-cost` — không cần lọc trừ thêm.

**Cần cập nhật thêm khi triển khai:**
- `permission.md`: bổ sung ngoại lệ cho khối Kinh doanh vào bảng "Dashboard Permission" (dòng 505-510) + bổ sung `sales-order.view-cost` vào phần liệt kê permission catalog của tài liệu, ghi rõ lý do (đồng bộ với `quotation.view-cost`).
- `apps/api/prisma/seed.ts`: thêm `'view-cost'` vào catalog `sales-order` (Permission không có CRUD API — seed theo release, đúng quy tắc đã có).

**Phạm vi kỹ thuật:** BE — seed permission mới, `dashboard.controller.ts` (check `sales-order.view-cost` cho `sales`, `sales-order.view` cho `alerts.delayedOrders`). FE — `dashboard/page.tsx` đã sẵn kiểu `SalesOverview | null`, chỉ cần đổi type + render guard.

---

## 7. Cho phép click-through một số StatTile

Thêm khả năng bấm vào tile để đi thẳng tới danh sách đã lọc sẵn tương ứng.

**Đã kiểm tra:** `/production`, `/returns`, `/debts` hiện **đều chưa đọc query param để lọc sẵn** (không có `useSearchParams`/`searchParams.get` nào trong 3 trang). Nghĩa là mục này không chỉ là việc ở Dashboard — phải thêm code đọc query filter ở từng trang đích. Danh sách tile dự kiến gắn link:

| Tile | Khối | Route đích dự kiến |
|---|---|---|
| Quá hạn | Tổng công nợ | `/debts?filter=overdue` |
| Vượt hạn mức | Tổng công nợ | `/debts?filter=creditExceeded` |
| Đã huỷ | Sản xuất | `/production?status=CANCELLED` |
| Chờ sản xuất / Đang sản xuất | Sản xuất | `/production?status=PENDING` / `?status=IN_PRODUCTION` |
| Tồn kho thu hồi lâu | Hàng hoàn | `/returns?aging=over30` (hoặc tuỳ filter đã có) |

**Phạm vi kỹ thuật:** FE — đổi `StatTile` từ `<div>` sang hỗ trợ `href` tuỳ chọn (dùng `Link` khi có, giữ `<div>` khi không). **Cộng thêm việc ở 3 trang đích** (`/production`, `/returns`, `/debts`): đọc query param lúc mount và áp filter tương ứng vào state lọc đã có sẵn của từng trang (không đổi BE — 3 trang này vốn đã fetch toàn bộ rồi lọc client-side).

---

## 8. Hiển thị "Cập nhật lúc HH:MM"

Thêm dòng nhỏ cạnh nút "Làm mới" hiển thị thời điểm `fetchOverview()` thành công gần nhất (state FE, dùng `new Date()` lúc nhận response — không cần BE trả timestamp vì Dashboard luôn realtime).

**Phạm vi kỹ thuật:** FE only — `dashboard/page.tsx`.

---

# Quyết định đã chốt (28/07/2026)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Mốc "cần hoàn thành" của Phiếu SX (mục 3b) | Derived runtime = `createdAt` + N ngày (mặc định 2, đọc từ Settings mới `Dashboard.productionOrderSlaDays`), không đổi schema. |
| 2 | Phạm vi thời gian dải "Hôm nay" (mục 5) | Luôn cố định hôm nay, không đổi theo bộ lọc đầu trang. |
| 3 | Định nghĩa "đơn giao" trong dải Hôm nay (mục 5) | Đổi tên tile thành "Đơn đã giao xe" — đếm theo `SalesOrderTimeline` action `SHIPPED` trong ngày. |
| 4 | Permission cho khối Kinh doanh (mục 6) | Tạo quyền mới `sales-order.view-cost` (đổi tên theo convention có sẵn, xem mục 6), độc lập với `sales-order.view`, ẩn toàn bộ khối; `alerts.delayedOrders` vẫn theo `sales-order.view`. |
| 5 | Nhãn mới khối Kinh doanh (mục 1) | Xác nhận giữ nguyên: "Đơn đang SX" / "Đơn đã hoàn thành SX". |
| 6 | Phạm vi click-through (mục 7) | Làm luôn filter ở cả 3 trang đích `/production`, `/returns`, `/debts` — không chỉ nối link suông. |

---

# Checklist thực hiện

## Backend
- [ ] Settings: thêm 2 key mới `Dashboard.quotationPendingDays` (mặc định 7, cần chốt số ngày cụ thể) và `Dashboard.productionOrderSlaDays` (mặc định 2) — seed theo đúng convention `setting.md`.
- [ ] `quotation.service.ts`: thêm `getPendingResponseQuotations(days)` (dựa `QuotationTimeline` action `QUOTATION_SENT`).
- [ ] `production-order.service.ts`: thêm method đọc phiếu SX trễ SLA (`status IN (PENDING, IN_PRODUCTION)` và `createdAt <= now - N ngày`).
- [ ] `sales-order.service.ts`: thêm method đọc dải "Hôm nay" (đơn mới theo `createdAt`, đơn đã giao xe theo `SalesOrderTimeline` action `SHIPPED`); tái dùng method tiền đã thu hôm nay đã có (Debt/Payment) nếu có sẵn, không viết lại logic.
- [ ] `apps/api/prisma/seed.ts`: thêm `'view-cost'` vào `PERMISSION_CATALOG['sales-order']`; xác nhận `SALES` role không được thêm quyền này (giữ nguyên danh sách hiện tại của role `SALES`).
- [ ] `dashboard.controller.ts`: permission gating `sales-order.view-cost` cho `sales`, `sales-order.view` cho `alerts.delayedOrders` (mục 6); forward dữ liệu mới (mục 3, 5).
- [ ] `dashboard.service.ts`: gọi các method mới, ghép vào `getOverview()`/`getAlerts()`.
- [ ] `knowledge/modules/permission.md`: cập nhật bảng "Dashboard Permission" + catalog liệt kê `sales-order.view-cost`.

## Frontend
- [ ] Đổi nhãn khối Kinh doanh/Sản xuất (mục 1) + chú thích all-time (mục 2).
- [ ] `alerts-panel.tsx`: thêm 2 loại cảnh báo mới (mục 3).
- [ ] `dashboard/page.tsx`: đổi thứ tự render — Cảnh báo lên đầu (mục 4); thêm dải "Hôm nay" (mục 5); đổi type `sales: SalesOverview | null` (mục 6); thêm hiển thị "Cập nhật lúc" (mục 8).
- [ ] `stat-tile.tsx`: hỗ trợ `href` tuỳ chọn; gắn link cho các tile ở mục 7.
- [ ] `production/page.tsx`, `returns/page.tsx`, `debts/page.tsx`: đọc query param lúc mount, áp vào state lọc client-side đã có sẵn của từng trang (mục 7 — làm đủ cả 3 trang, không chỉ link suông).

## Kiểm thử
- [ ] Cập nhật/thêm test cho các Service mới/sửa (`quotation.service.spec.ts`, `dashboard.service.spec.ts`...).
- [ ] `tsc --noEmit` + `next build` + `nest build` sạch.
- [ ] Verify tay qua service thật (không chỉ đọc code) — đúng yêu cầu đã ghi nhận từ các task trước.

---

# Ghi chú

Toàn bộ 6 điểm ở mục "Quyết định đã chốt" đã được người dùng xác nhận (28/07/2026) — không còn điểm mở. Báo cáo lại theo cụm: **Backend trước**, rồi **Frontend**, rồi **Test + verify** — theo đúng quy trình đã dùng ở các milestone trước (vd `007-bo-loc-thoi-gian-dashboard.md`).
