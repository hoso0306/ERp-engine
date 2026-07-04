import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { PrismaService } from '../prisma/prisma.service';

// ──────────────────────────────────────
// Helpers
// ──────────────────────────────────────

function makeVersion(overrides: Partial<{
  id: string;
  expression: string;
  priceRoundType: string;
  priceRoundValue: number | null;
  items: any[];
}> = {}) {
  return {
    id: 'ver-001',
    expression: 'area * 200000',
    priceRoundType: 'NONE',
    priceRoundValue: null,
    items: [],
    ...overrides,
  };
}

function makeProduct(versionOverrides?: Parameters<typeof makeVersion>[0] | null) {
  const version = versionOverrides === null ? undefined : makeVersion(versionOverrides);
  return {
    id: 'prod-001',
    pricingRule: version
      ? { versions: [version] }
      : versionOverrides === null
        ? { versions: [] }
        : null,
  };
}

function mockPrisma(product: any) {
  return {
    product: {
      findUnique: jest.fn().mockResolvedValue(product),
    },
  } as any;
}

// ──────────────────────────────────────
// Tests
// ──────────────────────────────────────

describe('PricingEngineService', () => {
  let service: PricingEngineService;

  async function build(prisma: any): Promise<PricingEngineService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingEngineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return module.get(PricingEngineService);
  }

  // ──────────────────────────────────────
  // Tính đúng giá cơ bản
  // ──────────────────────────────────────

  it('tính systemPrice đúng với expression area * 200000', async () => {
    service = await build(mockPrisma(makeProduct()));

    const result = await service.calculate({
      productId: 'prod-001',
      parameters: [
        { name: 'width', value: '1000' },   // 1000mm
        { name: 'height', value: '2000' },  // 2000mm → area = 2m²
      ],
    });

    // area = 1000 * 2000 / 1_000_000 = 2 m²
    // price = 2 * 200000 = 400_000
    expect(result.systemPrice).toBe(400_000);
    expect(result.pricingRuleVersionId).toBe('ver-001');
  });

  // ──────────────────────────────────────
  // MIN_AREA rule
  // ──────────────────────────────────────

  it('áp dụng MIN_AREA: diện tích nhỏ hơn tối thiểu → dùng minValue', async () => {
    service = await build(mockPrisma(makeProduct({
      expression: 'area * 200000',
      items: [{ ruleType: 'MIN_AREA', targetParameter: null, value: 0.7, displayOrder: 0 }],
    })));

    const result = await service.calculate({
      productId: 'prod-001',
      parameters: [
        { name: 'width', value: '400' },   // 400mm
        { name: 'height', value: '500' },  // 500mm → area = 0.2m² < 0.7
      ],
    });

    // area được floor lên 0.7 → price = 0.7 * 200000 = 140_000
    expect(result.systemPrice).toBe(140_000);
    expect(result.adjustedVariables['area']).toBe(0.7);
  });

  // ──────────────────────────────────────
  // MIN_DIMENSION rule
  // ──────────────────────────────────────

  it('áp dụng MIN_DIMENSION: width nhỏ hơn tối thiểu → dùng minValue', async () => {
    service = await build(mockPrisma(makeProduct({
      expression: 'width * 100',
      items: [{ ruleType: 'MIN_DIMENSION', targetParameter: 'width', value: 600, displayOrder: 0 }],
    })));

    const result = await service.calculate({
      productId: 'prod-001',
      parameters: [{ name: 'width', value: '400' }],  // 400 < 600
    });

    // width được floor lên 600 → price = 600 * 100 = 60_000
    expect(result.systemPrice).toBe(60_000);
  });

  // ──────────────────────────────────────
  // Làm tròn CEIL
  // ──────────────────────────────────────

  it('làm tròn CEIL theo priceRoundValue', async () => {
    service = await build(mockPrisma(makeProduct({
      expression: 'area * 200000',
      priceRoundType: 'CEIL',
      priceRoundValue: 10000,
      items: [],
    })));

    const result = await service.calculate({
      productId: 'prod-001',
      parameters: [
        { name: 'width', value: '1000' },
        { name: 'height', value: '1500' },  // area = 1.5m² → 300_000
      ],
    });

    // price = 300_000 đã là bội số của 10_000 → không đổi
    expect(result.systemPrice).toBe(300_000);
  });

  it('làm tròn CEIL lên bội số gần nhất', async () => {
    service = await build(mockPrisma(makeProduct({
      expression: 'area * 210000',   // 1.5 * 210000 = 315_000
      priceRoundType: 'CEIL',
      priceRoundValue: 10000,
      items: [],
    })));

    const result = await service.calculate({
      productId: 'prod-001',
      parameters: [
        { name: 'width', value: '1000' },
        { name: 'height', value: '1500' },
      ],
    });

    // 315_000 → ceil lên bội số 10_000 → 320_000
    expect(result.systemPrice).toBe(320_000);
  });

  // ──────────────────────────────────────
  // Lỗi: sản phẩm không tồn tại
  // ──────────────────────────────────────

  it('ném NotFoundException khi productId không tồn tại', async () => {
    service = await build(mockPrisma(null));

    await expect(
      service.calculate({ productId: 'not-found', parameters: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  // ──────────────────────────────────────
  // Lỗi: không có Pricing Rule
  // ──────────────────────────────────────

  it('ném BadRequestException khi sản phẩm chưa có Pricing Rule', async () => {
    const productWithoutRule = { id: 'prod-001', pricingRule: null };
    service = await build(mockPrisma(productWithoutRule));

    await expect(
      service.calculate({ productId: 'prod-001', parameters: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  // ──────────────────────────────────────
  // Lỗi: không có version ACTIVE
  // ──────────────────────────────────────

  it('ném BadRequestException khi không có Pricing Rule Version ACTIVE', async () => {
    const productNoActive = { id: 'prod-001', pricingRule: { versions: [] } };
    service = await build(mockPrisma(productNoActive));

    await expect(
      service.calculate({ productId: 'prod-001', parameters: [] }),
    ).rejects.toThrow(BadRequestException);
  });

  // ──────────────────────────────────────
  // Lỗi: expression sai cú pháp
  // ──────────────────────────────────────

  it('ném BadRequestException khi expression có cú pháp sai', async () => {
    service = await build(mockPrisma(makeProduct({ expression: 'width *' })));

    await expect(
      service.calculate({
        productId: 'prod-001',
        parameters: [{ name: 'width', value: '1000' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
