import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReturnService } from './return.service';
import { PrismaService } from '../prisma/prisma.service';

function makeSalesOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1',
    code: 'SO000001',
    customerId: 'cust-1',
    customerName: 'Nguyễn Văn An',
    status: 'DELIVERED',
    items: [
      {
        id: 'soi-1',
        productCode: 'SP000001',
        productName: 'Rèm phòng ngủ',
        quantity: 5,
        finalPrice: 1000000,
        parameters: [],
      },
    ],
    ...overrides,
  };
}

function makeRecoveryInventory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ri-1',
    code: 'RT000001-1',
    returnItemId: 'item-1',
    createdFromReturnCode: 'RT000001',
    productCode: 'SP000001',
    productName: 'Rèm phòng ngủ',
    quantity: 2,
    location: null,
    status: 'AVAILABLE',
    imageUrl: null,
    usedForNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ReturnService', () => {
  let service: ReturnService;
  let prisma: {
    salesOrder: { findUnique: jest.Mock };
    returnItem: {
      aggregate: jest.Mock;
      create: jest.Mock;
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
    return: {
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    recoveryInventory: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
      findMany: jest.Mock;
    };
    runningNumber: { update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      salesOrder: { findUnique: jest.fn() },
      returnItem: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { returnedQuantity: 0 } }),
        create: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      return: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      recoveryInventory: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      runningNumber: {
        update: jest
          .fn()
          .mockResolvedValue({ prefix: 'RT', lastNumber: 1, paddingLength: 6 }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReturnService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReturnService>(ReturnService);
  });

  describe('create() — Task 02/03 validation', () => {
    it('rejects when items is empty', async () => {
      await expect(
        service.create({ salesOrderId: 'so-1', items: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when SalesOrder does not exist', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          salesOrderId: 'nonexistent',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 1, reason: 'OTHER' },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when SalesOrder is not DELIVERED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'IN_PRODUCTION' }),
      );
      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 1, reason: 'OTHER' },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an invalid reason', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            {
              salesOrderItemId: 'soi-1',
              returnedQuantity: 1,
              reason: 'NOT_A_REAL_REASON',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a salesOrderItemId that does not belong to this SalesOrder', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            {
              salesOrderItemId: 'other-item',
              returnedQuantity: 1,
              reason: 'OTHER',
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when cumulative returnedQuantity across requested items in one call exceeds orderedQuantity', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      // quantity = 5 on soi-1; requesting 3 + 3 = 6 in the same call should fail
      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 3, reason: 'OTHER' },
            {
              salesOrderItemId: 'soi-1',
              returnedQuantity: 3,
              reason: 'WRONG_SIZE',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when cumulative returnedQuantity across PREVIOUS Returns + this request exceeds orderedQuantity', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      // Already returned 4 out of 5 previously (from a different Return)
      prisma.returnItem.aggregate.mockResolvedValue({
        _sum: { returnedQuantity: 4 },
      });

      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 2, reason: 'OTHER' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates Return + ReturnItem + RecoveryInventory in one transaction when valid', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      prisma.return.create.mockResolvedValue({ id: 'ret-1', code: 'RT000001' });
      prisma.returnItem.create.mockResolvedValue({ id: 'item-1' });
      prisma.return.findUniqueOrThrow.mockResolvedValue({
        id: 'ret-1',
        code: 'RT000001',
        items: [],
      });

      await service.create({
        salesOrderId: 'so-1',
        items: [
          {
            salesOrderItemId: 'soi-1',
            returnedQuantity: 2,
            reason: 'WRONG_SIZE',
          },
        ],
      });

      expect(prisma.returnItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            salesOrderItemId: 'soi-1',
            orderedQuantity: 5,
            returnedQuantity: 2,
            unitPriceSnapshot: 1000000,
            reason: 'WRONG_SIZE',
          }),
        }),
      );
      expect(prisma.recoveryInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            returnItemId: 'item-1',
            createdFromReturnCode: 'RT000001',
            quantity: 2,
            status: 'AVAILABLE',
          }),
        }),
      );
    });
  });

  describe('markUsed() / dispose() — Task 05 workflow', () => {
    it('markUsed() rejects when status is not AVAILABLE', async () => {
      prisma.recoveryInventory.findUnique.mockResolvedValue(
        makeRecoveryInventory({ status: 'USED' }),
      );
      await expect(service.markUsed('ri-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('markUsed() succeeds from AVAILABLE and stores usedForNote', async () => {
      prisma.recoveryInventory.findUnique.mockResolvedValue(
        makeRecoveryInventory(),
      );
      await service.markUsed('ri-1', { usedForNote: 'SO000231' });
      expect(prisma.recoveryInventory.update).toHaveBeenCalledWith({
        where: { id: 'ri-1' },
        data: { status: 'USED', usedForNote: 'SO000231' },
      });
    });

    it('dispose() rejects when status is not AVAILABLE', async () => {
      prisma.recoveryInventory.findUnique.mockResolvedValue(
        makeRecoveryInventory({ status: 'DISPOSED' }),
      );
      await expect(service.dispose('ri-1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects USED -> DISPOSED (no cross-transition)', async () => {
      prisma.recoveryInventory.findUnique.mockResolvedValue(
        makeRecoveryInventory({ status: 'USED' }),
      );
      await expect(service.dispose('ri-1')).rejects.toThrow(ForbiddenException);
    });

    it('dispose() succeeds from AVAILABLE', async () => {
      prisma.recoveryInventory.findUnique.mockResolvedValue(
        makeRecoveryInventory(),
      );
      await service.dispose('ri-1');
      expect(prisma.recoveryInventory.update).toHaveBeenCalledWith({
        where: { id: 'ri-1' },
        data: { status: 'DISPOSED' },
      });
    });
  });

  describe('updateRecoveryInventory() — Task 06 management', () => {
    it('rejects an invalid status value', async () => {
      prisma.recoveryInventory.findUnique.mockResolvedValue(
        makeRecoveryInventory(),
      );
      await expect(
        service.updateRecoveryInventory('ri-1', { status: 'NOT_REAL' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('only touches location/status/imageUrl — never Snapshot fields', async () => {
      prisma.recoveryInventory.findUnique.mockResolvedValue(
        makeRecoveryInventory(),
      );
      await service.updateRecoveryInventory('ri-1', {
        location: 'Kho A',
        status: 'DISPOSED',
        imageUrl: 'https://example.com/img.jpg',
      });

      const callArg = prisma.recoveryInventory.update.mock.calls[0][0];
      expect(callArg.data).toEqual({
        location: 'Kho A',
        imageUrl: 'https://example.com/img.jpg',
        status: 'DISPOSED',
      });
      expect(callArg.data).not.toHaveProperty('productCode');
      expect(callArg.data).not.toHaveProperty('quantity');
    });
  });
});
