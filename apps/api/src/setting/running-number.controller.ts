import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateRunningNumberDto } from './dto/update-running-number.dto';

// Chỉ sửa prefix/paddingLength/enabled — không sửa lastNumber, không Reset,
// không Delete (xem setting.md mục "Running Number").
@Controller('settings/running-numbers')
export class RunningNumberController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  findAll() {
    return this.settingService.findAllRunningNumbers();
  }

  @Put(':type')
  update(@Param('type') type: string, @Body() dto: UpdateRunningNumberDto) {
    return this.settingService.updateRunningNumber(type, dto);
  }
}
