import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DebtService } from './debt.service';
import { VatSettlementService } from './vat-settlement.service';
import { ReceivableQueryDto } from './dto/receivable-query.dto';
import { ReceivableByCustomerQueryDto } from './dto/receivable-by-customer-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('receivables')
@UseGuards(AuthGuard, PermissionGuard)
export class ReceivableController {
  constructor(
    private readonly debtService: DebtService,
    private readonly vatSettlementService: VatSettlementService,
  ) {}

  // Không có Create/Update/Delete API cho Receivable — chỉ ERP tự sinh/tự cập nhật.
  // close-without-vat là 1 Action (chuyển nhánh workflow), không phải Update tự do.

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

  // Đơn đã "Đóng công nợ (không xuất hóa đơn)", đủ điều kiện tạo VAT Settlement
  // (024-cong-no-vat-settlement.md) — giữ trong ReceivableController cho đúng
  // module ownership, cùng tiền lệ open-by-customer ở trên (không đụng
  // customer.controller.ts). Đăng ký trước ':id' cùng lý do trên.
  @Get('eligible-for-vat-settlement/:customerId')
  @RequirePermission('debt.view')
  getEligibleForVatSettlement(@Param('customerId') customerId: string) {
    return this.vatSettlementService.getEligibleReceivables(customerId);
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

  // Action "Đóng công nợ (không xuất hóa đơn)" (024-cong-no-vat-settlement.md).
  @Post(':id/close-without-vat')
  @RequirePermission('debt.create-payment')
  closeWithoutVat(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.debtService.closeReceivableWithoutVat(
      id,
      req.user?.userId ?? null,
    );
  }

  // Hoàn tác action trên (bổ sung 26/07/2026) — chặn nếu đã có VAT Settlement
  // (chưa huỷ) tham chiếu tới.
  @Post(':id/reopen-without-vat')
  @RequirePermission('debt.create-payment')
  reopenWithoutVat(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.debtService.reopenReceivableClosedWithoutVat(
      id,
      req.user?.userId ?? null,
    );
  }
}
