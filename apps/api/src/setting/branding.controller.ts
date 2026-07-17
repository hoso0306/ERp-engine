import { Controller, Get } from '@nestjs/common';
import { SettingService } from './setting.service';

// Public — KHÔNG @UseGuards. Dùng cho trang Login (chưa đăng nhập) và Sidebar.
// SettingService.getBranding() chỉ select companyName + logo — không bao giờ
// thêm field nhạy cảm (stamp, bank info, address, phone, taxCode) vào route này.
@Controller('settings/branding')
export class BrandingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  getBranding() {
    return this.settingService.getBranding();
  }
}
