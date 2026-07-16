import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoundType, VersionStatus } from '@prisma/client';
import {
  CalculatePriceDto,
  CalculatePriceResultDto,
} from './dto/calculate-price.dto';
import {
  coerceParameters,
  computeDerivedParams,
  DerivedParameterDef,
} from '../shared/derived-params';
import {
  runValidationRules,
  ValidationRuleDef,
} from '../shared/validation-rules';
import {
  evaluateNumber,
  evaluateBoolean,
  applyRounding,
  ExpressionContext,
} from '../shared/expression';

/**
 * Pricing Engine (Sprint 03 Task 07) — pipeline:
 *
 *   Validate → Derive → Normalize (min/bậc thang, có condition)
 *   → Matrix Lookup (unitPrice) → Công thức (dùng unitPrice + biến khác) → Round
 *
 * Chốt 16/07/2026: Ma trận và Công thức PHỐI HỢP, không loại trừ nhau — sản
 * phẩm có Ma trận bắt buộc phải có Công thức, `unitPrice` (đơn giá tra được
 * từ Ma trận) được truyền vào làm biến thật trong Công thức. Sản phẩm KHÔNG
 * có Ma trận thì Công thức chạy độc lập như trước (không có unitPrice).
 *
 * Tách 2 tầng: loadConfig (đọc DB) và calculatePrice (hàm thuần, không DB) —
 * test không cần mock Prisma, và bước Approve có thể tính lại từ config đã
 * snapshot (nguyên tắc 7).
 *
 * Billable ≠ Actual: engine điều chỉnh kích thước CHỈ để tính tiền, trên bản
 * sao. Kích thước gốc không bị ghi đè và là thứ duy nhất BOM Engine được nhận.
 */

export interface PricingRuleItemConfig {
  ruleType: string;
  targetParameter: string | null;
  value: number;
  condition: string | null;
  rangeFrom: number | null;
  rangeTo: number | null;
  billValue: number | null;
  displayOrder: number;
}

export interface PriceMatrixRowConfig {
  dimensions: Record<string, string>;
  unitPrice: number;
  displayOrder: number;
}

export interface PricingConfig {
  pricingRuleVersionId: string;
  expression: string | null;
  priceRoundType: RoundType;
  priceRoundValue: number;
  ruleItems: PricingRuleItemConfig[];
  matrixRows: PriceMatrixRowConfig[];
  derivedParameters: DerivedParameterDef[];
  validationRules: ValidationRuleDef[];
  enumParameterNames: string[];
  // Thuế suất VAT (%) — pass-through, KHÔNG tính vào rawPrice/systemPrice.
  // Nơi tiêu thụ (Preview sản phẩm, Discount Engine ở Quotation) tự tính
  // vatAmount đúng điểm cần trong pipeline của mình.
  vatRate: number;
}

export interface PricingCalcResult {
  systemPrice: number;
  rawPrice: number;
  unitPrice: number | null;
  billableParams: Record<string, number>;
  warnings: string[];
  pricingRuleVersionId: string;
  vatRate: number;
}

const VERSION_INCLUDE = {
  items: { orderBy: { displayOrder: 'asc' as const } },
  matrixRows: { orderBy: { displayOrder: 'asc' as const } },
} as const;

const PRODUCT_LEVEL_INCLUDE = {
  derivedParameters: { orderBy: { displayOrder: 'asc' as const } },
  validationRules: { orderBy: { displayOrder: 'asc' as const } },
  // Chỉ lấy tên — dùng để coerceParameters() biết KHÔNG được ép ENUM có giá
  // trị dạng số (vd "1"/"2") thành number, tránh lệch kiểu khi so sánh == với
  // literal chuỗi trong Condition/Rule (phát hiện lúc verify unitPrice migrate).
  parameters: { where: { type: 'ENUM' as const }, select: { name: true } },
} as const;

