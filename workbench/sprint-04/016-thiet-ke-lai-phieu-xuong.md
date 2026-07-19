# Milestone (Sprint 04) - Thiết kế lại toàn bộ phiếu xưởng theo tư duy phiếu giấy

> **Tên file:** `workbench/sprint-04/016-thiet-ke-lai-phieu-xuong.md`
> **Trạng thái:** ✅ ĐÃ CODE — build/typecheck sạch, **chưa verify trực quan qua trình duyệt** (xem `017`)

---

# Bối cảnh

Người dùng yêu cầu thiết kế lại toàn bộ giao diện phiếu xưởng (Cầu Vồng + Cửa Lưới), không dừng ở chỉnh màu/viền như `015`. Yêu cầu chi tiết (nguyên văn rút gọn):

1. Không dựng cả phiếu bằng 1 bảng HTML — chỉ phần bảng sản phẩm mới dùng `<table>`.
2. Tư duy phiếu sản xuất xưởng, ưu tiên tốc độ đọc của công nhân.
3. Bố cục: Header ~12-15% chiều cao, bảng sản phẩm ~70%, footer rất nhỏ.
4. Header: giữa là tiêu đề rất lớn + phụ đề nhỏ hơn ~50%; trái/phải là thông tin tra cứu (rất nhỏ); cân đối.
5. 2 khung thông tin: Tên KH / Tên nhà xe là điểm nhấn lớn nhất (18-22px), còn lại nhỏ hơn.
6. Bảng: Tên sản phẩm rộng nhất (~38-40%), Rộng/Cao/SL vừa đủ, Nhôm/Vải/Đóng gói không quá rộng.
7. Rộng/Cao: số phải rất lớn, to hơn cột khác ~30%, header chỉ ghi "RỘNG"/"CAO" không kèm đơn vị.
8. Gộp dòng: chỉ merge (rowSpan) cột Tên sản phẩm; STT/Rộng/Cao/SL vẫn hiển thị riêng từng dòng (không đổi logic gộp đã chốt ở `013`).
9. Tên sản phẩm: không in cả đoạn cấu hình dài — chỉ tên/mã (đậm) + mô tả ngắn 1 dòng, tối đa 2 dòng.
10. Phong cách: giống phiếu in laser xưởng, không giống website — không card, không bo góc, không đổ bóng, đường kẻ mảnh, phân cấp rõ, khoảng trắng đều, đọc được kích thước + tên khách từ 1-2 mét.

---

# Thiết kế

## Cấu trúc DOM (không còn "1 bảng HTML")

`WorkshopOrderContent` giờ là 1 `<div>` flex-column gồm 4 khối rõ ràng — chỉ khối (3) là bảng:

1. Header (`display:grid`, 3 cột `1fr 2fr 1fr` — trái/giữa/phải cân đối tuyệt đối).
2. 2 khung thông tin (`display:flex`, 2 khối bằng nhau).
3. `<table>` sản phẩm — duy nhất phần dùng bảng.
4. Footer (dòng "Lưu ý", rất nhỏ).

Không set cứng chiều cao pixel theo đúng tỷ lệ 12/70/18% — vì số dòng sản phẩm biến động theo từng phiếu, khoá cứng chiều cao dễ làm bảng bị cắt mất dữ liệu khi phiếu nhiều dòng. Thay vào đó dùng `flex: 1` cho bảng (chiếm hết phần còn lại) và padding/cỡ chữ đủ lớn ở header để tạo đúng **cảm giác tỷ lệ** như yêu cầu, ưu tiên an toàn dữ liệu hơn tỷ lệ pixel tuyệt đối.

## Phân cấp cỡ chữ (font hierarchy)

