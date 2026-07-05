import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DebtService } from './debt.service';
import { ReceivableQueryDto } from './dto/receivable-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('receivables')
@UseGuards(AuthGuard, PermissionGuard)
export class ReceivableController {
  constructor(private readonly debtService: DebtService) {}

  // Không có Create/Update/Delete API cho Receivable — chỉ ERP tự sinh/tự cập nhật.

  // Đăng ký trước ':id' để tránh 'dashboard' bị nuốt bởi route động.
  @Get('dashboard')
  @RequirePermission('debt.view')
  getOwnerDashboard() {
    return this.debtService.getOwnerDashboard();
  }

  @Get()
  @RequirePermission('debt.view')
  findAll(@Query() query: ReceivableQueryDto) {
    return this.debtService.findAllReceivables(query);
  }

  @Get(':id')
  @RequirePermission('debt.view')
  findOne(@Param('id') id: string) {
    return this.debtService.findOneReceivable(id);
  }
}
