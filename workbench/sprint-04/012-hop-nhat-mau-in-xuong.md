# Milestone (Sprint 04) - Hợp nhất mẫu in Cầu Vồng + Cửa Lưới, chuyển A5 ngang

> **Tên file:** `workbench/sprint-04/012-hop-nhat-mau-in-xuong.md`
> **Trạng thái:** ✅ ĐÃ CODE — chờ verify qua trình duyệt thật

---

# Bối cảnh

Sau khi code riêng 2 mẫu ở `010` (Cầu Vồng) và `011` (Cửa Lưới), người dùng xem lại và yêu cầu thay đổi để cả 2 xưởng dùng **chung 1 cơ chế**, không giữ 2 layout khác nhau như bản trước. 4 điểm chốt (19/07/2026):

1. Cả 2 phiếu dùng cơ chế gộp dòng theo mã sản phẩm (`rowSpan`, "(N bộ)") — đúng như Cầu Vồng đang làm. Bỏ cách "không gộp, lặp lại mỗi dòng" đã code riêng cho Cửa Lưới ở `011`.
2. Dòng mô tả thông số (khác Rộng/Cao) hiển thị kiểu `"khung Cà phê, Cửa đi, 1 cánh, hệ 30"` — tức từng thông số ghép `label value unit` (bỏ phần nào không có), nối bằng dấu phẩy. Không có thông số nào khác → để trống hẳn (không còn fallback `(SL bộ)` như bản đoán trước).
3. Tiêu đề xưởng sửa theo kiểu Cửa Lưới — có dòng phụ đề tên xưởng dưới tiêu đề chính "PHIẾU SX - XUẤT KHO" (áp dụng cho cả 2 xưởng, không còn cách hiển thị khác nhau giữa 2 mẫu).
4. In khổ giấy A5 **nằm ngang** (210 x 148mm), không phải khổ dọc như mặc định trước đó.

Kết quả: 2 mẫu `010`/`011` giờ **giống hệt nhau về cấu trúc** — gộp lại thành 1 component dùng chung `WorkshopOrderContent`, chỉ khác dữ liệu (`salesOrder`, `productionCenterName`...) theo từng Production Order.

---

# Thiết kế

## Gộp component

Xoá `CauVongOrderContent` + `CuaLuoiOrderContent`, thay bằng 1 component `WorkshopOrderContent` dùng chung cho cả `productionCenterCode === 'XW004'` (Cầu Vồng) và `'XW001'` (Cửa Lưới). Mẫu chung (`GenericOrderContent`, các xưởng khác) không đổi.

## `otherParamsText()` — công thức hiển thị thông số

```ts
function otherParamsText(item) {
  return item.parameters
    .filter(p => p.name !== "width" && p.name !== "height")
    .map(p => {
      const withLabel = p.label ? `${p.label} ${p.value}` : p.value;
      return p.unit ? `${withLabel} ${p.unit}` : withLabel;
    })
    .join(", ");
}
```

Khi gộp dòng theo `productCode` (rowSpan), dòng mô tả này lấy từ **item đầu tiên trong nhóm** (`group.items[0]`) — giả định các dòng cùng mã sản phẩm trong 1 phiếu có thông số khác Rộng/Cao giống nhau. Nếu thực tế không đúng (ví dụ cùng mã nhưng khác khung/màu), cần báo lại — khi đó phải bỏ gộp dòng hoặc tách cách hiển thị khác.

## In A5 nằm ngang

Dùng CSS Paged Media "named page" để chỉ áp dụng ngang cho 2 mẫu xưởng này, không ảnh hưởng mẫu chung (khổ dọc, dùng cho các xưởng khác nếu in gộp chung 1 lần):

```css
@page { size: A5; margin: 10mm 9mm 10mm 9mm; }              /* mẫu chung — dọc */
@page a5-landscape { size: A5 landscape; margin: 8mm 10mm; } /* mẫu xưởng — ngang */
.po-page.a5-landscape { page: a5-landscape; }
```

`div.po-page` của Cầu Vồng/Cửa Lưới nhận thêm class `a5-landscape` và `maxWidth: 700` (thay vì 480) để tận dụng chiều ngang.

---

# Phạm vi

## Trong phạm vi

- FE: `/production/print/page.tsx` — gộp 2 component thành `WorkshopOrderContent`, sửa `otherParamsText()`, thêm CSS named page A5 ngang.

## Ngoài phạm vi

- Không đổi BE.
- Không đổi mẫu chung (`GenericOrderContent`).
- Chưa xử lý trường hợp cùng mã sản phẩm nhưng khác thông số khác Rộng/Cao trong 1 nhóm gộp (xem giả định ở trên).

---

# Trình tự thực hiện

- [x] FE: gộp `CauVongOrderContent` + `CuaLuoiOrderContent` → `WorkshopOrderContent`.
- [x] Sửa `otherParamsText()` theo công thức `label value unit`, bỏ fallback, để trống khi không có thông số.
- [x] CSS `@page a5-landscape` + áp dụng cho 2 mẫu xưởng, giữ mẫu chung khổ dọc.
- [x] `tsc --noEmit` + `next build` sạch.
- [ ] Verify qua trình duyệt thật (chưa có credential Owner) — đặc biệt kiểm tra bản in thực tế có đúng khổ A5 ngang không (phụ thuộc driver máy in/trình duyệt).
