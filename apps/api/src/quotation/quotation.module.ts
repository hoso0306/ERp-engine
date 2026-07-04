import { Module } from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { QuotationController } from './quotation.controller';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';

@Module({
  imports: [PricingEngineModule],
  controllers: [QuotationController],
  providers: [QuotationWorkflowService],
  exports: [QuotationWorkflowService],
})
export class QuotationModule {}
