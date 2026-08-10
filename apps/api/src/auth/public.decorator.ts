import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Đánh dấu route/controller cố ý bỏ qua AuthGuard (vd branding cho màn hình
// trước đăng nhập). AuthGuard đọc metadata này qua Reflector — chỉ cách này
// mới được coi là "public" có chủ đích; controller nào thiếu cả @UseGuards
// lẫn @Public() là thiếu sót cần rà lại, không phải public hợp lệ.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
