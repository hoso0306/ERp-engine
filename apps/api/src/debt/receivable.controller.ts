import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DebtService } from './debt.service';
import { ReceivableQueryDto } from './dto/receivable-query.dto';
import { ReceivableByCustomerQueryDto } from './dto/receivable-by-customer-query.dto';
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

  // Danh sách Receivable còn nợ của 1 khách hàng, sort FIFO — phục vụ preview
  // trước khi xác nhận POST /payments/allocate (023-cong-no-payment-allocation-fifo).
  // Đăng ký trước ':id' cùng lý do trên.
  @Get('open-by-customer/:customerId')
  @RequirePermission('debt.view')
  getOpenByCustomer(@Param('customerId') customerId: string) {
    return this.debtService.getOpenReceivablesForCustomer(customerId);
  }

  // Preview cấn trừ FIFO trước khi xác nhận POST /payments/allocate (rà soát
  // tab Công nợ, 11/08/2026) — gộp cả Công nợ đầu kỳ, khác open-by-customer ở
  // trên (chỉ Receivable). Đăng ký trước ':id' cùng lý do các route literal khác.
  @Get('fifo-preview/:customerId')
  @RequirePermission('debt.view')
  getFifoPreview(@Param('customerId') customerId: string) {
    return this.debtService.getFifoPreviewForCustomer(customerId);
  }

  // Trang "Theo khách hàng" (rà soát tab Công nợ, chốt 26/07/2026) — đăng ký
  // trước ':id' cùng lý do các route literal khác ở trên.
  @Get('by-customer')
  @RequirePermission('debt.view')
  findAllByCustomer(@Query() query: ReceivableByCustomerQueryDto) {
    return this.debtService.findReceivablesByCustomer(query);
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
