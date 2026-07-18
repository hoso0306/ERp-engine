# Milestone (Sprint 04) - Bộ lọc thời gian Dashboard (tab cuối cùng của rà soát bộ lọc)

> **Tên file:** `workbench/sprint-04/007-bo-loc-thoi-gian-dashboard.md`
> **Trạng thái:** ✅ HOÀN THÀNH (18/07/2026)
>
> **Cập nhật 18/07/2026 (sau khi Report hoàn thành):** bộ lọc "Hôm nay/Tuần này/Tháng này/Tất cả/tuỳ chọn" mô tả ở file này đã được **thay bằng `DashboardRangeFilter`** — chỉ còn 3 preset ngắn (Hôm nay/Hôm qua/7 ngày gần đây), đúng nợ kỹ thuật đã ghi nhận ở `report.md` "Nguyên tắc phân vai Dashboard vs Report" và `008-module-bao-cao.md`. Nội dung bên dưới giữ nguyên để biết bối cảnh quyết định tại thời điểm đó, không còn phản ánh đúng UI hiện tại.

---

# Bối cảnh

Tiếp nối việc rà soát bộ lọc "THỜI GIAN HIỂN THỊ" đi qua từng tab (đã triển khai xong: Báo giá, Đơn hàng, Công nợ, Kho, Sản xuất, Hàng hoàn). Dashboard là tab cuối cùng.

Khác với các tab danh sách, Dashboard gồm nhiều khối KPI tổng hợp (SUM/COUNT/GROUP BY tính sẵn ở backend), không phải danh sách chứng từ — nên **không phải khối nào cũng lọc được kiểu client-side như các trang trước**. Đã rà soát toàn bộ khối đang hiển thị (xem báo cáo đã gửi trong chat) và thống nhất với người dùng cách xử lý từng khối.

---

# Quyết định đã chốt

1. **Bộ lọc đầu trang** — mặc định "Hôm nay" (khác các lần trước dùng "Tất cả"), vẫn 1 nút chung ở đầu trang.

2. **Kinh doanh** — giữ nguyên như đã làm: bảng "Đơn hàng gần đây" lọc theo `createdAt` trong khoảng đã chọn. Tile tổng quan (doanh thu/giá vốn/lợi nhuận kế hoạch, đếm theo trạng thái) giữ tức thời, không lọc.

3. **Công nợ → đổi tên "Tổng công nợ"** — theo yêu cầu, khối này **không cho lọc theo bộ lọc đầu trang nữa**:
   - Đổi tiêu đề khối từ "Công nợ" → "Tổng công nợ".
   - Bảng "Sắp đến hạn" **bỏ lọc theo `dueDate`** (đang lọc từ lần trước) — quay về hiển thị toàn bộ như backend trả (không cắt theo bộ lọc đầu trang).
   - Toàn bộ tile + "Top khách nợ nhiều nhất" vốn đã tính all-time, giữ nguyên.
   - Thêm chú thích nhỏ dưới tiêu đề, kiểu "(toàn bộ thời gian — không áp dụng bộ lọc)" để người xem không nhầm là đang lọc theo bộ lọc đầu trang.

4. **Kho → XOÁ toàn bộ khỏi Dashboard** — lý do nghiệp vụ: chưa được trả phí để triển khai phần báo cáo Kho. Gỡ hẳn khối "Kho" (tile tồn kho, Top vật tư tiêu thụ, Vật tư cần chú ý) khỏi trang Dashboard.

5. **Hàng hoàn** — theo đề xuất đã duyệt:
   - Tile "Phiếu hoàn / SL sản phẩm hoàn / Giá trị hoàn — **tháng này**" → đổi nhãn động theo bộ lọc đầu trang (vd chọn "Hôm nay" thì nhãn ghi "...hôm nay", chọn khoảng ngày thì ghi khoảng đó) và tính lại theo đúng khoảng đã chọn — thay vì hard-code tháng dương lịch như hiện tại.
   - Bảng "Lý do trả hàng" + List "Khách trả hàng nhiều nhất" → lọc theo `returnDate` trong khoảng đã chọn (hiện đang all-time, không lọc gì cả).
   - Tile "Kho thu hồi còn khả dụng" + "Tồn kho thu hồi lâu" (quá 30/90 ngày) → **giữ nguyên tức thời**, không lọc — đây là số dư/tuổi tồn kho thu hồi tại thời điểm xem, không phải số phát sinh theo kỳ.

