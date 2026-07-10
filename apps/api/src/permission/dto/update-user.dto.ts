export class UpdateUserDto {
  name?: string;
  isActive?: boolean;
  roleId?: string;
  // Task 01 (010-fe-cai-dat-nguoi-dung.md) — cấp lại mật khẩu tạm cho User đã
  // tồn tại, đúng thiết kế đã ghi ở authentication.md ("Admin/Owner reset thủ
  // công cho User qua PATCH /users/:id"). true = sinh mật khẩu tạm mới.
  resetPassword?: boolean;
}
