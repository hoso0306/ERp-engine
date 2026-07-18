import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductionOrderService } from '../production/production-order.service';
import { DebtService } from '../debt/debt.service';
import { ReturnService } from '../return/return.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let salesOrderService: Record<string, jest.Mock>;
  let productionOrderService: Record<string, jest.Mock>;
  let debtService: Record<string, jest.Mock>;
  let returnService: Record<string, jest.Mock>;

  beforeEach(async () => {
    salesOrderService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ totalRevenue: 100 }),
      getRecentOrders: jest.fn().mockResolvedValue([{ code: 'SO000001' }]),
      getDelayedOrders: jest.fn().mockResolvedValue([]),
    };
    productionOrderService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ inProduction: 1 }),
      getBusyCenters: jest.fn().mockResolvedValue([]),
      getProgressSummary: jest
        .fn()
        .mockResolvedValue({ overallProgressPercent: 50 }),
    };
    debtService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ totalRemaining: 200 }),
      getOverdueCustomers: jest.fn().mockResolvedValue([]),
      getUpcomingDueReceivables: jest.fn().mockResolvedValue([]),
      getCreditLimitExceededCustomers: jest.fn().mockResolvedValue([]),
      getTopDebtors: jest.fn().mockResolvedValue([]),
    };
    returnService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ returnsThisMonth: 0 }),
      getAgingRecoveryInventory: jest
        .fn()
        .mockResolvedValue({ over30Days: 0, over90Days: 0 }),
      getTopReturnReasons: jest.fn().mockResolvedValue([]),
      getReturnsByCustomer: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: SalesOrderService, useValue: salesOrderService },
        { provide: ProductionOrderService, useValue: productionOrderService },
        { provide: DebtService, useValue: debtService },
        { provide: ReturnService, useValue: returnService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('getDebtDashboard() calls DebtService with the requested upcomingDueDays window', async () => {
    await service.getDebtDashboard(14);
    expect(debtService.getUpcomingDueReceivables).toHaveBeenCalledWith(14);
  });

  // Cảnh báo tồn kho gỡ khỏi Dashboard cùng đợt gỡ khối Kho (chốt 18/07/2026,
  // 007-bo-loc-thoi-gian-dashboard.md; module Kho sau đó tạm gỡ hẳn khỏi
  // triển khai — xem warehouse.md "Trạng thái triển khai").
  it('getAlerts() aggregates from Debt/SalesOrder services only', async () => {
    const result = await service.getAlerts();
    expect(debtService.getOverdueCustomers).toHaveBeenCalled();
    expect(debtService.getCreditLimitExceededCustomers).toHaveBeenCalled();
    expect(salesOrderService.getDelayedOrders).toHaveBeenCalled();
    expect(result).toEqual({
      overdueDebt: [],
      creditLimitExceeded: [],
      delayedOrders: [],
    });
  });

  it('getOverview() composes sales/production/debt/returns/alerts — no warehouse', async () => {
    const overview = await service.getOverview();

    expect(overview).toHaveProperty('sales');
    expect(overview).toHaveProperty('production');
    expect(overview).toHaveProperty('debt');
    expect(overview).toHaveProperty('returns');
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
