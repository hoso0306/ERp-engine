import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

// Company là Singleton — không có Create/Delete API (xem setting.md).
@Controller('settings/company')
@UseGuards(AuthGuard, PermissionGuard)
export class CompanyController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  @RequirePermission('settings.view')
  getCompany() {
    return this.settingService.getCompany();
  }

  @Put()
  @RequirePermission('settings.update')
  updateCompany(@Body() dto: UpdateCompanyDto) {
    return this.settingService.updateCompany(dto);
  }
}
