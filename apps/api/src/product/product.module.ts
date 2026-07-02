import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { UnitController } from './unit.controller';
import { ProductTypeController } from './product-type.controller';
import { MaterialController } from './material.controller';
import { ProductParameterController } from './product-parameter.controller';
import { PricingRuleController } from './pricing-rule.controller';
import { MaterialRequirementController } from './material-requirement.controller';
import { ProductionCenterController } from './production-center.controller';

@Module({
  controllers: [
    ProductionCenterController,
    UnitController,
    ProductTypeController,
    MaterialController,
    ProductController,
    ProductParameterController,
    PricingRuleController,
    MaterialRequirementController,
  ],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
