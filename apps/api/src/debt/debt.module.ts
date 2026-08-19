import { Module } from '@nestjs/common';
import { SettingModule } from '../setting/setting.module';
import { DebtService } from './debt.service';
import { OpeningBalanceService } from './opening-balance.service';
import { PaymentController } from './payment.controller';
import { ReceivableController } from './receivable.controller';
import { OpeningBalanceController } from './opening-balance.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [SettingModule, PermissionModule],
  controllers: [PaymentController, ReceivableController, OpeningBalanceController],
  providers: [DebtService, OpeningBalanceService],
  exports: [DebtService, OpeningBalanceService],
})
export class DebtModule {}
