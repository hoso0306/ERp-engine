import { Module } from '@nestjs/common';
import { SettingModule } from '../setting/setting.module';
import { DebtService } from './debt.service';
import { PaymentController } from './payment.controller';
import { ReceivableController } from './receivable.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [SettingModule, PermissionModule],
  controllers: [PaymentController, ReceivableController],
  providers: [DebtService],
  exports: [DebtService],
})
export class DebtModule {}
