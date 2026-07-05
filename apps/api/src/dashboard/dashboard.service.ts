import { Injectable } from '@nestjs/common';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductionOrderService } from '../production/production-order.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { DebtService } from '../debt/debt.service';

// Dashboard không truy cập Prisma/Repository — chỉ gọi Service của module sở
// hữu dữ liệu (Module Ownership, xem knowledge/modules/dashboard.md).
@Injectable()
export class DashboardService {
  constructor(
    private readonly salesOrderService: SalesOrderService,
    private readonly productionOrderService: ProductionOrderService,
    private readonly warehouseService: WarehouseService,
    private readonly debtService: DebtService,
  ) {}

  async getOverview() {
    const [sales, production, warehouse, debt, alerts] = await Promise.all([
      this.getSalesDashboard(),
      this.getProductionDashboard(),
      this.getWarehouseDashboard(),
      this.getDebtDashboard(),
      this.getAlerts(),
    ]);

    return { sales, production, warehouse, debt, alerts };
  }

  async getSalesDashboard() {
    const [summary, recentOrders] = await Promise.all([
      this.salesOrderService.getDashboardSummary(),
      this.salesOrderService.getRecentOrders(),
    ]);

    return { summary, recentOrders };
  }

  async getProductionDashboard() {
    const [summary, busyCenters, progress] = await Promise.all([
      this.productionOrderService.getDashboardSummary(),
      this.productionOrderService.getBusyCenters(),
      this.productionOrderService.getProgressSummary(),
    ]);

    return { summary, busyCenters, progress };
  }

  async getWarehouseDashboard() {
    const [lowStockMaterials, topConsumedMaterials] = await Promise.all([
      this.warehouseService.getLowStockMaterials(),
      this.warehouseService.getTopConsumedMaterials(),
    ]);
    // Truyền lowStockMaterials đã có sẵn — tránh gọi lại cùng một query.
    const inventorySummary = await this.warehouseService.getInventorySummary(lowStockMaterials);

    return {
      inventorySummary,
      topConsumedMaterials,
      lowStockMaterials: lowStockMaterials.filter((m) => !m.outOfStock),
      outOfStockMaterials: lowStockMaterials.filter((m) => m.outOfStock),
    };
  }

  async getDebtDashboard(upcomingDueDays = 7) {
    const [summary, overdueCustomers, upcomingDue, creditExceeded, topDebtors] =
      await Promise.all([
        this.debtService.getDashboardSummary(),
        this.debtService.getOverdueCustomers(),
        this.debtService.getUpcomingDueReceivables(upcomingDueDays),
        this.debtService.getCreditLimitExceededCustomers(),
        this.debtService.getTopDebtors(),
      ]);

    return { summary, overdueCustomers, upcomingDue, creditExceeded, topDebtors };
  }

  async getAlerts() {
    const [overdueCustomers, creditExceeded, lowStockMaterials, delayedOrders] =
      await Promise.all([
        this.debtService.getOverdueCustomers(),
        this.debtService.getCreditLimitExceededCustomers(),
        this.warehouseService.getLowStockMaterials(),
        this.salesOrderService.getDelayedOrders(),
      ]);

    return {
      overdueDebt: overdueCustomers,
      creditLimitExceeded: creditExceeded,
      lowStockMaterials: lowStockMaterials.filter((m) => !m.outOfStock),
      outOfStockMaterials: lowStockMaterials.filter((m) => m.outOfStock),
      delayedOrders,
    };
  }
}
