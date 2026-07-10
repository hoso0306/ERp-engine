# Milestone 09 (Sprint 03) — FE Dashboard trang chủ

> **Tên file:** `workbench/sprint-03/009-fe-dashboard.md`
>
> Bước 7 trong `roadmap.md`.

---

# ⚠️ Tình trạng thực tế + Quyết định (chốt 10/07/2026)

Khảo sát code trước khi lập kế hoạch cho thấy tiến độ trong `roadmap.md` không khớp hoàn toàn với working tree:

1. **006 — FE Công nợ**: đã xong và đã commit (`70f0bf1`) — roadmap đã tick lại đúng.
2. **007 — FE Hàng hoàn**: **đang dang dở, chưa commit** (`git status` báo `??` cho `apps/web/src/app/returns/` và `apps/web/src/components/return/`):
   - Đã có: `/returns` (danh sách, tab "Phiếu hoàn"), `/returns/[id]` (chi tiết), `/returns/new` (tạo phiếu) — Task 00–02 của `007-fe-hang-hoan.md` có vẻ đã code xong.
   - Chưa có: tab "Kho thu hồi" mới là khung rỗng (Task 03), `navigation.ts` vẫn `disabled: true` cho "Hàng hoàn" (Task 04 chưa làm), `/orders/[id]` chưa có khối cross-link "Hàng hoàn", chưa verify sống + chưa commit (Task 05).
   - **Quyết định của người dùng: không đụng vào, chờ 007 commit xong.**
3. **008 — Báo cáo BE+FE**: chưa có file kế hoạch.

**Quyết định:** Milestone 009 **hoãn Task 05 (khối Return Overview)** cho tới khi 007 commit xong — chọn phương án (B) trong 2 phương án đã đề xuất. Task 00–04, 06, 07 (trừ phần Return trong Task 07) triển khai ngay, không phụ thuộc 007.

**Cập nhật 10/07/2026:** 007 đã commit (`54dceb9`) — Task 05 đã triển khai ngay sau đó, milestone 009 đóng đủ cả 8 Task.

**Cập nhật 10/07/2026 (2):** sau khi Milestone 010 xong (có Users/Roles), đã tạo được Role tuỳ chỉnh (`DASHBOARDONLY`, chỉ giữ `dashboard.view`) để live-test ẩn/hiện theo quyền — điều mà Task 02–06 trước đó chỉ xác nhận qua code review. Kết quả: **phát hiện 1 bug thật ở BE** — `GET /dashboard/overview` trả thẳng `alerts` không lọc theo quyền (khác với `GET /dashboard/alerts` độc lập, vốn lọc đúng), khiến user chỉ có `dashboard.view` vẫn thấy được tên khách hàng + số tiền vượt hạn mức công nợ qua khối Cảnh báo. Đã sửa `dashboard.controller.ts`: gộp logic lọc (`buildGatedAlerts()`) dùng chung cho cả `getOverview()` và `getAlerts()`. Verify lại sau khi sửa: alerts ẩn đúng theo quyền, `EmptyState` "Không có cảnh báo nào" hiển thị đúng khi rỗng.

Điểm về BE không ẩn `sales`/`alerts.delayedOrders` theo quyền (`sales-order.view`) — người dùng xác nhận **giữ nguyên, không sửa BE**, chỉ ghi nhận.

---

# Mục tiêu

Biến trang chủ `/` (hiện là placeholder "Chào mừng đến với ERP Engine") thành Dashboard thật: tổng hợp KPI + Alerts từ 5 module (Sales, Production, Warehouse, Debt, Return), có chỗ bấm vào (drill-down) các bản ghi/màn hình liên quan. BE đã hoàn chỉnh 100% từ Sprint 01 (`sprint-01/009-dashboard.md`, tất cả DoD đã tick) và đã permission-aware (gắn `AuthGuard`+`PermissionGuard` — việc này làm sau khi milestone Dashboard BE gốc đóng, không nằm trong `sprint-01/009-dashboard.md`).

Dashboard **không có Business Logic mới ở FE** — chỉ gọi API sẵn có và hiển thị, đúng nguyên tắc `knowledge/modules/dashboard.md`.

---

# Kết quả khảo sát (BE — không cần sửa gì)

## API (`apps/api/src/dashboard/dashboard.controller.ts`)

Tất cả đều `@RequirePermission('dashboard.view')`, `GET`, không có POST/PUT/PATCH/DELETE:

