import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PricingEngineService, PricingConfig } from './pricing-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoundType } from '@prisma/client';

// ──────────────────────────────────────
// Helpers — config thuần cho tầng Calculate (không cần DB)
// ──────────────────────────────────────

function makeConfig(overrides: Partial<PricingConfig> = {}): PricingConfig {
  return {
    pricingRuleVersionId: 'ver-001',
    expression: null,
    surchargeExpression: null,
    priceRoundType: RoundType.NONE,
    priceRoundValue: 0,
    ruleItems: [],
    matrixRows: [],
    derivedParameters: [
      { name: 'area', expression: 'chieurong * chieucao / 10000' },
    ],
    validationRules: [],
    enumParameterNames: [],
    vatRate: 0,
    ...overrides,
  };
}

// Bảng giá thật (ảnh bảo giá cửa lưới Hệ 30): Trắng/Cafe × 1/2 cánh
const HE30_MATRIX = [
  {
    dimensions: { maukhung: 'trang', socanh: '1' },
    unitPrice: 385000,
    displayOrder: 0,
  },
  {
    dimensions: { maukhung: 'trang', socanh: '2' },
    unitPrice: 408000,
    displayOrder: 1,
  },
  {
    dimensions: { maukhung: 'cafe', socanh: '1' },
    unitPrice: 428000,
    displayOrder: 2,
  },
  {
    dimensions: { maukhung: 'cafe', socanh: '2' },
    unitPrice: 450000,
    displayOrder: 3,
  },
];

// Ghi chú bảng giá: 1 cánh rộng <70cm tính 70cm; 2 cánh rộng <100cm tính 100cm
const HE30_MIN_RULES = [
  {
    ruleType: 'MIN_DIMENSION',
    targetParameter: 'chieurong',
    value: 70,
    condition: 'socanh == 1',
    rangeFrom: null,
    rangeTo: null,
    billValue: null,
    displayOrder: 0,
  },
  {
    ruleType: 'MIN_DIMENSION',
    targetParameter: 'chieurong',
    value: 100,
    condition: 'socanh == 2',
    rangeFrom: null,
    rangeTo: null,
    billValue: null,
    displayOrder: 1,
  },
];

function service(): PricingEngineService {
  return new PricingEngineService({} as PrismaService);
}

// ──────────────────────────────────────
// Matrix lookup (bảng giá thật)
// ──────────────────────────────────────

describe('PricingEngine.calculatePrice — Matrix lookup', () => {
  it('Hệ 30 Cafe 2 cánh, 250×200cm → 5m² × 450.000 = 2.250.000', () => {
    const result = service().calculatePrice(
      makeConfig({ matrixRows: HE30_MATRIX, expression: 'unitPrice * area' }),
      { chieurong: 250, chieucao: 200, maukhung: 'cafe', socanh: 2 },
    );

    expect(result.unitPrice).toBe(450000);
    expect(result.systemPrice).toBe(2_250_000);
    expect(result.billableParams.area).toBe(5);
  });

  it('đổi màu Trắng 1 cánh → tra đúng đơn giá khác (385.000)', () => {
    const result = service().calculatePrice(
      makeConfig({ matrixRows: HE30_MATRIX, expression: 'unitPrice * area' }),
      { chieurong: 100, chieucao: 100, maukhung: 'trang', socanh: 1 },
    );
    expect(result.unitPrice).toBe(385000);
    expect(result.systemPrice).toBe(385000); // 1m²
  });

  it('Công thức dùng unitPrice kết hợp thêm phụ phí cố định', () => {
    const result = service().calculatePrice(
      makeConfig({
        matrixRows: HE30_MATRIX,
        expression: 'unitPrice * area + 20000',
      }),
      { chieurong: 100, chieucao: 100, maukhung: 'trang', socanh: 1 },
    );
    expect(result.unitPrice).toBe(385000);
    expect(result.systemPrice).toBe(385000 + 20000);
  });

  it('tổ hợp chưa có giá → lỗi nêu rõ tổ hợp', () => {
    expect(() =>
      service().calculatePrice(
        makeConfig({ matrixRows: HE30_MATRIX, expression: 'unitPrice * area' }),
        { chieurong: 100, chieucao: 100, maukhung: 'van_go', socanh: 1 },
      ),
    ).toThrow(/van_go/);
  });

  it('có Ma trận nhưng KHÔNG có Công thức → lỗi bắt buộc phải có Công thức', () => {
    expect(() =>
      service().calculatePrice(makeConfig({ matrixRows: HE30_MATRIX }), {
        chieurong: 100,
        chieucao: 100,
        maukhung: 'cafe',
        socanh: 1,
      }),
    ).toThrow(/cần có Công thức/);
  });

  it('sản phẩm dùng matrix nhưng thiếu derived param area → Công thức lỗi biến "area" không tồn tại', () => {
    expect(() =>
      service().calculatePrice(
        makeConfig({
          matrixRows: HE30_MATRIX,
          expression: 'unitPrice * area',
          derivedParameters: [],
        }),
        { chieurong: 100, chieucao: 100, maukhung: 'cafe', socanh: 1 },
      ),
    ).toThrow(/area/);
  });
});

