import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from '../setting/setting.service';
import { PermissionService } from '../permission/permission.service';

function makeSalesOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1',
    code: 'SO000001',
    status: 'PRODUCTION_COMPLETED',
    receivable: null,
    productionOrders: [],
    deliveryName: 'Nguyễn Văn Cũ',
    deliveryPhone: '0900000000',
    deliveryAddress: 'Địa chỉ cũ',
    deliveryProvince: 'Hà Nội',
    deliveryDistrict: 'Cầu Giấy',
    deliveryWard: null,
    carrierName: null,
    carrierPhone: null,
    carrierNote: null,
    ...overrides,
  };
}

// Sprint 04 (005-nguoi-thuc-hien-lich-su-hoat-dong.md) — ship/deliver/override/
// cancel giờ ghi createdBy/createdByName từ JWT userId thay vì bỏ trống hoặc
// free-text overrideBy/cancelledBy (đã xoá khỏi DTO).
describe('SalesOrderService — actor name snapshot', () => {
  let service: SalesOrderService;
  let prisma: {
    salesOrder: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    salesOrderTimeline: { create: jest.Mock };
    productionOrder: { updateMany: jest.Mock };
    productionOrderTimeline: { createMany: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      salesOrder: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      salesOrderTimeline: { create: jest.fn() },
      productionOrder: { updateMany: jest.fn() },
      productionOrderTimeline: { createMany: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Nguyễn Văn An', email: 'an@acme.vn' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderService,
        { provide: PrismaService, useValue: prisma },
        // Report methods (014-bao-cao.md Task 00) cần timezone — các test ở
        // đây không đụng tới, mock tối thiểu.
        {
          provide: SettingService,
          useValue: {
            getCompany: jest
              .fn()
              .mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }),
          },
        },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
    prisma.salesOrder.findUniqueOrThrow.mockResolvedValue(makeSalesOrder());
  });

  describe('ship()', () => {
    it('ghi createdBy/createdByName từ JWT userId', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.ship('so-1', 'user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { name: true, email: true },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
          }),
        }),
      );
    });

    it('createdBy/createdByName đều null khi không có userId', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.ship('so-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: null,
            createdByName: null,
          }),
        }),
      );
    });
  });

  describe('deliver()', () => {
    it('ghi createdBy/createdByName từ JWT userId, fallback email khi name null', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'SHIPPED' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        name: null,
        email: 'an@acme.vn',
      });

      await service.deliver('so-1', 'user-1');

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'an@acme.vn',
          }),
        }),
      );
    });
  });

  describe('override()', () => {
    it('ghi createdBy/createdByName từ JWT userId — không còn overrideBy free-text', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.override(
        'so-1',
        { newStatus: 'SHIPPED', reason: 'Sửa lại theo yêu cầu khách' },
        'user-1',
      );

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
          }),
        }),
      );
    });
  });

  describe('cancel()', () => {
    it('ghi createdBy/createdByName từ JWT userId — không còn cancelledBy free-text', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'IN_PRODUCTION' }),
      );

      await service.cancel('so-1', { reason: 'Khách huỷ đơn' }, 'user-1');

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
          }),
        }),
      );
    });

    it('rejects khi đã DELIVERED (business rule sẵn có, không đụng khi thêm actor name)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'DELIVERED' }),
      );
      await expect(
        service.cancel('so-1', { reason: 'x' }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Sprint 04 (009-in-phieu-san-xuat.md) — không phải Manual Override: không
  // đổi Status, không bắt buộc lý do, sửa được ở mọi Status.
  describe('updateDeliveryAddress()', () => {
    const dto = {
      deliveryName: 'Nguyễn Văn Mới',
      deliveryPhone: '0911111111',
      deliveryAddress: 'Công trình Ecopark',
      deliveryProvince: 'Hưng Yên',
      deliveryDistrict: 'Văn Giang',
      deliveryWard: null,
    };

    it('ghi Timeline DELIVERY_ADDRESS_UPDATED với payload old/new + createdBy', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.updateDeliveryAddress('so-1', dto, 'user-1');

      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: {
          deliveryName: 'Nguyễn Văn Mới',
          deliveryPhone: '0911111111',
          deliveryAddress: 'Công trình Ecopark',
          deliveryProvince: 'Hưng Yên',
          deliveryDistrict: 'Văn Giang',
          deliveryWard: null,
        },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELIVERY_ADDRESS_UPDATED',
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
            payload: {
              old: {
                deliveryName: 'Nguyễn Văn Cũ',
                deliveryPhone: '0900000000',
                deliveryAddress: 'Địa chỉ cũ',
                deliveryProvince: 'Hà Nội',
                deliveryDistrict: 'Cầu Giấy',
                deliveryWard: null,
              },
              new: {
                deliveryName: 'Nguyễn Văn Mới',
                deliveryPhone: '0911111111',
                deliveryAddress: 'Công trình Ecopark',
                deliveryProvince: 'Hưng Yên',
                deliveryDistrict: 'Văn Giang',
                deliveryWard: null,
              },
            },
          }),
        }),
      );
    });

    it('không đổi Status — sửa được kể cả khi đã DELIVERED/CANCELLED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateDeliveryAddress('so-1', dto, 'user-1'),
      ).resolves.toBeDefined();
      expect(prisma.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
      );
    });

    it('bắt buộc deliveryName', async () => {
      await expect(
        service.updateDeliveryAddress('so-1', { ...dto, deliveryName: '  ' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('không bắt buộc deliveryPhone', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      await expect(
        service.updateDeliveryAddress('so-1', { ...dto, deliveryPhone: '' }, 'user-1'),
      ).resolves.toBeDefined();
    });

    it('không bắt buộc lý do (khác Manual Override)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      // dto không có field `reason` — service không được đòi hỏi nó.
      await expect(
        service.updateDeliveryAddress('so-1', dto, 'user-1'),
      ).resolves.toBeDefined();
    });
  });

  // 009-in-phieu-san-xuat.md — cùng cơ chế updateDeliveryAddress() nhưng khác
  // nhóm dữ liệu (nhà xe chở hàng), không field nào bắt buộc.
  describe('updateCarrierInfo()', () => {
    const dto = {
      carrierName: 'Xe Anh Công',
      carrierPhone: '0988670165',
      carrierNote: 'Giao trước 9h sáng',
    };

    it('ghi Timeline CARRIER_INFO_UPDATED với payload old/new + createdBy', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.updateCarrierInfo('so-1', dto, 'user-1');

      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: {
          carrierName: 'Xe Anh Công',
          carrierPhone: '0988670165',
          carrierNote: 'Giao trước 9h sáng',
        },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CARRIER_INFO_UPDATED',
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
            payload: {
              old: { carrierName: null, carrierPhone: null, carrierNote: null },
              new: {
                carrierName: 'Xe Anh Công',
                carrierPhone: '0988670165',
                carrierNote: 'Giao trước 9h sáng',
              },
            },
          }),
        }),
      );
    });

    it('không có field nào bắt buộc — cho lưu rỗng hết', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await expect(
        service.updateCarrierInfo('so-1', {}, 'user-1'),
      ).resolves.toBeDefined();
      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { carrierName: null, carrierPhone: null, carrierNote: null },
      });
    });

    it('không đổi Status — sửa được kể cả khi đã DELIVERED/CANCELLED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateCarrierInfo('so-1', dto, 'user-1'),
      ).resolves.toBeDefined();
      expect(prisma.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
      );
    });
  });
});