6. **Sản xuất**:
   - "Chờ SX" / "Đang SX": giữ **tức thời**, không lọc — thêm chú thích nhỏ "(hiện tại)" để người xem hiểu 2 số này không đổi theo bộ lọc.
   - "Hoàn thành": **lọc theo bộ lọc đầu trang**, dùng field `completedAt`. Thêm chú thích ngày động sau số (vd "Hoàn thành (18/07/2026)").
   - "Đã huỷ": **lọc theo bộ lọc đầu trang**. ⚠️ *Lưu ý kỹ thuật*: `ProductionOrder` không có cột `cancelledAt` riêng — action huỷ chỉ update `status`, không set mốc thời gian riêng (xem `sales-order.service.ts:394`). Đề xuất dùng `updatedAt` làm giá trị thay thế (không có action nào sửa phiếu sau khi đã CANCELLED nên an toàn dùng được). Muốn chính xác tuyệt đối cần thêm cột `cancelledAt` — **ngoài phạm vi task này**, để dành sau nếu cần.
   - "Tiến độ tổng" (%): đề xuất **giữ tức thời**, không lọc — đây là % hoàn thành của các đơn ĐANG sản xuất tại thời điểm xem (không phải số liệu phát sinh theo kỳ, đơn dở dang không "thuộc về" một ngày cụ thể). Thêm chú thích "(hiện tại)". *Cần bạn xác nhận đề xuất này.*
   - "Xưởng bận nhất/ít việc nhất" → đổi từ 2 thẻ rời rạc (chỉ hiện đầu + cuối danh sách) thành **danh sách đầy đủ tất cả xưởng**, sắp xếp theo số phiếu giảm dần, để thấy hết chứ không bỏ sót xưởng ở giữa. Dữ liệu này giữ **tức thời** (đúng bản chất "đang bận đến đâu ngay bây giờ"), không lọc theo bộ lọc đầu trang. `getBusyCenters()` ở backend đã trả về toàn bộ xưởng sẵn — chỉ cần sửa UI hiển thị hết.

7. **Cảnh báo** — giữ nguyên toàn bộ thời gian, không đổi gì (đã thống nhất từ trước).

---

# ⚠️ Điểm cần xác nhận thêm trước khi code

1. **Cảnh báo tồn kho trong khối Cảnh báo** — `lowStockMaterials`/`outOfStockMaterials` (2 loại cảnh báo "sắp hết hàng"/"hết hàng") lấy dữ liệu từ Warehouse module. Mục 4 yêu cầu "bỏ **toàn bộ** dữ liệu kho ra khỏi dashboard" — vậy 2 loại cảnh báo này trong khối Cảnh báo (khác khối "Kho") có bị gỡ theo không? Mục 7 chỉ nói "Cảnh báo: để toàn bộ thời gian", không nói gỡ bớt loại cảnh báo nào.
   - Nếu gỡ: Cảnh báo sẽ chỉ còn nợ quá hạn/vượt hạn mức/đơn trễ giao.
   - Nếu giữ: Cảnh báo tồn kho vẫn hiện dù khối "Kho" đã biến mất khỏi Dashboard — có thể gây khó hiểu ("sao không thấy Kho đâu mà vẫn có cảnh báo hết hàng?").

2. **Phạm vi gỡ Kho** — chỉ gỡ khối Kho khỏi `GET /dashboard/overview` (trang Dashboard tổng quan), hay gỡ luôn cả endpoint `GET /dashboard/warehouse` riêng lẻ (đang tồn tại độc lập, hiện chưa thấy FE nào khác gọi tới)? Đề xuất: chỉ gỡ khỏi `getOverview()` + xoá `<WarehouseOverviewPanel>` khỏi trang Dashboard, **giữ nguyên** endpoint `GET /dashboard/warehouse` (không xoá code/API) để tránh rủi ro phá vỡ nếu có chỗ khác cần, và dễ bật lại sau này nếu được duyệt ngân sách làm phần Kho.

---

# Lưu ý phạm vi kỹ thuật quan trọng

Khác với các trang danh sách (Đơn hàng, Sản xuất, Công nợ...) — nơi lọc được ngay ở FE vì trang đã fetch sẵn toàn bộ item hiển thị — các con số ở Dashboard là **aggregate tính sẵn ở backend** (SUM/COUNT/GROUP BY), FE chỉ nhận đúng con số cuối cùng, không có danh sách item để tự lọc lại. Vì vậy các khối cần "lọc theo bộ lọc đầu trang" ở trên (Hoàn thành SX, Đã huỷ SX, tile + bảng Hàng hoàn) **bắt buộc phải sửa backend** để nhận thêm tham số khoảng ngày (`from`/`to`) và tính lại truy vấn — không đơn thuần là thêm state ở FE như các tab trước. Khối lượng việc tab này lớn hơn các tab trước.

