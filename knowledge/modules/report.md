# Module Báo cáo (Report)

> **Tên file:** `knowledge/modules/report.md`
> **Trạng thái:** Đã triển khai (`014-bao-cao.md`, 18/07/2026). Đây là tài liệu chốt **mốc ngày ghi nhận** và **nguồn dữ liệu** cho từng báo cáo, để Report và Dashboard không bao giờ ra hai con số khác nhau cho cùng một câu hỏi.

---

# Nguyên tắc phân vai Dashboard vs Report

**Đọc mục này trước — nó chi phối mọi quyết định còn lại của tài liệu.**

**Dashboard phục vụ vận hành (Operations). Report phục vụ phân tích và ra quyết định (Analytics + Reporting).**

- **Dashboard** (`dashboard.md`) chỉ hiển thị trạng thái hiện tại: KPI thời gian thực, mặc định "Hôm nay", có thêm tối đa 2-3 preset ngắn (Hôm nay / Hôm qua / 7 ngày gần đây) để không trống trơn vào đầu tuần — **không có Tuần này/Tháng này/Tất cả/chọn ngày tuỳ ý**, những preset đó thuộc Report. Ngoài ra là cảnh báo và danh sách việc cần xử lý. Dashboard **không** hiển thị phân tích theo kỳ (doanh thu tháng, tăng trưởng, top khách, top sản phẩm, so sánh kỳ trước...), không có biểu đồ xu hướng, không có export.
- **Report** (tài liệu này) là nơi duy nhất chứa: phân tích theo khoảng thời gian tuỳ chọn (`from`–`to`), biểu đồ xu hướng, so sánh kỳ trước, bảng xếp hạng (top khách/sản phẩm/nhân viên), và export Excel/PDF.
- Dashboard và Report **dùng chung** định nghĩa dữ liệu, mốc ngày và Business Rule ở tài liệu này — đảm bảo cùng một chỉ số luôn cho cùng một kết quả dù xem ở đâu. Report không được định nghĩa lại một chỉ số Dashboard đã có, và ngược lại.
- ~~Dashboard hiện tại (Sprint 04, `007-bo-loc-thoi-gian-dashboard.md`) đang có bộ lọc kỳ tuỳ chọn cho khối Sản xuất (Hoàn thành/Huỷ) và Hàng hoàn — vi phạm nguyên tắc trên~~ — **đã dọn (18/07/2026)**: thay `DateRangeFilter` (Hôm nay/Tuần này/Tháng này/Tất cả/tuỳ chọn) bằng `DashboardRangeFilter` riêng cho Dashboard, chỉ còn Hôm nay/Hôm qua/7 ngày gần đây. Phân tích theo kỳ tuỳ chọn (tuần/tháng/năm/tuỳ chọn) nay chỉ có ở Report.

---

# Mục đích

Tổng hợp số liệu phục vụ quản lý và ra quyết định, theo đúng danh sách đã cam kết ở `03-danh-sach-module.md` (mục I.2).

Report trả lời các câu hỏi dạng:

- Tháng này bán được bao nhiêu? Lãi kế hoạch bao nhiêu?
- Tiền thật đã về bao nhiêu?
- Sản phẩm nào bán chạy? Nhóm nào tăng trưởng?
- Nhân viên nào mang về nhiều doanh số?
- Khách nào mua nhiều? Khách nào nợ nhiều?

---

# Vai trò trong ERP

Report là **Presentation Layer** — cùng tầng và cùng luật với Dashboard (`dashboard.md`):

- Không tạo dữ liệu.
- Không sửa dữ liệu.
- Không xử lý Business Logic.
- Chỉ đọc qua Service của module sở hữu dữ liệu (Module Ownership).

## Khác nhau giữa Report và Dashboard

| | Dashboard | Report |
|---|---|---|
| Câu hỏi | "Hôm nay tôi cần xử lý gì?" | "Trong kỳ X đã xảy ra gì?" |
| Thời gian | "Hôm nay" mặc định + tối đa 2-3 preset ngắn (Hôm qua/7 ngày gần đây) — không chọn ngày tuỳ ý | Luôn theo khoảng ngày tuỳ chọn (bộ lọc `from`–`to`) |
| Kết quả | KPI Cards + cảnh báo + việc cần xử lý | Bảng số liệu + biểu đồ xu hướng + so sánh kỳ trước, export Excel/PDF |
| Người dùng | Owner mở hằng ngày | Owner/Kế toán xem theo kỳ |

