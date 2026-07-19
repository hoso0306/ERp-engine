# Milestone (Sprint 04) - Chỉnh giao diện mẫu phiếu xưởng cho đúng ảnh gốc

> **Tên file:** `workbench/sprint-04/015-giao-dien-mau-phieu-xuong.md`
> **Trạng thái:** ✅ ĐÃ CODE — chờ verify qua trình duyệt thật

---

# Bối cảnh

Người dùng làm rõ: yêu cầu "thiết kế lại đúng 100%" ở lượt trước **chỉ nói về giao diện** (kích cỡ dòng/cột, cỡ chữ) — **không** phải logic gộp dòng hay nguồn dữ liệu. Logic gộp dòng giữ nguyên như `013` (Cầu Vồng gộp theo mã sản phẩm; Cửa Lưới gộp khi khớp cả mã sản phẩm lẫn toàn bộ thông số khác Rộng/Cao) — `014` (đổi Cửa Lưới thành không bao giờ gộp) bị revert.

Đối chiếu lại ảnh phiếu giấy gốc (cả Cầu Vồng lẫn Cửa Lưới), phong cách thực tế khác khá xa bản code trước:

- Toàn bộ viền đậm, màu đen (không phải viền mảnh xám).
- Không có màu navy ở header bảng — nền xám nhạt, chữ đen đậm (giống style của 2 khối "Thông tin khách hàng/giao hàng").
- Cỡ chữ lớn hơn hẳn (dễ đọc khi cầm giấy A5 ở xưởng), nhãn/giá trị đều đậm.
- Dòng "(N bộ)" hiển thị riêng dòng, không kèm mã sản phẩm (ảnh gốc không có dòng mã sản phẩm riêng — chỉ có tên sản phẩm rồi tới "(N bộ)").
- Tiêu đề chính to, đậm hơn; dòng "Xưởng {tên}" ở khối bên trái không cần lặp "Xưởng:" 2 lần theo cách cũ.

---

# Thay đổi

`WorkshopOrderContent` (`production/print/page.tsx`):

- Thêm hằng cục bộ `BORDER = "1.3px solid #1a1a1a"`, dùng thay cho `var(--border)` (viền xám mảnh) ở toàn bộ header bảng, ô bảng, khối thông tin.
- Header bảng sản phẩm: đổi nền từ `var(--navy)` + chữ trắng → nền `#f0f0f0` + chữ đen đậm, viết hoa qua `textTransform`.
- Tăng cỡ chữ toàn bộ: tiêu đề chính 16→22px, phụ đề xưởng 11→14px, nhãn/giá trị header 10.5→12px, khối thông tin 10→12px, bảng sản phẩm 9/9.5→11.5/12px, dòng mô tả phụ 8.5→10.5px, Lưu ý 9→11px.
- Dòng nhóm sản phẩm: bỏ hiển thị `productCode`, chỉ còn `Tên sản phẩm` (đậm) rồi tới dòng riêng `(N bộ)` — luôn hiển thị kể cả nhóm 1 dòng (giữ đúng hành vi gốc, không điều kiện theo số dòng).
- Cột bảng: đổi tên hiển thị viết thường có dấu ("Rộng", "Cao"... — CSS tự viết hoa qua `textTransform: uppercase`), chỉnh lại độ rộng cột cho cân đối khổ A5 ngang (Ghi chú rộng hơn hẳn để có chỗ viết tay).

Không đổi: logic gộp dòng (`groupKeyFor`), nguồn dữ liệu từng field, cơ chế A5 ngang, không ô ký tên.

---

# Phạm vi

## Trong phạm vi

- FE: `/production/print/page.tsx` — chỉnh style trong `WorkshopOrderContent` (không đổi cấu trúc dữ liệu/logic).

## Ngoài phạm vi

- Không đổi `GenericOrderContent` (mẫu chung các xưởng khác).
- Không đổi BE.
- Không đổi logic gộp dòng.

---

# Trình tự thực hiện

- [x] Đổi viền/màu/cỡ chữ trong `WorkshopOrderContent` theo đúng phong cách đen-trắng-đậm của ảnh gốc.
- [x] Bỏ hiển thị mã sản phẩm trong dòng nhóm, chỉ giữ tên sản phẩm + "(N bộ)".
- [x] `tsc --noEmit` + `next build` sạch.
- [ ] Verify qua trình duyệt thật + in thử để so khớp trực quan với ảnh gốc (chưa có credential Owner).
