import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardDebtQueryDto } from './dto/dashboard-debt-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { PermissionService } from '../permission/permission.service';

// Dashboard chỉ có Read API — không Create/Update/Delete.
// Dashboard không sở hữu dữ liệu, không sở hữu permission riêng cho từng KPI —
// chỉ hỏi lại đúng quyền view của module sở hữu (xem permission.md mục
// "Dashboard Permission"). dashboard.view là quyền truy cập Dashboard nói
// chung (Task 02); Task 06 ẩn từng KPI section trong getOverview()/getAlerts()
// theo đúng quyền view riêng, không ẩn toàn bộ Dashboard.
@Controller('dashboard')
@UseGuards(AuthGuard, PermissionGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly permissionService: PermissionService,
  ) {}

  @Get('overview')
  @RequirePermission('dashboard.view')
  async getOverview(@Req() req: AuthenticatedRequest) {
    const overview = await this.dashboardService.getOverview();
    const allowed = await this.permissionKeys(req);
    return {
      sales: overview.sales,
      production: this.hideUnlessAllowed(overview.production, allowed, 'production.view'),
      warehouse: this.hideUnlessAllowed(overview.warehouse, allowed, 'warehouse.view'),
      debt: this.hideUnlessAllowed(overview.debt, allowed, 'debt.view'),
      returns: this.hideUnlessAllowed(overview.returns, allowed, 'return.view'),
      alerts: overview.alerts,
    };
  }

  @Get('sales')
  @RequirePermission('dashboard.view')
  getSales() {
    return this.dashboardService.getSalesDashboard();
  }

  @Get('production')
  @RequirePermission('dashboard.view')
  getProduction() {
    return this.dashboardService.getProductionDashboard();
  }

  @Get('warehouse')
  @RequirePermission('dashboard.view')
  getWarehouse() {
    return this.dashboardService.getWarehouseDashboard();
  }

  @Get('debt')
  @RequirePermission('dashboard.view')
  getDebt(@Query() query: DashboardDebtQueryDto) {
    // Không truyền query -> DebtService tự đọc Settings.Dashboard.upcomingDueDays.
    const days = query.upcomingDueDays ? parseInt(query.upcomingDueDays, 10) : undefined;
    return this.dashboardService.getDebtDashboard(
      days !== undefined && Number.isFinite(days) ? days : undefined,
    );
  }

  @Get('returns')
  @RequirePermission('dashboard.view')
  getReturns() {
    return this.dashboardService.getReturnDashboard();
  }

  @Get('alerts')
  @RequirePermission('dashboard.view')
  async getAlerts(@Req() req: AuthenticatedRequest) {
    const alerts = await this.dashboardService.getAlerts();
    const allowed = await this.permissionKeys(req);
    return {
      overdueDebt: this.hideUnlessAllowed(alerts.overdueDebt, allowed, 'debt.view'),
      creditLimitExceeded: this.hideUnlessAllowed(
        alerts.creditLimitExceeded,
        allowed,
        'debt.view',
      ),
      lowStockMaterials: this.hideUnlessAllowed(
        alerts.lowStockMaterials,
        allowed,
        'warehouse.view',
      ),
      outOfStockMaterials: this.hideUnlessAllowed(
        alerts.outOfStockMaterials,
        allowed,
        'warehouse.view',
      ),
      delayedOrders: alerts.delayedOrders,
    };
  }

  private async permissionKeys(req: AuthenticatedRequest): Promise<Set<string>> {
    const roleId = req.user.roleId;
    if (!roleId) return new Set();
    return new Set(await this.permissionService.getPermissionKeysForRole(roleId));
  }

  private hideUnlessAllowed<T>(data: T, allowed: Set<string>, key: string): T | null {
    return allowed.has(key) ? data : null;
  }
}
