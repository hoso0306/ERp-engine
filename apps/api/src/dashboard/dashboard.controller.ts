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
    // Không truyền query -> DebtService tự đọc Settings.Dashboard.upcomingDueDays.
    const days = query.upcomingDueDays ? parseInt(query.upcomingDueDays, 10) : undefined;
    return this.dashboardService.getDebtDashboard(
      days !== undefined && Number.isFinite(days) ? days : undefined,
    );
  }

  @Get('alerts')
  getAlerts() {
    return this.dashboardService.getAlerts();
  }
}