- `GET /dashboard/overview` — gộp tất cả, **đã ẩn theo quyền per-section**: nếu user không có quyền view tương ứng, field đó trả về `null` (không phải thiếu field, không phải mảng rỗng) — FE phải kiểm tra `null` để ẩn cả khối.
  - `sales` — **không bị ẩn theo quyền** (luôn trả về, không check `sales-order.view`). Ghi nhận: có thể là chủ ý (Owner luôn cần thấy doanh thu tổng), không tự ý "sửa cho nhất quán" ở milestone FE — nếu thấy bất thường thì hỏi trước khi build.
  - `production` — ẩn nếu thiếu `production.view`.
  - `warehouse` — ẩn nếu thiếu `warehouse.view`.
  - `debt` — ẩn nếu thiếu `debt.view`.
  - `returns` — ẩn nếu thiếu `return.view`.
  - `alerts` — object luôn trả về, nhưng bên trong từng mảng ẩn riêng theo quyền (xem dưới); `alerts.delayedOrders` **không bị ẩn theo quyền** (giống `sales`).
- `GET /dashboard/sales`, `/production`, `/warehouse`, `/debt?upcomingDueDays=`, `/returns`, `/alerts` — từng phần riêng lẻ (không cần dùng ở milestone này vì `/overview` đã gộp đủ, tránh gọi thừa).

**Quyết định kiến trúc FE:** gọi **duy nhất** `GET /dashboard/overview` một lần khi vào trang — khớp nguyên tắc "Dashboard mở nhanh, không N+1" (`knowledge/modules/dashboard.md` mục Performance Rule). Không gọi thêm 5 API riêng lẻ.

## Response shape từng phần (đọc trực tiếp từ Service, không tự suy đoán field)

**`sales`** (`SalesOrderService.getDashboardSummary()` + `getRecentOrders()`):
```text
summary: { totalRevenue, totalPlannedCost, totalPlannedProfit, inProduction, productionCompleted, delivered }
recentOrders: { id, code, customerName, status, paymentStatus, totalAmount, createdAt }[]  (10 gần nhất)
```

**`production`** (`ProductionOrderService`):
```text
summary: { pending, inProduction, completed, cancelled }
busyCenters: { productionCenterId, productionCenterName, orderCount }[]  (sort giảm dần — đầu = bận nhất, cuối = ít việc nhất)
progress: {
  overallProgressPercent,
  orders: { salesOrderId, salesOrderCode, completed, total, progressPercent }[]  (chỉ đơn IN_PRODUCTION)
}
```

**`warehouse`**:
```text
inventorySummary: { totalMaterials, totalCurrentStock, lowStockCount, outOfStockCount }
topConsumedMaterials: { materialId, materialCode, materialName, unit, totalConsumed }[]
lowStockMaterials: { id, code, name, currentStock, minimumStock, unit: {id,name}, outOfStock: false }[]  (đã lọc outOfStock=false)
outOfStockMaterials: cùng shape, outOfStock: true
```

**`debt`**:
```text
summary: { totalReceivable, totalPaid, totalRemaining, overdueAmount, overdueCount }
overdueCustomers: { customerId, customerName, customerPhone, totalRemaining, receivableCount }[]
upcomingDue: Receivable[]  (include đầy đủ — RECEIVABLE_LIST_INCLUDE, sort theo dueDate)
creditExceeded: { customerId, customerName, totalRemaining, debtLimit }[]  (không có phone)
topDebtors: { customerId, customerName, customerPhone, totalRemaining }[]
```

**`returns`**:
```text
summary: { returnsThisMonth, totalProductsReturnedThisMonth, returnValueThisMonth, availableRecoveryCount, availableRecoveryQuantity }
aging: { over30Days, over90Days }  (số lượng Recovery Inventory còn AVAILABLE quá 30/90 ngày)
topReasons: { reason, count, returnedQuantity, percent }[]
byCustomer: { customerId, customerName, returnCount }[]  (top 10)
```

**`alerts`**:
```text
overdueDebt: (giống overdueCustomers)[]  — null nếu thiếu debt.view
creditLimitExceeded: (giống creditExceeded)[]  — null nếu thiếu debt.view
lowStockMaterials / outOfStockMaterials: (giống warehouse)[]  — null nếu thiếu warehouse.view
delayedOrders: { id, code, customerName, status, expectedDeliveryDate }[]  — KHÔNG ẩn theo quyền
```

## Pattern FE tái dùng

