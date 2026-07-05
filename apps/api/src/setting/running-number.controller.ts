import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateRunningNumberDto } from './dto/update-running-number.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

// Chỉ sửa prefix/paddingLength/enabled — không sửa lastNumber, không Reset,
// không Delete (xem setting.md mục "Running Number").
@Controller('settings/running-numbers')
@UseGuards(AuthGuard, PermissionGuard)
export class RunningNumberController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @RequirePermission('settings.view')
  findAll() {
    return this.settingService.findAllRunningNumbers();
  }

  @Put(':type')
  @RequirePermission('settings.update')
  update(@Param('type') type: string, @Body() dto: UpdateRunningNumberDto) {
    return this.settingService.updateRunningNumber(type, dto);
  }
}
