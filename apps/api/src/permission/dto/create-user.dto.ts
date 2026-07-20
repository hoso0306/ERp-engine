export class CreateUserDto {
  email!: string;
  // Tuỳ chọn — đăng nhập được bằng email hoặc SĐT nếu có (xem AuthService.login()).
  phone?: string;
  name?: string;
  roleId!: string;
}
