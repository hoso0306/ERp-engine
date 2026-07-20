import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { BomEngineService } from '../bom-engine/bom-engine.service';
import { PermissionService } from '../permission/permission.service';

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    quotationId: 'q-1',
    productId: 'prod-1',
    quantity: 2,
    systemPrice: 1000000,
    discountPercent: 0,
    note: null,
    finalPrice: 1000000,
    subtotal: 2000000,
    vatRate: 0,
    vatAmount: 0,
    pricingRuleVersionId: 'prv-1',
    materialRequirementVersionId: null,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    parameters: [],
    product: {
      id: 'prod-1',
      code: 'SP000001',
      name: 'Cửa nhôm',
      status: 'ACTIVE',
      productTypeId: 'pt-1',
      productType: { name: 'Cửa lưới' },
      productionCenterId: 'pc-1',
      productionCenter: { id: 'pc-1', name: 'Xưởng A' },
      // ENUM param names (022-gia-von-loi-nhuan-bao-gia.md) — mặc định không
      // có param ENUM nào, test riêng override khi cần.
      parameters: [],
      pricingRule: {
        versions: [{ id: 'prv-1' }],
      },
      materialRequirement: {
        versions: [
          {
            id: 'mrv-1',
            items: [],
          },
        ],
      },
    },
    ...overrides,
  };
}

function makeQuotation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    code: 'BG000001',
    customerId: 'cust-1',
    status: 'SENT',
    salesOrderId: null,
    expiryDate: null,
    expectedDeliveryDate: null,
    note: null,
    discountAmount: 0,
    discountReason: null,
    discountBy: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: 'cust-1',
      name: 'Nguyễn Văn An',
      phone: '0901000001',
      debtLimit: 0,
      debtTermDays: 30,
    },
    items: [makeItem()],
    timeline: [],
    ...overrides,
  };
}

