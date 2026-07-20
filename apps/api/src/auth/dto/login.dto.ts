export class LoginDto {
  // Nhận cả email lẫn số điện thoại (xem AuthService.login()).
  identifier!: string;
  password!: string;
}
