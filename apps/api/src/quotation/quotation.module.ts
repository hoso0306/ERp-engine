import { Module } from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { QuotationController } from './quotation.controller';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [PricingEngineModule, PermissionModule],
  controllers: [QuotationController],
  providers: [QuotationWorkflowService],
  exports: [QuotationWorkflowService],
})
export class QuotationModule {}