describe('QuotationWorkflowService.approve()', () => {
  let service: QuotationWorkflowService;
  let prisma: {
    quotation: { findUnique: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  // BomEngineService thật (logic Filter/Formula chạy thật) với Prisma mock riêng
  let bomPrisma: { materialRequirementVersion: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };
    bomPrisma = { materialRequirementVersion: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationWorkflowService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: PricingEngineService,
          useValue: { calculate: jest.fn() },
        },
        {
          provide: BomEngineService,
          useValue: new BomEngineService(bomPrisma as unknown as PrismaService),
        },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<QuotationWorkflowService>(QuotationWorkflowService);
  });

  it('throws NotFoundException when quotation does not exist', async () => {
    prisma.quotation.findUnique.mockResolvedValue(null);
    await expect(service.approve('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects approve when salesOrderId IS NOT NULL (double approve)', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ salesOrderId: 'so-existing' }),
    );
    await expect(service.approve('q-1')).rejects.toThrow(ForbiddenException);
  });

  it('rejects approve when product has no active PricingRuleVersion', async () => {
    const itemNoPricing = makeItem({
      product: {
        ...(makeItem().product as Record<string, unknown>),
        pricingRule: { versions: [] },
      },
    });
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ items: [itemNoPricing] }),
    );
    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects approve when product has no active MaterialRequirementVersion', async () => {
    const itemNoMaterial = makeItem({
      product: {
        ...(makeItem().product as Record<string, unknown>),
        materialRequirement: { versions: [] },
      },
    });
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ items: [itemNoMaterial] }),
    );
    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects approve when product is INACTIVE', async () => {
    const itemInactive = makeItem({
      product: {
        ...(makeItem().product as Record<string, unknown>),
        status: 'INACTIVE',
      },
    });
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ items: [itemInactive] }),
    );
    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects approve when status is not SENT', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'DRAFT' }),
    );
    await expect(service.approve('q-1')).rejects.toThrow(ForbiddenException);
  });

  it('chặn approve khi expression định mức lỗi — không sinh SalesOrder với plannedCost thiếu', async () => {
    const item = makeItem();
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ items: [item] }),
    );

    bomPrisma.materialRequirementVersion.findUnique.mockResolvedValue({
      id: 'mrv-1',
      items: [
        {
          materialId: 'mat-1',
          expression: 'chieurong *', // cú pháp hỏng
          condition: null,
          wastePercent: 0,
          roundType: 'NONE',
          roundValue: null,
          material: {
            code: 'NL000001',
            name: 'Khung nhôm',
            unit: null,
            prices: [],
          },
        },
      ],
      materialRequirement: { product: { derivedParameters: [] } },
    });

    const tx = {
      salesOrder: { create: jest.fn() },
      runningNumber: { update: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
    await expect(service.approve('q-1')).rejects.toThrow(/Khung nhôm/);
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
    expect(tx.runningNumber.update).not.toHaveBeenCalled();
  });

  it('condition trên dòng BOM lọc vật tư theo config khách chọn khi Approve', async () => {
    const item = makeItem({
      parameters: [
        {
          name: 'chieurong',
          value: '250',
          label: 'Rộng',
          unit: 'cm',
          displayOrder: 0,
        },
        {
          name: 'chieucao',
          value: '200',
          label: 'Cao',
          unit: 'cm',
          displayOrder: 1,
        },
        {
          name: 'maukhung',
          value: 'cafe',
          label: 'Màu',
          unit: null,
          displayOrder: 2,
        },
      ],
    });
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ items: [item] }),
    );

    bomPrisma.materialRequirementVersion.findUnique.mockResolvedValue({
      id: 'mrv-1',
      items: [
        {
          materialId: 'al-cafe',
          expression: '2 * chieurong / 100',
          condition: 'maukhung == "cafe"',
          wastePercent: 0,
          roundType: 'NONE',
          roundValue: null,
          material: {
            code: 'AL30-CAFE',
            name: 'Thanh Cafe',
            unit: { name: 'm' },
            prices: [{ price: '10000' }],
          },
        },
        {
          materialId: 'al-trang',
          expression: '2 * chieurong / 100',
          condition: 'maukhung == "trang"',
          wastePercent: 0,
          roundType: 'NONE',
          roundValue: null,
          material: {
            code: 'AL30-TRANG',
            name: 'Thanh Trắng',
            unit: { name: 'm' },
            prices: [{ price: '10000' }],
          },
        },
      ],
      materialRequirement: { product: { derivedParameters: [] } },
    });

    // tx mock đủ cho luồng approve chạy tới OrderBOM
    const orderBomCreate = jest.fn();
    const tx = {
      runningNumber: {
        update: jest
          .fn()
          .mockResolvedValue({ prefix: 'DH', lastNumber: 1, paddingLength: 6 }),
      },
      salesOrder: { create: jest.fn().mockResolvedValue({ id: 'so-1' }) },
      receivable: { create: jest.fn() },
      salesOrderItem: { create: jest.fn().mockResolvedValue({ id: 'soi-1' }) },
      orderBOM: { create: orderBomCreate },
      productionOrder: { create: jest.fn().mockResolvedValue({ id: 'po-1' }) },
      productionOrderTimeline: { create: jest.fn() },
      quotation: { update: jest.fn().mockResolvedValue({ id: 'q-1' }) },
      quotationTimeline: { create: jest.fn() },
      salesOrderTimeline: { create: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Lê Văn Duyệt', email: 'duyet@acme.vn' }),
      },
    };
    prisma.$transaction = jest.fn((fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    await service.approve('q-1', 'approver-1');

    expect(orderBomCreate).toHaveBeenCalledTimes(1);
    const bomData = orderBomCreate.mock.calls[0][0].data;
    const codes = bomData.items.create.map(
      (i: { materialCode: string }) => i.materialCode,
    );
    expect(codes).toEqual(['AL30-CAFE']);
    // 2 × 250cm / 100 = 5m × quantity 2 = 10m
    expect(bomData.items.create[0].quantity).toBeCloseTo(10);
    expect(bomData.plannedCost).toBe(100_000); // 10m × 10.000

    // Sprint 04 (005-nguoi-thuc-hien-lich-su-hoat-dong.md) — QUOTATION_APPROVED
    // timeline snapshot đúng approverUserId, không phải owner.
    expect(tx.quotationTimeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: 'approver-1',
          createdByName: 'Lê Văn Duyệt',
        }),
      }),
    );
  });

  // Review Nghiệp vụ Tài chính (chốt 18/07/2026, Finding #1): grandTotal
  // (dùng cho Receivable) đã trừ discountAmount đúng, nhưng plannedProfit bị
  // bỏ sót trước đây — test này khoá lại công thức đã sửa.
  it('trừ discountAmount (Giảm thêm cấp toàn báo giá) khỏi plannedProfit khi Approve', async () => {
    const item = makeItem(); // subtotal 2.000.000, BOM version 'mrv-1' không có Item nào → plannedCost 0
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ items: [item], discountAmount: 300_000 }),
    );
    bomPrisma.materialRequirementVersion.findUnique.mockResolvedValue({
      id: 'mrv-1',
      items: [],
      materialRequirement: { product: { derivedParameters: [] } },
    });

    const tx = {
      runningNumber: {
        update: jest
          .fn()
          .mockResolvedValue({ prefix: 'DH', lastNumber: 1, paddingLength: 6 }),
      },
      salesOrder: { create: jest.fn().mockResolvedValue({ id: 'so-1' }) },
      receivable: { create: jest.fn() },
      salesOrderItem: { create: jest.fn().mockResolvedValue({ id: 'soi-1' }) },
      orderBOM: { create: jest.fn() },
      productionOrder: { create: jest.fn().mockResolvedValue({ id: 'po-1' }) },
      productionOrderTimeline: { create: jest.fn() },
      quotation: { update: jest.fn().mockResolvedValue({ id: 'q-1' }) },
      quotationTimeline: { create: jest.fn() },
      salesOrderTimeline: { create: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Lê Văn Duyệt', email: 'duyet@acme.vn' }),
      },
    };
    prisma.$transaction = jest.fn((fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    await service.approve('q-1', 'approver-1');

    const soData = tx.salesOrder.create.mock.calls[0][0].data;
    expect(soData.totalAmount).toBe(2_000_000);
    expect(soData.plannedCost).toBe(0);
    // plannedProfit = totalAmount − plannedCost − discountAmount
    expect(soData.plannedProfit).toBe(2_000_000 - 0 - 300_000);
  });

  // Fix 19/07/2026 — expectedDeliveryDate không được set ở đâu cả, dù field
  // đã có sẵn trên SalesOrder. Snapshot từ Quotation.expectedDeliveryDate
  // (nhập tay lúc tạo/sửa báo giá) tại Approve.
  it('snapshot expectedDeliveryDate từ Quotation sang SalesOrder khi Approve', async () => {
    const deliveryDate = new Date('2026-08-01T00:00:00.000Z');
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ expectedDeliveryDate: deliveryDate }),
    );
    bomPrisma.materialRequirementVersion.findUnique.mockResolvedValue({
      id: 'mrv-1',
      items: [],
      materialRequirement: { product: { derivedParameters: [] } },
    });

    const tx = {
      runningNumber: {
        update: jest
          .fn()
          .mockResolvedValue({ prefix: 'DH', lastNumber: 1, paddingLength: 6 }),
      },
      salesOrder: { create: jest.fn().mockResolvedValue({ id: 'so-1' }) },
      receivable: { create: jest.fn() },
      salesOrderItem: { create: jest.fn().mockResolvedValue({ id: 'soi-1' }) },
      orderBOM: { create: jest.fn() },
      productionOrder: { create: jest.fn().mockResolvedValue({ id: 'po-1' }) },
      productionOrderTimeline: { create: jest.fn() },
      quotation: { update: jest.fn().mockResolvedValue({ id: 'q-1' }) },
      quotationTimeline: { create: jest.fn() },
      salesOrderTimeline: { create: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Lê Văn Duyệt', email: 'duyet@acme.vn' }),
      },
    };
    prisma.$transaction = jest.fn((fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    await service.approve('q-1', 'approver-1');

    const soData = tx.salesOrder.create.mock.calls[0][0].data;
    expect(soData.expectedDeliveryDate).toBe(deliveryDate);
  });
});