// Dải "Hôm nay" (Dashboard, 026-cai-tien-dashboard.md mục 5).
describe('SalesOrderService.getTodaySummary()', () => {
  let service: SalesOrderService;
  let prisma: {
    salesOrder: { count: jest.Mock };
    salesOrderTimeline: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salesOrder: { count: jest.fn().mockResolvedValue(0) },
      salesOrderTimeline: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingService, useValue: {} },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
  });

  it('counts non-CANCELLED orders created in range, and distinct SHIPPED timelines in range', async () => {
    const range = {
      from: new Date('2026-07-28T00:00:00'),
      to: new Date('2026-07-28T23:59:59.999'),
    };
    prisma.salesOrder.count.mockResolvedValue(3);
    prisma.salesOrderTimeline.findMany.mockResolvedValue([
      { salesOrderId: 'so-1' },
      { salesOrderId: 'so-2' },
    ]);

    const result = await service.getTodaySummary(range);

    expect(prisma.salesOrder.count).toHaveBeenCalledWith({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        status: { not: 'CANCELLED' },
      },
    });
    expect(prisma.salesOrderTimeline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: 'SHIPPED',
          createdAt: { gte: range.from, lte: range.to },
        },
        distinct: ['salesOrderId'],
      }),
    );
    expect(result).toEqual({ newOrders: 3, shippedOrders: 2 });
  });
});

