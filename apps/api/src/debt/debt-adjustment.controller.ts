import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DebtService } from './debt.service';
import { DebtAdjustmentHistoryQueryDto } from './dto/debt-adjustment-history-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

// Tab "Lịch sử giảm trừ/công nợ đầu kỳ" trong trang chi tiết khách hàng (rà
// soát nghiệp vụ 27/08/2026) — gộp DebtAdjustment (giảm trừ do hoàn hàng +
// giảm trừ độc lập) và OpeningBalanceTimeline (tăng công nợ do tạo Công nợ
// đầu kỳ), xem DebtService.getDebtAdjustmentHistoryByCustomer().
@Controller('debt-adjustments')
@UseGuards(AuthGuard, PermissionGuard)
export class DebtAdjustmentController {
  constructor(private readonly debtService: DebtService) {}

  @Get('by-customer/:customerId')
  @RequirePermission('debt.view')
  findHistoryByCustomer(
    @Param('customerId') customerId: string,
    @Query() query: DebtAdjustmentHistoryQueryDto,
  ) {
    return this.debtService.getDebtAdjustmentHistoryByCustomer(customerId, query);
  }
}
