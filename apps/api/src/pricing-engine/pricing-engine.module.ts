import { Module } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { PricingEngineController } from './pricing-engine.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [PermissionModule],
  controllers: [PricingEngineController],
  providers: [PricingEngineService],
  exports: [PricingEngineService],
})
export class PricingEngineModule {}
