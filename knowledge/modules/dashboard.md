# Module Dashboard

> **Tên file:** `knowledge/modules/dashboard.md`

---

# Mục đích

Dashboard là trung tâm quản trị của toàn bộ ERP.

Mục tiêu:

- Giúp Owner nắm được tình hình doanh nghiệp trong vài giây.
- Không nhập liệu.
- Không chỉnh sửa dữ liệu.
- Không xử lý Business Logic.

Dashboard chỉ tổng hợp dữ liệu từ các Module khác.

---

# Vai trò trong ERP

Dashboard là Presentation Layer.

Không phải Business Layer.

Dashboard không tạo dữ liệu.

Dashboard không cập nhật dữ liệu.

Dashboard không quyết định nghiệp vụ.

Mọi Business Logic đều thuộc các Module khác.

Dashboard chỉ đọc dữ liệu.

---

# Triết lý thiết kế

**Dashboard được phép JOIN và Aggregate đơn giản** (SUM, COUNT, GROUP BY, ORDER BY... LIMIT) trên dữ liệu đã được chuẩn hoá và đánh index — miễn là dữ liệu đó đã tồn tại sẵn (Summary Field hoặc bảng lịch sử immutable như `WarehouseTransaction`, `Payment`).

**Dashboard không được tính lại Business Logic của module nguồn.** Đây mới là ranh giới thật sự, không phải "cấm JOIN/Aggregate":

Được:

```text
SUM(Receivable.remainingAmount) GROUP BY customerId
COUNT(SalesOrder) WHERE status = IN_PRODUCTION
SUM(WarehouseTransaction.quantity) trong một khoảng thời gian
```

Không được:

```text
Tính lại giá bán (Pricing Engine)
Tính lại BOM / định mức vật tư
Tính lại chiết khấu
Tự suy diễn Payment Status thay vì đọc SalesOrder.paymentStatus
```

Ví dụ kinh điển:

Đúng: `SalesOrder.totalAmount → Dashboard`

Sai: `SalesOrder → SalesOrderItem → tính lại giá từng dòng → Dashboard`

---

# Module Ownership — Dashboard không đụng trực tiếp dữ liệu module khác

**Dashboard không bao giờ query trực tiếp bảng Prisma thuộc về module khác.** Luôn gọi qua Service đã export của module sở hữu dữ liệu đó (`SalesOrderService`, `ProductionOrderService`, `WarehouseService`, `DebtService`...) — dùng lại method đọc đã có, hoặc bổ sung method đọc mới ngay trong Service đó nếu chưa có sẵn.

Ví dụ: muốn có "Top vật tư tiêu thụ", thêm method `WarehouseService.getTopConsumedMaterials(dateRange)` — Dashboard gọi method này, không tự viết `prisma.warehouseTransaction.groupBy(...)` trong code của Dashboard.

**Không tách riêng một class `XxxQueryService` song song với Service hiện tại.** Bốn module dữ liệu nguồn (SalesOrder, Production, Warehouse, Debt) đã code xong với một Service duy nhất xử lý cả đọc lẫn ghi — tách thêm một tầng Query Service riêng cho từng module là refactor không cần thiết ở thời điểm này, khi chưa có nhu cầu thật (vd hiệu năng, cache riêng cho nhánh đọc). Nếu sau này thật sự cần, tách lúc đó cũng chưa muộn.

**Lý do đây là nguyên tắc, không phải ngoại lệ theo từng trường hợp:** một quy tắc duy nhất ("luôn qua Service của module sở hữu") dễ nhớ và dễ áp dụng nhất quán hơn là một quy tắc có ngoại lệ tuỳ theo độ phức tạp của query.

Nguyên tắc này áp dụng cho mọi module đọc dữ liệu cross-module trong tương lai — trước hết là **Báo cáo** (module đã có trong roadmap, `03-danh-sach-module.md` mục I.2). Không thiết kế sẵn cho các module chưa có trong roadmap (vd AI, Notification không nằm trong danh sách module của dự án).

---

# Business Flow

```text
Quotation

↓

Sales Order

↓

Production

↓

Warehouse

↓

Debt

↓

Dashboard
```

Dashboard luôn là điểm cuối.

---

# Các khu vực Dashboard

## 1. Sales Overview

Nguồn dữ liệu: `SalesOrderService`.

Hiển thị:

- Tổng doanh thu kế hoạch (`SalesOrder.totalAmount`)
- Tổng giá vốn kế hoạch (`SalesOrder.plannedCost`)
- Tổng lợi nhuận kế hoạch (`SalesOrder.plannedProfit`)
- Số đơn đang sản xuất / đã giao / hoàn thành (`COUNT(SalesOrder) GROUP BY status` — Aggregate đơn giản, được phép)