@Injectable()
export class PricingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────
  // Tầng Load — đọc Master Data thành config thuần
  // ─────────────────────────────────────────────────────

  /** Config từ version ACTIVE của sản phẩm (luồng báo giá). */
  async loadConfig(productId: string): Promise<PricingConfig> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        ...PRODUCT_LEVEL_INCLUDE,
        pricingRule: {
          include: {
            versions: {
              where: { status: VersionStatus.ACTIVE },
              include: VERSION_INCLUDE,
              take: 1,
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }
    if (!product.pricingRule) {
      throw new BadRequestException('Sản phẩm chưa có Quy tắc báo giá.');
    }
    const activeVersion = product.pricingRule.versions[0];
    if (!activeVersion) {
      throw new BadRequestException(
        'Sản phẩm chưa có Phiên bản Quy tắc báo giá đang hoạt động.',
      );
    }

    return this.toConfig(activeVersion, product);
  }

  /** Config từ một version cụ thể — kể cả DRAFT (luồng preview của admin). */
  async loadConfigForVersion(versionId: string): Promise<PricingConfig> {
    const version = await this.prisma.pricingRuleVersion.findUnique({
      where: { id: versionId },
      include: {
        ...VERSION_INCLUDE,
        pricingRule: {
          select: {
            product: { include: PRODUCT_LEVEL_INCLUDE },
          },
        },
      },
    });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    return this.toConfig(version, version.pricingRule.product);
  }

  private toConfig(
    version: {
      id: string;
      expression: string | null;
      priceRoundType: RoundType;
      priceRoundValue: unknown;
      vatRate: unknown;
      items: Array<{
        ruleType: string;
        targetParameter: string | null;
        value: unknown;
        condition: string | null;
        rangeFrom: unknown;
        rangeTo: unknown;
        billValue: unknown;
        displayOrder: number;
      }>;
      matrixRows: Array<{
        dimensions: unknown;
        unitPrice: unknown;
        displayOrder: number;
      }>;
    },
    product: {
      derivedParameters: Array<{ name: string; expression: string }>;
      validationRules: Array<{
        expression: string;
        severity: string;
        message: string;
      }>;
      parameters: Array<{ name: string }>;
    },
  ): PricingConfig {
    return {
      pricingRuleVersionId: version.id,
      expression: version.expression?.trim() || null,
      priceRoundType: version.priceRoundType,
      priceRoundValue: version.priceRoundValue
        ? Number(version.priceRoundValue)
        : 0,
      vatRate: Number(version.vatRate ?? 0),
      ruleItems: version.items.map((i) => ({
        ruleType: i.ruleType,
        targetParameter: i.targetParameter,
        value: Number(i.value),
        condition: i.condition,
        rangeFrom:
          i.rangeFrom !== null && i.rangeFrom !== undefined
            ? Number(i.rangeFrom)
            : null,
        rangeTo:
          i.rangeTo !== null && i.rangeTo !== undefined
            ? Number(i.rangeTo)
            : null,
        billValue:
          i.billValue !== null && i.billValue !== undefined
            ? Number(i.billValue)
            : null,
        displayOrder: i.displayOrder,
      })),
      matrixRows: version.matrixRows.map((r) => ({
        dimensions: r.dimensions as Record<string, string>,
        unitPrice: Number(r.unitPrice),
        displayOrder: r.displayOrder,
      })),
      derivedParameters: product.derivedParameters.map((d) => ({
        name: d.name,
        expression: d.expression,
      })),
      validationRules: product.validationRules.map((v) => ({
        expression: v.expression,
        severity: v.severity as 'WARN' | 'BLOCK',
        message: v.message,
      })),
      enumParameterNames: product.parameters.map((p) => p.name),
    };
  }

  // ─────────────────────────────────────────────────────
  // Tầng Calculate — hàm thuần, không DB
  // ─────────────────────────────────────────────────────

  calculatePrice(
    config: PricingConfig,
    rawParams: ExpressionContext,
  ): PricingCalcResult {
    // 1. Derive — từ tham số GỐC
    const ctx = computeDerivedParams(config.derivedParameters, rawParams);

    // 2. Validate — WARN gom vào warnings, BLOCK throw
    const { warnings } = runValidationRules(config.validationRules, ctx);

    // 3. Normalize — tạo billable params (bản sao, không ghi đè raw)
    const billable = this.normalize(config, ctx);

    // 4. Đơn giá: Matrix lookup → unitPrice trở thành biến thật, Công thức
    // dùng unitPrice (+ các biến khác) để tính giá bán cuối cùng. Ma trận và
    // Công thức PHỐI HỢP với nhau (không loại trừ nhau) — sản phẩm dùng Ma
    // trận bắt buộc phải có Công thức (chốt 16/07/2026, đảo lại quyết định
    // "matrix thắng" cũ ở workbench/sprint-03/011-pricing-bom-engine.md).
    let rawPrice: number;
    let unitPrice: number | null = null;

    if (config.matrixRows.length > 0) {
      unitPrice = this.lookupMatrix(config.matrixRows, ctx);
      if (!config.expression?.trim()) {
        throw new BadRequestException(
          'Sản phẩm dùng Bảng giá ma trận cần có Công thức để tính giá bán từ đơn giá tra được (vd: unitPrice * area).',
        );
      }
      try {
        rawPrice = evaluateNumber(config.expression, {
          ...billable,
          unitPrice,
        });
      } catch (e) {
        throw new BadRequestException(`Lỗi tính giá: ${(e as Error).message}`);
      }
    } else if (config.expression) {
      try {
        rawPrice = evaluateNumber(config.expression, billable);
      } catch (e) {
        throw new BadRequestException(`Lỗi tính giá: ${(e as Error).message}`);
      }
    } else {
      throw new BadRequestException(
        'Phiên bản Quy tắc báo giá chưa có Bảng giá ma trận lẫn công thức tính giá.',
      );
    }

    if (rawPrice < 0) {
      throw new BadRequestException(
        'Giá tính được là số âm — kiểm tra lại cấu hình giá.',
      );
    }

    // 5. Round
    const systemPrice = Math.round(
      applyRounding(rawPrice, config.priceRoundType, config.priceRoundValue),
    );

    return {
      systemPrice,
      rawPrice,
      unitPrice,
      billableParams: this.numericOnly(billable),
      warnings,
      pricingRuleVersionId: config.pricingRuleVersionId,
      vatRate: config.vatRate,
    };
  }

  /**
   * Áp rule items lên bản sao của context:
   * (a) rule mức tham số (MIN_DIMENSION/MIN_VALUE) trước,
   * (b) tính LẠI biến phái sinh từ tham số đã điều chỉnh
   *     (rộng 60cm bị nâng lên 70cm thì diện tích tính tiền phải theo 70cm),
   * (c) rule mức biến phái sinh (MIN_AREA, BILLABLE_STEP) sau.
   * Rule có condition chỉ chạy khi condition đúng (evaluate trên tham số gốc).
   */
  private normalize(
    config: PricingConfig,
    ctx: ExpressionContext,
  ): ExpressionContext {
    const applicable = config.ruleItems.filter((item) => {
      if (!item.condition) return true;
      try {
        return evaluateBoolean(item.condition, ctx);
      } catch (e) {
        throw new BadRequestException(
          `Condition của rule giá (${item.condition}) lỗi: ${(e as Error).message}`,
        );
      }
    });

    const adjustedRaw: ExpressionContext = { ...ctx };

    // (a) mức tham số
    for (const item of applicable) {
      if (
        (item.ruleType === 'MIN_DIMENSION' || item.ruleType === 'MIN_VALUE') &&
        item.targetParameter
      ) {
        const current = adjustedRaw[item.targetParameter];
        if (typeof current === 'number' && current < item.value) {
          adjustedRaw[item.targetParameter] = item.value;
        }
      }
    }

    // (b) tính lại biến phái sinh từ tham số đã điều chỉnh
    const billable = computeDerivedParams(
      config.derivedParameters,
      adjustedRaw,
    );

    // (c) mức biến phái sinh. BILLABLE_STEP so với giá trị GỐC (trước mọi bậc)
    // — các bậc không được cascade: 0.5m² khớp bậc [0, 0.7) → 0.7, không được
    // rơi tiếp vào bậc [0.7, 1) thành 1.
    const stepBase: ExpressionContext = { ...billable };
    for (const item of applicable) {
      if (item.ruleType === 'MIN_AREA') {
        const current = billable['area'];
        if (typeof current === 'number' && current < item.value) {
          billable['area'] = item.value;
        }
      } else if (item.ruleType === 'BILLABLE_STEP') {
        const target = item.targetParameter ?? 'area';
        const base = stepBase[target];
        const from = item.rangeFrom ?? Number.NEGATIVE_INFINITY;
        const to = item.rangeTo ?? Number.POSITIVE_INFINITY;
        if (
          typeof base === 'number' &&
          item.billValue !== null &&
          base >= from &&
          base < to
        ) {
          billable[target] = item.billValue;
        }
      }
    }

    return billable;
  }

  /** Khớp tổ hợp config với dimensions của row (so sánh dạng chuỗi). */
  private lookupMatrix(
    rows: PriceMatrixRowConfig[],
    ctx: ExpressionContext,
  ): number {
    for (const row of rows) {
      const matched = Object.entries(row.dimensions).every(
        ([key, value]) =>
          ctx[key] !== undefined && String(ctx[key]) === String(value),
      );
      if (matched) return row.unitPrice;
    }

    const dimensionNames = Object.keys(rows[0]?.dimensions ?? {});
    const combo = dimensionNames
      .map((k) => `${k}=${ctx[k] !== undefined ? String(ctx[k]) : '?'}`)
      .join(', ');
    throw new BadRequestException(
      `Bảng giá chưa có đơn giá cho tổ hợp: ${combo}.`,
    );
  }

  private numericOnly(ctx: ExpressionContext): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(ctx)) {
      if (typeof v === 'number') out[k] = v;
    }
    return out;
  }

  // ─────────────────────────────────────────────────────
  // API cũ — giữ nguyên chữ ký cho Quotation/Controller
  // ─────────────────────────────────────────────────────

  async calculate(dto: CalculatePriceDto): Promise<CalculatePriceResultDto> {
    const config = await this.loadConfig(dto.productId);
    const result = this.calculatePrice(
      config,
      coerceParameters(dto.parameters, config.enumParameterNames),
    );
    return {
      systemPrice: result.systemPrice,
      pricingRuleVersionId: result.pricingRuleVersionId,
      unitPrice: result.unitPrice,
      rawPrice: result.rawPrice,
      vatRate: result.vatRate,
      adjustedVariables: result.billableParams,
      warnings: result.warnings,
    };
  }
}
