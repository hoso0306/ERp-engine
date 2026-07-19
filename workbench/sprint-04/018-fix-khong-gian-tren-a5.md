# Milestone (Sprint 04) - Verify thật bằng Playwright: fix khổ giấy + phát hiện bug sidebar

> **Tên file:** `workbench/sprint-04/018-fix-khong-gian-tren-a5.md`
> **Trạng thái:** ✅ ĐÃ FIX TOÀN BỘ — verify lại bằng `page.pdf()` thật xác nhận cả 3 lỗi + bug sidebar đều đã đúng

---

# Bối cảnh

Môi trường không có `chromium-cli`/Playwright cài sẵn để verify trực quan (đã ghi ở `016`/`017`). Đã tự cài Playwright tạm vào thư mục scratchpad (không đụng tới `package.json` của dự án), tạo JWT hợp lệ ký bằng đúng `JWT_SECRET` cho user `owner@erp.local` (không đổi mật khẩu/tạo user mới), rồi dùng `page.pdf()` (mô phỏng đúng pipeline in thật của Chromium, khác `window.print()` chỉ ở chỗ không cần mở dialog) để kiểm tra kết quả in thật của `/production/print` với Production Order thật (Xưởng Cửa Lưới, PO000010).

Phát hiện 2 vấn đề:

## 1. Bug của tôi — CSS "named page" không hoạt động (đã fix)

`012` dùng `@page a5-landscape { size: A5 landscape; ... } .po-page.a5-landscape { page: a5-landscape; }` để chỉ áp khổ ngang riêng cho mẫu xưởng, giữ khổ dọc cho mẫu chung. Test bằng Playwright (Chromium thật) thì cơ chế này **không hoạt động** — toàn bộ vẫn ra khổ Letter dọc mặc định dù đã thử cả `preferCSSPageSize: true`.

**Đã fix:** bỏ named page, tính **1 khổ giấy duy nhất cho cả lượt in** ngay trong component `ProductionOrderPrintContent`, dựa theo danh sách phiếu đang in: có ít nhất 1 phiếu thuộc mẫu xưởng (Cầu Vồng/Cửa Lưới) → cả lượt in dùng A5 ngang; ngược lại giữ A5 dọc như mẫu chung.

```ts
const anyWorkshopTicket = orders.some(o => o.productionCenterCode === CAU_VONG... || ... CUA_LUOI...);
const pageCss = anyWorkshopTicket
  ? "@page { size: A5 landscape; margin: 8mm 10mm; }"
  : "@page { size: A5; margin: 10mm 9mm 10mm 9mm; }";
```

**Đánh đổi đã biết:** in gộp trong CÙNG 1 lượt vừa có phiếu mẫu xưởng vừa có phiếu xưởng khác (mẫu chung) sẽ dùng chung 1 khổ giấy (ưu tiên ngang nếu có ít nhất 1 phiếu mẫu xưởng) — không tách khổ theo từng trang được vì browser không hỗ trợ đáng tin cậy. Verify lại bằng Playwright sau khi sửa: **khổ giấy đã ra đúng A5 ngang** (PDF chỉ còn 1 trang, chiều ngang > chiều dọc).

## 2. Bug hệ thống có sẵn — Sidebar/Header luôn xuất hiện khi in (ĐÃ FIX, người dùng xác nhận sửa luôn)

Khi in thật (`page.pdf()`), **toàn bộ sidebar điều hướng + header của app vẫn xuất hiện trên giấy in**, chiếm phần lớn chiều ngang khổ A5 — đẩy nội dung phiếu bị cắt mất bên phải (ví dụ cột "GHI CHÚ" bị cắt còn "GHI CH", "Hạn giao hàng" bị cắt mất giá trị).

**Nguyên nhân:** `AppLayout` (`apps/web/src/components/layout/app-layout.tsx`) chỉ bỏ qua sidebar cho đúng 1 route `/login`:

```tsx
if (pathname === "/login") {
  return <>{children}</>;
}
```

Không có ngoại lệ cho bất kỳ route `/print` nào. Toàn bộ CSS `@media print` hiện có (cả ở `production/print/page.tsx` lẫn `quotations/[id]/print/page.tsx`) chỉ ẩn `.no-print` (2 nút "In/Tải PDF", "Đóng") — không có rule nào ẩn `AppSidebar`/`Header` khi in, vì 2 component đó nằm ngoài phạm vi `<style>` của từng trang.

