import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ExcelModule } from './shared/excel/excel.module';
import { HealthModule } from './health/health.module';
import { CustomerModule } from './customer/customer.module';
import { ProductModule } from './product/product.module';
import { PricingEngineModule } from './pricing-engine/pricing-engine.module';
import { QuotationModule } from './quotation/quotation.module';
import { SalesOrderModule } from './sales-order/sales-order.module';
import { ProductionModule } from './production/production.module';
import { DebtModule } from './debt/debt.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingModule } from './setting/setting.module';
import { ReturnModule } from './return/return.module';
import { AuthModule } from './auth/auth.module';
import { PermissionModule } from './permission/permission.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    ExcelModule,
    HealthModule,
    CustomerModule,
    ProductModule,
    PricingEngineModule,
    QuotationModule,
    SalesOrderModule,
    ProductionModule,
    // Module Kho tạm gỡ khỏi triển khai (18/07/2026) — code giữ nguyên ở
    // src/warehouse, xem warehouse.md mục "Trạng thái triển khai".
    DebtModule,
    DashboardModule,
    SettingModule,
    ReturnModule,
    AuthModule,
    PermissionModule,
  ],
})
export class AppModule {}