// Sprint 04 (005-nguoi-thuc-hien-lich-su-hoat-dong.md) — createdByName/
// discountByName snapshot từ JWT userId, dùng resolveActorName() dùng chung.
describe('QuotationWorkflowService — actor name snapshot', () => {
  let service: QuotationWorkflowService;
  let prisma: {
    quotation: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    quotationItem: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    quotationItemParameter: { deleteMany: jest.Mock; createMany: jest.Mock };
    quotationTimeline: { create: jest.Mock };
    customer: { findFirst: jest.Mock; findUnique: jest.Mock };
    customerProductDiscount: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock };
    runningNumber: { update: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let pricingEngine: { calculate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      quotationItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      quotationItemParameter: { deleteMany: jest.fn(), createMany: jest.fn() },
      quotationTimeline: { create: jest.fn() },
      customer: { findFirst: jest.fn(), findUnique: jest.fn() },
      customerProductDiscount: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      runningNumber: {
        update: jest
          .fn()
          .mockResolvedValue({ prefix: 'BG', lastNumber: 1, paddingLength: 6 }),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Nguyễn Văn An', email: 'an@acme.vn' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    pricingEngine = { calculate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: pricingEngine },
        {
          provide: BomEngineService,
          useValue: { loadConfigForVersion: jest.fn() },
        },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<QuotationWorkflowService>(QuotationWorkflowService);
  });

  it('create(): ghi createdBy/createdByName từ JWT userId', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prisma.quotation.create.mockResolvedValue(makeQuotation());

    await service.create({ customerId: 'cust-1' }, 'user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { name: true, email: true },
    });
    expect(prisma.quotationTimeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: 'user-1',
          createdByName: 'Nguyễn Văn An',
        }),
      }),
    );
  });

  it('send(): createdByName null khi userId null (không gọi user.findUnique)', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'DRAFT' }),
    );

    await service.send('q-1', null);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('cancel(): ghi createdBy/createdByName từ JWT userId', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'SENT', salesOrderId: null }),
    );

    await service.cancel('q-1', { reason: 'Khách đổi ý' }, 'user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { name: true, email: true },
    });
  });

  it('override(): không còn overrideBy trong payload, createdBy/createdByName lấy từ JWT', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'DRAFT', salesOrderId: null }),
    );

    await service.override(
      'q-1',
      { newStatus: 'SENT', reason: 'Sửa lại' },
      'user-1',
    );

    expect(prisma.quotationTimeline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdBy: 'user-1',
          createdByName: 'Nguyễn Văn An',
          payload: expect.not.objectContaining({
            overrideBy: expect.anything(),
          }),
        }),
      }),
    );
  });

});

