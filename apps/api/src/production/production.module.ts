import { Module } from '@nestjs/common';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { ProductionOrderService } from './production-order.service';
import { ProductionOrderController } from './production-order.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [SalesOrderModule, WarehouseModule, PermissionModule],
  controllers: [ProductionOrderController],
  providers: [ProductionOrderService],
  exports: [ProductionOrderService],
})
export class ProductionModule {}
