import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { DebtModule } from '../debt/debt.module';
import { CustomerModule } from '../customer/customer.module';
import { ReturnModule } from '../return/return.module';
import { SettingModule } from '../setting/setting.module';
import { PermissionModule } from '../permission/permission.module';

// Report chỉ gọi Service của module sở hữu dữ liệu (Module Ownership,
// 014-bao-cao.md "Kiến trúc") — không tạo ReportQueryService hay Repository
// riêng. ExcelModule/PdfModule là @Global (đăng ký ở AppModule) nên không
// cần import lại ở đây.
@Module({
  imports: [
    SalesOrderModule,
    DebtModule,
    CustomerModule,
    ReturnModule,
    SettingModule,
    PermissionModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
