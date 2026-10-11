import { Module } from '@nestjs/common';
import { PermissionModule } from '../permission/permission.module';
import { DebtModule } from '../debt/debt.module';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { SettingModule } from '../setting/setting.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({
  imports: [PermissionModule, DebtModule, SalesOrderModule, SettingModule],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