// ──────────────────────────────────────
// Normalize — min rule có condition, bậc thang, billable ≠ raw
// ──────────────────────────────────────

describe('PricingEngine.calculatePrice — Normalize (min/bậc thang)', () => {
  it('cửa 1 cánh rộng 60cm → tính tiền theo 70cm (diện tích tính lại từ chiều đã nâng)', () => {
    const result = service().calculatePrice(
      makeConfig({
        matrixRows: HE30_MATRIX,
        ruleItems: HE30_MIN_RULES,
        expression: 'unitPrice * area',
      }),
      { chieurong: 60, chieucao: 200, maukhung: 'cafe', socanh: 1 },
    );

    // billable: chieurong 60 → 70; area = 70*200/10000 = 1.4m²
    expect(result.billableParams.chieurong).toBe(70);
    expect(result.billableParams.area).toBeCloseTo(1.4);
    expect(result.systemPrice).toBe(Math.round(1.4 * 428000));
  });

  it('rule min 1 cánh KHÔNG áp cho cửa 2 cánh (condition) — 2 cánh dùng min 100cm', () => {
    const result = service().calculatePrice(
      makeConfig({
        matrixRows: HE30_MATRIX,
        ruleItems: HE30_MIN_RULES,
        expression: 'unitPrice * area',
      }),
      { chieurong: 80, chieucao: 200, maukhung: 'cafe', socanh: 2 },
    );

    // 2 cánh: min 100cm áp dụng (80 → 100); min 70 (1 cánh) bị bỏ qua
    expect(result.billableParams.chieurong).toBe(100);
    expect(result.systemPrice).toBe(Math.round(2 * 450000)); // 100*200/10000 = 2m²
  });

  it('KHÔNG ghi đè tham số gốc — rawParams giữ nguyên (billable ≠ actual)', () => {
    const raw = { chieurong: 60, chieucao: 200, maukhung: 'cafe', socanh: 1 };
    service().calculatePrice(
      makeConfig({
        matrixRows: HE30_MATRIX,
        ruleItems: HE30_MIN_RULES,
        expression: 'unitPrice * area',
      }),
      raw,
    );
    expect(raw.chieurong).toBe(60); // xưởng vẫn cắt theo 60cm
  });

  it('BILLABLE_STEP (rèm kéo đứng): 0,85m² rơi vào bậc [0.7, 1) → tính 1m²', () => {
    const stepRules = [
      {
        ruleType: 'BILLABLE_STEP',
        targetParameter: null,
        value: 0,
        condition: null,
        rangeFrom: 0,
        rangeTo: 0.7,
        billValue: 0.7,
        displayOrder: 0,
      },
      {
        ruleType: 'BILLABLE_STEP',
        targetParameter: null,
        value: 0,
        condition: null,
        rangeFrom: 0.7,
        rangeTo: 1,
        billValue: 1,
        displayOrder: 1,
      },
    ];
    const config = makeConfig({
      expression: 'area * 415000',
      ruleItems: stepRules,
    });

    // 0.85m² → bậc 1m²
    const mid = service().calculatePrice(config, {
      chieurong: 85,
      chieucao: 100,
    });
    expect(mid.billableParams.area).toBe(1);
    expect(mid.systemPrice).toBe(415000);

    // 0.5m² → bậc 0.7m²
    const small = service().calculatePrice(config, {
      chieurong: 50,
      chieucao: 100,
    });
    expect(small.billableParams.area).toBe(0.7);

    // 2.5m² → giữ nguyên
    const large = service().calculatePrice(config, {
      chieurong: 125,
      chieucao: 200,
    });
    expect(large.billableParams.area).toBe(2.5);
  });

  it('condition của rule lỗi → throw, không âm thầm bỏ rule', () => {
    const badRule = [
      {
        ruleType: 'MIN_AREA',
        targetParameter: null,
        value: 0.7,
        condition: 'bienkhongton >',
        rangeFrom: null,
        rangeTo: null,
        billValue: null,
        displayOrder: 0,
      },
    ];
    expect(() =>
      service().calculatePrice(
        makeConfig({ expression: 'area * 100000', ruleItems: badRule }),
        { chieurong: 100, chieucao: 100 },
      ),
    ).toThrow(BadRequestException);
  });
});

