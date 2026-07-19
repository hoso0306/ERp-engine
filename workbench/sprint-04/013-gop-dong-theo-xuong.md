# Milestone (Sprint 04) - Điều kiện gộp dòng khác nhau theo xưởng

> **Tên file:** `workbench/sprint-04/013-gop-dong-theo-xuong.md`
> **Trạng thái:** ✅ ĐÃ CODE — chờ verify qua trình duyệt thật

---

# Bối cảnh

Sau `012-hop-nhat-mau-in-xuong.md` (2 xưởng dùng chung layout, cùng gộp dòng theo `productCode`), người dùng chốt lại: **điều kiện gộp khác nhau theo xưởng**:

- **Xưởng Cầu Vồng:** chỉ cần cùng mã sản phẩm là gộp (giữ nguyên như `010`/`012`).
- **Xưởng Cửa Lưới:** phải khớp **cả** mã sản phẩm **lẫn** toàn bộ thông số khác Rộng/Cao (loại cửa, số cánh, màu khung...) mới được gộp — 2 dòng cùng mã nhưng khác 1 trong các thông số này thì **không** gộp, hiển thị 2 dòng riêng.

Bố cục hiển thị (rowSpan, tiêu đề phụ đề xưởng, A5 ngang, không ô ký tên) không đổi — chỉ đổi **key gộp**.

---

# Thiết kế

`groupItemsByProduct()` (chỉ nhận `items`, gộp cứng theo `productCode`) đổi thành `groupItems(items, keyFn)` — nhận thêm hàm tính khoá gộp. Thêm `groupKeyFor(productionCenterCode)` trả về đúng `keyFn` theo xưởng:

```ts
function groupKeyFor(productionCenterCode: string | null) {
  if (productionCenterCode === CUA_LUOI_CENTER_CODE) {
    return (item) => `${item.productCode}|${otherParamsText(item)}`;
  }
  return (item) => item.productCode;
}
```

Dùng `otherParamsText(item)` (đã có từ `012`, ghép toàn bộ thông số khác Rộng/Cao thành 1 chuỗi) làm một phần khoá gộp cho Cửa Lưới — tận dụng lại đúng logic đã tính để hiển thị dòng mô tả, không viết thêm quy tắc so khớp riêng. Nhờ vậy dòng mô tả lấy từ `group.items[0]` luôn đúng cho **mọi** dòng trong nhóm (đảm bảo do chính khoá gộp), không còn giả định "các dòng cùng mã chắc giống thông số khác" như bản `012`.

---

# Phạm vi

## Trong phạm vi

- FE: `/production/print/page.tsx` — đổi `groupItemsByProduct` → `groupItems(items, keyFn)`, thêm `groupKeyFor()`, gọi đúng theo `order.productionCenterCode` trong `WorkshopOrderContent`.

## Ngoài phạm vi

- Không đổi bố cục hiển thị, không đổi BE.

---

# Trình tự thực hiện

- [x] Đổi `groupItemsByProduct` → `groupItems(items, keyFn)`.
- [x] Thêm `groupKeyFor(productionCenterCode)` — Cầu Vồng theo `productCode`, Cửa Lưới theo `productCode + otherParamsText`.
- [x] `tsc --noEmit` + `next build` sạch.
- [ ] Verify qua trình duyệt thật (chưa có credential Owner).
