# Milestone (Sprint 04) - Mẫu in Phiếu SX riêng cho Xưởng Cầu Vồng

> **Tên file:** `workbench/sprint-04/010-mau-in-xuong-cau-vong.md`
> **Trạng thái:** ⚠️ MỘT PHẦN ĐÃ THAY ĐỔI — xem `012-hop-nhat-mau-in-xuong.md` (component `CauVongOrderContent` ở đây đã gộp chung với Cửa Lưới thành `WorkshopOrderContent`, giữ nguyên phần thiết kế dữ liệu/nhận diện xưởng).

---

# Bối cảnh

Milestone `009-in-phieu-san-xuat.md` đã code xong mẫu in A5 dùng chung cho mọi xưởng (`/production/print`). Người dùng gửi mẫu giấy thực tế đang dùng thủ công cho riêng **Xưởng Cầu Vồng** (rèm) — khác khá nhiều so với mẫu chung: có cột Rộng/Cao riêng cho từng bộ, gộp nhiều dòng cùng sản phẩm, có cột checklist Nhôm/Vải/Đóng gói, và khối "Thông tin giao hàng" (nhà xe) riêng biệt với khối "Thông tin khách hàng".

Đã trao đổi và chốt các điểm sau:

1. **Phạm vi:** chỉ áp dụng cho Production Order thuộc **Xưởng Cầu Vồng**. Các xưởng khác (Cửa lưới, Bạt) vẫn dùng mẫu chung hiện có ở `009`.
2. **Cột RỘNG / CAO:** bỏ đơn vị trong tiêu đề cột (không ghi "(mm)") — lấy thẳng giá trị `value` đã có trong đơn (`SalesOrderItemParameter` theo `name = 'width'/'height'`), không quy đổi, không thêm hậu tố đơn vị.
3. **Cột Nhôm / Vải / Đóng gói:** chỉ là ô trống dạng checklist cho xưởng tự ghi tay/tick khi làm hàng — không đọc từ bất kỳ dữ liệu nào (không phải BOM/Material).
4. **Tên nhà xe / SĐT nhà xe:** tạm thời để trống trên phiếu in (không lưu DB, không thêm field mới) — không nằm trong phạm vi milestone này. Có thể sẽ lấy từ thông tin khách hàng ở việc sau.

---

# Thiết kế

## Cách nhận diện "Xưởng Cầu Vồng"

`ProductionOrder` chỉ lưu snapshot `productionCenterId`/`productionCenterName`, không có quan hệ tới `ProductionCenter`. Để tránh so khớp fragile theo tên hiển thị, BE sẽ tra thêm `ProductionCenter.code` theo `productionCenterId` khi trả dữ liệu in, trả về thêm field `productionCenterCode`. FE chọn layout Cầu Vồng khi `productionCenterCode === 'XW004'`.

> **Sửa 19/07/2026:** Bản đầu dùng nhầm mã `XL03` (ví dụ minh hoạ trong `production.md`, không phải mã thật). Tra trực tiếp DB dev mới ra mã thật `XW004` (Cầu Vồng) — xem thêm `011-mau-in-xuong-cua-luoi.md` mục sửa lỗi.

Đây là rule đặc thù theo đúng 1 xưởng cụ thể của doanh nghiệp hiện tại — không xây dựng cơ chế "mẫu in cấu hình được" cho N xưởng (chưa có nhu cầu, tránh tối ưu sớm theo mục 12 CLAUDE.md).

## Bố cục phiếu (theo đúng mẫu giấy gửi)

- **Header:** trái — "Mã đơn hàng" (`salesOrder.code`), "Mã phiếu SX" (`productionOrder.code`); phải — "Ngày đặt hàng" (`salesOrder.createdAt`), "Hạn giao hàng" (`salesOrder.expectedDeliveryDate`), "Xưởng" (`productionCenterName`). Tiêu đề "PHIẾU SX - XUẤT KHO".
- **Khối "Thông tin khách hàng":** Tên KH (`deliveryName`), Địa chỉ (ghép `deliveryAddress/Ward/District/Province`), SĐT (`deliveryPhone`). Vẫn đọc `SalesOrder.delivery*`, không đọc `Customer` (đúng nguyên tắc đã chốt ở `009`).
- **Khối "Thông tin giao hàng":** Tên nhà xe / SĐT nhà xe / Ghi chú — 3 dòng để trống, xưởng ghi tay (theo điểm 4 đã chốt).
- **Bảng sản phẩm:** cột STT | Tên sản phẩm | RỘNG | CAO | SL | NHÔM | VẢI | ĐÓNG GÓI | GHI CHÚ.
  - Gộp các dòng cùng `productCode` vào 1 ô "Tên sản phẩm" dùng `rowSpan`, hiển thị `{productName} ({tổng SL} bộ)`.
  - Mỗi dòng con: RỘNG/CAO lấy từ `item.parameters` (`name='width'`/`'height'`), SL = `item.quantity`, NHÔM/VẢI/ĐÓNG GÓI để trống, GHI CHÚ = `item.note`.
  - Dòng "TỔNG CỘNG" = tổng SL toàn bảng.
- **Không hiện giá bán/giá vốn** (giữ nguyên nguyên tắc `production.md`).

## Điểm đã chốt (19/07/2026)

**Không có ô ký tên** cho mẫu Cầu Vồng — khác với mẫu chung `009` (3 ô "Xưởng giao / Tài xế nhận / Khách hàng nhận"). Phiếu Cầu Vồng kết thúc bằng dòng "Lưu ý" in đậm chữ nghiêng, đúng theo mẫu giấy gửi.

---

# Phạm vi

## Trong phạm vi

- BE: `production-order.service.ts` — hàm `print()`/`findOne()` trả thêm `productionCenterCode` (tra từ `ProductionCenter` theo `productionCenterId`) và `salesOrder.createdAt`.
- FE: `/production/print/page.tsx` — thêm nhánh layout riêng khi `productionCenterCode === 'XW004'`, theo đúng bố cục ở trên; giữ nguyên layout cũ cho các xưởng khác.
- Test: cập nhật/thêm test cho `productionCenterCode` trả đúng trong `print()`/`findOne()`.

## Ngoài phạm vi

- Không thêm field nhà xe (tên/SĐT) vào DB.
- Không đọc BOM/Material cho cột Nhôm/Vải/Đóng gói.
- Không xây dựng cơ chế cấu hình mẫu in theo từng xưởng (hard-code 1 nhánh riêng cho XW004).
- Không đổi mẫu chung hiện có của `009` cho các xưởng khác.

---

# Trình tự thực hiện

- [x] BE: thêm `productionCenterCode` (tra `ProductionCenter.code` theo `productionCenterId`) + `salesOrder.createdAt` vào response `findOne()`/`print()`.
- [x] FE: nhánh layout Cầu Vồng (`CauVongOrderContent`) ở `/production/print`, giữ nguyên layout cũ (`GenericOrderContent`) cho xưởng khác. Không có ô ký tên (đã chốt 19/07/2026).
- [x] Test: `production-order.service.spec.ts` — 2 test mới cho `productionCenterCode` (tra đúng theo id, null khi không tìm thấy); mock `productionCenter.findUnique` bổ sung vào toàn bộ suite.
- [x] `tsc --noEmit` (api + web) + `nest build` + `next build` sạch. Route `/production/print` build thành công.
- [ ] Verify qua trình duyệt thật (chưa có credential Owner).
