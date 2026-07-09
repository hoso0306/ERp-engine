import { ChangePasswordForm } from "./change-password-form";

// mustChangePassword = true (mật khẩu tạm hoặc vừa bị Admin reset) — chặn
// toàn bộ trang nội bộ cho tới khi đổi mật khẩu thành công (authentication.md
// mục "Bắt buộc đổi mật khẩu lần đầu"). AppLayout render component này thay
// children bất kể route nào đang được truy cập.
export function ForcedChangePasswordScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-popover p-6 text-popover-foreground ring-1 ring-foreground/10">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-semibold">Yêu cầu đổi mật khẩu</h1>
          <p className="text-sm text-muted-foreground">
            Đây là lần đăng nhập đầu tiên hoặc mật khẩu vừa được đặt lại. Vui
            lòng đặt mật khẩu mới trước khi tiếp tục sử dụng hệ thống.
          </p>
        </div>
        <ChangePasswordForm submitLabel="Đặt mật khẩu mới" />
      </div>
    </div>
  );
}
