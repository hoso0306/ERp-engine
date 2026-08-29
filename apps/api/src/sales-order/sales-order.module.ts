import { Module } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderController } from './sales-order.controller';
import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';
import { ReturnModule } from '../return/return.module';

@Module({
  // SettingModule: report method cần Settings.Company.timezone (014-bao-cao.md
  // Task 00) — cùng pattern DebtModule.
  // ReturnModule (rà soát nghiệp vụ Return, 27/08/2026): Controller cần
  // ReturnService cho GET /sales-orders/revenue-summary (ghép doanh thu +
  // phần Công ty hỗ trợ) — không cycle vì ReturnModule không import ngược
  // lại SalesOrderModule.
  imports: [PermissionModule, SettingModule, ReturnModule],
  controllers: [SalesOrderController],
  providers: [SalesOrderService],
  exports: [SalesOrderService],
})
export class SalesOrderModule {}
