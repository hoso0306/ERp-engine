import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoundType, VersionStatus } from '@prisma/client';
import { computeDerivedParams, DerivedParameterDef } from '../shared/derived-params';
import {
  evaluateNumber,
  evaluateBoolean,
  applyRounding,
  ExpressionContext,
} from '../shared/expression';

/**
 * BOM Engine (Sprint 03 Task 09) — pipeline:
 *
 *   Filter (condition theo Configuration) → Formula → Waste → Round → × quantity
 *
 * NGUYÊN TẮC BẮT BUỘC (billable ≠ actual): BOM Engine chỉ nhận KÍCH THƯỚC GỐC
 * khách đặt. Không bao giờ truyền billable/adjusted params của Pricing Engine
 * vào đây — xưởng cắt thanh theo kích thước thật, không theo kích thước tính tiền.
 *
 * Chọn vật tư theo Configuration bằng condition trên từng dòng
 * (maukhung == "cafe" → dòng AL30-CAFE). Condition null = dòng luôn được dùng.
 */

export interface BomItemConfig {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialUnit: string | null;
  expression: string;
  condition: string | null;
  wastePercent: number;
  roundType: RoundType;
  roundValue: number | null;
  /** Giá mặc định hiện tại của vật tư (isDefault, effectiveFrom mới nhất) — 0 nếu chưa có. */
  unitPrice: number;
}

export interface BomConfig {
  materialRequirementVersionId: string;
  items: BomItemConfig[];
  derivedParameters: DerivedParameterDef[];
}

export interface BomLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  materialUnit: string | null;
  expression: string;
  wastePercent: number;
  roundType: RoundType;
  roundValue: number | null;
  /** Lượng cơ sở cho 1 sản phẩm (trước hao hụt/làm tròn). */
  baseQty: number;
  wastedQty: number;
  /** Lượng cuối cho 1 sản phẩm (sau hao hụt + làm tròn). */
  finalQtyPerUnit: number;
  /** Lượng cuối × số lượng sản phẩm. */
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BomCalcResult {
  materialRequirementVersionId: string;
  lines: BomLine[];
  plannedCost: number;
}

const VERSION_INCLUDE = {
  items: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      material: {
        include: {
          unit: { select: { name: true } },
          prices: {
            where: { isDefault: true },
            orderBy: { effectiveFrom: 'desc' as const },
            take: 1,
          },
        },
      },
    },
  },
  materialRequirement: {
    select: {
      product: {
        select: {
          derivedParameters: { orderBy: { displayOrder: 'asc' as const } },
        },
      },
    },
  },
} as const;

@Injectable()
export class BomEngineService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────
  // Tầng Load
  // ─────────────────────────────────────────────────────

  /** Config từ một version cụ thể (Snapshot Rule: approve dùng đúng version đã snapshot). */
  async loadConfigForVersion(versionId: string): Promise<BomConfig> {
    const version = await this.prisma.materialRequirementVersion.findUnique({
      where: { id: versionId },
      include: VERSION_INCLUDE,
    });
    if (!version) {
      throw new NotFoundException('Phiên bản Định mức vật tư không tồn tại.');
    }
    return this.toConfig(version);
  }

  /** Config từ version ACTIVE của sản phẩm. */
  async loadConfig(productId: string): Promise<BomConfig> {
    const version = await this.prisma.materialRequirementVersion.findFirst({
      where: {
        materialRequirement: { productId },
        status: VersionStatus.ACTIVE,
      },
      include: VERSION_INCLUDE,
    });
    if (!version) {
      throw new BadRequestException(
        'Sản phẩm chưa có Phiên bản Định mức vật tư đang hoạt động.',
      );
    }
    return this.toConfig(version);
  }

  private toConfig(version: {
    id: string;
    items: Array<{
      materialId: string;
      expression: string;
      condition: string | null;
      wastePercent: unknown;
      roundType: RoundType;
      roundValue: unknown;
      material: {
        code: string;
        name: string;
        unit: { name: string } | null;
        prices: Array<{ price: unknown }>;
      };
    }>;
    materialRequirement: {
      product: { derivedParameters: Array<{ name: string; expression: string }> };
    };
  }): BomConfig {
    return {
      materialRequirementVersionId: version.id,
      items: version.items.map((i) => ({
        materialId: i.materialId,
        materialCode: i.material.code,
        materialName: i.material.name,
        materialUnit: i.material.unit?.name ?? null,
        expression: i.expression,
        condition: i.condition,
        wastePercent: Number(i.wastePercent),
        roundType: i.roundType,
        roundValue: i.roundValue !== null && i.roundValue !== undefined ? Number(i.roundValue) : null,
        unitPrice: i.material.prices[0] ? Number(i.material.prices[0].price) : 0,
      })),
      derivedParameters: version.materialRequirement.product.derivedParameters.map((d) => ({
        name: d.name,
        expression: d.expression,
      })),
    };
  }

  // ─────────────────────────────────────────────────────
  // Tầng Calculate — hàm thuần, không DB
  // ─────────────────────────────────────────────────────

  /**
   * @param rawParams Tham số GỐC khách đặt (+ ENUM config) — không phải billable params.
   * @param quantity  Số lượng sản phẩm (1 cho preview theo đơn vị).
   */
  calculateBom(config: BomConfig, rawParams: ExpressionContext, quantity = 1): BomCalcResult {
    const ctx = computeDerivedParams(config.derivedParameters, rawParams);

    const lines: BomLine[] = [];
    let plannedCost = 0;

    for (const item of config.items) {
      // 1. Filter — chọn vật tư theo Configuration. Condition lỗi → throw,
      //    không âm thầm bỏ dòng (nhất quán nguyên tắc Task 01).
      if (item.condition) {
        let applicable: boolean;
        try {
          applicable = evaluateBoolean(item.condition, ctx);
        } catch (e) {
          throw new BadRequestException(
            `Condition của vật tư "${item.materialName}" (${item.condition}) lỗi: ${(e as Error).message}`,
          );
        }
        if (!applicable) continue;
      }

      // 2. Formula
      let baseQty: number;
      try {
        baseQty = evaluateNumber(item.expression, ctx);
      } catch (e) {
        throw new BadRequestException(
          `Công thức định mức của vật tư "${item.materialName}" (${item.expression}) lỗi — ${(e as Error).message}`,
        );
      }

      // 3. Waste → Round → × quantity
      const wastedQty = baseQty * (1 + item.wastePercent / 100);
      const finalQtyPerUnit = applyRounding(wastedQty, item.roundType, item.roundValue ?? 0);
      const qty = finalQtyPerUnit * quantity;
      const lineTotal = Math.round(qty * item.unitPrice);
      plannedCost += lineTotal;

      lines.push({
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialName: item.materialName,
        materialUnit: item.materialUnit,
        expression: item.expression,
        wastePercent: item.wastePercent,
        roundType: item.roundType,
        roundValue: item.roundValue,
        baseQty,
        wastedQty,
        finalQtyPerUnit,
        quantity: qty,
        unitPrice: item.unitPrice,
        lineTotal,
      });
    }

    return {
      materialRequirementVersionId: config.materialRequirementVersionId,
      lines,
      plannedCost,
    };
  }
}
