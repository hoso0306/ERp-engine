# Test lần 1 - Kiểm thử thủ công toàn bộ chức năng hiện có (08/07/2026)

> **Tên file:** `workbench/sprint-02/testlan1.md`

---

# Mục tiêu

Người dùng tự kiểm thử toàn bộ chức năng đang có trên website sau khi hoàn thành Milestone 01 (Sprint 02) — `001-cap-nhat-kien-truc.md`.

Đánh dấu `[x]` vào mục đã test đạt. Muốn thêm tính năng hoặc ghi lỗi thì ghi chú vào ngay bên dưới các mục của tính năng đó.

---

# Môi trường test

* Web: `http://localhost:3000` (Next.js dev)
* API: `http://localhost:3001` — chạy qua **proxy test tự đăng nhập** `http://localhost:3002` (user `verify-sprint02@erp.local`, quyền OWNER)
* DB: PostgreSQL (Docker `erp-postgres`), dữ liệu dev
* Lưu ý: FE **chưa có màn hình đăng nhập** — đăng nhập được xử lý tự động bởi proxy test. Các module Đơn hàng / Sản xuất / Kho / Công nợ / Dashboard / Hàng hoàn **chưa có trang web** (mới có API).

---

# Phần 1 - Master Data

## 1.1 Đơn vị tính (`/units`)

* [x] Xem danh sách đơn vị.
* [x] Thêm đơn vị mới.
* [x] Sửa đơn vị.
* [x] Xoá đơn vị.

## 1.2 Loại sản phẩm (`/product-types`)

* [x] Xem danh sách.
* [x] Thêm loại mới.
* [x] Bật / tắt hoạt động.
* [x] Sửa loại.
* [x] Xoá loại.

## 1.3 Xưởng sản xuất (`/production-centers`)

* [x] Xem danh sách.
* [x] Thêm xưởng mới.
* [x] Sửa xưởng mới.
* [x] Xoá xưởng mới.

## 1.4 Vật tư (`/materials`)

* [x] Xem danh sách, tìm kiếm.
* [x] Tạo vật tư mới (chọn đơn vị tính).
* [x] Mở chi tiết → xem giá vật tư (nhiều mức giá theo NCC, giá mặc định).
* [x] Thêm mức giá mới cho vật tư.
* [x] Xem tồn kho hiện tại + tồn kho tối thiểu.
* [x] Sửa vật tư.
* [x] Bật tắt Ngừng sử dụng, sử dụng

Lỗi: - Chưa xem được tồn kho, tồn kho tối thiểu → ✅ ĐÃ SỬA 09/07 (Task 01 milestone 002 — cột tồn kho + cảnh báo dưới mức ở danh sách/chi tiết; đặt được tồn tối thiểu ngay trong form)
     - Phần hiển thị FE ở ô ''dơn vị tính' ở tab 'chỉnh sửa nguyên liệu' và 'thêm nguyên liệu' bị lỗi hiển thị → ✅ ĐÃ SỬA 09/07 (Task 00 — lỗi chung component Select, sửa một chỗ hết mọi form)
Tính năng muốn thêm:
     - Phân loại các nguyên liệu theo xưởng sản xuất → ✅ ĐÃ LÀM 09/07 (Task 08 — gắn nhiều xưởng, lọc theo xưởng)
     - Hiển thị giá nhập và giá bán → ✅ ĐÃ LÀM 09/07 (Task 07 — giá bán lẻ + giá nhập mặc định)
     - Đổi tên FE của tab từ ''Nguyên liệu'' thành ''Vật tư'' để nghe hợp với ngành hơn → ✅ ĐÃ LÀM 09/07 (Task 01)

---

# Phần 2 - Khách hàng (`/customers`)

