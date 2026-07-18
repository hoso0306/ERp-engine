import { Injectable } from '@nestjs/common';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductionOrderService } from '../production/production-order.service';
import { DebtService } from '../debt/debt.service';
import { ReturnService } from '../return/return.service';

// Dashboard không truy cập Prisma/Repository — chỉ gọi Service của module sở
// hữu dữ liệu (Module Ownership, xem knowledge/modules/dashboard.md).
@Injectable()
export class DashboardService {
  constructor(
    private readonly salesOrderService: SalesOrderService,
    private readonly productionOrderService: ProductionOrderService,
    private readonly debtService: DebtService,
    private readonly returnService: ReturnService,
  ) {}

  // Rà soát bộ lọc thời gian Dashboard (chốt 18/07/2026,
  // 007-bo-loc-thoi-gian-dashboard.md): range = bộ lọc đầu trang Dashboard,
  // chỉ ảnh hưởng các khối được thiết kế lọc theo kỳ (Sản xuất
  // Hoàn thành/Huỷ, Hàng hoàn) — Kinh doanh/Công nợ lọc riêng ở FE
  // (danh sách con), Kho đã gỡ khỏi Dashboard (chưa triển khai báo cáo Kho).
  async getOverview(range?: { from?: Date; to?: Date }) {
    const [sales, production, debt, returns, alerts] = await Promise.all([
      this.getSalesDashboard(),
      this.getProductionDashboard(range),
      this.getDebtDashboard(),
      this.getReturnDashboard(range),
      this.getAlerts(),
    ]);

    return { sales, production, debt, returns, alerts };
  }

  async getSalesDashboard() {
    const [summary, recentOrders] = await Promise.all([
      this.salesOrderService.getDashboardSummary(),
      this.salesOrderService.getRecentOrders(),
    ]);

    return { summary, recentOrders };
  }

  async getProductionDashboard(range?: { from?: Date; to?: Date }) {
    const [summary, busyCenters, progress] = await Promise.all([
      this.productionOrderService.getDashboardSummary(range),
      this.productionOrderService.getBusyCenters(),
      this.productionOrderService.getProgressSummary(),
    ]);

    return { summary, busyCenters, progress };
  }

  // getWarehouseDashboard() đã gỡ hẳn cùng đợt tạm gỡ module Kho khỏi triển
  // khai (18/07/2026 — xem warehouse.md mục "Trạng thái triển khai").

  // upcomingDueDays: nếu không truyền, DebtService tự đọc Settings.Dashboard.upcomingDueDays
  // — Dashboard không hard-code giá trị mặc định (Task 04, 010-cai-dat.md).
  async getDebtDashboard(upcomingDueDays?: number) {
    const [summary, overdueCustomers, upcomingDue, creditExceeded, topDebtors] =
      await Promise.all([
        this.debtService.getDashboardSummary(),
        this.debtService.getOverdueCustomers(),
        this.debtService.getUpcomingDueReceivables(upcomingDueDays),
        this.debtService.getCreditLimitExceededCustomers(),
        this.debtService.getTopDebtors(),
      ]);

    return {
      summary,
      overdueCustomers,
      upcomingDue,
      creditExceeded,
      topDebtors,
    };
  }

  async getReturnDashboard(range?: { from?: Date; to?: Date }) {
    const [summary, aging, topReasons, byCustomer] = await Promise.all([
      this.returnService.getDashboardSummary(range),
      this.returnService.getAgingRecoveryInventory(),
      this.returnService.getTopReturnReasons(range),
      this.returnService.getReturnsByCustomer(range),
    ]);

    return { summary, aging, topReasons, byCustomer };
  }

  // Cảnh báo tồn kho (sắp hết/hết hàng) gỡ khỏi Dashboard cùng đợt gỡ khối Kho
  // (chốt 18/07/2026, 007-bo-loc-thoi-gian-dashboard.md — chưa triển khai báo
  // cáo Kho). Còn lại: nợ quá hạn, vượt hạn mức, đơn trễ giao — luôn toàn bộ
  // thời gian, không lọc theo bộ lọc đầu trang.
  async getAlerts() {
    const [overdueCustomers, creditExceeded, delayedOrders] =
      await Promise.all([
        this.debtService.getOverdueCustomers(),
        this.debtService.getCreditLimitExceededCustomers(),
        this.salesOrderService.getDelayedOrders(),
      ]);

    return {
      overdueDebt: overdueCustomers,
      creditLimitExceeded: creditExceeded,
      delayedOrders,
    };
  }
}