---

# Việc dự kiến (checklist — CHƯA LÀM, chờ duyệt kế hoạch + trả lời 2 điểm ở trên)

## Backend

- [ ] `dashboard.service.ts` / `dashboard.controller.ts`: bỏ `warehouse` khỏi response `getOverview()`.
- [ ] `debt.service.ts`: xác nhận lại `getUpcomingDueReceivables()` — việc lọc "Sắp đến hạn" theo `dueDate` hiện đang làm ở FE (`DebtOverviewPanel`), không đụng backend gì — chỉ cần bỏ ở FE (mục Frontend bên dưới), không cần sửa backend cho mục này.
- [ ] `return.service.ts`: sửa `getDashboardSummary(from?, to?)`, `getTopReturnReasons(from?, to?)`, `getReturnsByCustomer(from?, to?, limit?)` — nhận khoảng ngày lọc theo `returnDate`, thay vì hard-code tháng (`getDashboardSummary`) hoặc all-time (2 hàm còn lại).
- [ ] `production-order.service.ts`: sửa `getDashboardSummary(from?, to?)` — thêm đếm `completed`/`cancelled` **theo khoảng ngày** (dùng `completedAt` cho completed, `updatedAt` cho cancelled) tách riêng với `pending`/`inProduction` (vẫn đếm tức thời, không theo khoảng ngày).
- [ ] `dashboard.controller.ts`: nhận query `from`/`to` ở `GET /dashboard/overview`, forward xuống các hàm ở trên.

## Frontend

- [ ] `dashboard/page.tsx`: mặc định `dateFrom`/`dateTo` = Hôm nay (`todayISO()`); truyền `from`/`to` vào request `GET /dashboard/overview`; bỏ truyền `dateFrom`/`dateTo` xuống `DebtOverviewPanel`; xoá hẳn `<WarehouseOverviewPanel>`; truyền `dateFrom`/`dateTo` xuống `ReturnOverviewPanel` và `ProductionOverviewPanel`.
- [ ] `debt-overview-panel.tsx`: bỏ toàn bộ logic lọc `upcomingDue` theo ngày (bỏ props `dateFrom`/`dateTo`), đổi tiêu đề "Công nợ" → "Tổng công nợ", thêm chú thích "(toàn bộ thời gian)".
- [ ] `return-overview-panel.tsx`: nhận props `dateFrom`/`dateTo`, đổi nhãn tile "...tháng này" thành động, hiển thị đúng số backend trả theo khoảng ngày mới (không tự lọc ở FE vì đây là aggregate).
- [ ] `production-overview-panel.tsx`:
  - Thêm chú thích "(hiện tại)" cho Chờ SX / Đang SX / Tiến độ tổng.
  - "Hoàn thành" / "Đã huỷ" hiển thị số backend trả theo khoảng ngày (nhận từ props `dateFrom`/`dateTo`), thêm chú thích ngày động.
  - Đổi UI 2 thẻ "Xưởng bận/ít việc nhất" → danh sách đầy đủ tất cả xưởng (bảng hoặc list), sắp xếp giảm dần theo số phiếu.
- [ ] Xoá `warehouse-overview-panel.tsx` khỏi import ở `dashboard/page.tsx` (giữ nguyên file component, không xoá — phòng khi cần dùng lại).

## Kiểm thử

- [ ] Cập nhật/thêm test cho `return.service.ts`, `production-order.service.ts` (dashboard summary theo khoảng ngày).
- [ ] `tsc --noEmit` + `next build` + `nest build` sạch.
- [ ] Verify tay: đổi bộ lọc đầu trang (Hôm nay/Tuần này/Tháng này/Tất cả/tuỳ chọn) → đúng các khối được thiết kế để đổi theo (Kinh doanh, Sản xuất Hoàn thành/Huỷ, Hàng hoàn) thay đổi số liệu; các khối "tức thời"/"toàn thời gian" (Công nợ, Chờ SX/Đang SX/Tiến độ, Xưởng, Cảnh báo) không đổi.

---

# Ghi chú thực hiện

Chờ người dùng trả lời 2 điểm ở mục "⚠️ Điểm cần xác nhận thêm" và duyệt kế hoạch tổng thể trước khi bắt đầu code. Sau khi duyệt, báo cáo theo cụm: **Backend trước (return + production + dashboard controller)**, rồi **Frontend**, rồi **Test + verify**.