Không tính lại từ `SalesOrderItem`.

---

## 2. Production Overview

Nguồn dữ liệu: `ProductionOrderService`.

Hiển thị:

- Đang sản xuất / đã hoàn thành
- Tiến độ từng xưởng
- Xưởng nhiều việc nhất / ít việc nhất (`COUNT(ProductionOrder) GROUP BY productionCenterId`)

Tiến độ mỗi đơn:

```text
completedProductionOrders / totalProductionOrders
```

UI hiển thị: `2/3 (67%)` — phép chia hiển thị, không phải tính lại Business Logic.

Dashboard không lưu Progress.

---

## 3. Warehouse Overview

Nguồn dữ liệu: `WarehouseService`.

Hiển thị:

- Giá trị tồn kho, tồn kho hiện tại — đọc `Material.currentStock` (Summary Field có sẵn), không SUM lại `WarehouseTransaction`.
- Top vật tư tiêu thụ — gọi `WarehouseService.getTopConsumedMaterials(dateRange)` (SUM `WarehouseTransaction.quantity` theo khoảng thời gian, có index, không cần thêm Summary Field mới vì tính năng ít dùng).
- Sắp hết hàng / Hết hàng — so sánh `Material.currentStock` với `Material.minimumStock`.

**Cần bổ sung field mới `Material.minimumStock`** — hiện chưa tồn tại trong schema. `Material` thuộc **Product module** (không phải Warehouse), nên đây là thay đổi chạm thêm vào Product module — xem "Module Dependencies".

---

## 4. Debt Overview

Nguồn dữ liệu: `DebtService`.

Hiển thị:

- Tổng phải thu / Đã thu / Còn phải thu — đọc `Receivable.totalAmount`/`paidAmount`/`remainingAmount`.
- Quá hạn / Sắp đến hạn / Khách vượt hạn mức / Top khách nợ nhiều / Top khách quá hạn.

**Không tự tính lại logic quá hạn/vượt hạn mức trong Dashboard.** Gọi qua `DebtService` (method đọc đã có hoặc bổ sung thêm, vd `DebtService.getOverview()`) — logic `dueDate`/`riskLevel`/credit-limit-exceeded đã được định nghĩa trong `knowledge/modules/debt.md`, chỉ có một nơi định nghĩa duy nhất.

**Ghi chú cần xử lý khi triển khai:** `debt.md` (Task 07 — Debt Read API) hiện chỉ có filter `overdue`/`risk`/`creditExceeded`, **chưa có khái niệm "Sắp đến hạn" (dueDate trong vòng N ngày tới)**. Cần bổ sung filter/method này vào Debt module trước khi Dashboard có thể dùng — không tự định nghĩa lại trong Dashboard.

---

## 5. Alerts

Hiển thị:

- Đơn hàng quá hạn
- Khách vượt hạn mức
- Công nợ quá hạn
- Sắp hết vật tư
- Hết vật tư
- Đơn sản xuất chậm

Alerts không tạo Workflow. Chỉ cảnh báo — cùng nguồn dữ liệu như các mục trên, gọi qua Service của module sở hữu.

---

# Phân loại truy vấn: KPI Cards vs Ranking

Để dễ tổ chức API/UI và giới hạn phạm vi hiệu năng:

**KPI Cards** — số liệu tổng hợp realtime, đọc/Aggregate đơn giản: doanh thu, lợi nhuận, tồn kho, công nợ.

**Ranking** — truy vấn có `ORDER BY ... LIMIT` (luôn giới hạn số dòng nhỏ, vd top 10): Top khách nợ nhiều, Top vật tư tiêu thụ, Top xưởng, Top sản phẩm. Không phải Business Logic — chỉ là sắp xếp/giới hạn kết quả.

---

# Debt Monitoring

Dashboard phục vụ Owner, không phục vụ kế toán.

Owner cần:

```text
Tổng phải thu
↓
Khách nào đang nợ nhiều
↓
Khách nào quá hạn
↓
Khách nào vượt hạn mức
↓
Ưu tiên đi thu tiền
```

## Quá hạn

Điều kiện: `Receivable.dueDate < Today` và `remainingAmount > 0`.

## Sắp đến hạn

Ví dụ: trong vòng 7 ngày (`Today` đến `Today + 7`) — xem ghi chú ở mục "Debt Overview" về việc cần bổ sung filter này ở Debt module.

## Khách vượt hạn mức

Không tính theo từng Receivable — tính theo Customer:

```text
SUM(remainingAmount) GROUP BY customerId
```

So sánh với `Customer.debtLimit` (giá trị hiện tại). Nếu vượt → hiển thị cảnh báo.

Toàn bộ logic này thuộc về `DebtService` — xem "Module Ownership".

