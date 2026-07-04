import { Module } from '@nestjs/common';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { ProductionOrderService } from './production-order.service';
import { ProductionOrderController } from './production-order.controller';

@Module({
  imports: [SalesOrderModule],
  controllers: [ProductionOrderController],
  providers: [ProductionOrderService],
  exports: [ProductionOrderService],
})
export class ProductionModule {}