// Khối Kinh doanh (Dashboard, 027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 2)
// — giờ có bộ lọc riêng, áp cả vào 3 tile tiền lẫn 3 tile đếm.
describe('SalesOrderService.getDashboardSummary()', () => {
  let service: SalesOrderService;
  let prisma: {
    salesOrder: { aggregate: jest.Mock; groupBy: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salesOrder: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { totalAmount: 0, plannedCost: 0, plannedProfit: 0 },
        }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: SettingService, useValue: {} },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
  });

  it('không truyền range -> all-time, không thêm createdAt vào where', async () => {
    await service.getDashboardSummary();

    expect(prisma.salesOrder.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'CANCELLED' } },
      }),
    );
    expect(prisma.salesOrder.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('truyền range -> lọc createdAt trên cả aggregate (tile tiền) lẫn groupBy (tile đếm)', async () => {
    const range = {
      from: new Date('2026-07-28T00:00:00'),
      to: new Date('2026-07-28T23:59:59.999'),
    };

    await service.getDashboardSummary(range);

    expect(prisma.salesOrder.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { not: 'CANCELLED' },
          createdAt: { gte: range.from, lte: range.to },
        },
      }),
    );
    expect(prisma.salesOrder.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
    );
  });
});

// sprint-04/028 — Doanh số theo xưởng + nhắc khách lâu không mua.
describe('SalesOrderService — doanh số theo xưởng & thống kê theo khách', () => {
  let service: SalesOrderService;
  let prisma: {
    salesOrderItem: { findMany: jest.Mock };
    salesOrder: { groupBy: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      salesOrderItem: { findMany: jest.fn() },
      salesOrder: { groupBy: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SettingService,
          useValue: {
            getCompany: jest
              .fn()
              .mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }),
          },
        },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
  });

  // Đơn mẫu dùng chung (031): netRevenue = plannedProfit + plannedCost.
  //  so-1: tiền hàng 150, giá vốn 60, LN 70  (net 130)
  //  so-2: tiền hàng 350, giá vốn 150, LN 150 (net 300) — 2 xưởng A + B
  //  so-3: tiền hàng 100, giá vốn 70, LN 20   (net 90)  — bán lẻ vật tư
  const SO1 = { totalAmount: 150, plannedCost: 60, plannedProfit: 70 };
  const SO2 = { totalAmount: 350, plannedCost: 150, plannedProfit: 150 };
  const SO3 = { totalAmount: 100, plannedCost: 70, plannedProfit: 20 };

  describe('getRevenueByProductionCenter()', () => {
    it('gom theo xưởng, đếm đơn distinct, giữ dòng bán lẻ (null) riêng, tổng khớp SUM subtotal', async () => {
      prisma.salesOrderItem.findMany.mockResolvedValue([
        {
          salesOrderId: 'so-1',
          productionCenterId: 'pc-a',
          productionCenterName: 'Xưởng A',
          subtotal: 100,
          plannedCost: 40,
          salesOrder: SO1,
        },
        {
          salesOrderId: 'so-1',
          productionCenterId: 'pc-a',
          productionCenterName: 'Xưởng A',
          subtotal: 50,
          plannedCost: 20,
          salesOrder: SO1,
        },
        {
          salesOrderId: 'so-2',
          productionCenterId: 'pc-a',
          productionCenterName: 'Xưởng A mới',
          subtotal: 50,
          plannedCost: 30,
          salesOrder: SO2,
        },
        {
          salesOrderId: 'so-2',
          productionCenterId: 'pc-b',
          productionCenterName: 'Xưởng B',
          subtotal: 300,
          plannedCost: 120,
          salesOrder: SO2,
        },
        {
          salesOrderId: 'so-3',
          productionCenterId: null,
          productionCenterName: null,
          subtotal: 100,
          plannedCost: 70,
          salesOrder: SO3,
        },
      ]);

      const from = new Date('2026-10-01T00:00:00');
      const to = new Date('2026-10-31T23:59:59.999');
      const result = await service.getRevenueByProductionCenter(from, to);

      expect(prisma.salesOrderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            salesOrder: {
              status: { not: 'CANCELLED' },
              createdAt: { gte: from, lte: to },
            },
          },
        }),
      );
      expect(result.totalRevenue).toBe(600);
      expect(result.centers.map((c) => c.productionCenterId)).toEqual([
        'pc-b',
        'pc-a',
        null,
      ]);
      const [b, a, retail] = result.centers;
      expect(b).toMatchObject({
        productionCenterName: 'Xưởng B',
        orderCount: 1,
        revenue: 300,
        revenuePercent: 50,
        plannedCost: 120,
      });
      // Nhãn = snapshot gặp sau cùng (rows sắp createdAt tăng dần).
      expect(a).toMatchObject({
        productionCenterName: 'Xưởng A mới',
        orderCount: 2,
        revenue: 200,
        plannedCost: 90,
      });
      expect(a.revenuePercent).toBeCloseTo((200 / 600) * 100);
      expect(retail).toMatchObject({
        productionCenterName: null,
        orderCount: 1,
        revenue: 100,
        plannedCost: 70,
      });
    });

    it('lợi nhuận kế hoạch theo dòng của xưởng, Giảm thêm/VAT chia theo tỷ lệ doanh số; tổng = SUM(plannedProfit)', async () => {
      prisma.salesOrderItem.findMany.mockResolvedValue([
        {
          salesOrderId: 'so-1',
          productionCenterId: 'pc-a',
          productionCenterName: 'A',
          subtotal: 100,
          plannedCost: 40,
          salesOrder: SO1,
        },
        {
          salesOrderId: 'so-1',
          productionCenterId: 'pc-a',
          productionCenterName: 'A',
          subtotal: 50,
          plannedCost: 20,
          salesOrder: SO1,
        },
        {
          salesOrderId: 'so-2',
          productionCenterId: 'pc-a',
          productionCenterName: 'A',
          subtotal: 50,
          plannedCost: 30,
          salesOrder: SO2,
        },
        {
          salesOrderId: 'so-2',
          productionCenterId: 'pc-b',
          productionCenterName: 'B',
          subtotal: 300,
          plannedCost: 120,
          salesOrder: SO2,
        },
        {
          salesOrderId: 'so-3',
          productionCenterId: null,
          productionCenterName: null,
          subtotal: 100,
          plannedCost: 70,
          salesOrder: SO3,
        },
      ]);

      const result = await service.getRevenueByProductionCenter(
        new Date(),
        new Date(),
      );
      const byId = new Map(
        result.centers.map((c) => [c.productionCenterId, c]),
      );

      // Xưởng A: trọn LN đơn so-1 (70) + phần của so-2: 300×50/350 − 30.
      expect(byId.get('pc-a')!.plannedProfit).toBeCloseTo(
        70 + (300 * 50) / 350 - 30,
      );
      // Xưởng B: 300×300/350 − 120.
      expect(byId.get('pc-b')!.plannedProfit).toBeCloseTo(
        (300 * 300) / 350 - 120,
      );
      // Bán lẻ: trọn LN đơn so-3.
      expect(byId.get(null)!.plannedProfit).toBeCloseTo(20);
      // Tổng các xưởng = tổng LN kế hoạch các đơn (70 + 150 + 20).
      expect(result.totalPlannedProfit).toBeCloseTo(240);
      expect(
        result.centers.reduce((s, c) => s + c.plannedProfit, 0),
      ).toBeCloseTo(240);
    });

    it('không có dữ liệu -> tổng 0, danh sách rỗng', async () => {
      prisma.salesOrderItem.findMany.mockResolvedValue([]);
      const result = await service.getRevenueByProductionCenter(
        new Date(),
        new Date(),
      );
      expect(result).toEqual({
        totalRevenue: 0,
        totalPlannedProfit: 0,
        centers: [],
      });
    });

    it('đơn có totalAmount = 0 -> không chia (tránh chia cho 0), LN dòng = −giá vốn', async () => {
      prisma.salesOrderItem.findMany.mockResolvedValue([
        {
          salesOrderId: 'so-0',
          productionCenterId: 'pc-a',
          productionCenterName: 'A',
          subtotal: 0,
          plannedCost: 5,
          salesOrder: { totalAmount: 0, plannedCost: 5, plannedProfit: -5 },
        },
      ]);
      const result = await service.getRevenueByProductionCenter(
        new Date(),
        new Date(),
      );
      expect(result.centers[0].plannedProfit).toBe(-5);
      expect(result.totalPlannedProfit).toBe(-5);
    });
  });

  describe('getProductionCenterRevenueSeries()', () => {
    it('lọc đúng xưởng, cắt kỳ theo timezone công ty, đủ bucket trống, có chuỗi lợi nhuận', async () => {
      prisma.salesOrderItem.findMany.mockResolvedValue([
        // 23:30 ngày 01/10 giờ VN = 16:30Z — phải rơi vào ngày 01/10, không phải 02/10.
        {
          salesOrderId: 'so-1',
          subtotal: 100,
          plannedCost: 40,
          salesOrder: { ...SO1, createdAt: new Date('2026-10-01T16:30:00Z') },
        },
        {
          salesOrderId: 'so-1',
          subtotal: 50,
          plannedCost: 20,
          salesOrder: { ...SO1, createdAt: new Date('2026-10-01T16:30:00Z') },
        },
        {
          salesOrderId: 'so-2',
          subtotal: 50,
          plannedCost: 30,
          salesOrder: { ...SO2, createdAt: new Date('2026-10-03T03:00:00Z') },
        },
      ]);

      const from = new Date('2026-10-01T00:00:00+07:00');
      const to = new Date('2026-10-03T23:59:59.999+07:00');
      const result = await service.getProductionCenterRevenueSeries(
        'pc-a',
        from,
        to,
        'day',
      );

      expect(prisma.salesOrderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            productionCenterId: 'pc-a',
            salesOrder: {
              status: { not: 'CANCELLED' },
              createdAt: { gte: from, lte: to },
            },
          },
        }),
      );
      expect(result.totalRevenue).toBe(200);
      expect(result.orderCount).toBe(2);
      const so2Profit = (300 * 50) / 350 - 30;
      expect(result.totalPlannedProfit).toBeCloseTo(70 + so2Profit);
      expect(result.series.map((p) => [p.period, p.revenue])).toEqual([
        ['2026-10-01', 150],
        ['2026-10-02', 0],
        ['2026-10-03', 50],
      ]);
      expect(result.series[0].plannedProfit).toBeCloseTo(70);
      expect(result.series[1].plannedProfit).toBe(0);
      expect(result.series[2].plannedProfit).toBeCloseTo(so2Profit);
    });
  });

  describe('getOrderStatsByCustomer()', () => {
    it('group theo khách, loại CANCELLED, map ngày mua gần nhất + tổng doanh số', async () => {
      const last = new Date('2026-09-01T00:00:00Z');
      prisma.salesOrder.groupBy.mockResolvedValue([
        {
          customerId: 'c-1',
          _sum: { totalAmount: 500 },
          _count: { _all: 2 },
          _max: { createdAt: last },
        },
      ]);

      const result = await service.getOrderStatsByCustomer();

      expect(prisma.salesOrder.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['customerId'],
          where: { status: { not: 'CANCELLED' } },
        }),
      );
      expect(result).toEqual([
        {
          customerId: 'c-1',
          orderCount: 2,
          totalRevenue: 500,
          lastOrderAt: last,
        },
      ]);
    });
  });
});
