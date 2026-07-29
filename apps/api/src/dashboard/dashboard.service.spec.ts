import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductionOrderService } from '../production/production-order.service';
import { DebtService } from '../debt/debt.service';
import { ReturnService } from '../return/return.service';
import { QuotationWorkflowService } from '../quotation/quotation-workflow.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let salesOrderService: Record<string, jest.Mock>;
  let productionOrderService: Record<string, jest.Mock>;
  let debtService: Record<string, jest.Mock>;
  let returnService: Record<string, jest.Mock>;
  let quotationService: Record<string, jest.Mock>;

  beforeEach(async () => {
    salesOrderService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ totalRevenue: 100 }),
      getRecentOrders: jest.fn().mockResolvedValue([{ code: 'SO000001' }]),
      getDelayedOrders: jest.fn().mockResolvedValue([]),
      getTodaySummary: jest
        .fn()
        .mockResolvedValue({ newOrders: 3, shippedOrders: 2 }),
    };
    productionOrderService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ inProduction: 1 }),
      getBusyCenters: jest.fn().mockResolvedValue([]),
      getProgressSummary: jest
        .fn()
        .mockResolvedValue({ overallProgressPercent: 50 }),
      getOverdueProductionOrders: jest.fn().mockResolvedValue([]),
    };
    debtService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ totalRemaining: 200 }),
      getOverdueCustomers: jest.fn().mockResolvedValue([]),
      getUpcomingDueReceivables: jest.fn().mockResolvedValue([]),
      getCreditLimitExceededCustomers: jest.fn().mockResolvedValue([]),
      getTopDebtors: jest.fn().mockResolvedValue([]),
      getCashInReport: jest.fn().mockResolvedValue({ totalCashIn: 500000 }),
      getReceivablesInRangeSummary: jest
        .fn()
        .mockResolvedValue({ newReceivableCount: 2, newReceivableAmount: 3000000, cashIn: { totalCashIn: 1500000 } }),
    };
    returnService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ returnsThisMonth: 0 }),
      getAgingRecoveryInventory: jest
        .fn()
        .mockResolvedValue({ over30Days: 0, over90Days: 0 }),
      getTopReturnReasons: jest.fn().mockResolvedValue([]),
      getReturnsByCustomer: jest.fn().mockResolvedValue([]),
    };
    quotationService = {
      getPendingResponseQuotations: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: SalesOrderService, useValue: salesOrderService },
        { provide: ProductionOrderService, useValue: productionOrderService },
        { provide: DebtService, useValue: debtService },
        { provide: ReturnService, useValue: returnService },
        { provide: QuotationWorkflowService, useValue: quotationService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('getDebtDashboard() calls DebtService with the requested upcomingDueDays window', async () => {
    await service.getDebtDashboard(14);
    expect(debtService.getUpcomingDueReceivables).toHaveBeenCalledWith(14);
  });

  // 027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 3-4 — khối Tổng công nợ có
  // bộ lọc riêng, chỉ ảnh hưởng "inRange" (2 tile phát sinh), không đụng các
  // tile số dư cũ (summary/overdueCustomers/upcomingDue/creditExceeded/topDebtors).
  it('getDebtDashboard() không truyền range -> inRange = null, không gọi getReceivablesInRangeSummary', async () => {
    const result = await service.getDebtDashboard();

    expect(debtService.getReceivablesInRangeSummary).not.toHaveBeenCalled();
    expect(result.inRange).toBeNull();
    expect(result.summary).toEqual({ totalRemaining: 200 });
  });

  it('getDebtDashboard() truyền range đủ from/to -> inRange lấy từ getReceivablesInRangeSummary', async () => {
    const range = { from: new Date('2026-07-01'), to: new Date('2026-07-31') };
    const result = await service.getDebtDashboard(undefined, range);

    expect(debtService.getReceivablesInRangeSummary).toHaveBeenCalledWith(
      range.from,
      range.to,
    );
    expect(result.inRange).toEqual({
      newReceivableCount: 2,
      newReceivableAmount: 3000000,
      cashIn: { totalCashIn: 1500000 },
    });
  });

  // Khối Kinh doanh (mục 2) — bộ lọc riêng giờ áp cả vào summary (6 tile).
  it('getSalesDashboard() forwards range to SalesOrderService.getDashboardSummary', async () => {
    const range = { from: new Date('2026-07-28'), to: new Date('2026-07-28') };
    await service.getSalesDashboard(range);

    expect(salesOrderService.getDashboardSummary).toHaveBeenCalledWith(range);
  });

  // Cảnh báo tồn kho gỡ khỏi Dashboard cùng đợt gỡ khối Kho (chốt 18/07/2026,
  // 007-bo-loc-thoi-gian-dashboard.md; module Kho sau đó tạm gỡ hẳn khỏi
  // triển khai — xem warehouse.md "Trạng thái triển khai"). Báo giá chưa
  // phản hồi/phiếu SX trễ SLA thêm ở 026-cai-tien-dashboard.md mục 3.
  it('getAlerts() aggregates from Debt/SalesOrder/Quotation/Production services', async () => {
    const result = await service.getAlerts();
    expect(debtService.getOverdueCustomers).toHaveBeenCalled();
    expect(debtService.getCreditLimitExceededCustomers).toHaveBeenCalled();
    expect(salesOrderService.getDelayedOrders).toHaveBeenCalled();
    expect(quotationService.getPendingResponseQuotations).toHaveBeenCalled();
    expect(
      productionOrderService.getOverdueProductionOrders,
    ).toHaveBeenCalled();
    expect(result).toEqual({
      overdueDebt: [],
      creditLimitExceeded: [],
      delayedOrders: [],
      pendingQuotations: [],
      overdueProductionOrders: [],
    });
  });

  it('getTodaySummary() combines SalesOrder today counts with Debt cash-in today', async () => {
    const result = await service.getTodaySummary();

    expect(salesOrderService.getTodaySummary).toHaveBeenCalled();
    expect(debtService.getCashInReport).toHaveBeenCalled();
    expect(result).toEqual({
      newOrders: 3,
      shippedOrders: 2,
      cashInToday: 500000,
    });
  });

  // Khối "Hôm nay" giờ có bộ lọc riêng (mục 5) — khi FE truyền range khác
  // hôm nay (vd "Hôm qua"), phải dùng đúng range đó thay vì tự tính lại hôm nay.
  it('getTodaySummary(range) dùng đúng range được truyền, không tự tính lại hôm nay', async () => {
    const range = { from: new Date('2026-07-27T00:00:00'), to: new Date('2026-07-27T23:59:59.999') };
    await service.getTodaySummary(range);

    expect(salesOrderService.getTodaySummary).toHaveBeenCalledWith(range);
    expect(debtService.getCashInReport).toHaveBeenCalledWith(
      range.from,
      range.to,
    );
  });

  it('getOverview() composes sales/production/debt/returns/today/alerts — no warehouse', async () => {
    const overview = await service.getOverview();

    expect(overview).toHaveProperty('sales');
    expect(overview).toHaveProperty('production');
    expect(overview).toHaveProperty('debt');
    expect(overview).toHaveProperty('returns');
    expect(overview).toHaveProperty('today');
    expect(overview).toHaveProperty('alerts');
    expect(overview).not.toHaveProperty('warehouse');

    expect(salesOrderService.getDashboardSummary).toHaveBeenCalled();
    expect(productionOrderService.getDashboardSummary).toHaveBeenCalled();
    expect(debtService.getDashboardSummary).toHaveBeenCalled();
  });

  it('getOverview() forwards the range filter to Production and Return dashboards', async () => {
    const range = { from: new Date('2026-07-18'), to: new Date('2026-07-18') };
    await service.getOverview(range);

    expect(productionOrderService.getDashboardSummary).toHaveBeenCalledWith(
      range,
    );
    expect(returnService.getDashboardSummary).toHaveBeenCalledWith(range);
    expect(returnService.getTopReturnReasons).toHaveBeenCalledWith(range);
    expect(returnService.getReturnsByCustomer).toHaveBeenCalledWith(range);
  });
});
