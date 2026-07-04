import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoundType, VersionStatus } from '@prisma/client';
import { CalculatePriceDto, CalculatePriceResultDto } from './dto/calculate-price.dto';

@Injectable()
export class PricingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(dto: CalculatePriceDto): Promise<CalculatePriceResultDto> {
    const { productId, parameters } = dto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        pricingRule: {
          include: {
            versions: {
              where: { status: VersionStatus.ACTIVE },
              include: { items: { orderBy: { displayOrder: 'asc' } } },
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

    if (!activeVersion.expression?.trim()) {
      throw new BadRequestException(
        'Phiên bản Quy tắc báo giá chưa có công thức tính giá.',
      );
    }

    // Parse parameters thành số
    const vars: Record<string, number> = {};
    for (const p of parameters) {
      const num = parseFloat(p.value);
      vars[p.name] = isNaN(num) ? 0 : num;
    }

    // Tính biến phái sinh: area (m²) — giả sử width, height đơn vị mm
    const width = vars['width'] ?? 0;
    const height = vars['height'] ?? 0;
    vars['area'] = (width * height) / 1_000_000;

    // Áp dụng Pricing Rule Items
    for (const item of activeVersion.items) {
      const minValue = Number(item.value);

      if (item.ruleType === 'MIN_AREA') {
        if (vars['area'] < minValue) {
          vars['area'] = minValue;
        }
      } else if (
        (item.ruleType === 'MIN_DIMENSION' || item.ruleType === 'MIN_VALUE') &&
        item.targetParameter
      ) {
        const param = item.targetParameter;
        if ((vars[param] ?? 0) < minValue) {
          vars[param] = minValue;
        }
      }
    }

    // Tính giá từ expression
    const rawPrice = this.evaluateExpression(activeVersion.expression, vars);

    if (rawPrice < 0) {
      throw new BadRequestException('Giá tính được là số âm — kiểm tra lại công thức.');
    }

    // Làm tròn giá
    const systemPrice = this.applyRounding(
      rawPrice,
      activeVersion.priceRoundType,
      activeVersion.priceRoundValue ? Number(activeVersion.priceRoundValue) : 0,
    );

    return {
      systemPrice: Math.round(systemPrice),
      pricingRuleVersionId: activeVersion.id,
      adjustedVariables: vars,
    };
  }

  private evaluateExpression(
    expression: string,
    variables: Record<string, number>,
  ): number {
    const keys = Object.keys(variables);
    const values = Object.values(variables);
    try {
      // expressions do admin nhập — không phải user input không tin cậy
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `"use strict"; return (${expression});`);
      const result = fn(...values);
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Công thức không trả về số hợp lệ.');
      }
      return result;
    } catch (e) {
      throw new BadRequestException(`Lỗi tính giá: ${(e as Error).message}`);
    }
  }

  private applyRounding(price: number, roundType: RoundType, step: number): number {
    if (step <= 0 || roundType === RoundType.NONE) return price;

    switch (roundType) {
      case RoundType.CEIL:
        return Math.ceil(price / step) * step;
      case RoundType.FLOOR:
        return Math.floor(price / step) * step;
      case RoundType.ROUND:
        return Math.round(price / step) * step;
      default:
        return price;
    }
  }
}