- `components/debt/debt-dashboard-panel.tsx` (đã có, dùng ở `/debts`) là ví dụ gần nhất: `StatTile` local (label/value/sub/tone) + `formatMoney` local bằng `Intl.NumberFormat("vi-VN")`. **Không sửa file này** (thuộc trang `/debts`, ngoài phạm vi) — dashboard trang chủ tạo bộ component riêng trong `components/dashboard/`.
- Codebase hiện **không có `formatMoney` dùng chung** — mỗi file tự định nghĩa local (đã kiểm tra 17 chỗ dùng pattern này). Theo đúng convention hiện tại, `components/dashboard/*.tsx` cũng tự định nghĩa local, không tạo util chung mới (tránh lệch pattern, không phải việc của milestone này).
- `components/shared`: `PageHeader`, `Loading`, `ErrorState`, `EmptyState` — dùng như mọi trang khác.
- `useAuth().hasPermission(key)` (`context/auth-context.tsx`) — dùng để quyết định link nào hiện được (vd chỉ link `/orders/[id]` nếu có `sales-order.view`), tương tự pattern đã dùng ở `/orders/[id]`, `/returns` (theo khảo sát 007).
- Không trang danh sách nào (`/orders`, `/production`, `/warehouse`, `/debts`) hiện đọc query param để filter sẵn — nghĩa là "bấm vào" ở milestone này chỉ áp dụng được cho:
  - Bản ghi có ID cụ thể trong payload → link thẳng trang chi tiết đã có sẵn: đơn hàng (`/orders/[id]`), khách hàng (`/customers/[id]`), vật tư (`/materials/[id]`).
  - Nút "Xem tất cả" ở đầu mỗi khối → link tới trang danh sách tổng (`/orders`, `/production`, `/warehouse`, `/debts`, `/returns`), **không** kèm filter — tránh phải sửa các trang danh sách đó (ngoài phạm vi milestone này, không tự ý mở rộng).
  - "Xưởng bận nhất/ít việc nhất" không có trang chi tiết xưởng (`/production-centers` chưa có route `[id]`) → hiển thị dạng text, không làm link.

---

# Phạm vi

- Route `/` (`apps/web/src/app/page.tsx`) — thay nội dung placeholder bằng Dashboard thật.
- 1 lần gọi `GET /dashboard/overview` khi vào trang, phân phối dữ liệu xuống từng khối con qua props (không mỗi khối tự fetch riêng).
- 6 khối: Sales, Production, Warehouse, Debt, Return, Alerts — mỗi khối ẩn hoàn toàn nếu field tương ứng là `null` (không đủ quyền).
- Không thêm filter ngày/khoảng thời gian ở FE (BE tự đọc `Settings.Dashboard.*` cho các tham số như `topCustomers`, `topMaterials`, `upcomingDueDays`, `defaultDashboardPeriod` — FE không truyền, không hard-code).
- Không sửa BE, không sửa schema, không sửa permission seed.
- Không đụng `apps/web/src/app/returns/**`, `apps/web/src/components/return/**`, hay bất kỳ phần nào thuộc milestone 007 đang dang dở — chỉ **link tới** `/returns` từ khối Return.
- Không cache, không background job (V1 — đúng `knowledge/modules/dashboard.md` mục Refresh Rule) — luôn đọc realtime khi mở trang, có nút "Làm mới" gọi lại API.

---

# Task 00 — Kiến trúc trang + types + `StatTile` dùng chung cho Dashboard

## Nội dung

- `components/dashboard/stat-tile.tsx`: tách từ pattern `DebtDashboardPanel` (label, value, sub?, tone?: "default"|"danger"), dùng chung cho mọi khối trong milestone này.
- `types/dashboard.ts` (hoặc khai trực tiếp trong trang, tuỳ độ dài): interface khớp đúng shape đã khảo sát ở trên cho `DashboardOverview` (các field permission-gated kiểu `T | null`).
- `apps/web/src/app/page.tsx`: gọi `GET /dashboard/overview` bằng `apiGet`, quản lý `loading`/`error`/`data` theo đúng pattern `Loading`/`ErrorState` đã dùng ở các trang khác; nút "Làm mới" gọi lại.
- Layout khung: `PageHeader` (title "Dashboard", không có action tạo mới — Dashboard chỉ Read) + lưới các khối theo thứ tự Sales → Production → Warehouse → Debt → Return → Alerts.

### Definition of Done

