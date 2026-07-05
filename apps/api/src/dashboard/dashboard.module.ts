import { Module } from '@nestjs/common';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { ProductionModule } from '../production/production.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { DebtModule } from '../debt/debt.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [SalesOrderModule, ProductionModule, WarehouseModule, DebtModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