**Đây là bug có từ trước** (ảnh hưởng cả `/quotations/[id]/print` đã code ở milestone khác từ trước, không phải do `009`-`018` gây ra), nhưng **chỉ vừa lộ ra** vì lần đầu tiên có người verify bằng in thật (`page.pdf()`) thay vì chỉ đọc code/build. Về bản chất: tính năng "in phiếu" (cả báo giá lẫn sản xuất) hiện KHÔNG in ra được bản sạch — luôn kèm sidebar, khiến nội dung bị lệch/cắt.

**Đã fix (người dùng xác nhận sửa luôn** — ngoài phạm vi ban đầu "thiết kế lại phiếu xưởng" nhưng chặn cả tính năng in nên cần sửa ngay):

```tsx
// apps/web/src/components/layout/app-layout.tsx
if (pathname === "/login" || pathname.endsWith("/print")) {
  return <>{children}</>;
}
```

Đơn giản, nhất quán với cách `/login` đã làm, sửa được cho cả 2 tính năng in (báo giá + sản xuất) cùng lúc.

**Verify lại bằng `page.pdf()` sau khi sửa:** sidebar đã biến mất hoàn toàn, phiếu Cửa Lưới (PO000010) hiện đúng 1 trang A5 ngang, đầy đủ không bị cắt chữ — header cân đối, RỘNG/CAO hiện đúng số liệu thật (0.63/1.520, 0.44/1.38, 1.27/0.53), 3 dòng gộp đúng vì cùng mã sản phẩm + cùng thông số khác (loại cửa/số cánh/màu khung giống hệt nhau ở dữ liệu test này).

**Lưu ý hiển thị số (không phải bug):** Rộng/Cao hiện đúng nguyên giá trị mét đã lưu (`0.63`, `1.520`...), không quy đổi ra mm — đúng theo yêu cầu đã chốt trước đó ("bỏ đơn vị, lấy số liệu trong đơn hàng thôi"), chỉ khác cách trình bày so với ảnh mẫu giấy gốc (dùng số mm nguyên như "2475"). Nếu muốn hiển thị dạng mm, cần một quyết định riêng (nhân 1000 + làm tròn) — chưa làm vì đã chốt rõ ràng ở lượt trước.

---

# Cách verify (ghi lại để tái sử dụng)

- JWT hợp lệ tạo bằng `jsonwebtoken`, ký với đúng `JWT_SECRET` trong `apps/api/.env`, payload `{ sub: <User.id>, roleId: <User.roleId> }` — set vào cookie `erp_token` (tên cookie tra ở `apps/web/src/lib/auth-constants.ts`) qua `context.addCookies()` của Playwright. Không tạo/sửa user thật, không cần mật khẩu.
- Playwright cài tạm ở thư mục scratchpad (`npm install playwright` — KHÔNG phải devDependency của repo), browser Chromium đã có sẵn ở `C:\Users\hi\AppData\Local\ms-playwright`.
- Dùng `page.pdf({ printBackground: true, preferCSSPageSize: true })` để mô phỏng đúng pipeline in thật (khác `page.screenshot()` — không áp dụng `@page`).

---

# Phạm vi

## Trong phạm vi

- FE: `/production/print/page.tsx` — sửa cơ chế tính khổ giấy (bỏ named page, tính 1 khổ chung cho cả lượt in).
- FE: `app-layout.tsx` — bỏ sidebar/header cho mọi route `/print` (người dùng xác nhận mở rộng phạm vi vì chặn cả tính năng in).

## Ngoài phạm vi

- Không đổi cách hiển thị số Rộng/Cao (giữ nguyên mét, không quy đổi mm) — đã chốt ở lượt trước.

---

# Trình tự thực hiện

- [x] Cài Playwright tạm, tạo JWT hợp lệ, verify bằng `page.pdf()` với PO thật.
- [x] Phát hiện + fix bug named-page không hoạt động.
- [x] Phát hiện + fix bug sidebar luôn hiện khi in (`app-layout.tsx`).
- [x] `tsc --noEmit` + `next build` sạch.
- [x] Verify lại bằng `page.pdf()` sau khi fix sidebar — phiếu ra đúng 1 trang A5 ngang, không cắt chữ, dữ liệu Rộng/Cao đúng, gộp dòng đúng logic.
