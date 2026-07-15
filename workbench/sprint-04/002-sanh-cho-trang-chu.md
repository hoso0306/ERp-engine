# Milestone (Sprint 04) - Sảnh chờ (Trang chủ theo quyền)

> **Tên file:** `workbench/sprint-04/002-sanh-cho-trang-chu.md`
> **Trạng thái:** ĐÃ CODE XONG — chờ review/xác nhận, `tsc --noEmit` sạch. Chưa test UI qua Playwright (môi trường hiện tại không có tool trình duyệt) — cần người dùng tự kiểm tra thủ công theo mục Test bên dưới.

---

# Bối cảnh

Phát hiện khi test thật: breadcrumb "Dashboard" ở đầu mọi trang **hardcode link về "/"** cho mọi user, không kiểm tra quyền (`page-breadcrumb.tsx`). Trong khi đó sidebar đã đúng khi ẩn mục "Dashboard" cho role thiếu `dashboard.view` (vd role ACCOUNTANT — chỉ có `debt.*` + `settings.view`).

Kiểm tra thêm ở BE: **toàn bộ 6 endpoint của `dashboard.controller.ts`** (`overview`, `sales`, `production`, `warehouse`, `debt`, `returns`, `alerts`) đều `@RequirePermission('dashboard.view')` ở mức controller — không phải chỉ ẩn từng phần dữ liệu. Nghĩa là user thiếu quyền này mà bấm breadcrumb "Dashboard" sẽ vào "/" và nhận **lỗi 403 thật** (trang lỗi), không phải chỉ thấy Dashboard rỗng. Đây là bug thật, không phải giả định.

**Quyết định:** thay vì vá riêng breadcrumb, tách hẳn khái niệm "trang gốc" khỏi "Dashboard" — đường dẫn `/` trở thành **Sảnh chờ**: lưới icon các tính năng mà user đang đăng nhập CÓ QUYỀN truy cập, dùng lại đúng cơ chế lọc quyền đã có sẵn ở `config/navigation.ts` (field `requiredPermission` mỗi mục) + `app-sidebar.tsx` (logic lọc `!item.requiredPermission || hasPermission(item.requiredPermission)`). Dashboard (trang phân tích KPI hiện tại) chuyển thành route riêng `/dashboard`, giữ nguyên toàn bộ logic/permission cũ, không đổi gì ở Backend.

## Quyết định đã chốt (qua trao đổi)

1. Nhãn hiển thị ở breadcrumb/tiêu đề cho trang gốc "/": **"Trang chủ"** (khái niệm nội bộ vẫn gọi Sảnh chờ/Lobby).
2. Lưới icon **nhóm theo group** giống sidebar (Điều hành/Kinh doanh/Vận hành/Danh mục/Hệ thống) — giữ tư duy người dùng đã quen.
3. Ô "Dashboard" (nay ở `/dashboard`) **hiển thị bình thường** trong lưới như mọi tính năng khác, không đặc cách — ai có `dashboard.view` thì thấy.

---

# Việc làm

## 1. Di chuyển Dashboard sang route riêng ✅

- Di chuyển nguyên vẹn nội dung `src/app/page.tsx` (Dashboard hiện tại) → `src/app/dashboard/page.tsx`. Không đổi logic bên trong (vẫn gọi đúng các API `/dashboard/*` như cũ).
- `src/config/navigation.ts`: đổi `href` của mục "Dashboard" từ `"/"` → `"/dashboard"`.

## 2. Tạo trang Sảnh chờ mới tại "/" ✅

`src/app/page.tsx` (file mới, thay thế Dashboard cũ đã di chuyển):

- Đọc `navigation` từ `config/navigation.ts`, lọc từng `group.items` bằng đúng logic đã có ở `app-sidebar.tsx`: `!item.requiredPermission || hasPermission(item.requiredPermission)`. Bỏ qua group nào lọc xong rỗng (giống sidebar).
- Hiển thị dạng lưới, nhóm theo `group.label`, mỗi ô: icon (`item.icon`), tên (`item.title`), bấm vào điều hướng `item.href`.
- Mục có `item.disabled` (vd "Báo cáo"): hiển thị mờ + badge "Đang phát triển", không cho bấm — đồng bộ với cách sidebar đang xử lý, không tạo quy tắc mới.
- Dựng bằng div/Tailwind theo phong cách `rounded-lg border` đã dùng khắp app (không có sẵn component `Card` trong `ui/`, không thêm thư viện mới).
- Edge case: user lọc ra 0 mục nào ở mọi group (permission rỗng hoàn toàn) — hiển thị `EmptyState` có sẵn (`@/components/shared`) kèm thông báo rõ (vd "Tài khoản của bạn chưa được cấp quyền truy cập tính năng nào — liên hệ Owner/Admin"), không để trắng trang.

## 3. Cập nhật các chỗ đang ngầm định "/" = Dashboard ✅

- `src/components/layout/header.tsx`: điều kiện `pathname === "/"` đang hiển thị tiêu đề cứng "Dashboard" → đổi thành "Trang chủ".
- `src/components/shared/page-breadcrumb.tsx`: label "Dashboard" (luôn hiển thị ở breadcrumb mọi trang con, link về "/") → đổi thành "Trang chủ". Logic `getPageTitle()` tự nhận đúng "Dashboard" cho `/dashboard` sau khi cập nhật `navigation.ts` ở mục 1 — không cần sửa thêm hàm này.

## 4. Không cần đổi (đã tự đúng sau khi "/" đổi ý nghĩa)

- `middleware.ts` — vẫn redirect về "/" sau khi phát hiện chưa đăng nhập lúc đăng nhập lại; không đổi.
- `login/page.tsx` — vẫn `router.push("/")` mặc định khi không có `redirect` param; không đổi.
- Backend (`dashboard.controller.ts`, permission catalog...) — không đổi gì, `dashboard.view` vẫn gate y hệt.

---

# Test

- Đăng nhập OWNER (đủ mọi quyền) → vào "/" thấy đủ ô theo đúng cấu trúc nhóm của sidebar, bấm từng ô điều hướng đúng trang, ô Dashboard bấm vào `/dashboard` hoạt động như cũ.
- Tạo tạm 1 user role ACCOUNTANT (giống cách đã test ở milestone `012`, xoá sau khi test) → xác nhận: sidebar không có Dashboard (như hiện tại), Sảnh chờ cũng không có ô Dashboard, breadcrumb "Trang chủ" ở mọi trang con dẫn về "/" không còn lỗi 403.
- Test edge case: tạm tắt hết quyền 1 user thử (hoặc dùng role rỗng) → xác nhận Sảnh chờ hiện `EmptyState` thay vì trắng trang.
- `tsc --noEmit` sạch ✅. Kiểm tra thủ công UI qua Playwright (chụp screenshot Sảnh chờ với vài role khác nhau) — **chưa làm**, môi trường code hiện tại không có tool trình duyệt; các mục test còn lại (OWNER, role ACCOUNTANT, edge case rỗng quyền) cần người dùng tự xác nhận.

---

# Quy trình làm việc

Theo đúng quy ước dự án: làm xong dừng lại tóm tắt + đề xuất commit message, chờ lệnh. Đây là 1 Task trọn vẹn, không tách nhỏ thêm.
