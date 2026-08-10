import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import { SettingService } from './setting.service';

// Public có chủ đích, đánh dấu tường minh bằng @Public() (AuthGuard đọc qua
// Reflector và bỏ qua xác thực) — dùng cho trang Login (chưa đăng nhập) và
// Sidebar. SettingService.getBranding() chỉ select companyName + logo —
// không bao giờ thêm field nhạy cảm (stamp, bank info, address, phone,
// taxCode) vào route này (có test khẳng định response shape).
@Controller('settings/branding')
@UseGuards(AuthGuard)
export class BrandingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @Public()
  getBranding() {
    return this.settingService.getBranding();
  }
}