| Thành phần | Cỡ chữ | Đậm |
|---|---|---|
| Tiêu đề "PHIẾU SX - XUẤT KHO" | 30px | 800 |
| Phụ đề tên xưởng | 15px (đúng 50% tiêu đề) | 700 |
| Mã đơn hàng/phiếu SX, ngày tháng (trái/phải header) | 9px, màu `#555` | thường |
| Tên KH | 20px | 800 |
| Địa chỉ/SĐT khách hàng | 11px | thường |
| Tên nhà xe | 16px | 700 |
| SĐT/Ghi chú nhà xe | 11px | thường |
| Nhãn khung ("Thông tin khách hàng"...) | 9px, uppercase | 700 |
| Header cột bảng | 10px, uppercase | 700 |
| Ô Rộng/Cao | 15px (~36% lớn hơn 11px) | 800 |
| Ô thường (STT/SL/Nhôm/Vải/Đóng gói) | 11px | — |
| Tên sản phẩm (dòng 1) | 13px | 700 |
| Mô tả ngắn (dòng 2, tối đa 1 dòng — `white-space: nowrap` + `text-overflow: ellipsis`) | 10px | thường |
| Footer "Lưu ý" | 8px, in nghiêng | — |

## Bảng sản phẩm

- Dùng `<colgroup>` set width theo `%`: STT 5, Tên sản phẩm 39, Rộng 11, Cao 11, SL 6, Nhôm 6, Vải 6, Đóng gói 7, Ghi chú 9.
- Header chỉ ghi "Rộng"/"Cao" (CSS `textTransform: uppercase` tự viết hoa), không có "(mm)".
- Gộp dòng: giữ nguyên đúng `013` — chỉ ô Tên sản phẩm dùng `rowSpan`; STT/Rộng/Cao/SL luôn hiển thị theo từng dòng riêng (khớp ví dụ người dùng đưa).
- Bỏ hiển thị `productCode` và `(N bộ)` trong ô Tên sản phẩm (yêu cầu #9: chỉ tên/mã + mô tả ngắn, tối đa 2 dòng) — khác với `015` (từng có dòng "(N bộ)" riêng).

## Style tổng thể

- Viền mảnh `0.75px solid #000` (đổi từ `1.3px` ở `015` — "đường kẻ mảnh" theo đúng yêu cầu mới, KHÔNG phải viền đậm).
- Không `border-radius`, không `box-shadow` ở bất kỳ đâu.
- Nhãn khung dùng viền dưới mảnh phân cách, không dùng nền xám đầy (tránh cảm giác "card").

## Bug tiện thể phát hiện + fix trong lượt này

Khi tra dữ liệu thật để chuẩn bị xem trước, phát hiện tên tham số Rộng/Cao thật trong DB là `chieurong`/`chieucao`, không phải `width`/`height` — xem chi tiết và fix ở `017-fix-ten-tham-so-kich-thuoc.md`.

---

# Phạm vi

## Trong phạm vi

- FE: viết lại toàn bộ `WorkshopOrderContent` trong `/production/print/page.tsx`.
- FE: outer wrapper (`po-page`) đổi sang width `190mm` (thay vì `maxWidth` px) cho 2 mẫu xưởng, khớp khổ A5 ngang.

## Ngoài phạm vi

- Không đổi `GenericOrderContent` (mẫu chung).
- Không đổi BE.
- Không đổi logic gộp dòng (`groupKeyFor`, giữ nguyên `013`).
- Không khoá cứng tỷ lệ chiều cao 12/70/18% bằng pixel/mm tuyệt đối (đánh đổi lấy an toàn không cắt dữ liệu khi nhiều dòng sản phẩm).

---

# Trình tự thực hiện

- [x] Viết lại `WorkshopOrderContent`: header grid 3 cột, 2 khung thông tin, bảng `<colgroup>`, footer nhỏ.
- [x] Phân cấp cỡ chữ theo bảng trên.
- [x] Đổi viền đậm → viền mảnh.
- [x] Bỏ `productCode`/`(N bộ)` khỏi ô Tên sản phẩm, giới hạn mô tả 1 dòng bằng `ellipsis`.
- [x] `tsc --noEmit` + `next build` sạch.
- [ ] Verify trực quan qua trình duyệt thật (chưa thực hiện được — môi trường không có công cụ chụp ảnh màn hình; xem `017`). Người dùng cần tự mở thử `/production/print?ids=...` với PO thật.
