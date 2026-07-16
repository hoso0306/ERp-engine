import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

// Key-value engine dùng chung cho Dashboard/Notification/Document/Security/Backup.
// Không Create key mới, không Delete — chỉ Update giá trị đã seed sẵn.
@Controller('settings')
@UseGuards(AuthGuard, PermissionGuard)
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @RequirePermission('settings.view')
  findAll() {
    return this.settingService.findAllSettings();
  }

  @Get(':module')
  @RequirePermission('settings.view')
  findByModule(@Param('module') module: string) {
    return this.settingService.findSettingsByModule(module);
  }

  @Put(':module')
  @RequirePermission('settings.update')
  updateByModule(
    @Param('module') module: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingService.updateSettingsByModule(module, dto);
  }
}