// Sprint 04 (005-chiet-khau-khach-hang-vat-bao-gia.md) — Discount Engine mới:
// snapshot discountPercent từ CustomerProductDiscount(customerId, productId),
// THAY THẾ HOÀN TOÀN CustomerGroup.discountPercent ("CK nhóm") + chiết khấu
// bổ sung cấp dòng cũ.
describe('QuotationWorkflowService — Discount Engine (Sprint 04)', () => {
  let service: QuotationWorkflowService;
  let prisma: {
    quotation: { findUnique: jest.Mock; update: jest.Mock };
    quotationItem: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    quotationItemParameter: { deleteMany: jest.Mock; createMany: jest.Mock };
    customerProductDiscount: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let pricingEngine: { calculate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      quotation: { findUnique: jest.fn(), update: jest.fn() },
      quotationItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      quotationItemParameter: { deleteMany: jest.fn(), createMany: jest.fn() },
      customerProductDiscount: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    pricingEngine = { calculate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: pricingEngine },
        {
          provide: BomEngineService,
          useValue: { loadConfigForVersion: jest.fn() },
        },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<QuotationWorkflowService>(QuotationWorkflowService);
  });

  it('addItem(): có cấu hình CustomerProductDiscount → snapshot discountPercent', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'DRAFT' }),
    );
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      code: 'SP000001',
      name: 'Cửa nhôm',
      parameters: [],
    });
    prisma.customerProductDiscount.findUnique.mockResolvedValue({
      discountPercent: 10,
    });
    pricingEngine.calculate.mockResolvedValue({
      systemPrice: 1_000_000,
      pricingRuleVersionId: 'prv-1',
      vatRate: 0,
      warnings: [],
    });

    await service.addItem('q-1', {
      productId: 'prod-1',
      quantity: 1,
      parameters: [],
    });

    expect(prisma.customerProductDiscount.findUnique).toHaveBeenCalledWith({
      where: { customerId_productId: { customerId: 'cust-1', productId: 'prod-1' } },
    });
    expect(prisma.quotationItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountPercent: 10,
          finalPrice: 900_000, // 1.000.000 × (1 − 10%)
        }),
      }),
    );
  });

  it('addItem(): chưa cấu hình CustomerProductDiscount → discountPercent = 0', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'DRAFT' }),
    );
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-1',
      code: 'SP000001',
      name: 'Cửa nhôm',
      parameters: [],
    });
    prisma.customerProductDiscount.findUnique.mockResolvedValue(null);
    pricingEngine.calculate.mockResolvedValue({
      systemPrice: 1_000_000,
      pricingRuleVersionId: 'prv-1',
      vatRate: 0,
      warnings: [],
    });

    await service.addItem('q-1', {
      productId: 'prod-1',
      quantity: 1,
      parameters: [],
    });

    expect(prisma.quotationItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountPercent: 0,
          finalPrice: 1_000_000,
        }),
      }),
    );
  });

  it('updateItem(): giữ nguyên discountPercent đã snapshot, không lookup lại', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'DRAFT' }),
    );
    prisma.quotationItem.findFirst.mockResolvedValue(
      makeItem({ discountPercent: 10, systemPrice: 1_000_000 }),
    );
    prisma.product.findUnique.mockResolvedValue({
      code: 'SP000001',
      name: 'Cửa nhôm',
    });

    await service.updateItem('q-1', 'item-1', { quantity: 3 });

    expect(prisma.customerProductDiscount.findUnique).not.toHaveBeenCalled();
    expect(prisma.quotationItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finalPrice: 900_000, // vẫn 10% như snapshot cũ
          subtotal: 2_700_000, // 900.000 × 3
        }),
      }),
    );
  });
});

