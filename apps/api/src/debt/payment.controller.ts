import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DebtService } from './debt.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('payments')
@UseGuards(AuthGuard, PermissionGuard)
export class PaymentController {
  constructor(private readonly debtService: DebtService) {}

  // Payment không có Update/Delete API — append-only (xem debt.md).
  // Hoàn tác dùng POST /payments/:id/reverse (tạo bút toán đảo chiều mới).
  // Không có GET /payments độc lập ở V1 — xem GET /receivables/:id (lịch sử
  // cấn trừ lồng bên trong).

  // Luồng theo 1 đơn — không đổi contract so với trước 023-cong-no-payment-allocation-fifo.
  @Post()
  @RequirePermission('debt.create-payment')
  create(
    @Body() dto: CreatePaymentDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.debtService.createPayment(dto, req.user?.userId ?? null);
  }

  // Luồng theo khách hàng — mặc định FIFO, cho phép cấn tay qua dto.allocations.
  @Post('allocate')
  @RequirePermission('debt.create-payment')
  createAllocated(
    @Body() dto: AllocatePaymentDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.debtService.createAllocatedPayment(
      dto,
      req.user?.userId ?? null,
    );
  }

  @Post(':id/reverse')
  @RequirePermission('debt.create-payment')
  reverse(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.debtService.reversePayment(id, req.user?.userId ?? null);
  }
}
