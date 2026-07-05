import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { PrismaService } from '../prisma/prisma.service';

function makeMaterial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mat-1',
    code: 'NL000001',
    name: 'Khung nhôm',
    unitId: 'unit-1',
    isActive: true,
    currentStock: 100,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    unit: { name: 'Cái' },
    ...overrides,
  };
}

describe('WarehouseService', () => {
  let service: WarehouseService;
  let prisma: {
    material: { findUnique: jest.Mock; update: jest.Mock };
    runningNumber: { update: jest.Mock };
    materialReceipt: { create: jest.Mock; findUniqueOrThrow: jest.Mock };
    warehouseTransaction: { create: jest.Mock };
    productionOrderItem: { findMany: jest.Mock };
    orderBOM: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      material: { findUnique: jest.fn(), update: jest.fn() },
      runningNumber: { update: jest.fn() },
      materialReceipt: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
      warehouseTransaction: { create: jest.fn() },
      productionOrderItem: { findMany: jest.fn() },
      orderBOM: { findMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WarehouseService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<WarehouseService>(WarehouseService);
  });

  describe('createMaterialReceipt() — Task 02/07 validation', () => {
    it('rejects when quantity <= 0', async () => {
      await expect(
        service.createMaterialReceipt({ materialId: 'mat-1', quantity: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when Material does not exist', async () => {
      prisma.material.findUnique.mockResolvedValue(null);
      await expect(
        service.createMaterialReceipt({ materialId: 'nonexistent', quantity: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when Material is not ACTIVE', async () => {
      prisma.material.findUnique.mockResolvedValue(makeMaterial({ isActive: false }));
      await expect(
        service.createMaterialReceipt({ materialId: 'mat-1', quantity: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates MaterialReceipt + WarehouseTransaction(IN) and increments currentStock by delta', async () => {
      prisma.material.findUnique.mockResolvedValue(makeMaterial());
      prisma.runningNumber.update.mockResolvedValue({ prefix: 'PN', lastNumber: 1, paddingLength: 6 });
      prisma.materialReceipt.create.mockResolvedValue({ id: 'receipt-1' });
      prisma.materialReceipt.findUniqueOrThrow.mockResolvedValue({ id: 'receipt-1', code: 'PN000001' });

      await service.createMaterialReceipt({ materialId: 'mat-1', quantity: 50 });

      expect(prisma.warehouseTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'IN',
            transactionType: 'MATERIAL_RECEIPT',
            quantity: 50,
            materialReceiptId: 'receipt-1',
          }),
        }),
      );
      expect(prisma.material.update).toHaveBeenCalledWith({
        where: { id: 'mat-1' },
        data: { currentStock: { increment: 50 } },
      });
    });
  });

  describe('issueForProductionOrder() — Task 03/07 (Material Issue)', () => {
    it('does nothing when the Production Order has no items', async () => {
      prisma.productionOrderItem.findMany.mockResolvedValue([]);
      await service.issueForProductionOrder('po-1', prisma as never);
      expect(prisma.warehouseTransaction.create).not.toHaveBeenCalled();
    });

    it('aggregates OrderBOMItem quantity per material (not per BOM line) before issuing', async () => {
      prisma.productionOrderItem.findMany.mockResolvedValue([
        { salesOrderItemId: 'soi-1' },
        { salesOrderItemId: 'soi-2' },
      ]);
      // Same material used by two different SalesOrderItems in this Production Order
      prisma.orderBOM.findMany.mockResolvedValue([
        { items: [{ materialId: 'mat-1', quantity: 4 }] },
        { items: [{ materialId: 'mat-1', quantity: 6 }] },
      ]);
      prisma.material.findUnique.mockResolvedValue(makeMaterial({ currentStock: 100 }));

      await service.issueForProductionOrder('po-1', prisma as never);

      // Exactly ONE WarehouseTransaction row for this material, quantity = 4 + 6 = 10
      expect(prisma.warehouseTransaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.warehouseTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'OUT',
            transactionType: 'MATERIAL_ISSUE',
            materialId: 'mat-1',
            quantity: 10,
            productionOrderId: 'po-1',
          }),
        }),
      );
      expect(prisma.material.update).toHaveBeenCalledWith({
        where: { id: 'mat-1' },
        data: { currentStock: { decrement: 10 } },
      });
    });

    it('blocks issuance and creates no WarehouseTransaction when stock is insufficient (no negative stock)', async () => {
      prisma.productionOrderItem.findMany.mockResolvedValue([{ salesOrderItemId: 'soi-1' }]);
      prisma.orderBOM.findMany.mockResolvedValue([
        { items: [{ materialId: 'mat-1', quantity: 200 }] },
      ]);
      prisma.material.findUnique.mockResolvedValue(makeMaterial({ currentStock: 5 }));

      await expect(
        service.issueForProductionOrder('po-1', prisma as never),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.warehouseTransaction.create).not.toHaveBeenCalled();
      expect(prisma.material.update).not.toHaveBeenCalled();
    });

    it('rejects when Material is not ACTIVE', async () => {
      prisma.productionOrderItem.findMany.mockResolvedValue([{ salesOrderItemId: 'soi-1' }]);
      prisma.orderBOM.findMany.mockResolvedValue([
        { items: [{ materialId: 'mat-1', quantity: 10 }] },
      ]);
      prisma.material.findUnique.mockResolvedValue(makeMaterial({ isActive: false }));

      await expect(
        service.issueForProductionOrder('po-1', prisma as never),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
