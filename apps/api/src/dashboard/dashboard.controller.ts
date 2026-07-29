import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardDebtQueryDto } from './dto/dashboard-debt-query.dto';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
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
  async getOverview(
    @Query() query: DashboardOverviewQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const overview = await this.dashboardService.getOverview(
      this.parseRange(query),
    );
    const allowed = await this.permissionKeys(req);
    return {
      // sales-order.view-cost (026-cai-tien-dashboard.md mục 6) — permission
      // riêng cho KPI tài chính (doanh thu/giá vốn/lợi nhuận kế hoạch), độc
      // lập với sales-order.view, cùng convention với quotation.view-cost.
      // Đây là ngoại lệ có chủ đích với nguyên tắc "Dashboard không tạo
      // permission riêng" (permission.md mục "Dashboard Permission") — quyền
      // này thuộc Sales Order module, không phải Dashboard.
      sales: this.hideUnlessAllowed(
        overview.sales,
        allowed,
        'sales-order.view-cost',
      ),
      production: this.hideUnlessAllowed(
        overview.production,
        allowed,
        'production.view',
      ),
      debt: this.hideUnlessAllowed(overview.debt, allowed, 'debt.view'),
      returns: this.hideUnlessAllowed(overview.returns, allowed, 'return.view'),
      // Dải "Hôm nay" (mục 5) — ẩn từng số theo đúng quyền view của module sở
      // hữu dữ liệu tương ứng (không phải view-cost — đây là số đếm/tiền
      // vận hành hôm nay, không phải KPI tài chính kế hoạch).
      today: {
        newOrders: allowed.has('sales-order.view')
          ? overview.today.newOrders
          : null,
        shippedOrders: allowed.has('sales-order.view')
          ? overview.today.shippedOrders
          : null,
        cashInToday: allowed.has('debt.view')
          ? overview.today.cashInToday
          : null,
      },
      // Bug fix (verify sống 010-fe-cai-dat-nguoi-dung.md): alerts trong
      // overview trước đây trả thẳng không lọc theo quyền, khác với
      // GET /dashboard/alerts (đã lọc đúng) — rò dữ liệu công nợ/kho cho user
      // chỉ có dashboard.view. Dùng chung buildGatedAlerts() với getAlerts().
      alerts: this.buildGatedAlerts(overview.alerts, allowed),
    };
  }

  // "to" tính hết ngày (23:59:59.999) theo giờ local để bao trọn ngày cuối
  // khoảng đã chọn, không chỉ đến 00:00. Dùng chung cho mọi route bên dưới —
  // mỗi khối giờ có bộ lọc riêng (027-thiet-ke-lai-dashboard-bo-loc-rieng.md).
  private parseRange(query: {
    from?: string;
    to?: string;
  }): { from?: Date; to?: Date } | undefined {
    if (!query.from && !query.to) return undefined;
    return {
      from: query.from ? new Date(`${query.from}T00:00:00`) : undefined,
      to: query.to ? new Date(`${query.to}T23:59:59.999`) : undefined,
    };
  }

  // Mỗi route riêng bên dưới giờ THỰC SỰ được FE dùng (trước đây chỉ tồn
  // tại nhưng FE luôn gọi /overview) — phải tự lọc theo quyền giống hệt
  // getOverview(), không dựa vào @RequirePermission('dashboard.view') chung
  // chung (đó chỉ là quyền vào được Dashboard, không phải quyền xem KPI cụ
  // thể — xem permission.md mục "Dashboard Permission").

  @Get('sales')
  @RequirePermission('dashboard.view')
  async getSales(
    @Query() query: DashboardOverviewQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const allowed = await this.permissionKeys(req);
    if (!allowed.has('sales-order.view-cost')) return null;
    return this.dashboardService.getSalesDashboard(this.parseRange(query));
  }

  @Get('production')
  @RequirePermission('dashboard.view')
  async getProduction(
    @Query() query: DashboardOverviewQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const allowed = await this.permissionKeys(req);
    if (!allowed.has('production.view')) return null;
    return this.dashboardService.getProductionDashboard(
      this.parseRange(query),
    );
  }

  @Get('debt')
  @RequirePermission('dashboard.view')
  async getDebt(
    @Query() query: DashboardDebtQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const allowed = await this.permissionKeys(req);
    if (!allowed.has('debt.view')) return null;
    // Không truyền query -> DebtService tự đọc Settings.Dashboard.upcomingDueDays.
    const days = query.upcomingDueDays
      ? parseInt(query.upcomingDueDays, 10)
      : undefined;
    return this.dashboardService.getDebtDashboard(
      days !== undefined && Number.isFinite(days) ? days : undefined,
      this.parseRange(query),
    );
  }

  @Get('returns')
  @RequirePermission('dashboard.view')
  async getReturns(
    @Query() query: DashboardOverviewQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const allowed = await this.permissionKeys(req);
    if (!allowed.has('return.view')) return null;
    return this.dashboardService.getReturnDashboard(this.parseRange(query));
  }

  // Dải "Hôm nay" (027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 5) — bộ
  // lọc riêng, mặc định "Hôm nay" nhưng đổi được. Ẩn từng số theo đúng quyền
  // view của module sở hữu (không phải view-cost — đây là số đếm/tiền vận
  // hành, không phải KPI tài chính kế hoạch), giống cách getOverview() đang
  // làm — không ẩn cả khối.
  @Get('today')
  @RequirePermission('dashboard.view')
  async getToday(
    @Query() query: DashboardOverviewQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const range = this.parseRange(query);
    const today = await this.dashboardService.getTodaySummary(
      range?.from && range?.to ? { from: range.from, to: range.to } : undefined,
    );
    const allowed = await this.permissionKeys(req);
    return {
      newOrders: allowed.has('sales-order.view') ? today.newOrders : null,
      shippedOrders: allowed.has('sales-order.view')
        ? today.shippedOrders
        : null,
      cashInToday: allowed.has('debt.view') ? today.cashInToday : null,
    };
  }

  @Get('alerts')
  @RequirePermission('dashboard.view')
  async getAlerts(@Req() req: AuthenticatedRequest) {
    const alerts = await this.dashboardService.getAlerts();
    const allowed = await this.permissionKeys(req);
    return this.buildGatedAlerts(alerts, allowed);
  }

  private async permissionKeys(
    req: AuthenticatedRequest,
  ): Promise<Set<string>> {
    const roleId = req.user.roleId;
    if (!roleId) return new Set();
    return new Set(
      await this.permissionService.getPermissionKeysForRole(roleId),
    );
  }

  private hideUnlessAllowed<T>(
    data: T,
    allowed: Set<string>,
    key: string,
  ): T | null {
    return allowed.has(key) ? data : null;
  }

  // Dùng chung bởi getOverview() và getAlerts() — trước đây getOverview() trả
  // thẳng alerts không lọc theo quyền, khác với getAlerts() độc lập (bug, xem
  // ghi chú ở getOverview()).
  private buildGatedAlerts(
    alerts: Awaited<ReturnType<DashboardService['getAlerts']>>,
    allowed: Set<string>,
  ) {
    return {
      overdueDebt: this.hideUnlessAllowed(
        alerts.overdueDebt,
        allowed,
        'debt.view',
      ),
      creditLimitExceeded: this.hideUnlessAllowed(
        alerts.creditLimitExceeded,
        allowed,
        'debt.view',
      ),
      // 026-cai-tien-dashboard.md mục 6 — trước đây không lọc theo quyền
      // (ghi nhận là bug, xem dashboard/page.tsx cũ). Đơn trễ giao là trạng
      // thái vận hành, không phải tài chính — dùng sales-order.view, không
      // phải sales-order.view-cost.
      delayedOrders: this.hideUnlessAllowed(
        alerts.delayedOrders,
        allowed,
        'sales-order.view',
      ),
      pendingQuotations: this.hideUnlessAllowed(
        alerts.pendingQuotations,
        allowed,
        'quotation.view',
      ),
      overdueProductionOrders: this.hideUnlessAllowed(
        alerts.overdueProductionOrders,
        allowed,
        'production.view',
      ),
    };
  }
}