* [x] Xem danh sách, tìm kiếm theo tên / SĐT.
* [x] Lọc theo nhóm khách hàng.
* [x] Tạo khách mới — chọn **Nhóm khách hàng** (quyết định % chiết khấu ở báo giá) + tuyến giao hàng.
* [x] Mở chi tiết → sửa thông tin.
* [x] Xoá khách → vào danh sách "Đã xoá" → khôi phục.
* [x] Export Excel.
* [x] Tải template import.
Lỗi: 
- Khi nhập số điện thoại bằng import, số điện thoại bị mất số 0 ở đầu trong file excel (do định dạng cột số điện thoại trong file excel) dẫn đến sai sdt trong phần mềm → ✅ ĐÃ SỬA 09/07 (Task 02 — template ép cột Text, import tự thêm lại số 0 + validate theo dòng)
- FE của các trường 'nhóm khách hàng', 'tuyến giao hàng' và 'mức độ ưu tiên' bị lỗi hiển thị trong tab 'thêm khách hàng' và 'sửa khách hàng' → ✅ ĐÃ SỬA 09/07 (Task 00)
Tính năng muốn thêm:
     - Thêm trường thông tin khách hàng gồm: Tên công ty và mã số thuế → ✅ ĐÃ LÀM 09/07 (Task 05 — form/chi tiết/import/export)
---

# Phần 3 - Sản phẩm + Quy tắc giá (`/products`)

Dùng sản phẩm mẫu **SP000003 "[Cửa lưới] Hệ 27 - Khung trắng/ghi/cafe"** (đầy đủ nhất).

* [x] Xem danh sách, lọc theo trạng thái / loại sản phẩm.
* [x] Mở chi tiết SP000003 → xem **Thông số sản phẩm** (số cánh, chiều cao, chiều rộng).
* [x] Vào **Quy tắc báo giá**: xem version ACTIVE + expression tính giá.
* [x] **Preview giá** với thông số bất kỳ.
* [x] Tạo version giá mới (DRAFT) → sửa expression → **Kích hoạt** (version cũ tự chuyển ARCHIVED).
* [x] Vào **Định mức vật tư**: xem version ACTIVE, công thức tính lượng vật tư.
* [x] Tạo sản phẩm mới hoàn chỉnh (thông số + quy tắc giá + định mức) — nếu có thời gian.
Lỗi: - FE của các mục 'loại sản phẩm', 'đơn vị tính', 'xưởng sản xuất' bị lỗi hiển thị trong các tab 'thêm sản phẩm' và 'sửa sản phẩm' → ✅ ĐÃ SỬA 09/07 (Task 00)

---

# Phần 4 - Báo giá (`/quotations`) — luồng chính

## 4.1 Luồng cơ bản

* [x] Tạo báo giá mới → chọn khách hàng.
* [x] Thêm sản phẩm: chọn SP000003, nhập thông số → **giá tự tính** từ Pricing Engine (không nhập giá tay được).
* [x] Chiết khấu nhóm khách tự áp theo nhóm của khách.
* [x] Giảm thêm (% hoặc số tiền) → hệ thống **bắt buộc nhập lý do**.
* [x] Sửa dòng (đổi số lượng / thông số) → giá tính lại.
* [x] Xoá dòng.
* [x] Sửa thông tin chung (ngày hết hạn, ghi chú).
Lỗi: - Báo giá có ngày hết hạn, nhưng các báo giá đã duyệt lại không tự động bỏ cảnh báo, mà vẫn lưu lại cảnh báo. TÔi đề xuất các báo giá đã duyệt nên tự chuyển sang tab 'đã duyệt'. Mặc định khi vào tab 'báo giá' thì sẽ hiển thị các báo giá chưa duyệt và các báo giá của ngày hôm đó. Có các bộ lọc để chuyển sang 'đã duyệt', chưa duyệt hoặc lọc theo ngày. → ✅ ĐÃ SỬA 09/07 (Task 03 — cảnh báo quá hạn chỉ áp cho báo giá Nháp/Đã gửi; tabs Chờ xử lý (mặc định)/Đã duyệt/Đã huỷ/Tất cả + lọc khoảng ngày tạo, theo phương án đã chốt 08/07)
- Lỗi hiển thị tên sản phẩm trong tab'chỉnh sửa sản phẩm' → ✅ ĐÃ SỬA 09/07 (Task 00)
Tính năng muốn thêm:
- Ô nhập số điện thoại tìm khách hàng nên trực quan hơn, tôi muốn khi nhập sdt, khách hàng hiển thị theo quá trình nhập luôn, để dễ chọn. Ví dụ: nhập 098 thì lập tức đã xổ ra cửa sổ các khách hàng ở bên dưới. → ✅ ĐÃ LÀM 09/07 (Task 04 — gõ tên/SĐT là dropdown gợi ý hiện ngay, chọn bằng chuột hoặc phím mũi tên + Enter)