- [x] Trang `/` gọi đúng 1 lần `GET /dashboard/overview`, hiện `Loading` khi đang tải, `ErrorState` (có nút Thử lại) khi lỗi.
- [x] Build thành công.

**Commit**
```text
feat(web): dashboard page scaffold with overview fetch and shared stat tile
```

---

# Task 01 — Khối Sales Overview

## Nội dung

- `components/dashboard/sales-overview-panel.tsx`: nhận `sales` (không null — không bị ẩn theo quyền) làm props.
- StatTile: Tổng doanh thu kế hoạch, Tổng giá vốn kế hoạch, Tổng lợi nhuận kế hoạch, Đang SX / SX xong / Đã giao (đếm).
- Danh sách "Đơn hàng gần đây" (10 đơn từ `recentOrders`): mã đơn (link `/orders/[id]` nếu `hasPermission("sales-order.view")`, else text), khách hàng, trạng thái (badge — tái dùng `SalesOrderStatusBadge` đã có), thanh toán, tổng tiền, ngày tạo.
- Nút "Xem tất cả đơn hàng" → `/orders` (chỉ hiện nếu có `sales-order.view`).

### Definition of Done

- [x] Số liệu khớp với `/orders` thật (đối chiếu sống).
- [x] Link đơn hàng gần đây điều hướng đúng `/orders/[id]`.
- [x] Build thành công.

**Commit**
```text
feat(web): sales overview panel with recent orders drill-down
```

---

# Task 02 — Khối Production Overview

## Nội dung

- `components/dashboard/production-overview-panel.tsx`: nhận `production` (`null`-able, ẩn cả khối nếu null).
- StatTile: Đang SX / Đã hoàn thành / Đã huỷ (từ `summary`), Tiến độ tổng (`progress.overallProgressPercent`, hiện dạng "x/y (z%)" — chỉ hiển thị phép chia, không tính lại).
- "Xưởng bận nhất" (phần tử đầu `busyCenters`) / "Xưởng ít việc nhất" (phần tử cuối) — text, không link (không có route chi tiết xưởng).
- Bảng "Tiến độ theo đơn" (`progress.orders`): mã đơn (link `/orders/[id]` nếu đủ quyền), completed/total, progress bar hoặc text %.
- Nút "Xem tất cả phiếu sản xuất" → `/production` (chỉ hiện nếu `production.view`).

### Definition of Done

- [x] Số liệu khớp `/production` thật.
- [x] Khối ẩn hoàn toàn khi user không có `production.view` — **live-test thành công** (10/07/2026, sau Milestone 010): Role `DASHBOARDONLY` (chỉ `dashboard.view`) đăng nhập → khối Sản xuất không xuất hiện trên trang chủ.
- [x] Build thành công.

**Commit**
```text
feat(web): production overview panel with progress and busiest center
```

---

# Task 03 — Khối Warehouse Overview

## Nội dung

- `components/dashboard/warehouse-overview-panel.tsx`: nhận `warehouse` (`null`-able).
- StatTile: Tổng số vật tư, Tổng tồn kho hiện tại, Sắp hết hàng (đếm), Hết hàng (đếm) — tone "danger" khi > 0.
- Bảng "Top vật tư tiêu thụ": mã/tên (link `/materials/[id]` nếu có quyền xem — kiểm tra menu Vật tư hiện không cần permission riêng, xem `navigation.ts` dòng "Vật tư" không có `requiredPermission` → luôn cho phép), số lượng tiêu thụ, đơn vị.
- Bảng "Sắp hết hàng" / "Hết hàng" (gộp 1 bảng, cột trạng thái phân biệt): mã/tên (link `/materials/[id]`), tồn hiện tại, tồn tối thiểu.
- Nút "Xem tất cả kho" → `/warehouse` (chỉ hiện nếu `warehouse.view`).

### Definition of Done

- [x] Số liệu khớp `/warehouse` thật.
- [x] Khối ẩn hoàn toàn khi thiếu `warehouse.view` — live-test thành công cùng đợt với Task 02 (Role `DASHBOARDONLY`).
- [x] Build thành công.

**Commit**
```text
feat(web): warehouse overview panel with low/out-of-stock materials
```

---

# Task 04 — Khối Debt Overview

## Nội dung

