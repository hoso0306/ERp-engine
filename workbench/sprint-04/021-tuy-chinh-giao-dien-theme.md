# 021 — Tuỳ chỉnh giao diện (theme, màu sắc, tương phản)

Ngày thực hiện: 20/07/2026.

**Trạng thái:** Code xong, tự verify qua `next build` + đọc CSS đã build + screenshot (Playwright headless) ở từng bước. **Chưa commit/chưa deploy VPS** tại thời điểm ghi tài liệu này — người dùng tự commit/push.

## 1. Quá trình chọn theme

Thử lần lượt nhiều theme lấy từ tweakcn.com và ui.shadcn.com/create (qua registry JSON / chạy CLI trong thư mục tạm để trích xuất, không đụng vào dự án thật khi thử):

1. Future Teal (tweakcn)
2. AstroVista (tweakcn) — **chốt làm nền chính thức**
3. kedokteran (tweakcn)
4. Preset `b1tgXouZc` (ui.shadcn.com/create) — style Luma, tông ocean blue
5. Preset `b2D0x7gRM` (ui.shadcn.com/create) — tông teal/emerald

Sau khi chốt AstroVista, tuỳ biến thủ công từng phần theo phản hồi trực tiếp — không dùng nguyên bản theme nào ở trên nữa.

## 2. Bảng màu cuối cùng (`apps/web/src/app/globals.css`)

| Token | Giá trị | Ghi chú |
|---|---|---|
| `--primary` / `--ring` | `oklch(0.4544 0.1028 241.4653)` (`#0a5c8a`) | Navy đậm — màu chủ đạo (nút, focus ring, logo badge) |
| `--secondary` | `oklch(0.9100 0.0350 241.4653)` (`#cee5f7`) | Navy **nhạt nhất** — dùng cho badge trạng thái phụ (Thấp/Ngừng...) và track Tabs. Trước đó bị set đậm hơn cả primary (ngược logic), đã sửa lại. |
| `--background` | `oklch(0.9800 0.0020 236.4993)` (`#f7f9fa`) | Nhạt, gần trắng |
| `--muted` | `oklch(0.9300 0.0017 247.8389)` (`#e7e8e9`) | Tăng độ tương phản so với background (trước bị sáng hơn cả background) |
| `--input` (viền Input/Select) | `oklch(0.7500 0.0029 264.5420)` (`#adaeb0`) | Trước quá nhạt gần như vô hình (`#f4f5f7`), đã tăng độ đậm |
| `--chart-1..5` | Navy → xanh lá → vàng → tím → cam đỏ | chart-1 đồng bộ tông navy với primary; cố định thứ tự cho biểu đồ Report (Task 07) |
| `--sidebar` | `oklch(0.3563 0.0649 246.0157)` (`#1c3f5c`) | Nền sidebar navy, cố định (không đổi theo light/dark mode nội dung chính) |
| `--sidebar-accent` / `--sidebar-primary` / `--sidebar-ring` | `= --primary` (`#0a5c8a`) | Mục hover/đang chọn trong sidebar — trước cùng tông tối với nền nên không thấy, đã tách rõ |
| `--radius` | `0.5rem` | |
| Shadow, tracking, spacing | Giữ theo bản AstroVista gốc | Không tuỳ biến thêm |

**Font** (`apps/web/src/app/layout.tsx`): đồng bộ với bản đang chạy thật trên VPS (`kynangai.cloud`) — **Inter** (sans) + **Geist Mono** (mono), không dùng font serif.

## 3. Component/behavior đã sửa

- **`components/ui/tabs.tsx`**: track mặc định `bg-muted` (xám, gần vô hình) → `bg-secondary` (navy nhạt) — áp dụng cho mọi Tabs trong app.
- **`components/ui/table.tsx`**: hover dòng bảng `hover:bg-muted/50` (trắng, khó thấy) → `hover:bg-primary/10` (navy nhạt) — áp dụng cho mọi bảng dữ liệu.
- **`app/page.tsx`** (trang chủ): hover ô module `hover:bg-muted/50` → `hover:border-primary hover:bg-primary/10 hover:text-primary`.
- **`components/layout/app-layout.tsx`**:
  - `SidebarProvider defaultOpen={false}` — sidebar mặc định thu gọn (icon-only).
  - Watermark logo (trước chỉ có ở trang chủ) chuyển lên `<main>` dùng chung — hiển thị mờ phía sau nội dung ở **mọi tab**, không riêng trang chủ.
- **Badge `variant="secondary"`** (16 vị trí trong app: Ngừng/Ngừng bán/Ngừng dùng, ưu tiên Thấp, tag loại tham số...): tự động đổi màu theo token `--secondary` đã sửa ở mục 2, không cần sửa từng file.

## 4. Đã kiểm tra, không cần sửa

- Đăng nhập mặc định về trang chủ (`/`): code đã đúng sẵn từ trước (`login/page.tsx` push `/` khi không có `redirect` param). `proxy.ts` chỉ gắn `redirect=<trang cũ>` khi bị văng do hết phiên — cố ý giữ để quay lại đúng chỗ đang thao tác dở, không phải bug.

## File chính đã sửa

`apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/components/layout/app-layout.tsx`, `apps/web/src/components/ui/table.tsx`, `apps/web/src/components/ui/tabs.tsx`.

## Lưu ý cho lần sau

- Mỗi lần đổi `globals.css`/`layout.tsx` khi đang chạy `next dev` xen kẽ với `next build` (để verify) dễ khiến dev server phục vụ CSS cache cũ — phải xoá `.next` và khởi động lại dev server sạch sau khi build.
- Không có quyền SSH VPS lẫn thông tin đăng nhập DB local (mật khẩu Owner chỉ hiện 1 lần lúc seed) — mọi xác nhận trực quan trong phiên này làm qua: screenshot trang `/login` (không cần đăng nhập), preview HTML độc lập dựng từ đúng giá trị CSS đang dùng, và đọc trực tiếp giá trị CSS đã build qua `curl`.
