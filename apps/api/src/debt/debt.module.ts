import { Module } from '@nestjs/common';
import { SettingModule } from '../setting/setting.module';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';
import { DebtService } from './debt.service';
import { VatSettlementService } from './vat-settlement.service';
import { OpeningBalanceService } from './opening-balance.service';
import { PaymentController } from './payment.controller';
import { ReceivableController } from './receivable.controller';
import { VatSettlementController } from './vat-settlement.controller';
import { OpeningBalanceController } from './opening-balance.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [SettingModule, PermissionModule, PricingEngineModule],
  controllers: [
    PaymentController,
    ReceivableController,
    VatSettlementController,
    OpeningBalanceController,
  ],
  providers: [DebtService, VatSettlementService, OpeningBalanceService],
  exports: [DebtService, VatSettlementService, OpeningBalanceService],
})
export class DebtModule {}