// 009-in-phieu-san-xuat.md (workbench/sprint-04) — snapshot valueLabel (nhãn hiển thị option
// ENUM đã chọn) tại addItem/updateItem, để bản in không phải hiện mã thô.
describe('QuotationWorkflowService — snapshot valueLabel cho tham số ENUM', () => {
  let service: QuotationWorkflowService;
  let prisma: {
    quotation: { findUnique: jest.Mock };
    quotationItem: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    quotationItemParameter: { deleteMany: jest.Mock; createMany: jest.Mock };
    customerProductDiscount: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let pricingEngine: { calculate: jest.Mock };

  const productWithEnumParam = {
    id: 'prod-1',
    code: 'SP000036',
    name: '[Cửa lưới] Hệ xếp Thăng Long 27',
    parameters: [
      {
        name: 'loaicua',
        label: 'Loại cửa',
        unit: null,
        displayOrder: 0,
        options: [
          { value: 'cuadi', label: 'Cửa đi' },
          { value: 'cuaso', label: 'Cửa sổ' },
        ],
      },
      {
        name: 'chieurong',
        label: 'Chiều rộng',
        unit: 'm',
        displayOrder: 1,
        options: [],
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      quotation: { findUnique: jest.fn() },
      quotationItem: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      quotationItemParameter: { deleteMany: jest.fn(), createMany: jest.fn() },
      customerProductDiscount: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };
    pricingEngine = { calculate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: pricingEngine },
        { provide: BomEngineService, useValue: { loadConfigForVersion: jest.fn() } },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<QuotationWorkflowService>(QuotationWorkflowService);
  });

  it('addItem(): tham số ENUM khớp option → snapshot đúng valueLabel', async () => {
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ status: 'DRAFT' }));
    prisma.product.findUnique.mockResolvedValue(productWithEnumParam);
    prisma.customerProductDiscount.findUnique.mockResolvedValue(null);
    pricingEngine.calculate.mockResolvedValue({
      systemPrice: 500_000,
      pricingRuleVersionId: 'prv-1',
      vatRate: 0,
      warnings: [],
    });

    await service.addItem('q-1', {
      productId: 'prod-1',
      quantity: 1,
      parameters: [
        { name: 'loaicua', value: 'cuaso' },
        { name: 'chieurong', value: '0.63' },
      ],
    });

    expect(prisma.quotationItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parameters: {
            create: [
              expect.objectContaining({ name: 'loaicua', value: 'cuaso', valueLabel: 'Cửa sổ' }),
              expect.objectContaining({ name: 'chieurong', value: '0.63', valueLabel: null }),
            ],
          },
        }),
      }),
    );
  });

  it('addItem(): giá trị ENUM không khớp option nào → valueLabel = null (không throw)', async () => {
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ status: 'DRAFT' }));
    prisma.product.findUnique.mockResolvedValue(productWithEnumParam);
    prisma.customerProductDiscount.findUnique.mockResolvedValue(null);
    pricingEngine.calculate.mockResolvedValue({
      systemPrice: 500_000,
      pricingRuleVersionId: 'prv-1',
      vatRate: 0,
      warnings: [],
    });

    await service.addItem('q-1', {
      productId: 'prod-1',
      quantity: 1,
      parameters: [{ name: 'loaicua', value: 'khong_ton_tai' }],
    });

    expect(prisma.quotationItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parameters: {
            create: [expect.objectContaining({ value: 'khong_ton_tai', valueLabel: null })],
          },
        }),
      }),
    );
  });

  it('updateItem(): sửa tham số ENUM → createMany ghi đúng valueLabel mới', async () => {
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ status: 'DRAFT' }));
    prisma.quotationItem.findFirst.mockResolvedValue(makeItem());
    prisma.product.findUnique.mockResolvedValue(productWithEnumParam);
    pricingEngine.calculate.mockResolvedValue({
      systemPrice: 500_000,
      pricingRuleVersionId: 'prv-1',
      vatRate: 0,
      warnings: [],
    });

    await service.updateItem('q-1', 'item-1', {
      parameters: [{ name: 'loaicua', value: 'cuadi' }],
    });

    expect(prisma.quotationItemParameter.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ name: 'loaicua', value: 'cuadi', valueLabel: 'Cửa đi' })],
      }),
    );
  });
});