**Cả hai bắt buộc dùng chung một bộ định nghĩa mốc ngày và nguồn dữ liệu ở tài liệu này.** Nếu Dashboard cần một con số mà tài liệu này đã định nghĩa (vd "doanh thu tháng"), Dashboard phải dùng đúng định nghĩa ở đây — không tự định nghĩa lại.

---

# Triết lý thiết kế

1. **Live query — không bảng thống kê riêng.** V1 mọi báo cáo tính trực tiếp từ dữ liệu nghiệp vụ (SalesOrder, Payment, Receivable, ReturnItem...) tại thời điểm xem. Không tạo bảng `report_*`, không snapshot số liệu theo kỳ, không background job. Quy mô 3 người dùng + vài trăm đơn/năm — Postgres với index đúng là quá đủ. Materialized View/bảng tổng hợp chỉ xem xét ở V2 nếu đo được chậm thật.

2. **Module Ownership** — giống Dashboard: Report gọi method đọc trên Service của module sở hữu (`SalesOrderService`, `DebtService`, `ReturnService`, `PaymentService`...). Không viết `prisma.salesOrder.groupBy(...)` trong code của Report. Method chưa có thì bổ sung vào Service của module nguồn.

3. **Không tính lại Business Logic.** Đọc các giá trị đã chốt (`totalAmount`, `plannedCost`, `plannedProfit`, `subtotal`, `remainingAmount`, `unitPriceSnapshot`...). Được phép SUM/COUNT/GROUP BY/ORDER BY — không được tính lại giá, BOM, chiết khấu, payment status.

4. **Số liệu quá khứ có thể thay đổi hồi tố trong một trường hợp duy nhất: đơn bị huỷ.** Vì báo cáo là live query và mọi báo cáo đều loại `CANCELLED`, một đơn tạo tháng 6 bị huỷ vào tháng 7 sẽ **biến mất khỏi báo cáo tháng 6** khi xem lại. Đây là hành vi đúng và có chủ đích (đơn huỷ = chưa từng bán). Không "đóng sổ kỳ" ở V1 — chốt sổ kế toán không thuộc phạm vi ERP này.

5. **Biểu đồ là cách trình bày lại dữ liệu API, không phải nguồn số liệu riêng.** Report nào có chuỗi thời gian trong phần "Hiển thị" (theo ngày/tháng/năm) đều có thêm 1 biểu đồ xu hướng (line/bar tuỳ độ dài kỳ) ở FE, vẽ trực tiếp từ cùng dữ liệu bảng đã trả về — không thêm endpoint riêng cho biểu đồ, không tính toán gì khác ngoài những gì bảng số liệu đã có.

---

# Nguyên tắc mốc ngày & Planned vs Actual

**Đây là phần quan trọng nhất của tài liệu.** Mọi báo cáo, Dashboard, và câu trả lời cho khách hàng đều phải dùng đúng bảng này:

| Chỉ số | Nguồn (field đã lưu) | Planned / Actual | Mốc ngày để lọc theo kỳ |
|---|---|---|---|
| **Doanh thu** | `SalesOrder.totalAmount` | **Planned** (chốt tại Approve) | `SalesOrder.createdAt` |
| **Giá vốn** | `SalesOrder.plannedCost` | **Planned** | `SalesOrder.createdAt` |
| **Lợi nhuận** | `SalesOrder.plannedProfit` | **Planned** | `SalesOrder.createdAt` |
| **Tiền mặt về** | `Payment.amount` | **Actual** (tiền thật đã thu) | `Payment.paymentDate` |
| **Công nợ còn phải thu** | `Receivable.remainingAmount` | Actual — trạng thái hiện tại | Không theo kỳ (xem ghi chú) |
| **Giá trị hàng hoàn** | `ReturnItem.returnedQuantity × unitPriceSnapshot` | Actual | `Return.returnDate` |

