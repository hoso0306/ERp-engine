import { Module } from '@nestjs/common';
import { PricingEngineModule } from '../pricing-engine/pricing-engine.module';
import { BomEngineModule } from '../bom-engine/bom-engine.module';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { UnitController } from './unit.controller';
import { ProductTypeController } from './product-type.controller';
import { MaterialController } from './material.controller';
import { ProductParameterController } from './product-parameter.controller';
import { PricingRuleController } from './pricing-rule.controller';
import { MaterialRequirementController } from './material-requirement.controller';
import { ProductionCenterController } from './production-center.controller';
import { ValidationRuleController } from './validation-rule.controller';
import { DerivedParameterController } from './derived-parameter.controller';

@Module({
  imports: [PricingEngineModule, BomEngineModule],
  controllers: [
    ProductionCenterController,
    UnitController,
    ProductTypeController,
    MaterialController,
    ProductController,
    ProductParameterController,
    PricingRuleController,
    MaterialRequirementController,
    ValidationRuleController,
    DerivedParameterController,
  ],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
