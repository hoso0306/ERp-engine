import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';

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

  beforeEach(async () => {
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationWorkflowService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: PricingEngineService,
          useValue: { calculate: jest.fn() },
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
});
