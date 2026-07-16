import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoundType } from '@prisma/client';
import { BomEngineService, BomConfig, BomItemConfig } from './bom-engine.service';
import { PricingEngineService, PricingConfig } from '../pricing-engine/pricing-engine.service';
import { PrismaService } from '../prisma/prisma.service';

function makeItem(overrides: Partial<BomItemConfig> = {}): BomItemConfig {
  return {
    materialId: 'mat-1',
    materialCode: 'NL000001',
    materialName: 'Khung nhôm',
    materialUnit: 'm',
    expression: '(chieurong + chieucao) * 2 / 100',
    condition: null,
    wastePercent: 0,
    roundType: RoundType.NONE,
    roundValue: null,
    unitPrice: 50000,
    ...overrides,
  };
}

function makeConfig(items: BomItemConfig[], overrides: Partial<BomConfig> = {}): BomConfig {
  return {
    materialRequirementVersionId: 'mrv-001',
    items,
    derivedParameters: [{ name: 'area', expression: 'chieurong * chieucao / 10000' }],
    ...overrides,
  };
}

function service(): BomEngineService {
  return new BomEngineService({} as PrismaService);
}

// ──────────────────────────────────────
// Filter — chọn vật tư theo Configuration
// ──────────────────────────────────────

describe('BomEngine.calculateBom — Filter theo condition', () => {
  const colorVariants = [
    makeItem({
      materialId: 'al-cafe', materialCode: 'AL30-CAFE', materialName: 'Thanh nhôm H30 Cafe',
      expression: '2 * chieurong / 100', condition: 'maukhung == "cafe"',
    }),
    makeItem({
      materialId: 'al-trang', materialCode: 'AL30-TRANG', materialName: 'Thanh nhôm H30 Trắng',
      expression: '2 * chieurong / 100', condition: 'maukhung == "trang"',
    }),
    makeItem({
      materialId: 'wheel', materialCode: 'WH30', materialName: 'Bánh xe H30',
      expression: 'if(socanh == 2, 8, 4)', condition: null, materialUnit: 'cái', unitPrice: 5000,
    }),
  ];

  it('chọn Cafe → chỉ ra dòng AL30-CAFE, không ra AL30-TRANG; dòng không condition luôn có', () => {
    const result = service().calculateBom(makeConfig(colorVariants), {
      chieurong: 250, chieucao: 200, maukhung: 'cafe', socanh: 2,
    });

    const codes = result.lines.map((l) => l.materialCode);
    expect(codes).toEqual(['AL30-CAFE', 'WH30']);
    expect(codes).not.toContain('AL30-TRANG');
  });

  it('công thức phụ kiện theo số cánh: 2 cánh → 8 bánh xe, 1 cánh → 4', () => {
    const two = service().calculateBom(makeConfig(colorVariants), {
      chieurong: 100, chieucao: 100, maukhung: 'trang', socanh: 2,
    });
    expect(two.lines.find((l) => l.materialCode === 'WH30')?.baseQty).toBe(8);

    const one = service().calculateBom(makeConfig(colorVariants), {
      chieurong: 100, chieucao: 100, maukhung: 'trang', socanh: 1,
    });
    expect(one.lines.find((l) => l.materialCode === 'WH30')?.baseQty).toBe(4);
  });

  it('condition lỗi (biến không tồn tại) → throw nêu tên vật tư, KHÔNG âm thầm bỏ dòng', () => {
    const broken = [makeItem({ condition: 'mausai == "cafe"' })];
    expect(() =>
      service().calculateBom(makeConfig(broken), { chieurong: 100, chieucao: 100 }),
    ).toThrow(BadRequestException);
    expect(() =>
      service().calculateBom(makeConfig(broken), { chieurong: 100, chieucao: 100 }),
    ).toThrow(/Khung nhôm/);
  });

  it('expression định mức lỗi → throw nêu tên vật tư', () => {
    const broken = [makeItem({ expression: 'chieurong *' })];
    expect(() =>
      service().calculateBom(makeConfig(broken), { chieurong: 100, chieucao: 100 }),
    ).toThrow(/Khung nhôm/);
  });
});

// ──────────────────────────────────────
// Formula → Waste → Round → × quantity
// ──────────────────────────────────────

