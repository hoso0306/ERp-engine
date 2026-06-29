import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ExcelModule } from './shared/excel/excel.module';
import { HealthModule } from './health/health.module';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    ExcelModule,
    HealthModule,
    CustomerModule,
  ],
})
export class AppModule {}
