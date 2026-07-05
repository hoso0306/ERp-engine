import { Module } from '@nestjs/common';
import { DebtService } from './debt.service';
import { PaymentController } from './payment.controller';
import { ReceivableController } from './receivable.controller';

@Module({
  controllers: [PaymentController, ReceivableController],
  providers: [DebtService],
  exports: [DebtService],
})
export class DebtModule {}
