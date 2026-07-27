import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VatSettlementService } from './vat-settlement.service';
import { CreateVatSettlementDto } from './dto/create-vat-settlement.dto';
import { CreateVatSettlementFromOpeningBalanceDto } from './dto/create-vat-settlement-from-opening-balance.dto';
import { ConfirmVatSettlementPaymentDto } from './dto/confirm-vat-settlement-payment.dto';
import { MarkVatSettlementInvoicedDto } from './dto/mark-vat-settlement-invoiced.dto';
import { VatSettlementQueryDto } from './dto/vat-settlement-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

// 024-cong-no-vat-settlement.md — VatSettlement là chứng từ tài chính độc lập
// (xử lý VAT sau bán), workflow DRAFT → SENT → PAID → INVOICED.
@Controller('vat-settlements')
@UseGuards(AuthGuard, PermissionGuard)
export class VatSettlementController {
  constructor(private readonly vatSettlementService: VatSettlementService) {}

  @Get()
  @RequirePermission('debt.view')
  findAll(@Query() query: VatSettlementQueryDto) {
    return this.vatSettlementService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('debt.view')
  findOne(@Param('id') id: string) {
    return this.vatSettlementService.findOne(id);
  }

  @Post()
  @RequirePermission('debt.create-payment')
  create(
    @Body() dto: CreateVatSettlementDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.vatSettlementService.create(dto, req.user?.userId ?? null);
  }

  // "Phục dựng hoá đơn" cho Công nợ đầu kỳ (opening-balance.md) — route riêng,
  // DTO khác hẳn create() (dòng sản phẩm, không phải chọn Receivable). Đăng ký
  // trước ':id' để tránh bị nuốt bởi route động.
  @Post('from-opening-balance')
  @RequirePermission('debt.create-payment')
  createFromOpeningBalance(
    @Body() dto: CreateVatSettlementFromOpeningBalanceDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.vatSettlementService.createFromOpeningBalance(
      dto,
      req.user?.userId ?? null,
    );
  }

  @Post(':id/send')
  @RequirePermission('debt.create-payment')
  send(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.vatSettlementService.send(id, req.user?.userId ?? null);
  }

  // Huỷ khi còn DRAFT (bổ sung 26/07/2026, theo rà soát mô hình công nợ).
  @Post(':id/cancel')
  @RequirePermission('debt.create-payment')
  cancel(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.vatSettlementService.cancel(id, req.user?.userId ?? null);
  }

  @Post(':id/confirm-payment')
  @RequirePermission('debt.create-payment')
  confirmPayment(
    @Param('id') id: string,
    @Body() dto: ConfirmVatSettlementPaymentDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.vatSettlementService.confirmPayment(
      id,
      dto,
      req.user?.userId ?? null,
    );
  }

  @Post(':id/mark-invoiced')
  @RequirePermission('debt.create-payment')
  markInvoiced(
    @Param('id') id: string,
    @Body() dto: MarkVatSettlementInvoicedDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.vatSettlementService.markInvoiced(
      id,
      dto,
      req.user?.userId ?? null,
    );
  }
}