- `components/dashboard/debt-overview-panel.tsx`: nhận `debt` (`null`-able).
- StatTile: Tổng phải thu, Đã thu, Còn phải thu, Quá hạn (đếm + tiền, tone danger nếu > 0), Vượt hạn mức (đếm + tiền, tone danger nếu > 0).
- "Sắp đến hạn" (`upcomingDue`, là `Receivable[]` đầy đủ): bảng rút gọn — mã đơn/khách hàng, hạn thanh toán, còn lại — link `/debts/[id]` nếu `hasPermission("debt.view")` (dùng `receivable.id`).
- "Top khách nợ nhiều nhất" (`topDebtors`): tên, SĐT, tổng còn nợ — link `/customers/[id]` nếu `hasPermission("customer.view")`.
- Nút "Xem tất cả công nợ" → `/debts` (chỉ hiện nếu `debt.view`).

### Definition of Done

- [x] Số liệu khớp `/debts` thật (đối chiếu dashboard công nợ đã có ở `/debts` — trùng nhau vì cùng nguồn `DebtService`).
- [x] Khối ẩn hoàn toàn khi thiếu `debt.view` — live-test thành công cùng đợt với Task 02 (Role `DASHBOARDONLY`).
- [x] Build thành công.

**Commit**
```text
feat(web): debt overview panel with upcoming due and top debtors
```

---

# Task 05 — Khối Return Overview

**Đã làm** (10/07/2026) — 007 đã commit (`54dceb9`), gỡ block, triển khai ngay.

## Nội dung

- `components/dashboard/return-overview-panel.tsx`: nhận `returns` (`null`-able).
- StatTile: Số phiếu hoàn tháng này, SL sản phẩm hoàn tháng này, Giá trị hoàn tháng này, Kho thu hồi còn khả dụng (đếm + SL).
- "Recovery Inventory tồn lâu": `aging.over30Days` / `aging.over90Days` — tone danger nếu > 0.
- "Lý do trả hàng nhiều nhất" (`topReasons`, dùng nhãn VN — nếu 007 đã có `return-reason-label.ts` thì tái dùng, không định nghĩa lại).
- "Khách trả hàng nhiều nhất" (`byCustomer`): tên, số phiếu — link `/customers/[id]` nếu `hasPermission("customer.view")`.
- Nút "Xem tất cả hàng hoàn" → `/returns` (chỉ hiện nếu `return.view`) — **theo phương án đã chọn ở mục ⚠️**.

### Definition of Done

- [x] Số liệu khớp dữ liệu Return thật (verify sống: 2 phiếu hoàn tháng này, giá trị 65.602.000đ, lý do trả hàng + khách trả hàng nhiều nhất đúng).
- [x] Khối ẩn hoàn toàn khi thiếu `return.view` — live-test thành công cùng đợt với Task 02 (Role `DASHBOARDONLY`).
- [x] Build thành công. Nút "Xem tất cả hàng hoàn" điều hướng đúng `/returns`.

**Commit**
```text
feat(web): return overview panel
```

---

# Task 06 — Khối Alerts

## Nội dung

- `components/dashboard/alerts-panel.tsx`: nhận `alerts` (luôn có object, nhưng field con `null`-able theo quyền).
- Danh sách cảnh báo dạng list, mỗi dòng có icon mức độ + link:
  - Công nợ quá hạn (`overdueDebt`) → `/customers/[id]` (nếu `customer.view`).
  - Khách vượt hạn mức (`creditLimitExceeded`) → `/customers/[id]`.
  - Sắp hết vật tư (`lowStockMaterials`) → `/materials/[id]`.
  - Hết vật tư (`outOfStockMaterials`) → `/materials/[id]`, tone khẩn cấp hơn.
  - Đơn trễ tiến độ (`delayedOrders`) → `/orders/[id]` (nếu `sales-order.view`).
- Ẩn từng nhóm cảnh báo nếu field tương ứng là `null` (thiếu quyền); nếu **toàn bộ** alerts rỗng → `EmptyState` ("Không có cảnh báo nào").
- Không có action nào ở đây — Alerts chỉ hiển thị, không đổi trạng thái (đúng `knowledge/modules/dashboard.md`).

### Definition of Done

