import { Module } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderController } from './sales-order.controller';
import { PermissionModule } from '../permission/permission.module';
import { SettingModule } from '../setting/setting.module';

@Module({
  // SettingModule: report method cần Settings.Company.timezone (014-bao-cao.md
  // Task 00) — cùng pattern DebtModule.
  imports: [PermissionModule, SettingModule],
  controllers: [SalesOrderController],
  providers: [SalesOrderService],
  exports: [SalesOrderService],
})
export class SalesOrderModule {}
