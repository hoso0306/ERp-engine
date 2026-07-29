import { Module } from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { QuotationController } from './quotation.controller';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';
import { BomEngineModule } from '../bom-engine/bom-engine.module';
import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [PricingEngineModule, BomEngineModule, PermissionModule, SettingModule],
  controllers: [QuotationController],
  providers: [QuotationWorkflowService],
  exports: [QuotationWorkflowService],
})
export class QuotationModule {}
