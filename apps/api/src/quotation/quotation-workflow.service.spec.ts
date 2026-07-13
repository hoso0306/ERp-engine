import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { BomEngineService } from '../bom-engine/bom-engine.service';

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    quotationId: 'q-1',
    productId: 'prod-1',
    quantity: 2,
    systemPrice: 1000000,
    groupDiscount: 0,
    additionalDiscountPercent: 0,
    additionalDiscountAmount: 0,
    discountReason: null,
    discountBy: null,
    finalPrice: 1000000,
    subtotal: 2000000,
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
    note: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { id: 'cust-1', name: 'Nguyễn Văn An', phone: '0901000001' },
    items: [makeItem()],
    timeline: [],
    ...overrides,
  };
}

describe('QuotationWorkflowService.approve()', () => {
  let service: QuotationWorkflowService;
  let prisma: { quotation: { findUnique: jest.Mock; update: jest.Mock }; $transaction: jest.Mock };
  // BomEngineService thật (logic Filter/Formula chạy thật) với Prisma mock riêng
  let bomPrisma: { materialRequirementVersion: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
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
      ],
    }).compile();

    service = module.get<QuotationWorkflowService>(QuotationWorkflowService);
  });

  it('throws NotFoundException when quotation does not exist', async () => {
    prisma.quotation.findUnique.mockResolvedValue(null);
    await expect(service.approve('nonexistent')).rejects.toThrow(NotFoundException);
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
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ items: [itemNoPricing] }));
    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects approve when product has no active MaterialRequirementVersion', async () => {
    const itemNoMaterial = makeItem({
      product: {
        ...(makeItem().product as Record<string, unknown>),
        materialRequirement: { versions: [] },
      },
    });
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ items: [itemNoMaterial] }));
    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects approve when product is INACTIVE', async () => {
    const itemInactive = makeItem({
      product: {
        ...(makeItem().product as Record<string, unknown>),
        status: 'INACTIVE',
      },
    });
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ items: [itemInactive] }));
    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects approve when status is not SENT', async () => {
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ status: 'DRAFT' }));
    await expect(service.approve('q-1')).rejects.toThrow(ForbiddenException);
  });

  it('chặn approve khi expression định mức lỗi — không sinh SalesOrder với plannedCost thiếu', async () => {
    const item = makeItem({ materialRequirementVersionId: 'mrv-1' });
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ items: [item] }));

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
          material: { code: 'NL000001', name: 'Khung nhôm', unit: null, prices: [] },
        },
      ],
      materialRequirement: { product: { derivedParameters: [] } },
    });

    const tx = {
      salesOrder: { create: jest.fn() },
      runningNumber: { update: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await expect(service.approve('q-1')).rejects.toThrow(BadRequestException);
    await expect(service.approve('q-1')).rejects.toThrow(/Khung nhôm/);
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
    expect(tx.runningNumber.update).not.toHaveBeenCalled();
  });

  it('condition trên dòng BOM lọc vật tư theo config khách chọn khi Approve', async () => {
    const item = makeItem({
      materialRequirementVersionId: 'mrv-1',
      parameters: [
        { name: 'chieurong', value: '250', label: 'Rộng', unit: 'cm', displayOrder: 0 },
        { name: 'chieucao', value: '200', label: 'Cao', unit: 'cm', displayOrder: 1 },
        { name: 'maukhung', value: 'cafe', label: 'Màu', unit: null, displayOrder: 2 },
      ],
    });
    prisma.quotation.findUnique.mockResolvedValue(makeQuotation({ items: [item] }));

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
          material: { code: 'AL30-CAFE', name: 'Thanh Cafe', unit: { name: 'm' }, prices: [{ price: '10000' }] },
        },
        {
          materialId: 'al-trang',
          expression: '2 * chieurong / 100',
          condition: 'maukhung == "trang"',
          wastePercent: 0,
          roundType: 'NONE',
          roundValue: null,
          material: { code: 'AL30-TRANG', name: 'Thanh Trắng', unit: { name: 'm' }, prices: [{ price: '10000' }] },
        },
      ],
      materialRequirement: { product: { derivedParameters: [] } },
    });

    // tx mock đủ cho luồng approve chạy tới OrderBOM
    const orderBomCreate = jest.fn();
    const tx = {
      runningNumber: { update: jest.fn().mockResolvedValue({ prefix: 'DH', lastNumber: 1, paddingLength: 6 }) },
      salesOrder: { create: jest.fn().mockResolvedValue({ id: 'so-1' }) },
      receivable: { create: jest.fn() },
      salesOrderItem: { create: jest.fn().mockResolvedValue({ id: 'soi-1' }) },
      orderBOM: { create: orderBomCreate },
      productionOrder: { create: jest.fn().mockResolvedValue({ id: 'po-1' }) },
      productionOrderTimeline: { create: jest.fn() },
      quotation: { update: jest.fn().mockResolvedValue({ id: 'q-1' }) },
      quotationTimeline: { create: jest.fn() },
      salesOrderTimeline: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx));

    await service.approve('q-1');

    expect(orderBomCreate).toHaveBeenCalledTimes(1);
    const bomData = orderBomCreate.mock.calls[0][0].data;
    const codes = bomData.items.create.map((i: { materialCode: string }) => i.materialCode);
    expect(codes).toEqual(['AL30-CAFE']);
    // 2 × 250cm / 100 = 5m × quantity 2 = 10m
    expect(bomData.items.create[0].quantity).toBeCloseTo(10);
    expect(bomData.plannedCost).toBe(100_000); // 10m × 10.000
  });
});