> Các chỉ số Kho (Nhập/Xuất kho theo `WarehouseTransaction`, Tồn kho hiện tại theo `Material.currentStock`) đã gỡ khỏi bảng này cùng đợt tạm gỡ module Kho (18/07/2026 — xem `warehouse.md` mục "Trạng thái triển khai" và ghi chú D1 ở Nhóm D). Khi bật lại Kho, khôi phục từ lịch sử git của tài liệu này.

## Giải thích các quyết định

**"Doanh thu" trong toàn hệ thống = doanh thu kế hoạch, ghi nhận tại ngày chốt đơn (`SalesOrder.createdAt` — chính là ngày Approve báo giá, vì SalesOrder chỉ sinh từ Approve).** Không dùng ngày giao hàng, không dùng ngày thanh toán. Lý do:

- Nhất quán với quyết định đã có ở `product.md` ("Doanh thu và lợi nhuận được ghi nhận khi Đơn hàng chuyển sang Đang sản xuất") và `order.md` (Planned Financials chốt khi tạo SO).
- Doanh nghiệp Make-To-Order đo "tháng này chốt được bao nhiêu đơn" — đúng cách Owner đang nghĩ.
- Tiền thật đã có chỉ số riêng: **Tiền mặt về**.

**V1 không tồn tại "lợi nhuận thực tế".** Hệ thống chưa theo dõi chi phí thực tế (actual cost — đã chừa sẵn ở `order.md`: V2 thêm `actualRevenue/actualCost/actualProfit`). Mọi nơi hiển thị "lợi nhuận" phải ghi rõ nhãn **"Lợi nhuận kế hoạch"** — không được hiển thị chữ "lợi nhuận" trần trụi khiến Owner tưởng là lãi thật.

**Hàng hoàn không trừ vào doanh thu.** Nhất quán `return.md` ("Return không làm thay đổi doanh thu"). Báo cáo hiển thị "Giá trị hàng hoàn" thành chỉ số **riêng, đặt cạnh** doanh thu để Owner tự đối chiếu — không tự động tính "doanh thu thuần". Nếu sau này doanh nghiệp cần giảm trừ thật, nghiệp vụ đó đi qua Manual Adjustment của Debt module (V2), không đi qua Report.

**Công nợ không lọc theo kỳ.** "Còn phải thu" là trạng thái tại thời điểm xem — không có khái niệm "công nợ của tháng 6". Bộ lọc ngày trong Báo cáo công nợ chỉ áp dụng cho phần **phát sinh** (đơn mới trong kỳ, tiền thu trong kỳ), không áp dụng cho số dư.

**Múi giờ:** mọi phép GROUP BY theo ngày/tháng/năm phải chuyển `createdAt`/`paymentDate` (lưu UTC) về `Settings.Company.timezone` trước khi cắt kỳ — nếu không, đơn chốt 23h ngày 31/07 giờ VN sẽ rơi nhầm sang tháng 8. Đây là lỗi kinh điển, ghi rõ ở đây để không ai quên.

**Khoảng ngày:** bộ lọc `from`–`to` là **inclusive theo ngày** trong timezone công ty (`from 00:00:00` đến `to 23:59:59`). Mặc định khi mở màn hình: đọc `Settings.Dashboard.defaultDashboardPeriod` — không hard-code.

## Quy tắc loại trừ (áp dụng cho MỌI báo cáo)

```text
SalesOrder.status != CANCELLED
```

- Doanh thu / giá vốn / lợi nhuận / đơn hàng / cơ cấu sản phẩm / doanh thu nhân viên / doanh thu khách hàng: loại đơn `CANCELLED`.
- Công nợ: chỉ tính Receivable thuộc SalesOrder chưa huỷ (đúng Dashboard Rule đã có ở `debt.md`).
- Payment không cần lọc — đơn đã thu tiền không huỷ được (rule ở `debt.md`), nên mọi Payment đều thuộc đơn còn hiệu lực.

---

# Danh mục báo cáo

14 báo cáo theo `03-danh-sach-module.md`, gom thành 4 nhóm. Mỗi báo cáo ghi rõ: nguồn → mốc ngày → cách tính.

