# Milestone (Sprint 04) - Mẫu in Phiếu SX riêng cho Xưởng Cửa Lưới

> **Tên file:** `workbench/sprint-04/011-mau-in-xuong-cua-luoi.md`
> **Trạng thái:** ⚠️ THAY ĐỔI SAU KHI USER XEM LẠI — xem `012-hop-nhat-mau-in-xuong.md`. Người dùng bác bỏ cách "không gộp dòng" đề xuất ở đây; component `CuaLuoiOrderContent` đã gộp chung với Cầu Vồng thành `WorkshopOrderContent` (dùng cơ chế gộp `rowSpan` của Cầu Vồng cho cả 2 xưởng).

---

# Bối cảnh

Tiếp nối `010-mau-in-xuong-cau-vong.md`. Người dùng gửi thêm mẫu giấy đang dùng thủ công cho **Xưởng Cửa Lưới** và xác nhận code luôn cho cả 2 xưởng trong 1 lượt.

## Bug đã sửa (19/07/2026)

Bản code đầu dùng mã `XL01`/`XL03` — lấy theo ví dụ minh hoạ trong `production.md` (không phải mã thật). Người dùng báo "in phiếu Cửa Lưới vẫn ra phiếu cũ" — tra trực tiếp DB dev (`ProductionCenter.findMany`) mới phát hiện mã thật hoàn toàn khác:

| Xưởng | Mã thật (DB) | Mã đã dùng nhầm ban đầu |
| --- | --- | --- |
| Xưởng Cầu Vồng | `XW004` | `XL03` |
| Xưởng Cửa Lưới | `XW001` | `XL01` |

Đã sửa cả 2 hằng số (`CAU_VONG_CENTER_CODE`, `CUA_LUOI_CENTER_CODE`) trong `production/print/page.tsx` và cập nhật lại `010-mau-in-xuong-cau-vong.md`. Bài học: ví dụ trong tài liệu `knowledge/modules/*.md` chỉ mang tính minh hoạ, không được dùng làm giá trị thật trong code khi chưa tra lại dữ liệu thật.

So với mẫu Cầu Vồng, ảnh gửi có 2 khác biệt quan sát được:

1. Có thêm dòng phụ đề tên xưởng ("XƯỞNG CỬA LƯỚI") ngay dưới tiêu đề chính "PHIẾU SX - XUẤT KHO".
2. Ô "Tên sản phẩm" **không gộp dòng** theo mã sản phẩm như Cầu Vồng — mỗi dòng hiển thị đầy đủ tên sản phẩm + một dòng mô tả thông số khác Rộng/Cao (ví dụ "KHUNG CÀ PHÊ, CỬA ĐI, 1 CÁNH, HỆ 30").

# Giả định (cần xác nhận nếu sai)

Ảnh mẫu chỉ có 5 dòng thực tế, không đủ để suy ra 100% quy tắc hiển thị dòng mô tả. Đã áp dụng suy luận sau — **cần người dùng xác nhận**:

- Dòng mô tả dưới tên sản phẩm = nối các `SalesOrderItemParameter` **khác** `width`/`height` (ví dụ khung, loại cửa, số cánh, hệ) bằng dấu phẩy, chỉ lấy `value` (không kèm `label`).
- Nếu sản phẩm không có thông số nào khác Rộng/Cao (dòng 5 trong ảnh mẫu, không có dòng mô tả) → hiển thị fallback `(SL bộ)` thay vì để trống hoàn toàn.
- Không gộp dòng theo `productCode` (khác hẳn Cầu Vồng) — vì sản phẩm cửa lưới có thể khác nhau ở nhiều thông số khác ngoài kích thước, gộp an toàn theo `productCode` như Cầu Vồng có thể che mất khác biệt giữa các dòng.
- Dòng phụ đề tên xưởng: chỉ thêm cho mẫu Cửa Lưới (đúng ảnh gửi), **không** thêm ngược lại cho mẫu Cầu Vồng đã code ở `010` (ảnh mẫu Cầu Vồng không có dòng này).
- Không có ô ký tên (giữ nhất quán quyết định đã chốt ở `010`).
- Tên nhà xe/SĐT nhà xe/Ghi chú: để trống như Cầu Vồng (chưa lưu DB).

---

# Thiết kế

## Nhận diện xưởng

`productionCenterCode === 'XW001'` → layout `CuaLuoiOrderContent`. Dùng lại cơ chế `productionCenterCode` đã thêm ở `010` (không cần đổi BE thêm).

## Bố cục

Giống hệt khung 2 khối "Thông tin khách hàng"/"Thông tin giao hàng" và cột bảng của mẫu Cầu Vồng (STT | Tên sản phẩm | RỘNG | CAO | SL | NHÔM | VẢI | ĐÓNG GÓI | GHI CHÚ). Khác 2 điểm nêu trên (phụ đề xưởng + không gộp dòng).

---

# Phạm vi

## Trong phạm vi

- FE: `/production/print/page.tsx` — thêm `CUA_LUOI_CENTER_CODE = "XW001"`, hàm `otherParamsText()`, component `CuaLuoiOrderContent`, nhánh chọn layout theo `productionCenterCode`.

## Ngoài phạm vi

- Không đổi BE (đã đủ field từ `010`).
- Không đổi mẫu Cầu Vồng (`010`) hay mẫu chung (`009`).
- Không thêm field nhà xe vào DB (giữ nguyên phạm vi `010`).

---

# Trình tự thực hiện

- [x] FE: `CuaLuoiOrderContent` + nhánh chọn layout theo `productionCenterCode === 'XW001'`.
- [x] `tsc --noEmit` + `next build` sạch (route `/production/print` build thành công).
- [ ] Người dùng xác nhận lại phần "Giả định" ở trên (đặc biệt quy tắc dòng mô tả + fallback).
- [ ] Verify qua trình duyệt thật (chưa có credential Owner).