## 4.2 Snapshot tên sản phẩm (mới - Task 01)

* [x] Tạo báo giá có SP000003 → sang `/products` đổi tên SP000003 (thêm "XYZ") → quay lại báo giá, F5 → **tên trên báo giá vẫn là tên cũ**.
* [x] Trang in (Tải PDF) cũng giữ tên cũ.
* [x] Đổi tên sản phẩm về như ban đầu sau khi test.

## 4.3 Gửi + In

* [x] "Gửi báo giá" → trạng thái sang **Đã gửi**.
* [x] "Tải PDF" → trang in mở đúng: layout, thông số, tổng tiền, lý do chiết khấu.

## 4.4 Tính lại giá khi đổi version (mới - Task 02, quan trọng nhất)

* [x] Báo giá đang **Đã gửi** → sang SP000003 tạo version giá mới (vd expression cũ `+ 50000`) → **Kích hoạt**.
* [x] Quay lại báo giá → "Khách đã duyệt" → **bị chặn**, hiện hộp cảnh báo vàng liệt kê đúng dòng bị lệch version + nút **"Tính lại giá"**.
* [x] Bấm "Tính lại giá" → hiện **bảng chênh lệch giá cũ / mới** từng dòng (đúng +50.000 ₫).
* [x] "Khách đã duyệt" lần nữa → **thành công**: sinh Đơn hàng + Phiếu sản xuất, badge "Đã tạo đơn hàng".
Lỗi: - Khi khách đã duyệt thì tạo đơn hàng và phiếu sản xuất. Tuy nhiên bên tab sản xuất và tab đơn hàng thì không có gì → ✅ ĐÃ XỬ LÝ 09/07 (không phải lỗi nghiệp vụ — đơn hàng + phiếu SX đã được tạo đúng trong DB; trang web cho 2 module này chưa được xây. Task 06: menu chưa có trang gắn badge "Đang phát triển", không bấm vào được nữa. Xây FE Đơn hàng/Sản xuất theo `workbench/roadmap.md` bước 2-3)
## 4.5 Cấm huỷ báo giá đã duyệt (mới - Task 02)

* [x] Báo giá APPROVED → "Huỷ báo giá" + lý do → **bị chặn** (thông báo hướng dẫn huỷ Đơn hàng).
* [x] "Override" → CANCELLED + lý do → **cũng bị chặn**.

## 4.6 Timeline + các luồng phụ

* [x] Timeline cuối trang đủ sự kiện: Tạo → Gửi → Điều chỉnh thủ công (= lần Tính lại giá) → Khách đã duyệt.
* [x] Huỷ báo giá ở trạng thái Nháp / Đã gửi (chưa duyệt) → thành công, bắt buộc lý do.
* [x] Manual Override đổi trạng thái khác (vd CANCELLED → SENT... tuỳ nghiệp vụ) → ghi Timeline kèm lý do + người thực hiện.
* [x] Báo giá quá hạn (đặt ngày hết hạn trong quá khứ) → hiện badge "Đã quá hạn".

---

# Phần 5 - Ngoài phạm vi test web lần này

Các chức năng sau **chỉ có API**, đã verify tự động 45/45 check ngày 06/07/2026 — sẽ test trên web khi có FE:

* Đơn hàng: ship / deliver / cancel (kể cả **huỷ đơn đã thu cọc** - Task 04), Manual Override.
* Sản xuất: start / complete Phiếu sản xuất, cascade trạng thái.
* Kho: nhập vật tư, xuất kho theo BOM.
* Công nợ: ghi nhận thanh toán, Debt Monitoring, dashboard công nợ.
* Hàng hoàn: tạo Return, **complete Return** (Task 05), Recovery Inventory.
* Dashboard tổng quan.
* Đăng nhập / phân quyền trên FE.

---

# Lỗi phát hiện



---

# Kết luận

* [ ] Đạt — sẵn sàng sang Milestone `002-bao-cao.md`.
* [x] Có lỗi cần sửa (liệt kê ở trên) — lập task sửa lỗi trước khi sang milestone mới.