## Nhóm A — Tài chính

### A1. Báo cáo doanh thu

- **Nguồn:** `SalesOrder.totalAmount`, lọc `createdAt` trong kỳ, loại `CANCELLED`.
- **Hiển thị:** tổng doanh thu kỳ này, so sánh kỳ trước (% tăng giảm — Derived, tính runtime), chuỗi theo ngày/tháng tuỳ độ dài kỳ.

### A2. Báo cáo tiền mặt về

- **Nguồn:** `Payment.amount`, lọc `paymentDate` trong kỳ.
- **Hiển thị:** tổng tiền về, phân theo `paymentMethod` (CASH / BANK_TRANSFER), chuỗi theo ngày.
- **Ghi chú:** đây là chỉ số Actual duy nhất về tiền — không được cộng lẫn với doanh thu (Planned) trong cùng một ô số liệu.

### A3. Báo cáo lợi nhuận (kế hoạch)

- **Nguồn:** `SalesOrder.plannedProfit`, `plannedCost` — cùng bộ lọc như A1.
- **Hiển thị:** lợi nhuận kế hoạch, tỷ suất (`plannedProfit / totalAmount` — Derived, tính runtime, không lưu), chuỗi theo kỳ.
- **Nhãn bắt buộc:** "Lợi nhuận kế hoạch".

### A4. Báo cáo công nợ

- **Nguồn:** `DebtService` (tái sử dụng toàn bộ logic đã có ở `debt.md` — Overdue/Risk/Credit-limit).
- **Số dư (không theo kỳ):** tổng còn phải thu, quá hạn theo bậc rủi ro (LOW/MEDIUM/HIGH), khách vượt hạn mức, top khách nợ.
- **Phát sinh (theo kỳ):** công nợ mới phát sinh (Receivable của SO tạo trong kỳ), tiền thu trong kỳ (= A2).

## Nhóm B — Bán hàng

### B1. Báo cáo đơn hàng

- **Nguồn:** `SalesOrder`, lọc `createdAt` trong kỳ.
- **Hiển thị:** số đơn theo `status`, theo `paymentStatus`, giá trị trung bình đơn; giao đúng hạn / trễ hạn (`actualDeliveryDate <= expectedDeliveryDate`, chỉ tính đơn đã có đủ 2 ngày — Derived, runtime).

### B2. Cơ cấu doanh thu theo sản phẩm

- **Nguồn:** `SalesOrderItem.subtotal`, JOIN `SalesOrder` để lọc kỳ + loại `CANCELLED`.
- **Group theo:** `productId` (khoá nhóm — xem "Thay đổi schema cần trước"), hiển thị bằng `productName` snapshot.
- **Hiển thị:** top sản phẩm theo doanh thu, tỷ trọng %.

### B3. Báo cáo tốc độ phát triển qua các tháng, năm

- **Nguồn:** chính là A1/A2/A3 GROUP BY tháng (hoặc năm), trong timezone công ty.
- **Hiển thị:** chuỗi 12 tháng gần nhất (hoặc theo năm), % tăng trưởng so với kỳ liền trước và cùng kỳ năm trước (Derived, runtime).

### B4. Báo cáo tốc độ phát triển theo nhóm sản phẩm

- **Nguồn:** `SalesOrderItem.subtotal` GROUP BY `productTypeId` snapshot + GROUP BY tháng.
- **Phụ thuộc schema:** `SalesOrderItem` hiện **chưa có** thông tin nhóm sản phẩm — xem "Thay đổi schema cần trước". Không được join ngược `productCode → Product → ProductType` (đọc lại Master Data cho chứng từ đã chốt — vi phạm Snapshot Rule, và sai khi Product đổi nhóm sau này).

## Nhóm C — Con người

### C1. Doanh thu theo nhân viên

