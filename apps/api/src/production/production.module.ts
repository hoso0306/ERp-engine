import { Module } from '@nestjs/common';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { ProductionOrderService } from './production-order.service';
import { ProductionOrderController } from './production-order.controller';
import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  imports: [SalesOrderModule, PermissionModule, SettingModule],
  controllers: [ProductionOrderController],
  providers: [ProductionOrderService],
  exports: [ProductionOrderService],
})
export class ProductionModule {}
