# Milestone (Sprint 04) - Lợi nhuận kế hoạch theo xưởng

> **Tên file:** `workbench/sprint-04/031-loi-nhuan-theo-xuong.md`
> **Trạng thái:** ✅ Code xong (13/10/2026) — chưa commit, chưa deploy.
> **Tiếp nối:** `028-doanh-so-xuong-nhac-khach.md` (doanh số theo xưởng), `029-phan-quyen-theo-tung-bao-cao.md`.

---

# Bối cảnh

Khối "Doanh số theo xưởng" (Dashboard) và báo cáo "Doanh thu theo xưởng" (Báo cáo → Sản xuất) hiện chỉ có doanh số. User muốn xem thêm **lợi nhuận kế hoạch** của từng xưởng, và ở trang chi tiết xưởng có ô tích để chọn hiện Doanh thu / Lợi nhuận trên biểu đồ.

---

# Quyết định đã chốt (13/10/2026)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Lợi nhuận xưởng tính thế nào | **Theo các dòng sản phẩm thuộc xưởng trong đơn** (doanh thu + giá vốn của chính các dòng đó — tương đương tính theo phiếu sản xuất vì `ProductionOrderItem` trỏ thẳng về `SalesOrderItem`, không lưu giá riêng). VAT 8% tính trên doanh thu của xưởng. Riêng **"Giảm thêm"** (nhập cho cả đơn, không gắn sản phẩm) → **Cách 1: chia theo tỷ lệ doanh số xưởng** (user chọn 13/10/2026) để tổng LN các xưởng khớp tổng LN kế hoạch. |
| 2 | Ai thấy lợi nhuận trong Báo cáo | Phải có **đồng thời** `report.revenue-by-production-center` **và** `report.profit`. Thiếu `report.profit` → vẫn xem doanh thu, không thấy phần lợi nhuận. |
| 3 | Trang danh sách "Doanh thu theo xưởng" trong Báo cáo | **Có** thêm cột lợi nhuận (cùng quy tắc quyền như #2). |

Dashboard: khối vốn chỉ hiện với `sales-order.view-cost` (Chủ DN / Quản trị) → hiện luôn cột lợi nhuận, không thêm điều kiện.

---

# Cách tính (theo dòng sản phẩm của xưởng — không tính lại giá)

Lợi nhuận kế hoạch của đơn đã chốt tại Approve:

```text
plannedProfit = (totalAmount − discountAmount) − VAT_hoá_đơn(8%) − plannedCost
```

→ Doanh thu thuần của đơn (đã trừ Giảm thêm, đã tách VAT):

```text
netRevenue(order) = plannedProfit + plannedCost
```

Với mỗi đơn, mỗi xưởng c (gồm nhóm "Bán lẻ vật tư" = productionCenterId null). Công thức dưới tương đương "(doanh thu dòng của c − phần Giảm thêm chia theo tỷ lệ) − VAT 8% − giá vốn dòng của c" vì VAT là tỷ lệ cố định trên tiền hàng; viết theo snapshot của đơn để không lặp lại hằng số VAT ở module khác:

```text
share_c        = SUM(subtotal dòng của c) / totalAmount(order)
netRevenue_c   = netRevenue(order) × share_c
plannedCost_c  = SUM(SalesOrderItem.plannedCost dòng của c)      ← snapshot có sẵn
plannedProfit_c = netRevenue_c − plannedCost_c
```

- **Tổng lợi nhuận các xưởng = tổng `SalesOrder.plannedProfit`** (khớp báo cáo A3 Lợi nhuận kế hoạch và Dashboard), sai số làm tròn ≤ vài đồng.
- Dùng **chỉ dữ liệu snapshot** (`plannedProfit`, `plannedCost`, `totalAmount`, `subtotal`) — không gọi Pricing/BOM, không lặp lại hằng số VAT 8% ở module khác (đúng "Dashboard/Report không tính lại Business Logic").
- **Không trừ hàng hoàn** — cùng quy tắc báo cáo A3 (`report.md`).
- Nhãn luôn là **"Lợi nhuận kế hoạch"** (bắt buộc theo `report.md`).
- Tỷ suất = lợi nhuận / doanh số của xưởng — Derived, tính runtime, không lưu.

Kiểm tra dữ liệu production (13/10/2026, chỉ đọc): 2.019 đơn không huỷ — `SUM(item.plannedCost) = order.plannedCost` ở **100%** đơn; 339 đơn nhiều xưởng, 61 đơn có Giảm thêm; 3 đơn plannedCost = 0 (sản phẩm chưa có định mức — lợi nhuận = toàn bộ doanh thu thuần, giống A3 hiện tại).

---

# Thiết kế

## Backend (SalesOrderService — Module Ownership)

- `getRevenueByProductionCenter(from, to)`: mỗi xưởng trả thêm `plannedCost`, `plannedProfit`; response thêm `totalPlannedProfit`. Đọc thêm `salesOrder.{totalAmount, plannedProfit, plannedCost}` của từng dòng để phân bổ.
- `getProductionCenterRevenueSeries(...)`: thêm `totalPlannedProfit` và `plannedProfit` vào từng điểm của chuỗi (`buildSeries` thêm key).
- **Ẩn theo quyền ở tầng API** (không dựa FE ẩn cột):
  - `GET /reports/revenue-by-production-center[/:id]`: chỉ trả các field lợi nhuận khi role có `report.profit`; không có → bỏ field (FE tự ẩn).
  - `GET /dashboard/sales/by-production-center`: giữ gate `sales-order.view-cost` hiện có → luôn kèm lợi nhuận.
- Unit test: phân bổ đơn 1 xưởng / nhiều xưởng / có Giảm thêm / có dòng bán lẻ; tổng các xưởng = tổng plannedProfit; ẩn field khi thiếu quyền.

## Frontend

1. **Dashboard** — khối "Doanh số theo xưởng": thêm cột **"Lợi nhuận kế hoạch"** cạnh "Doanh số", có ở dòng Tổng.
2. **Báo cáo → Doanh thu theo xưởng** (danh sách): thêm ô tổng "Lợi nhuận kế hoạch" + cột lợi nhuận mỗi xưởng (chỉ khi API trả về).
3. **Trang chi tiết xưởng**:
   - Thêm ô "Lợi nhuận kế hoạch" và "Tỷ suất LN" cạnh ô Doanh thu.
   - Trên biểu đồ: ô tích **☑ Doanh thu ☑ Lợi nhuận kế hoạch** (mặc định tích cả hai), tích ô nào biểu đồ hiện series đó. Không có quyền lợi nhuận → không hiện ô tích, biểu đồ chỉ có doanh thu như hiện tại.
4. **Hướng dẫn & cập nhật**: thêm mục nhật ký đợt mới + sửa bài "Xem doanh số theo xưởng" (quy ước 030).

## Tài liệu

`dashboard.md` (1d), `report.md` (E1), file này.

---

# Task

## ✅ Task 1 — BE: phân bổ lợi nhuận theo xưởng + ẩn theo quyền + unit test

`SalesOrderService.itemPlannedProfit()` (dùng chung cho 2 method), `getRevenueByProductionCenter()` thêm `plannedCost/plannedProfit/totalPlannedProfit`, `getProductionCenterRevenueSeries()` thêm `plannedProfit` vào chuỗi + `totalPlannedProfit`. `ReportController` bỏ field lợi nhuận khi thiếu `report.profit`. Test: 4 test service (phân bổ, tổng khớp, chia 0, chuỗi) + 2 test controller theo quyền. Jest 406/406.
## ✅ Task 2 — FE: cột lợi nhuận Dashboard + danh sách báo cáo
## ✅ Task 3 — FE: trang chi tiết xưởng (ô số + ô tích series trên biểu đồ)
## ✅ Task 4 — Hướng dẫn & cập nhật + tài liệu
## ✅ Task 5 — Test (unit, tsc, build, API thật: tổng LN xưởng = tổng plannedProfit; role có/không report.profit)

---

# Kết quả

- **BE:** `tsc` sạch; Jest 406/406 (thêm 4 test service: phân bổ theo dòng + Giảm thêm, tổng = SUM plannedProfit, totalAmount = 0, chuỗi theo kỳ; 2 test controller theo quyền `report.profit`). Lint không thêm lỗi so với HEAD.
- **FE:** `tsc` + `next build` sạch; lint không thêm lỗi. `ReportRankingTable` thêm `extraColumn` tuỳ chọn (báo cáo cũ không đổi).
- **API thật (local, năm 2026):** tổng LN kế hoạch các xưởng = **42.364.044 ₫ = SUM(`plannedProfit`)** các đơn trong DB (khớp tuyệt đối); Dashboard cùng số; chi tiết Xưởng Bạt 7.883.292 ₫ = dòng của xưởng ở danh sách = tổng chuỗi theo tháng.
- **Quyền thiếu `report.profit`:** cover bằng unit test controller (local không có role nào có thẻ "Doanh thu theo xưởng" mà thiếu "Lợi nhuận kế hoạch" — không tự tạo role test).
- Trang `/dashboard`, `/reports/production-centers`, chi tiết xưởng, `/help`, `/help/doanh-so-theo-xuong` → 200.