- **Nguồn:** `SalesOrder.totalAmount` GROUP BY người phụ trách, lọc kỳ theo `createdAt`.
- **Phụ thuộc schema:** khoá nhóm phải là `ownerId` (FK User) — hiện `SalesOrder` chỉ có `ownerName String?` tự do, group theo chuỗi gõ tay sẽ vỡ số liệu ngay lần đổi tên đầu tiên. **Báo cáo này chỉ triển khai được sau khi hoàn thành việc chuyển `ownerName → ownerId + ownerName (snapshot hiển thị)`** — đã nằm trong danh sách "Nên sửa trước Go-Live" của architecture review.

### C2. Doanh thu theo khách hàng / Báo cáo khách hàng

- **Nguồn:** `SalesOrder.totalAmount` GROUP BY `customerId` (đã có sẵn, đã index), lọc kỳ.
- **Hiển thị:** top khách theo doanh thu kỳ; khách mới trong kỳ (`Customer.createdAt`); với từng khách: lần mua đầu (`MIN(SalesOrder.createdAt)`), lần mua gần nhất (`MAX`), tổng số đơn, tổng doanh thu, công nợ hiện tại — đúng cam kết "tính realtime, không lưu trong bảng customers" của `customer.md`.

## Nhóm D — Vận hành

> **D1. Báo cáo kho — TẠM GỠ (chốt 18/07/2026).** Doanh nghiệp chưa muốn xây/dùng module Kho — đang được ẩn khỏi phần mềm ở một task riêng (xem `warehouse.md` mục "Trạng thái triển khai"). Report vì vậy **không triển khai D1**, không gọi `WarehouseService`. Khi nào Kho được xây/bật lại, khôi phục D1 theo đúng mô tả nghiệp vụ cũ (còn giữ trong lịch sử file, xem git log tài liệu này) — không tự thiết kế lại.

### D2. Báo cáo hàng hoàn

- **Nguồn:** `Return`/`ReturnItem`, lọc `returnDate` trong kỳ. Tái sử dụng các method đã có của `ReturnService` (`getTopReturnReasons()`, `getReturnsByCustomer()`...).
- **Hiển thị:** số phiếu, số sản phẩm, giá trị hoàn theo giá bán (`returnedQuantity × unitPriceSnapshot`), top lý do, theo khách hàng — đúng ranh giới `return.md` (thống kê vận hành, không đụng tài chính).

---

# Thay đổi schema cần TRƯỚC khi triển khai Report

> **Cập nhật 18/07/2026 (khảo sát trước khi code — `008-module-bao-cao.md`):** mục 1 và 2 dưới đây **đã được làm từ trước** (không rõ ở lần nào), giữ lại mô tả để biết lý do thiết kế. Index `Payment(paymentDate)` ở mục 3 rà soát lại lúc triển khai Task 00 (`014-bao-cao.md`) — hoá ra cũng **đã có sẵn** từ migration `20260706044014_architecture_review_snapshots_return_status_indexes`, không cần migration mới.

Chốt tại đây để làm một lần, tránh retrofit khi dữ liệu thật đã phát sinh. Toàn bộ là **field snapshot/reference bổ sung + index** — không đổi Business Rule nào.

## 1. `SalesOrderItem` — bổ sung định danh sản phẩm và nhóm sản phẩm ✅ đã có

```text
SalesOrderItem (bổ sung)
  productId         String   // Redundant Reference — khoá nhóm bất biến cho B2
  productTypeId     String   // Redundant Reference — khoá nhóm cho B4
  productTypeName   String   // snapshot — nhãn hiển thị, không đọc lại ProductType
```

- Snapshot tại thời điểm Approve (cùng chỗ đang snapshot `productCode`/`productName`), copy từ `Product` đang được duyệt.
- Lý do `productId`/`productTypeId` là Redundant Reference hợp lệ (không phải Derived Data): copy ID bất biến, cùng convention `Receivable.customerId` đã thống nhất ở `debt.md`.
- Lý do không join ngược qua `productCode`: vi phạm Snapshot Rule, và nhóm của Product có thể đổi sau này — báo cáo lịch sử phải giữ nhóm **tại thời điểm bán**.
- Dữ liệu SalesOrderItem cũ (nếu có trước migration): backfill bằng script join theo `productCode` một lần duy nhất lúc migrate, ghi rõ trong migration note.

## 2. `SalesOrder.ownerId` (điều kiện cho C1) ✅ đã có

