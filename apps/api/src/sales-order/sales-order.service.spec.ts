import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { PrismaService } from '../prisma/prisma.service';

function makeSalesOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1',
    code: 'SO000001',
    status: 'PRODUCTION_COMPLETED',
    receivable: null,
    productionOrders: [],
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
});