---

# Dashboard Rule

- Dashboard đọc qua Service của module sở hữu dữ liệu, không JOIN/query trực tiếp bảng của module khác.
- Được phép JOIN/Aggregate đơn giản trên dữ liệu đã chuẩn hoá, có index.
- Không được tính lại Business Logic của module nguồn (giá, BOM, chiết khấu, payment status...).
- Không Aggregate lại nếu module nguồn đã có sẵn Summary Field tương đương (vd `Material.currentStock`, `Receivable.remainingAmount`).

---

# Performance Rule

Dashboard là màn hình được mở nhiều nhất.

Yêu cầu:

- Load nhanh.
- Query đơn giản, có index.
- Ranking luôn giới hạn `LIMIT` nhỏ (xem "Phân loại truy vấn").
- Không tính Business Logic phức tạp (giá, BOM, chiết khấu).

Nếu cần hiệu năng cao hơn trong tương lai: cho phép thêm Materialized View hoặc Cache. Không thay đổi Business Rule.

---

# Refresh Rule

V1: Dashboard luôn đọc dữ liệu realtime. Không cache. Không background job. Refresh khi người dùng mở lại hoặc nhấn Refresh.

V2: có thể bổ sung Redis Cache, Materialized View, Scheduled Refresh.

---

# Permission

**V1: Dashboard chưa triển khai phân quyền.**

Toàn bộ Permission (Owner xem toàn bộ, Manager xem theo phạm vi, Nhân viên không truy cập...) sẽ được thực hiện khi Module Authentication & Authorization (`Cài đặt` → `Phân quyền`, đã có trong roadmap `03-danh-sach-module.md` mục 11) hoàn thành.

**Dashboard chỉ định nghĩa dữ liệu, không định nghĩa quyền truy cập.** Lý do: hiện dự án chưa có Auth module (`User` model chưa có field `role`, chưa có Login/JWT/Guard nào) — nếu Dashboard tự định nghĩa Permission bây giờ, Dashboard sẽ phụ thuộc vào một module chưa tồn tại.

---

# API

Ví dụ:

```http
GET /dashboard/overview
GET /dashboard/sales
GET /dashboard/production
GET /dashboard/warehouse
GET /dashboard/debt
GET /dashboard/alerts
```

Dashboard chỉ có Read API. Không có POST/PUT/PATCH/DELETE.

---

# Business Rule

- Dashboard không tạo dữ liệu.
- Dashboard không sửa dữ liệu.
- Dashboard không xử lý Business Logic — không tính lại giá, BOM, chiết khấu, payment status...
- Dashboard chỉ đọc qua Service của module sở hữu dữ liệu (Module Ownership) — không query trực tiếp bảng của module khác.
- Được phép JOIN/Aggregate đơn giản (SUM, COUNT, GROUP BY, Ranking có LIMIT) trên dữ liệu đã chuẩn hoá.
- Ưu tiên đọc Summary Field có sẵn nếu đã tồn tại, không Aggregate lại từ đầu.
- Dashboard luôn phản ánh dữ liệu hiện tại của hệ thống (V1 không cache).
- Cảnh báo chỉ mang tính hỗ trợ ra quyết định, không tự động thay đổi trạng thái của bất kỳ Module nào.
- V1 chưa triển khai Permission — để dành khi có Module Auth.

---

# Quan hệ dữ liệu

```text
Quotation
      │
      ▼
SalesOrder
      │
      ├──────────────┐
      ▼              ▼
Production      Receivable
      │              │
      ▼              ▼
Warehouse      Payment
      │              │
      └──────┬───────┘
             ▼
         Dashboard
```

---

# Module Dependencies

## Phụ thuộc

- SalesOrderService, ProductionOrderService, WarehouseService, DebtService (chỉ gọi qua method đọc đã export — Module Ownership).

## Module bị ảnh hưởng

- Product module: cần thêm field `Material.minimumStock` (phục vụ "Sắp hết hàng"/"Hết hàng").
- Debt module: cần bổ sung filter/method "Sắp đến hạn" (dueDate trong N ngày tới) vào Read API — hiện chưa có.

Không được thay đổi Business Rule hoặc Data Model của các Module trên ngoài phạm vi đã thống nhất ở đây.

Nếu cần thay đổi thêm phải dừng và xác nhận với người dùng.

---

# Ghi chú

Dashboard là Module tổng hợp. Không chứa Business Logic.

Nếu Dashboard cần thêm dữ liệu mà các Module khác chưa cung cấp Summary Field hoặc method đọc phù hợp, phải bổ sung tại Module nguồn (qua Service của module đó) — không tính lại Business Logic ngay trong Dashboard, không tự query trực tiếp bảng của module khác.

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
