# Milestone (Sprint 04) - Sửa lại: Xưởng Cửa Lưới không bao giờ gộp dòng

> **Tên file:** `workbench/sprint-04/014-sua-lai-mau-cua-luoi.md`
> **Trạng thái:** ❌ ĐÃ REVERT — người dùng xác nhận logic gộp dòng ở `013` là đúng, không đổi. Xem `015-giao-dien-mau-phieu-xuong.md` — ý "thiết kế lại đúng 100%" chỉ nói về giao diện (kích cỡ dòng/cột/chữ), không phải logic gộp/dữ liệu.

---

# Bối cảnh

`013-gop-dong-theo-xuong.md` code theo lời mô tả của người dùng: Cửa Lưới gộp dòng khi khớp cả mã sản phẩm lẫn toàn bộ thông số khác Rộng/Cao. Người dùng gửi lại đúng ảnh phiếu giấy thật (RÈM G002, đơn G002, phiếu CL-000165) và yêu cầu xem kỹ, thiết kế lại đúng 100%.

Đối chiếu kỹ ảnh: **5 dòng RÈM G002, trong đó dòng 1-4 giống hệt nhau tuyệt đối** (cùng mã, cùng "KHUNG CÀ PHÊ, CỬA ĐI, 1 CÁNH, HỆ 30", cùng Rộng 2475/Cao 3115) — nhưng phiếu **vẫn hiện riêng 4 dòng**, không gộp. Vậy quy tắc đúng của Cửa Lưới là: **không bao giờ gộp dòng**, bất kể có trùng khớp hay không. Yêu cầu ở `013` ("khớp cả mã + thông số mới gộp") trên thực tế không bao giờ xảy ra trên phiếu thật — sửa lại cho khớp ảnh 100% thay vì giữ đúng câu chữ mô tả trước đó.

(Dòng 5 hiện "(1 bộ)" thay vì dòng thông số — đây không phải fallback tôi tự thêm, mà do chính dòng đó không có `SalesOrderItemParameter` nào khác Rộng/Cao, hoặc có 1 thông số mà giá trị/label ghép ra đúng chữ "1 bộ". `otherParamsText()` không có logic đặc cách, cứ hiển thị đúng dữ liệu thật — nếu trống thì để trống theo đúng chốt ở lượt trước.)

---

# Thiết kế

Đổi `groupKeyFor()`: nhánh Cửa Lưới trả về `(item) => item.id` — mỗi dòng luôn là 1 nhóm riêng (rowSpan luôn = 1), tương đương không gộp. Nhánh Cầu Vồng giữ nguyên (`productCode`).

```ts
function groupKeyFor(productionCenterCode) {
  if (productionCenterCode === CUA_LUOI_CENTER_CODE) {
    return (item) => item.id; // không bao giờ gộp
  }
  return (item) => item.productCode; // Cầu Vồng
}
```

Không đổi gì khác (bố cục, `otherParamsText()`, header, A5 ngang giữ nguyên từ `012`).

---

# Phạm vi

## Trong phạm vi

- FE: `/production/print/page.tsx` — sửa `groupKeyFor()` nhánh Cửa Lưới.

## Ngoài phạm vi

- Không đổi BE, không đổi Cầu Vồng, không đổi bố cục.

---

# Trình tự thực hiện

- [x] Sửa `groupKeyFor()` — Cửa Lưới dùng `item.id` làm khoá (không gộp).
- [x] `tsc --noEmit` + `next build` sạch.
- [ ] Verify qua trình duyệt thật (chưa có credential Owner) — đối chiếu trực tiếp với ảnh phiếu CL-000165 người dùng gửi.
