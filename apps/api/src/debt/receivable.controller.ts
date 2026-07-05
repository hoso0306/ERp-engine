import { Controller, Get, Param, Query } from '@nestjs/common';
import { DebtService } from './debt.service';
import { ReceivableQueryDto } from './dto/receivable-query.dto';

@Controller('receivables')
export class ReceivableController {
  constructor(private readonly debtService: DebtService) {}

  // Không có Create/Update/Delete API cho Receivable — chỉ ERP tự sinh/tự cập nhật.

  // Đăng ký trước ':id' để tránh 'dashboard' bị nuốt bởi route động.
  @Get('dashboard')
  getOwnerDashboard() {
    return this.debtService.getOwnerDashboard();
  }

  @Get()
  findAll(@Query() query: ReceivableQueryDto) {
    return this.debtService.findAllReceivables(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.debtService.findOneReceivable(id);
  }
}