```text
SalesOrder (bổ sung)
  ownerId   String?   // FK User; ownerName giữ nguyên làm snapshot hiển thị
```

Thuộc hạng mục "Nên sửa trước Go-Live" của architecture review — Report C1 phụ thuộc việc này. Nếu chưa làm kịp, C1 lùi lại, **không** ship bản group-by-string tạm.

## 3. Index theo ngày

| Bảng | Index | Phục vụ | Trạng thái |
|---|---|---|---|
| `SalesOrder` | `@@index([createdAt])` | A1/A3/B1/B3/C1/C2 | ✅ đã có |
| `Payment` | `@@index([paymentDate])` | A2 | ✅ đã có |
| `Return` | `@@index([returnDate])` | D2 | ✅ đã có |
| `MaterialReceipt` | `@@index([createdAt])` | ~~D1~~ (tạm gỡ) | ✅ đã có sẵn, không cần làm gì thêm |
| `SalesOrderItem` | `@@index([productId])`, `@@index([productTypeId])` | B2/B4 | ✅ đã có |

Không thêm index dự phòng cho nhu cầu chưa có — chỉ đúng danh sách trên.

---

# API

Read-only, một prefix duy nhất:

```http
GET /reports/revenue                 # A1
GET /reports/cash-in                 # A2
GET /reports/profit                  # A3
GET /reports/debt                    # A4
GET /reports/orders                  # B1
GET /reports/revenue-by-product      # B2
GET /reports/growth                  # B3 (query: groupBy=month|year)
GET /reports/growth-by-product-type  # B4
GET /reports/revenue-by-employee     # C1
GET /reports/revenue-by-customer     # C2
GET /reports/returns                 # D2 (D1 Báo cáo kho tạm gỡ, xem Nhóm D)
```

Query params chung: `from`, `to` (yyyy-mm-dd, inclusive, timezone công ty). Không có POST/PUT/PATCH/DELETE.

## Excel & PDF Export

Mỗi endpoint có bản export tương ứng, chọn định dạng qua query `format`:

```http
GET /reports/{name}/export?format=xlsx   # mặc định nếu không truyền
GET /reports/{name}/export?format=pdf
```

- **Excel:** sinh qua `ExcelService` (đã có sẵn — `apps/api/src/shared/excel/excel.service.ts`, đang dùng cho Customer/Product import-export) — Report không gọi thư viện Excel trực tiếp.
- **PDF:** sinh qua `PdfService` (wrapper cùng vị trí đã quy định ở `04-cong-nghe-su-dung.md` — Report không gọi thư viện PDF trực tiếp). `PdfService` **chưa tồn tại**, phải viết mới cùng đợt triển khai Report này — xem "Module Dependencies".
- Nội dung cả 2 định dạng = đúng dữ liệu API trả về với cùng bộ lọc, kèm dòng tiêu đề ghi kỳ báo cáo + thời điểm xuất. Không thêm chỉ số chỉ có trong Excel/PDF — cả hai là bản in của API, không phải nguồn số liệu thứ hai.

---

# Permission

Một quyền duy nhất cho toàn module:

```text
report.view
```

- Seed thêm vào Permission catalog (đúng quy trình `permission.md`: Dev seed, không tạo qua API), gán mặc định cho `OWNER`/`ADMIN`/`ACCOUNTANT`/`MANAGER`.
- Không tách quyền theo từng báo cáo ở V1 — chưa có nhu cầu thật. Nếu sau này cần ẩn báo cáo tài chính khỏi một Role, tách `report.finance.view` lúc đó.

---

# Không làm trong V1

- Bảng thống kê riêng / Materialized View / cache / background job.
- Đóng sổ kỳ (period close) — số liệu quá khứ thay đổi khi đơn huỷ là hành vi chấp nhận.
- Lợi nhuận thực tế (actual cost) — chờ V2 `actualRevenue/actualCost/actualProfit` (`order.md`).
- Doanh thu thuần sau hàng hoàn — chờ nghiệp vụ Manual Adjustment (Debt V2).
- Báo cáo kho (D1) và mọi chỉ số tồn kho — module Kho tạm gỡ khỏi triển khai (xem `warehouse.md`).
- Báo cáo tuỳ biến (custom report builder), lập lịch gửi báo cáo qua email.
- Mục tiêu doanh thu theo kỳ và tỷ lệ hoàn thành mục tiêu (A1) — chờ khi hệ thống có Setting "Mục tiêu doanh thu" (chưa tồn tại). Không thêm vào "Hiển thị" của A1 khi chưa có dữ liệu mục tiêu thật.

