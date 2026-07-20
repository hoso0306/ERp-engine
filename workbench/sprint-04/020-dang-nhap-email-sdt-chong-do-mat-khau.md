# 020 — Đăng nhập bằng Email/SĐT + Chống dò mật khẩu

Ngày thực hiện: 20/07/2026.

## 1. Đăng nhập bằng Email hoặc SĐT

**Commit:** `57842a9` — đã deploy lên VPS (`kynangai.cloud`).

- Thêm field `phone` (tuỳ chọn, unique) vào `User`.
- Đăng nhập tự nhận diện email/SĐT trong 1 ô duy nhất (không cần chọn kiểu nhập).
- Email không phân biệt hoa/thường — chuẩn hoá về chữ thường cả lúc tạo User lẫn lúc đăng nhập.
- Thêm ô SĐT vào Settings > Users (tạo/sửa User).
- Thông báo lỗi đăng nhập sai bổ sung: "Hãy liên hệ với người sáng lập để cấp lại mật khẩu."

**File chính:** `apps/api/prisma/schema.prisma`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/dto/login.dto.ts`, `apps/api/src/permission/user.service.ts`, `apps/api/src/permission/dto/create-user.dto.ts`, `apps/api/src/permission/dto/update-user.dto.ts`, `apps/web/src/app/login/page.tsx`, `apps/web/src/context/auth-context.tsx`, `apps/web/src/components/setting/user-dialog.tsx`, `apps/web/src/components/setting/user-table.tsx`, `apps/web/src/types/auth.ts`.

## 2. Chống dò mật khẩu (khoá tạm theo bậc)

Ngưỡng đã chốt: sai 5 lần liên tiếp → khoá 5 phút. Sai đủ 10 lần → khoá 30 phút. Đếm dồn (không reset giữa 2 mốc), chỉ reset về 0 khi đăng nhập đúng.

**Thông báo hiển thị theo từng tình huống:**

| Tình huống | Thông báo |
|---|---|
| Sai, chưa chạm ngưỡng | "Email hoặc mật khẩu không đúng. Hãy liên hệ với người sáng lập để cấp lại mật khẩu. Còn N lần thử." |
| Vừa chạm ngưỡng 5 (lần thứ 5) | "Sai mật khẩu quá 5 lần. Chờ 300 giây để thử lại." |
| Vừa chạm ngưỡng 10 (lần thứ 10 trở lên) | "Sai mật khẩu quá 10 lần. Chờ 30 phút để thử lại." |
| Đang trong thời gian khoá | "Tài khoản đang tạm khoá. Chờ [giây/phút] để thử lại." (tự chọn đơn vị: dưới 10 phút hiện giây, từ 10 phút trở lên hiện phút) |

**Field mới trên User:** `failedLoginAttempts` (Int, mặc định 0), `lockedUntil` (DateTime?, nullable).

**File chính:** `apps/api/prisma/schema.prisma`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.service.spec.ts` (18 test mới cho cơ chế này).

**Trạng thái:** Code xong, tự verify qua API local (đếm lùi đúng, khoá đúng 300 giây ở lần 5, đúng mật khẩu vẫn bị chặn khi đang khoá) — 285/285 test API pass. **Chưa commit/chưa deploy VPS** tại thời điểm ghi tài liệu này — người dùng tự commit.

## Đánh đổi bảo mật cần lưu ý

Thông báo "còn N lần thử" và thông báo khi tài khoản đang bị khoá đều **tiết lộ rằng tài khoản có tồn tại** (khác với nguyên tắc "không phân biệt email không tồn tại / sai mật khẩu" ban đầu của hệ thống). Đây là đánh đổi UX đã được người dùng xác nhận rõ ràng khi yêu cầu tính năng này.
