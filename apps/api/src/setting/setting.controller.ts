import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

// Key-value engine dùng chung cho Dashboard/Notification/Document/Security/Backup.
// Không Create key mới, không Delete — chỉ Update giá trị đã seed sẵn.
@Controller('settings')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  findAll() {
    return this.settingService.findAllSettings();
  }

  @Get(':module')
  findByModule(@Param('module') module: string) {
    return this.settingService.findSettingsByModule(module);
  }

  @Put(':module')
  updateByModule(@Param('module') module: string, @Body() dto: UpdateSettingDto) {
    return this.settingService.updateSettingsByModule(module, dto);
  }
}
