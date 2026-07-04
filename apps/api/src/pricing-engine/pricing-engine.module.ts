import { Module } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { PricingEngineController } from './pricing-engine.controller';

@Module({
  controllers: [PricingEngineController],
  providers: [PricingEngineService],
  exports: [PricingEngineService],
})
export class PricingEngineModule {}
