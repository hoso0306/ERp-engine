import { Controller, Post, Body } from '@nestjs/common';
import { DebtService } from './debt.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly debtService: DebtService) {}

  // Payment không có Update/Delete API — append-only (xem debt.md).
  // Không có GET /payments độc lập ở V1 — xem GET /receivables/:id (Payment History lồng bên trong).

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.debtService.createPayment(dto);
  }
}
