import { forwardRef, Module } from '@nestjs/common';
import { SettingService } from './setting.service';
import { CompanyController } from './company.controller';
import { RunningNumberController } from './running-number.controller';
import { SettingController } from './setting.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  // forwardRef vì AuthModule (import SettingModule trực tiếp) và
  // PermissionModule tạo thành một chu trình module: Setting → Permission →
  // Auth → Setting.
  imports: [forwardRef(() => PermissionModule)],
  // CompanyController/RunningNumberController (route tĩnh) đăng ký TRƯỚC
  // SettingController (route động ':module') để tránh '/settings/company' và
  // '/settings/running-numbers' bị ':module' nuốt mất.
  controllers: [CompanyController, RunningNumberController, SettingController],
  providers: [SettingService],
  exports: [SettingService],
})
export class SettingModule {}
