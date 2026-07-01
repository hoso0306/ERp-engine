import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { UnitController } from './unit.controller';
import { ProductTypeController } from './product-type.controller';
import { MaterialController } from './material.controller';

@Module({
  controllers: [
    UnitController,
    ProductTypeController,
    MaterialController,
    ProductController,
  ],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
