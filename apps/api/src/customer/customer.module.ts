import { Module } from '@nestjs/common';
import { PermissionModule } from '../permission/permission.module';
import { DebtModule } from '../debt/debt.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({
  imports: [PermissionModule, DebtModule],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
