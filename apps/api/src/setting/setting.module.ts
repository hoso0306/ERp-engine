import { forwardRef, Module } from '@nestjs/common';
import { SettingService } from './setting.service';
import { CompanyController } from './company.controller';
import { RunningNumberController } from './running-number.controller';
import { BrandingController } from './branding.controller';
import { SettingController } from './setting.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  // forwardRef vì AuthModule (import SettingModule trực tiếp) và
  // PermissionModule tạo thành một chu trình module: Setting → Permission →
  // Auth → Setting.
  imports: [forwardRef(() => PermissionModule)],
  // CompanyController/RunningNumberController/BrandingController (route tĩnh)
  // đăng ký TRƯỚC SettingController (route động ':module') để tránh
  // '/settings/company', '/settings/running-numbers', '/settings/branding'
  // bị ':module' nuốt mất. BrandingController KHÔNG có AuthGuard (public).
  controllers: [
    CompanyController,
    RunningNumberController,
    BrandingController,
    SettingController,
  ],
  providers: [SettingService],
  exports: [SettingService],
})
export class SettingModule {}