---

# Business Rule

- Mọi chỉ số phải lấy đúng nguồn + mốc ngày theo bảng "Nguyên tắc mốc ngày & Planned vs Actual" — Dashboard dùng chung định nghĩa này.
- Mọi báo cáo loại `SalesOrder.status = CANCELLED` (trừ Payment — không thể tồn tại trên đơn huỷ).
- Chỉ số Planned và Actual không được cộng lẫn trong cùng một con số.
- "Lợi nhuận" luôn hiển thị nhãn "kế hoạch" ở V1.
- Giá trị hàng hoàn hiển thị riêng, không trừ vào doanh thu.
- GROUP BY ngày/tháng/năm theo `Settings.Company.timezone`; khoảng lọc inclusive theo ngày.
- Report chỉ đọc qua Service của module sở hữu (Module Ownership) — không query trực tiếp bảng của module khác, không tính lại Business Logic.
- B4 và C1 chỉ được triển khai sau khi hoàn thành thay đổi schema tương ứng (mục "Thay đổi schema cần trước") — không ship bản tạm bằng join ngược Master Data hay group theo chuỗi tên.
- Excel/PDF export và biểu đồ đều là bản trình bày lại của API — cùng bộ lọc, cùng con số, không tính toán thêm.

---

# Module Dependencies

## Phụ thuộc

- `SalesOrderService`, `PaymentService`/`DebtService`, `ReturnService`, `CustomerService` — chỉ gọi method đọc (Module Ownership, cùng pattern Dashboard). Không gọi `WarehouseService` — D1 tạm gỡ (xem Nhóm D).
- `ExcelService` (export Excel — đã có sẵn tại `apps/api/src/shared/excel/`).
- `PdfService` (export PDF — **chưa tồn tại, cần viết mới**, wrapper mỏng quanh 1 thư viện PDF, đặt cùng vị trí quy ước với `ExcelService`, ví dụ `apps/api/src/shared/pdf/`).
- `SettingService` (`timezone`, `defaultDashboardPeriod`).
- Permission (`report.view`).
- Frontend: cần thêm 1 thư viện vẽ biểu đồ (`apps/web` hiện chưa có) — chọn lúc code, đây là chi tiết kỹ thuật không thuộc phạm vi tài liệu nghiệp vụ này.

## Module bị ảnh hưởng (thay đổi cần thống nhất trước khi code)

- **Sales Order module:** thêm snapshot `productId`/`productTypeId`/`productTypeName` vào `SalesOrderItem` (set tại Approve); thêm `ownerId`; thêm index `createdAt`.
- **Debt module:** thêm index `Payment(paymentDate)`; bổ sung method đọc theo kỳ nếu chưa có.
- **Return module:** thêm index `Return(returnDate)`.
- **Permission module:** seed `report.view`.
- ~~**Warehouse module**~~ — không còn cần đụng tới, D1 tạm gỡ (module Kho đang được ẩn khỏi phần mềm ở task riêng, xem `warehouse.md`).

Không được thay đổi Business Rule hoặc Data Model của các Module trên ngoài phạm vi đã liệt kê. Nếu cần thay đổi thêm phải dừng và xác nhận với người dùng.

---

# Ghi chú

Report là module tổng hợp cuối chuỗi — không chứa Business Logic, không phải nguồn sự thật của bất kỳ con số nào. Nguồn sự thật luôn là module nghiệp vụ; Report chỉ trình bày.

Nếu một báo cáo cần dữ liệu mà module nguồn chưa có (field, method, index), bổ sung tại module nguồn theo mục "Module bị ảnh hưởng" — không tự tính trong Report.

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và hỏi người dùng trước khi tiếp tục.