// ──────────────────────────────────────
// Expression fallback + rounding (tương thích sản phẩm cũ)
// ──────────────────────────────────────

describe('PricingEngine.calculatePrice — Expression fallback', () => {
  it('không có matrix → dùng expression (sản phẩm cũ chạy nguyên trạng)', () => {
    const result = service().calculatePrice(
      makeConfig({
        expression: '(chieucao/100)*(chieurong/100)*328000 + 5000',
      }),
      { chieurong: 100, chieucao: 200 },
    );
    expect(result.unitPrice).toBeNull();
    expect(result.systemPrice).toBe(2 * 328000 + 5000);
  });

  it('làm tròn CEIL theo bước 10.000', () => {
    const result = service().calculatePrice(
      makeConfig({
        expression: 'area * 210000',
        priceRoundType: RoundType.CEIL,
        priceRoundValue: 10000,
      }),
      { chieurong: 100, chieucao: 150 }, // 1.5m² → 315.000 → CEIL 320.000
    );
    expect(result.systemPrice).toBe(320_000);
  });

  it('không có matrix lẫn expression → lỗi rõ ràng', () => {
    expect(() =>
      service().calculatePrice(makeConfig(), { chieurong: 100, chieucao: 100 }),
    ).toThrow(/chưa có Bảng giá/);
  });

  it('giá âm → lỗi', () => {
    expect(() =>
      service().calculatePrice(
        makeConfig({ expression: 'area * 100000 - 999999999' }),
        {
          chieurong: 100,
          chieucao: 100,
        },
      ),
    ).toThrow(/số âm/);
  });
});

// ──────────────────────────────────────
// VAT — pass-through, không tính vào systemPrice/rawPrice
// ──────────────────────────────────────

describe('PricingEngine.calculatePrice — VAT pass-through', () => {
  it('trả đúng vatRate từ config, KHÔNG cộng vào systemPrice', () => {
    const result = service().calculatePrice(
      makeConfig({ expression: 'area * 300000', vatRate: 10 }),
      { chieurong: 100, chieucao: 150 }, // 1.5m² × 300.000 = 450.000
    );
    expect(result.vatRate).toBe(10);
    expect(result.systemPrice).toBe(450_000);
  });

  it('vatRate mặc định 0 khi config không set', () => {
    const result = service().calculatePrice(
      makeConfig({ expression: 'area * 300000' }),
      { chieurong: 100, chieucao: 150 },
    );
    expect(result.vatRate).toBe(0);
  });
});

