import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

// Company là Singleton — không có Create/Delete API (xem setting.md).
@Controller('settings/company')
export class CompanyController {
  constructor(private readonly settingService: SettingService) {}

  @Get()
  getCompany() {
    return this.settingService.getCompany();
  }

  @Put()
  updateCompany(@Body() dto: UpdateCompanyDto) {
    return this.settingService.updateCompany(dto);
  }
}