// Sprint 04 (005-chiet-khau-khach-hang-vat-bao-gia.md) — Giảm thêm cấp toàn
// báo giá, chỉ số tiền mặt, áp trên Tổng thanh toán (Tổng tiền hàng + VAT).
describe('QuotationWorkflowService.discount()', () => {
  let service: QuotationWorkflowService;
  let prisma: {
    quotation: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      quotation: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: { calculate: jest.fn() } },
        {
          provide: BomEngineService,
          useValue: { loadConfigForVersion: jest.fn() },
        },
        { provide: PermissionService, useValue: { hasPermission: jest.fn() } },
      ],
    }).compile();

    service = module.get<QuotationWorkflowService>(QuotationWorkflowService);
  });

  it('rejects khi báo giá không ở DRAFT/SENT', async () => {
    prisma.quotation.findUnique.mockResolvedValue(
      makeQuotation({ status: 'APPROVED' }),
    );
    await expect(
      service.discount('q-1', { amount: 100_000, reason: 'Khách quen' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects khi amount > 0 nhưng thiếu reason', async () => {
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation());
    await expect(
      service.discount('q-1', { amount: 100_000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects khi amount vượt quá Tổng thanh toán (Tổng tiền hàng + VAT)', async () => {
    // item mặc định: subtotal 2.000.000, vatAmount 0 → Tổng thanh toán 2.000.000
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation());
    await expect(
      service.discount('q-1', { amount: 3_000_000, reason: 'Quá tay' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('áp dụng thành công, lưu discountAmount/discountReason/discountBy từ JWT', async () => {
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation());
    prisma.quotation.update.mockResolvedValue({ id: 'q-1' });

    await service.discount(
      'q-1',
      { amount: 100_000, reason: 'Khách quen' },
      'user-1',
    );

    expect(prisma.quotation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q-1' },
        data: expect.objectContaining({
          discountAmount: 100_000,
          discountReason: 'Khách quen',
          discountBy: 'user-1',
        }),
      }),
    );
  });
});

// 022-gia-von-loi-nhuan-bao-gia.md — Việc 4/5. Giá vốn ước tính real-time
// (không phải plannedCost snapshot), chỉ trả về qua endpoint/field gắn
// quotation.view-cost — service tự nhận roleId, không tự ý gate ở đây (đã
// gate ở controller cho cost-summary, và ở chính findAll cho list).
describe('QuotationWorkflowService — Giá vốn/Lợi nhuận (022)', () => {
  let service: QuotationWorkflowService;
  let prisma: {
    quotation: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    materialRequirement: { findMany: jest.Mock };
  };
  let bomEngine: {
    loadConfigForVersion: jest.Mock;
    calculateBom: jest.Mock;
  };
  let permissionService: { hasPermission: jest.Mock };

  beforeEach(async () => {
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      materialRequirement: { findMany: jest.fn() },
    };
    bomEngine = {
      loadConfigForVersion: jest.fn(),
      calculateBom: jest.fn(),
    };
    permissionService = { hasPermission: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationWorkflowService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: { calculate: jest.fn() } },
        { provide: BomEngineService, useValue: bomEngine },
        { provide: PermissionService, useValue: permissionService },
      ],
    }).compile();

    service = module.get<QuotationWorkflowService>(QuotationWorkflowService);
  });

  it('getCostSummary(): tính đúng giá vốn/lợi nhuận từng dòng + tổng, đánh dấu costAvailable=false khi sản phẩm chưa có Material Requirement Version ACTIVE', async () => {
    prisma.quotation.findUnique.mockResolvedValue({
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productCode: 'SP000001',
          productName: 'Cửa nhôm',
          quantity: 2,
          finalPrice: 300_000,
          subtotal: 600_000,
          parameters: [],
        },
        {
          id: 'item-2',
          productId: 'prod-2',
          productCode: 'SP000002',
          productName: 'Cửa lưới',
          quantity: 1,
          finalPrice: 200_000,
          subtotal: 200_000,
          parameters: [],
        },
      ],
    });
    prisma.materialRequirement.findMany.mockResolvedValue([
      { productId: 'prod-1', versions: [{ id: 'mrv-1' }], product: { parameters: [] } },
      // prod-2: không có version ACTIVE nào → costAvailable=false.
    ]);
    bomEngine.loadConfigForVersion.mockResolvedValue({
      materialRequirementVersionId: 'mrv-1',
      items: [],
      derivedParameters: [],
    });
    bomEngine.calculateBom.mockReturnValue({
      materialRequirementVersionId: 'mrv-1',
      lines: [],
      plannedCost: 250_000, // giá vốn cho 2 sản phẩm → đơn giá 125.000
    });

    const result = await service.getCostSummary('q-1');

    expect(result.items).toHaveLength(2);
    const item1 = result.items.find((i) => i.quotationItemId === 'item-1')!;
    expect(item1.costAvailable).toBe(true);
    expect(item1.totalCost).toBe(250_000);
    expect(item1.costUnitPrice).toBe(125_000);
    expect(item1.totalSale).toBe(600_000);
    expect(item1.profit).toBe(350_000);

    const item2 = result.items.find((i) => i.quotationItemId === 'item-2')!;
    expect(item2.costAvailable).toBe(false);
    expect(item2.totalCost).toBe(0);
    expect(item2.profit).toBe(200_000);

    expect(result.totals).toEqual({
      totalCost: 250_000,
      totalSale: 800_000,
      profit: 550_000,
    });
    expect(result.hasIncompleteData).toBe(true);
  });

  it('findAll(): KHÔNG trả totalCost/profit khi role không có quotation.view-cost', async () => {
    permissionService.hasPermission.mockResolvedValue(false);
    prisma.quotation.findMany.mockResolvedValue([
      { id: 'q-1', items: [{ id: 'item-1', subtotal: 600_000 }] },
    ]);
    prisma.quotation.count.mockResolvedValue(1);

    const result = await service.findAll({}, 'role-sales');

    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      'role-sales',
      'quotation.view-cost',
    );
    expect(result.data[0]).not.toHaveProperty('totalCost');
    expect(result.data[0]).not.toHaveProperty('profit');
  });

  it('findAll(): TRẢ totalCost/profit khi role có quotation.view-cost', async () => {
    permissionService.hasPermission.mockResolvedValue(true);
    prisma.quotation.findMany.mockResolvedValue([
      {
        id: 'q-1',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 2,
            subtotal: 600_000,
            parameters: [],
          },
        ],
      },
    ]);
    prisma.quotation.count.mockResolvedValue(1);
    prisma.materialRequirement.findMany.mockResolvedValue([
      { productId: 'prod-1', versions: [{ id: 'mrv-1' }], product: { parameters: [] } },
    ]);
    bomEngine.loadConfigForVersion.mockResolvedValue({
      materialRequirementVersionId: 'mrv-1',
      items: [],
      derivedParameters: [],
    });
    bomEngine.calculateBom.mockReturnValue({
      materialRequirementVersionId: 'mrv-1',
      lines: [],
      plannedCost: 250_000,
    });

    const result = await service.findAll({}, 'role-owner');

    expect((result.data[0] as { totalCost: number }).totalCost).toBe(250_000);
    expect((result.data[0] as { profit: number }).profit).toBe(350_000);
  });
});
