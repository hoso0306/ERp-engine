import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { DebtService } from './debt.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('payments')
@UseGuards(AuthGuard, PermissionGuard)
export class PaymentController {
  constructor(private readonly debtService: DebtService) {}

  // Payment không có Update/Delete API — append-only (xem debt.md).
  // Không có GET /payments độc lập ở V1 — xem GET /receivables/:id (Payment History lồng bên trong).

  @Post()
  @RequirePermission('debt.create-payment')
  create(@Body() dto: CreatePaymentDto) {
    return this.debtService.createPayment(dto);
  }
}
