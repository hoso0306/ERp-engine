import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardDebtQueryDto } from './dto/dashboard-debt-query.dto';

// Dashboard chỉ có Read API — không Create/Update/Delete.
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('sales')
  getSales() {
    return this.dashboardService.getSalesDashboard();
  }

  @Get('production')
  getProduction() {
    return this.dashboardService.getProductionDashboard();
  }

  @Get('warehouse')
  getWarehouse() {
    return this.dashboardService.getWarehouseDashboard();
  }

  @Get('debt')
  getDebt(@Query() query: DashboardDebtQueryDto) {
    const days = query.upcomingDueDays ? parseInt(query.upcomingDueDays, 10) : 7;
    return this.dashboardService.getDebtDashboard(Number.isFinite(days) ? days : 7);
  }

  @Get('alerts')
  getAlerts() {
    return this.dashboardService.getAlerts();
  }
}
