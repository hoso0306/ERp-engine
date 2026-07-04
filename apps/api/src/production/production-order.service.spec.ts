import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
    salesOrder: { id: 'so-1', code: 'SO000001', customerName: 'Nguyễn Văn An', customerPhone: '0901000001', status: 'IN_PRODUCTION' },
    ...overrides,
  };
}

describe('ProductionOrderService', () => {
  let service: ProductionOrderService;
  let prisma: {
    productionOrder: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    productionOrderTimeline: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let salesOrderService: { syncProductionProgress: jest.Mock };

  beforeEach(async () => {
    prisma = {
      productionOrder: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      productionOrderTimeline: {
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
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
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
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
      prisma.productionOrder.findUnique.mockResolvedValue(makeProductionOrder());
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
          data: expect.objectContaining({ action: 'STARTED', actorType: 'USER' }),
        }),
      );
    });
  });

  describe('complete()', () => {
    it('rejects when status is not IN_PRODUCTION (not started yet)', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'PENDING' }),
      );
      await expect(service.complete('po-1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a second Complete once already PRODUCTION_COMPLETED (no double complete, no backward transition)', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(
        makeProductionOrder({ status: 'PRODUCTION_COMPLETED' }),
      );
      await expect(service.complete('po-1')).rejects.toThrow(ForbiddenException);
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
          data: expect.objectContaining({ action: 'COMPLETED', actorType: 'USER' }),
        }),
      );
      expect(salesOrderService.syncProductionProgress).toHaveBeenCalledWith('so-1', prisma);
    });
  });
});
