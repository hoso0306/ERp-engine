import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductionOrderService } from '../production/production-order.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { DebtService } from '../debt/debt.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let salesOrderService: Record<string, jest.Mock>;
  let productionOrderService: Record<string, jest.Mock>;
  let warehouseService: Record<string, jest.Mock>;
  let debtService: Record<string, jest.Mock>;

  beforeEach(async () => {
    salesOrderService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ totalRevenue: 100 }),
      getRecentOrders: jest.fn().mockResolvedValue([{ code: 'SO000001' }]),
      getDelayedOrders: jest.fn().mockResolvedValue([]),
    };
    productionOrderService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ inProduction: 1 }),
      getBusyCenters: jest.fn().mockResolvedValue([]),
      getProgressSummary: jest.fn().mockResolvedValue({ overallProgressPercent: 50 }),
    };
    warehouseService = {
      getLowStockMaterials: jest.fn().mockResolvedValue([
        { code: 'NL001', outOfStock: false },
        { code: 'NL002', outOfStock: true },
      ]),
      getTopConsumedMaterials: jest.fn().mockResolvedValue([]),
      getInventorySummary: jest.fn().mockResolvedValue({ totalMaterials: 5 }),
    };
    debtService = {
      getDashboardSummary: jest.fn().mockResolvedValue({ totalRemaining: 200 }),
      getOverdueCustomers: jest.fn().mockResolvedValue([]),
      getUpcomingDueReceivables: jest.fn().mockResolvedValue([]),
      getCreditLimitExceededCustomers: jest.fn().mockResolvedValue([]),
      getTopDebtors: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: SalesOrderService, useValue: salesOrderService },
        { provide: ProductionOrderService, useValue: productionOrderService },
        { provide: WarehouseService, useValue: warehouseService },
        { provide: DebtService, useValue: debtService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('getWarehouseDashboard() reuses the already-fetched lowStockMaterials instead of querying twice', async () => {
    await service.getWarehouseDashboard();

    expect(warehouseService.getLowStockMaterials).toHaveBeenCalledTimes(1);
    expect(warehouseService.getInventorySummary).toHaveBeenCalledWith([
      { code: 'NL001', outOfStock: false },
      { code: 'NL002', outOfStock: true },
    ]);
  });

  it('getWarehouseDashboard() splits low-stock vs out-of-stock from one query', async () => {
    const result = await service.getWarehouseDashboard();
    expect(result.lowStockMaterials).toEqual([{ code: 'NL001', outOfStock: false }]);
    expect(result.outOfStockMaterials).toEqual([{ code: 'NL002', outOfStock: true }]);
  });

  it('getDebtDashboard() calls DebtService with the requested upcomingDueDays window', async () => {
    await service.getDebtDashboard(14);
    expect(debtService.getUpcomingDueReceivables).toHaveBeenCalledWith(14);
  });

  it('getAlerts() aggregates from Debt/Warehouse/SalesOrder services only — no Prisma access', async () => {
    const result = await service.getAlerts();
    expect(debtService.getOverdueCustomers).toHaveBeenCalled();
    expect(debtService.getCreditLimitExceededCustomers).toHaveBeenCalled();
    expect(warehouseService.getLowStockMaterials).toHaveBeenCalled();
    expect(salesOrderService.getDelayedOrders).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        overdueDebt: [],
        creditLimitExceeded: [],
        lowStockMaterials: [{ code: 'NL001', outOfStock: false }],
        outOfStockMaterials: [{ code: 'NL002', outOfStock: true }],
        delayedOrders: [],
      }),
    );
  });

  it('getOverview() composes all five sections by calling each Service exactly once per section', async () => {
    const overview = await service.getOverview();

    expect(overview).toHaveProperty('sales');
    expect(overview).toHaveProperty('production');
    expect(overview).toHaveProperty('warehouse');
    expect(overview).toHaveProperty('debt');
    expect(overview).toHaveProperty('alerts');

    expect(salesOrderService.getDashboardSummary).toHaveBeenCalled();
    expect(productionOrderService.getDashboardSummary).toHaveBeenCalled();
    expect(warehouseService.getInventorySummary).toHaveBeenCalled();
    expect(debtService.getDashboardSummary).toHaveBeenCalled();
  });
});
