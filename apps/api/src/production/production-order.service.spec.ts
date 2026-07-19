import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import { PrismaService } from '../prisma/prisma.service';
import { SalesOrderService } from '../sales-order/sales-order.service';

function makeProductionOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    code: 'PO000001',
    salesOrderId: 'so-1',
    productionCenterId: 'pc-1',
    productionCenterName: 'Xưởng cửa lưới',
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    timeline: [],
    salesOrder: {
      id: 'so-1',
      code: 'SO000001',
      customerName: 'Nguyễn Văn An',
      customerPhone: '0901000001',
      status: 'IN_PRODUCTION',
    },
    ...overrides,
  };
}

describe('ProductionOrderService', () => {
  let service: ProductionOrderService;
  let prisma: {
    productionOrder: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    productionOrderTimeline: { create: jest.Mock };
    productionCenter: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let salesOrderService: { syncProductionProgress: jest.Mock };

  beforeEach(async () => {
    prisma = {
      productionOrder: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      productionOrderTimeline: {
        create: jest.fn(),
      },
      // Mẫu in riêng Xưởng Cầu Vồng (009-in-phieu-san-xuat.md) — findOne()
      // tra thêm ProductionCenter.code, mặc định null (không phải XW004).
      productionCenter: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn() },
      // print() (009-in-phieu-san-xuat.md) truyền một mảng Promise thay vì
      // callback — hỗ trợ cả 2 dạng $transaction() mà Prisma cho phép.
      $transaction: jest.fn((arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: unknown) => Promise<unknown>)(prisma);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };
    salesOrderService = { syncProductionProgress: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionOrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: SalesOrderService, useValue: salesOrderService },
      ],
    }).compile();

    service = module.get<ProductionOrderService>(ProductionOrderService);
  });

  describe('findOne()', () => {
    it('throws NotFoundException when production order does not exist', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    // 009-in-phieu-san-xuat.md — FE chọn mẫu in riêng dựa vào field này.
    it('trả về productionCenterCode tra từ ProductionCenter theo productionCenterId', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ productionCenterId: 'pc-cau-vong' }),
      );
      prisma.productionCenter.findUnique.mockResolvedValue({ code: 'XL03' });

      const result = await service.findOne('po-1');

      expect(prisma.productionCenter.findUnique).toHaveBeenCalledWith({
        where: { id: 'pc-cau-vong' },
        select: { code: true },
      });
      expect(result.productionCenterCode).toBe('XL03');
    });

    it('productionCenterCode = null khi không tìm thấy ProductionCenter', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(makeProductionOrder());
      prisma.productionCenter.findUnique.mockResolvedValue(null);

      const result = await service.findOne('po-1');

      expect(result.productionCenterCode).toBeNull();
    });
  });

  // Cột "Đã in" ở tab Sản xuất (fix 19/07/2026) — isPrinted derive từ số dòng
  // Timeline PRINTED (_count.timeline), không lưu field riêng.
  describe('findAll()', () => {
    it('isPrinted = true khi có ít nhất 1 dòng Timeline PRINTED', async () => {
      prisma.productionOrder.findMany.mockResolvedValue([
        { ...makeProductionOrder(), _count: { items: 2, timeline: 1 } },
      ]);
      prisma.productionOrder.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data[0].isPrinted).toBe(true);
      expect(result.data[0]._count).toEqual({ items: 2 });
    });

    it('isPrinted = false khi chưa in lần nào', async () => {
      prisma.productionOrder.findMany.mockResolvedValue([
        { ...makeProductionOrder(), _count: { items: 2, timeline: 0 } },
      ]);
      prisma.productionOrder.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data[0].isPrinted).toBe(false);
    });
  });

  describe('start()', () => {
    it('rejects when status is not PENDING', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'IN_PRODUCTION' }),
      );
      await expect(service.start('po-1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a second Start once already IN_PRODUCTION (no double start)', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'IN_PRODUCTION' }),
      );
      await expect(service.start('po-1')).rejects.toThrow(ForbiddenException);
    });

    it('transitions PENDING -> IN_PRODUCTION and writes STARTED timeline', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder(),
      );
      prisma.productionOrder.findUniqueOrThrow.mockResolvedValue(
        makeProductionOrder({ status: 'IN_PRODUCTION' }),
      );

      await service.start('po-1');

      expect(prisma.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: expect.objectContaining({ status: 'IN_PRODUCTION' }),
        }),
      );
      expect(prisma.productionOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STARTED',
            actorType: 'USER',
          }),
        }),
      );
    });

    it('ghi createdBy/createdByName từ userId (JWT) vào STARTED timeline', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder(),
      );
      prisma.productionOrder.findUniqueOrThrow.mockResolvedValue(
        makeProductionOrder({ status: 'IN_PRODUCTION' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        name: 'Trần Thị Bình',
        email: 'binh@acme.vn',
      });

      await service.start('po-1', 'user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { name: true, email: true },
      });
      expect(prisma.productionOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'Trần Thị Bình',
          }),
        }),
      );
    });

    it('createdBy/createdByName đều null khi không có userId', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder(),
      );
      prisma.productionOrder.findUniqueOrThrow.mockResolvedValue(
        makeProductionOrder({ status: 'IN_PRODUCTION' }),
      );

      await service.start('po-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.productionOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: null,
            createdByName: null,
          }),
        }),
      );
    });
  });

  describe('complete()', () => {
    it('rejects when status is not IN_PRODUCTION (not started yet)', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'PENDING' }),
      );
      await expect(service.complete('po-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a second Complete once already PRODUCTION_COMPLETED (no double complete, no backward transition)', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'PRODUCTION_COMPLETED' }),
      );
      await expect(service.complete('po-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('transitions IN_PRODUCTION -> PRODUCTION_COMPLETED and syncs Sales Order progress', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'IN_PRODUCTION', startedAt: new Date() }),
      );
      prisma.productionOrder.findUniqueOrThrow.mockResolvedValue(
        makeProductionOrder({ status: 'PRODUCTION_COMPLETED' }),
      );

      await service.complete('po-1');

      expect(prisma.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'po-1' },
          data: expect.objectContaining({ status: 'PRODUCTION_COMPLETED' }),
        }),
      );
      expect(prisma.productionOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMPLETED',
            actorType: 'USER',
          }),
        }),
      );
      expect(salesOrderService.syncProductionProgress).toHaveBeenCalledWith(
        'so-1',
        prisma,
      );
    });

    it('ghi createdBy/createdByName từ userId (JWT) vào COMPLETED timeline, fallback email khi name null', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'IN_PRODUCTION', startedAt: new Date() }),
      );
      prisma.productionOrder.findUniqueOrThrow.mockResolvedValue(
        makeProductionOrder({ status: 'PRODUCTION_COMPLETED' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        name: null,
        email: 'binh@acme.vn',
      });

      await service.complete('po-1', 'user-1');

      expect(prisma.productionOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'binh@acme.vn',
          }),
        }),
      );
    });
  });

  // In phiếu A5 (009-in-phieu-san-xuat.md) — không phải Action đổi Status,
  // chỉ ghi vết PRINTED.
  describe('print()', () => {
    it('rejects khi ids rỗng', async () => {
      await expect(service.print([])).rejects.toThrow(BadRequestException);
    });

    it('rejects khi có id không tồn tại', async () => {
      prisma.productionOrder.findMany.mockResolvedValue([{ id: 'po-1' }]);
      await expect(service.print(['po-1', 'po-missing'])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ghi 1 dòng Timeline PRINTED cho mỗi phiếu, không đổi status', async () => {
      prisma.productionOrder.findMany.mockResolvedValue([
        { id: 'po-1' },
        { id: 'po-2' },
      ]);
      prisma.productionOrder.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(makeProductionOrder({ id: where.id })),
      );

      const result = await service.print(['po-1', 'po-2'], 'user-1');

      expect(result.map((po) => po.id)).toEqual(['po-1', 'po-2']);
      expect(prisma.productionOrderTimeline.create).toHaveBeenCalledTimes(2);
      expect(prisma.productionOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productionOrderId: 'po-1',
            action: 'PRINTED',
            actorType: 'USER',
            createdBy: 'user-1',
          }),
        }),
      );
      expect(prisma.productionOrder.update).not.toHaveBeenCalled();
    });
  });
});