- [x] Danh sách cảnh báo đúng dữ liệu thật, link điều hướng đúng (verify sống: alert "vượt hạn mức tín dụng" hiển thị đúng, link sang khách hàng hoạt động).
- [x] Ẩn đúng nhóm theo quyền — **live-test thành công** (10/07/2026): Role `DASHBOARDONLY` ban đầu vẫn thấy alert "vượt hạn mức tín dụng" dù thiếu `debt.view` → phát hiện bug BE (`GET /dashboard/overview` không lọc `alerts` theo quyền, khác `GET /dashboard/alerts`) → đã sửa `dashboard.controller.ts` (gộp `buildGatedAlerts()` dùng chung) → verify lại: alert biến mất đúng, `EmptyState` "Không có cảnh báo nào" hiển thị đúng khi rỗng.
- [x] Build thành công.

**Commit**
```text
feat(web): dashboard alerts panel with drill-down links
```

---

# Task 07 — Hoàn thiện Milestone

## Nội dung đã thực hiện

- Build xanh cả 2 app: `tsc --noEmit` (apps/web) sạch, `next build` thành công (22 route, không lỗi).
- Verify sống bằng Playwright thật (Node script dùng package `playwright`, đăng nhập `owner@erp.local` thật — mật khẩu do người dùng cung cấp trực tiếp cho phiên này), chạy 2 đợt (trước và sau khi thêm Task 05):
  - Cả 6 khối (Kinh doanh/Sản xuất/Kho/Công nợ/Hàng hoàn/Cảnh báo) hiển thị đúng, đối chiếu số liệu khớp dữ liệu thật.
  - Bấm link "đơn hàng gần đây" → `/orders/[id]`; "Top khách nợ" → `/customers/[id]`; "Top vật tư tiêu thụ" → `/materials/[id]`; "Xem tất cả hàng hoàn" → `/returns` — đều đúng.
  - Nút "Làm mới" gọi lại API thành công.
  - 0 lỗi console suốt cả 2 đợt test.
- **Live-test ẩn/hiện theo quyền hoàn tất** (10/07/2026, sau Milestone 010): tạo Role `DASHBOARDONLY` (chỉ `dashboard.view`) qua `/settings/roles` + 1 User gán role đó, đăng nhập thật và kiểm tra trang chủ. Kết quả: khối Sản xuất/Kho/Công nợ/Hàng hoàn đều ẩn đúng; khối Kinh doanh vẫn hiện (đúng thiết kế, không bị gate); menu sidebar chỉ còn "Dashboard" + các mục không cần quyền riêng (Sản phẩm, Vật tư, Danh mục). **Phát hiện + sửa 1 bug BE thật:** `GET /dashboard/overview` không lọc `alerts` theo quyền (rò dữ liệu công nợ/kho cho user chỉ có `dashboard.view`) — đã sửa `dashboard.controller.ts`, verify lại đúng. Role/User test đã Disable/vô hiệu hoá sau khi xong (không xoá được theo thiết kế).
- Cập nhật `roadmap.md` mục Tiến độ: `006` đã tick, `007` tick sau khi commit `54dceb9`, `009` tick đủ hẳn (cả 8 Task, không còn phần hoãn hay chưa live-test).

### Definition of Done

- [x] Toàn bộ Task 00–06 xong, verify sống thật.
- [x] `roadmap.md` cập nhật đúng thực tế (006, 007, 009).
- [x] Ẩn/hiện theo quyền: live-test thành công với Role giới hạn thật (xem ghi chú trên); phát hiện và sửa 1 bug BE trong quá trình test.

**Commit đề xuất** (chưa thực hiện — chờ người dùng xác nhận trước khi commit, theo CLAUDE.md mục 11):
```text
feat(web): dashboard page scaffold with overview fetch and shared stat tile
feat(web): sales overview panel with recent orders drill-down
feat(web): production overview panel with progress and busiest center
feat(web): warehouse overview panel with low/out-of-stock materials
feat(web): debt overview panel with upcoming due and top debtors
feat(web): return overview panel
feat(web): dashboard alerts panel with drill-down links
fix(api): gate alerts by permission in GET /dashboard/overview
chore(web): complete dashboard FE milestone
```

---

# Thứ tự thực hiện đề xuất

Task 00 → 01 → 02 → 03 → 04 → 05 → 06 → 07.

(Task 01–06 độc lập dữ liệu với nhau — có thể đổi thứ tự nội bộ nếu cần, miễn Task 00 làm trước tiên và Task 07 làm cuối cùng.)

---

# Milestone tiếp theo

Sau milestone này: `010-fe-cai-dat-nguoi-dung.md` (Bước 8 — FE Cài đặt + Người dùng/Phân quyền), trừ khi 007/008 vẫn chưa đóng thì cần quay lại hoàn thiện trước theo đúng thứ tự roadmap.
