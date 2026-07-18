import { Module } from '@nestjs/common';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { ProductionModule } from '../production/production.module';
import { DebtModule } from '../debt/debt.module';
import { ReturnModule } from '../return/return.module';
import { PermissionModule } from '../permission/permission.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    SalesOrderModule,
    ProductionModule,
    DebtModule,
    ReturnModule,
    PermissionModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
