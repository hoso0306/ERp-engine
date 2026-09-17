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
        itemType: 'PRODUCT',
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
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    debtAdjustment: { findMany: jest.Mock };
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
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Nguyễn Văn An', email: 'an@acme.vn' }),
      },
      // ReturnService.attachDebtAdjustmentSummary() query lại DebtAdjustment
      // (sửa 27/08/2026) — mặc định rỗng, test riêng override khi cần.
      debtAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
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

    // Nới điều kiện (rà soát nghiệp vụ Return, 27/08/2026) — trước đây chỉ
    // cho tạo khi DELIVERED, nay cho phép ở mọi trạng thái, chỉ chặn CANCELLED.
    it('rejects when SalesOrder is CANCELLED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'CANCELLED' }),
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

    it('accepts when SalesOrder is IN_PRODUCTION (chưa DELIVERED)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'IN_PRODUCTION' }),
      );
      prisma.return.create.mockResolvedValue({ id: 'ret-1', code: 'RT000001' });
      prisma.returnItem.create.mockResolvedValue({ id: 'item-1' });
      prisma.return.findUniqueOrThrow.mockResolvedValue({
        id: 'ret-1',
        code: 'RT000001',
        items: [],
      });

      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 1, reason: 'OTHER' },
          ],
        }),
      ).resolves.toBeDefined();
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

    // Hoàn vật tư bán lẻ (rà soát nghiệp vụ Return, 17/09/2026) — trước đây
    // bị chặn cứng (itemType=MATERIAL), nay hỗ trợ, snapshot rẽ nhánh sang
    // materialCode/materialName/materialUnit thay vì productCode/productName.
    it('creates Return + ReturnItem + RecoveryInventory cho dòng vật tư bán lẻ (itemType=MATERIAL)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({
          items: [
            {
              id: 'soi-1',
              itemType: 'MATERIAL',
              materialCode: 'VT000001',
              materialName: 'Bạt xếp/cuốn - Mô tơ động cơ',
              materialUnit: 'Cái',
              quantity: 5,
              finalPrice: 1000000,
              vatRate: 0,
              parameters: [],
            },
          ],
        }),
      );
      prisma.return.create.mockResolvedValue({ id: 'ret-1', code: 'RT000001' });
      prisma.returnItem.create.mockResolvedValue({ id: 'item-1' });
      prisma.return.findUniqueOrThrow.mockResolvedValue({
        id: 'ret-1',
        code: 'RT000001',
        items: [],
      });

      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 2, reason: 'OTHER' },
          ],
        }),
      ).resolves.toBeDefined();

      expect(prisma.returnItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemType: 'MATERIAL',
            productCode: null,
            productName: null,
            materialCode: 'VT000001',
            materialName: 'Bạt xếp/cuốn - Mô tơ động cơ',
            materialUnit: 'Cái',
          }),
        }),
      );
      expect(prisma.recoveryInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemType: 'MATERIAL',
            productCode: null,
            productName: null,
            materialCode: 'VT000001',
            materialName: 'Bạt xếp/cuốn - Mô tơ động cơ',
            materialUnit: 'Cái',
          }),
        }),
      );
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

    // Phân bổ khách/công ty chịu (rà soát nghiệp vụ Return, 27/08/2026).
    it('mặc định customerBorneAmount = totalValue (khách chịu 100%) khi không truyền, snapshot ownerId/ownerName', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ ownerId: 'user-1', ownerName: 'Trần Sale' }),
      );
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
          { salesOrderItemId: 'soi-1', returnedQuantity: 2, reason: 'OTHER' },
        ],
      });

      expect(prisma.return.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'user-1',
            ownerName: 'Trần Sale',
            totalValue: 2000000,
            customerBorneAmount: 2000000,
            companyBorneReason: null,
          }),
        }),
      );
    });

    it('rejects customerBorneAmount vượt quá totalValue', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 2, reason: 'OTHER' },
          ],
          customerBorneAmount: 3000000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects khi công ty chịu > 0 nhưng không có companyBorneReason', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      await expect(
        service.create({
          salesOrderId: 'so-1',
          items: [
            { salesOrderItemId: 'soi-1', returnedQuantity: 2, reason: 'OTHER' },
          ],
          customerBorneAmount: 500000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('chấp nhận customerBorneAmount tuỳ chỉnh kèm companyBorneReason', async () => {
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
          { salesOrderItemId: 'soi-1', returnedQuantity: 2, reason: 'OTHER' },
        ],
        customerBorneAmount: 500000,
        companyBorneReason: 'Lỗi sản xuất — cắt sai kích thước',
      });

      expect(prisma.return.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerBorneAmount: 500000,
            companyBorneReason: 'Lỗi sản xuất — cắt sai kích thước',
          }),
        }),
      );
    });
  });

  describe('complete() — actor name snapshot (Sprint 04)', () => {
    function makeReturn(overrides: Record<string, unknown> = {}) {
      return {
        id: 'ret-1',
        code: 'RT000001',
        status: 'PROCESSING',
        completedBy: null,
        completedByName: null,
        completedAt: null,
        items: [],
        ...overrides,
      };
    }

    it('rejects when status is not PROCESSING', async () => {
      prisma.return.findUnique.mockResolvedValue(
        makeReturn({ status: 'COMPLETED' }),
      );
      await expect(service.complete('ret-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ghi completedBy/completedByName từ JWT userId', async () => {
      prisma.return.findUnique.mockResolvedValue(makeReturn());
      prisma.return.update.mockResolvedValue(
        makeReturn({ status: 'COMPLETED' }),
      );

      await service.complete('ret-1', 'user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { name: true, email: true },
      });
      expect(prisma.return.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completedBy: 'user-1',
            completedByName: 'Nguyễn Văn An',
          }),
        }),
      );
    });

    it('completedBy/completedByName đều null khi không có userId', async () => {
      prisma.return.findUnique.mockResolvedValue(makeReturn());
      prisma.return.update.mockResolvedValue(
        makeReturn({ status: 'COMPLETED' }),
      );

      await service.complete('ret-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.return.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completedBy: null,
            completedByName: null,
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
