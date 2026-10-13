import { ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { ReportController } from './report.controller';
import type { ReportService } from './report.service';
import type { ExcelService } from '../shared/excel/excel.service';
import type { PdfService } from '../shared/pdf/pdf.service';
import type { PermissionService } from '../permission/permission.service';
import type { AuthenticatedRequest } from '../auth/auth.guard';

// 029-phan-quyen-theo-tung-bao-cao.md — export `/reports/:name/export` không
// gắn @RequirePermission tĩnh được (`:name` động), nên tự kiểm tra
// `report.${name}` trong method. Chỉ cover nhánh phân quyền này.
describe('ReportController.export() — phân quyền theo từng báo cáo', () => {
  let controller: ReportController;
  let reportService: { buildExport: jest.Mock; exportSubtitle: jest.Mock };
  let excelService: { export: jest.Mock };
  let permissionService: { hasPermission: jest.Mock };

  const query = { from: '2026-10-01', to: '2026-10-31' };
  const res = {} as Response;
  const req = (roleId?: string) =>
    ({
      user: roleId ? { userId: 'u-1', roleId } : undefined,
    }) as AuthenticatedRequest;

  beforeEach(() => {
    reportService = {
      buildExport: jest.fn().mockResolvedValue({ columns: [], rows: [] }),
      exportSubtitle: jest.fn(),
    };
    excelService = { export: jest.fn().mockResolvedValue(undefined) };
    permissionService = { hasPermission: jest.fn() };
    controller = new ReportController(
      reportService as unknown as ReportService,
      excelService as unknown as ExcelService,
      {} as PdfService,
      permissionService as unknown as PermissionService,
    );
  });

  it('có đúng quyền report.<name> -> xuất file', async () => {
    permissionService.hasPermission.mockResolvedValue(true);

    await controller.export('orders-list', query, req('role-1'), res);

    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      'role-1',
      'report.orders-list',
    );
    expect(reportService.buildExport).toHaveBeenCalled();
    expect(excelService.export).toHaveBeenCalled();
  });

  it('thiếu quyền của đúng báo cáo đó -> 403, không build dữ liệu', async () => {
    permissionService.hasPermission.mockResolvedValue(false);

    await expect(
      controller.export('profit', query, req('role-1'), res),
    ).rejects.toThrow(ForbiddenException);
    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      'role-1',
      'report.profit',
    );
    expect(reportService.buildExport).not.toHaveBeenCalled();
  });

  it('không xác định được role -> 403', async () => {
    await expect(
      controller.export('revenue', query, req(), res),
    ).rejects.toThrow(ForbiddenException);
    expect(permissionService.hasPermission).not.toHaveBeenCalled();
    expect(reportService.buildExport).not.toHaveBeenCalled();
  });
});

// 031-loi-nhuan-theo-xuong.md — lợi nhuận kế hoạch theo xưởng chỉ trả khi
// role có THÊM `report.profit`; thiếu quyền thì API bỏ hẳn các field lợi nhuận.
describe('ReportController — lợi nhuận theo xưởng theo quyền report.profit', () => {
  let controller: ReportController;
  let reportService: {
    getRevenueByProductionCenter: jest.Mock;
    getProductionCenterRevenue: jest.Mock;
  };
  let permissionService: { hasPermission: jest.Mock };

  const query = { from: '2026-10-01', to: '2026-10-31' };
  const req = {
    user: { userId: 'u-1', roleId: 'role-1' },
  } as AuthenticatedRequest;
  const listData = {
    totalRevenue: 600,
    totalPlannedProfit: 240,
    centers: [
      {
        productionCenterId: 'pc-a',
        productionCenterName: 'A',
        orderCount: 2,
        revenue: 600,
        revenuePercent: 100,
        plannedCost: 300,
        plannedProfit: 240,
      },
    ],
  };
  const seriesData = {
    totalRevenue: 600,
    totalPlannedProfit: 240,
    orderCount: 2,
    series: [{ period: '2026-10-01', revenue: 600, plannedProfit: 240 }],
  };

  beforeEach(() => {
    reportService = {
      getRevenueByProductionCenter: jest.fn().mockResolvedValue(listData),
      getProductionCenterRevenue: jest.fn().mockResolvedValue(seriesData),
    };
    permissionService = { hasPermission: jest.fn() };
    controller = new ReportController(
      reportService as unknown as ReportService,
      {} as ExcelService,
      {} as PdfService,
      permissionService as unknown as PermissionService,
    );
  });

  it('có report.profit -> trả đủ lợi nhuận (danh sách + chi tiết)', async () => {
    permissionService.hasPermission.mockResolvedValue(true);

    expect(await controller.getRevenueByProductionCenter(query, req)).toEqual(
      listData,
    );
    expect(
      await controller.getProductionCenterRevenue('pc-a', query, req),
    ).toEqual(seriesData);
    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      'role-1',
      'report.profit',
    );
  });

  it('thiếu report.profit -> bỏ hết field lợi nhuận/giá vốn, giữ doanh thu', async () => {
    permissionService.hasPermission.mockResolvedValue(false);

    expect(await controller.getRevenueByProductionCenter(query, req)).toEqual({
      totalRevenue: 600,
      centers: [
        {
          productionCenterId: 'pc-a',
          productionCenterName: 'A',
          orderCount: 2,
          revenue: 600,
          revenuePercent: 100,
        },
      ],
    });
    expect(
      await controller.getProductionCenterRevenue('pc-a', query, req),
    ).toEqual({
      totalRevenue: 600,
      orderCount: 2,
      series: [{ period: '2026-10-01', revenue: 600 }],
    });
  });
});