// ──────────────────────────────────────
// Validation Rule trong pipeline
// ──────────────────────────────────────

describe('PricingEngine.calculatePrice — Validation', () => {
  it('rule hệ xích (WARN): cao > 2×rộng → warnings, vẫn tính giá', () => {
    const result = service().calculatePrice(
      makeConfig({
        expression: 'area * 100000',
        validationRules: [
          {
            expression: 'chieucao > 2 * chieurong',
            severity: 'WARN',
            message:
              'Chiều cao vượt quá 2 lần chiều rộng — kiểm tra lại với xưởng.',
          },
        ],
      }),
      { chieurong: 100, chieucao: 300 },
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('2 lần chiều rộng');
    expect(result.systemPrice).toBeGreaterThan(0);
  });

  it('rule BLOCK vi phạm → throw message của rule', () => {
    expect(() =>
      service().calculatePrice(
        makeConfig({
          expression: 'area * 100000',
          validationRules: [
            {
              expression: 'chieurong > 500',
              severity: 'BLOCK',
              message: 'Chiều rộng vượt khổ tối đa 5m.',
            },
          ],
        }),
        { chieurong: 600, chieucao: 100 },
      ),
    ).toThrow('Chiều rộng vượt khổ tối đa 5m.');
  });

  it('không vi phạm → warnings rỗng', () => {
    const result = service().calculatePrice(
      makeConfig({
        expression: 'area * 100000',
        validationRules: [
          {
            expression: 'chieucao > 2 * chieurong',
            severity: 'WARN',
            message: 'x',
          },
        ],
      }),
      { chieurong: 100, chieucao: 150 },
    );
    expect(result.warnings).toEqual([]);
  });
});

// ──────────────────────────────────────
// Tầng Load + API calculate(dto) — mock Prisma
// ──────────────────────────────────────

describe('PricingEngineService.calculate (load + calc)', () => {
  async function build(prisma: unknown): Promise<PricingEngineService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingEngineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return module.get(PricingEngineService);
  }

  function mockProduct(overrides: Record<string, unknown> = {}) {
    return {
      id: 'prod-001',
      derivedParameters: [
        { name: 'area', expression: 'chieurong * chieucao / 10000' },
      ],
      validationRules: [],
      parameters: [{ name: 'maukhung' }, { name: 'socanh' }],
      pricingRule: {
        versions: [
          {
            id: 'ver-001',
            expression: 'unitPrice * area',
            priceRoundType: 'NONE',
            priceRoundValue: null,
            items: [],
            matrixRows: HE30_MATRIX,
          },
        ],
      },
      ...overrides,
    };
  }

  it('end-to-end: coerce tham số (ENUM giữ chuỗi, số thành number) + matrix lookup', async () => {
    const svc = await build({
      product: { findUnique: jest.fn().mockResolvedValue(mockProduct()) },
    });

    const result = await svc.calculate({
      productId: 'prod-001',
      parameters: [
        { name: 'chieurong', value: '250' },
        { name: 'chieucao', value: '200' },
        { name: 'maukhung', value: 'cafe' }, // ENUM — phải giữ nguyên chuỗi
        { name: 'socanh', value: '2' },
      ],
    });

    expect(result.systemPrice).toBe(2_250_000);
    expect(result.unitPrice).toBe(450000);
    expect(result.pricingRuleVersionId).toBe('ver-001');
    expect(result.warnings).toEqual([]);
  });

  it('sản phẩm không tồn tại → NotFoundException', async () => {
    const svc = await build({
      product: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      svc.calculate({ productId: 'x', parameters: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('chưa có version ACTIVE → BadRequestException', async () => {
    const svc = await build({
      product: {
        findUnique: jest
          .fn()
          .mockResolvedValue(mockProduct({ pricingRule: { versions: [] } })),
      },
    });
    await expect(
      svc.calculate({ productId: 'prod-001', parameters: [] }),
    ).rejects.toThrow(BadRequestException);
  });
});
