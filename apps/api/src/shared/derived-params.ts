import { BadRequestException } from '@nestjs/common';
import { evaluateNumber, ExpressionContext } from './expression';

/**
 * Đơn vị chuẩn toàn hệ thống (chốt 10/07/2026 — workbench/sprint-03/011):
 * kích thước nhập theo cm, diện tích theo m².
 *
 * Biến phái sinh (vd: area = chieurong * chieucao / 10000) được định nghĩa
 * trong bảng derived_parameters theo từng sản phẩm — KHÔNG hardcode trong engine.
 * Luôn tính từ THAM SỐ GỐC; Pricing Engine tự tính lại trên billable params
 * sau khi áp min-rule, BOM Engine không bao giờ nhận billable params.
 */
export const CM2_PER_M2 = 10_000;

export interface DerivedParameterDef {
  name: string;
  expression: string;
}

/**
 * Chuyển tham số dạng chuỗi (QuotationItemParameter.value) sang context typed:
 * parse được số hữu hạn → number, còn lại giữ string (phục vụ condition ENUM,
 * ví dụ maukhung == "cafe").
 */
export function coerceParameters(
  parameters: Array<{ name: string; value: string }>,
): ExpressionContext {
  const ctx: ExpressionContext = {};
  for (const p of parameters) {
    const num = Number(p.value);
    ctx[p.name] = p.value.trim() !== '' && isFinite(num) ? num : p.value;
  }
  return ctx;
}

/**
 * Tính biến phái sinh theo định nghĩa DB, trả về context mới (base + derived).
 * Expression lỗi hoặc thiếu biến → BadRequestException nêu rõ biến nào.
 */
export function computeDerivedParams(
  defs: DerivedParameterDef[],
  base: ExpressionContext,
): ExpressionContext {
  const ctx: ExpressionContext = { ...base };
  for (const def of defs) {
    try {
      ctx[def.name] = evaluateNumber(def.expression, ctx);
    } catch (e) {
      throw new BadRequestException(
        `Không tính được biến phái sinh "${def.name}" (${def.expression}): ${(e as Error).message}`,
      );
    }
  }
  return ctx;
}