describe('BomEngine.calculateBom — Waste/Round/Quantity', () => {
  it('hao hụt 5% + làm tròn CEIL bước 0.5 + nhân số lượng 3', () => {
    const config = makeConfig([
      makeItem({
        expression: 'chieurong / 100', // 250cm → 2.5m
        wastePercent: 5,               // → 2.625m
        roundType: RoundType.CEIL,
        roundValue: 0.5,               // → 3m
        unitPrice: 40000,
      }),
    ]);
    const result = service().calculateBom(config, { chieurong: 250, chieucao: 100 }, 3);

    const line = result.lines[0];
    expect(line.baseQty).toBeCloseTo(2.5);
    expect(line.wastedQty).toBeCloseTo(2.625);
    expect(line.finalQtyPerUnit).toBe(3);
    expect(line.quantity).toBe(9);           // 3m × 3 sản phẩm
    expect(line.lineTotal).toBe(360_000);    // 9 × 40.000
    expect(result.plannedCost).toBe(360_000);
  });

  it('dùng được biến phái sinh (area) trong công thức định mức', () => {
    const config = makeConfig([
      makeItem({ materialName: 'Lưới', expression: 'area', unitPrice: 100000 }),
    ]);
    const result = service().calculateBom(config, { chieurong: 250, chieucao: 200 });
    expect(result.lines[0].baseQty).toBe(5); // 5m²
  });
});

// ──────────────────────────────────────
// NGUYÊN TẮC MILESTONE: billable ≠ actual
// ──────────────────────────────────────

describe('Billable ≠ Actual — giá theo kích thước tính tiền, BOM theo kích thước gốc', () => {
  it('đơn 60×200cm, rule min 70cm: giá tính theo 70cm nhưng thanh cắt theo 60cm', () => {
    const rawParams = { chieurong: 60, chieucao: 200, maukhung: 'cafe', socanh: 1 };

    // Pricing: min 70cm được áp → tính tiền theo 70cm
    const pricingConfig: PricingConfig = {
      pricingRuleVersionId: 'ver-1',
      expression: 'unitPrice * area',
      priceRoundType: RoundType.NONE,
      priceRoundValue: 0,
      ruleItems: [{
        ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 70,
        condition: 'socanh == 1', rangeFrom: null, rangeTo: null, billValue: null, displayOrder: 0,
      }],
      matrixRows: [{ dimensions: { maukhung: 'cafe', socanh: '1' }, unitPrice: 428000, displayOrder: 0 }],
      derivedParameters: [{ name: 'area', expression: 'chieurong * chieucao / 10000' }],
      validationRules: [],
      enumParameterNames: [],
    };
    const price = new PricingEngineService({} as PrismaService).calculatePrice(
      pricingConfig,
      rawParams,
    );
    expect(price.billableParams.chieurong).toBe(70);
    expect(price.systemPrice).toBe(Math.round(1.4 * 428000)); // 70×200 = 1.4m²

    // BOM: nhận KÍCH THƯỚC GỐC → thanh ngang 2×60cm = 1.2m, KHÔNG phải 1.4m
    const bomConfig = makeConfig([
      makeItem({ materialName: 'Thanh ngang', expression: '2 * chieurong / 100' }),
    ]);
    const bom = service().calculateBom(bomConfig, rawParams);
    expect(bom.lines[0].baseQty).toBeCloseTo(1.2);

    // Tham số gốc không bị hai engine ghi đè
    expect(rawParams.chieurong).toBe(60);
  });
});

// ──────────────────────────────────────
// Tầng Load — mock Prisma
// ──────────────────────────────────────

describe('BomEngine.loadConfigForVersion', () => {
  it('map version + items + derived params của sản phẩm; giá mặc định của vật tư', async () => {
    const prisma = {
      materialRequirementVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mrv-9',
          items: [{
            materialId: 'mat-1',
            expression: '2 * chieurong',
            condition: 'maukhung == "cafe"',
            wastePercent: '5',
            roundType: 'CEIL',
            roundValue: '0.5',
            material: {
              code: 'AL30-CAFE',
              name: 'Thanh nhôm Cafe',
              unit: { name: 'm' },
              prices: [{ price: '45000' }],
            },
          }],
          materialRequirement: {
            product: {
              derivedParameters: [{ name: 'area', expression: 'chieurong * chieucao / 10000' }],
            },
          },
        }),
      },
    };
    const svc = new BomEngineService(prisma as unknown as PrismaService);
    const config = await svc.loadConfigForVersion('mrv-9');

    expect(config.materialRequirementVersionId).toBe('mrv-9');
    expect(config.items[0]).toMatchObject({
      materialCode: 'AL30-CAFE',
      condition: 'maukhung == "cafe"',
      wastePercent: 5,
      roundValue: 0.5,
      unitPrice: 45000,
    });
    expect(config.derivedParameters).toHaveLength(1);
  });

  it('version không tồn tại → NotFoundException', async () => {
    const prisma = {
      materialRequirementVersion: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const svc = new BomEngineService(prisma as unknown as PrismaService);
    await expect(svc.loadConfigForVersion('x')).rejects.toThrow(NotFoundException);
  });
});
