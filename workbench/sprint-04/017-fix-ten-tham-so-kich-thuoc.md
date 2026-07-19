# Milestone (Sprint 04) - Fix: sai tên tham số Rộng/Cao (width/height → chieurong/chieucao)

> **Tên file:** `workbench/sprint-04/017-fix-ten-tham-so-kich-thuoc.md`
> **Trạng thái:** ✅ ĐÃ FIX — bug nghiêm trọng, phát hiện khi tra DB thật để chuẩn bị verify giao diện

---

# Bối cảnh

Trong lúc chuẩn bị xem trước giao diện mẫu phiếu xưởng (`016`) bằng dữ liệu thật, tra trực tiếp `SalesOrderItemParameter` của 1 Production Order thật (Xưởng Cửa Lưới, sản phẩm `SP000036`) thì phát hiện: tên tham số thật trong DB là **`chieurong`/`chieucao`** — không phải `width`/`height` như code đã dùng từ `010` đến `016`.

Tra tiếp toàn bộ `ProductParameter` có liên quan tới kích thước trên **mọi Product hiện có** (cả nhóm Cửa Lưới lẫn nhóm Rèm ở Cầu Vồng — SP000036 đến SP000055): **100% đều dùng `chieurong`/`chieucao`**, không có sản phẩm nào dùng `width`/`height`. Đây là quy ước tên tham số thật của toàn bộ dữ liệu đang chạy — ví dụ `width`/`height` ở `knowledge/modules/product.md` chỉ là minh hoạ, không phản ánh dữ liệu thật (giống lỗi mã xưởng `XL01/XL03` đã gặp ở `010`/`011`).

**Hậu quả trước khi fix:** cột RỘNG/CAO trên cả mẫu Cầu Vồng lẫn Cửa Lưới hiển thị "—" (không tìm thấy tham số) với mọi phiếu thật — bug tồn tại xuyên suốt từ `010` đến `016` mà không ai phát hiện vì trước giờ chỉ kiểm bằng `tsc`/`next build` (không lỗi biên dịch) chứ chưa từng chạy thử với dữ liệu thật.

---

# Thay đổi

`production/print/page.tsx`:

```ts
const WIDTH_PARAM_NAME = "chieurong";
const HEIGHT_PARAM_NAME = "chieucao";
```

Thay toàn bộ chỗ dùng chuỗi `"width"`/`"height"` (trong `paramValue()` gọi ở bảng sản phẩm, và trong điều kiện lọc của `otherParamsText()`) bằng 2 hằng số trên.

---

# Bài học

Trước khi tin bất kỳ tên field/code/tham số nào lấy từ tài liệu minh hoạ trong `knowledge/`, **phải tra thẳng dữ liệu thật** (DB dev) — không suy đoán theo ví dụ trong doc. Đã áp dụng đúng nguyên tắc này khi tra mã xưởng ở `010`/`011`, nhưng bị bỏ sót ở tên tham số kích thước — cần rút kinh nghiệm áp dụng nhất quán cho MỌI field liên quan tới dữ liệu nghiệp vụ thật, không chỉ riêng những chỗ đã từng bị lỗi.

---

# Phạm vi

## Trong phạm vi
- FE: sửa `paramValue()` calls + filter trong `otherParamsText()`.

## Ngoài phạm vi
- Không đổi BE, không đổi `knowledge/modules/product.md` (ví dụ minh hoạ giữ nguyên, không phải bug tài liệu — chỉ là code đã hiểu nhầm ví dụ thành giá trị thật).

---

# Trình tự thực hiện

- [x] Tra `SalesOrderItemParameter` + `ProductParameter` thật trong DB dev, xác nhận tên chuẩn `chieurong`/`chieucao`.
- [x] Sửa `paramValue()`/`otherParamsText()` dùng đúng tên tham số.
- [x] `tsc --noEmit` + `next build` sạch.
- [ ] Verify qua trình duyệt thật — **không thực hiện được trong phiên này**: môi trường không có công cụ chụp ảnh màn hình trình duyệt (không có `chromium-cli`/Playwright cài sẵn). Đã tạo JWT hợp lệ (ký bằng đúng `JWT_SECRET` cho user `owner@erp.local`) để test nhưng chưa render được ảnh chụp. Cần người dùng tự mở `/production/print?ids=<PO thật>` để xác nhận trực quan.
