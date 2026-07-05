import { Module } from '@nestjs/common';
import { SettingService } from './setting.service';
import { CompanyController } from './company.controller';
import { RunningNumberController } from './running-number.controller';
import { SettingController } from './setting.controller';

@Module({
  // CompanyController/RunningNumberController (route tĩnh) đăng ký TRƯỚC
  // SettingController (route động ':module') để tránh '/settings/company' và
  // '/settings/running-numbers' bị ':module' nuốt mất.
  controllers: [CompanyController, RunningNumberController, SettingController],
  providers: [SettingService],
  exports: [SettingService],
})
export class SettingModule {}
