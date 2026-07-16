import { BadRequestException } from '@nestjs/common';
import { evaluateNumber, ExpressionContext } from './expression';

/**
 * Đơn vị chuẩn toàn hệ thống (chốt lại 14/07/2026 — workbench/sprint-03/011):
 * kích thước nhập theo MÉT (m, số thập phân, ví dụ 1.546), diện tích theo m².
 *
 * Biến phái sinh (vd: area = chieurong * chieucao) được định nghĩa trong bảng
 * derived_parameters theo từng sản phẩm — KHÔNG hardcode trong engine.
 * Luôn tính từ THAM SỐ GỐC; Pricing Engine tự tính lại trên billable params
 * sau khi áp min-rule, BOM Engine không bao giờ nhận billable params.
 */

export interface DerivedParameterDef {
  name: string;
  expression: string;
}

/**
 * Chuyển tham số dạng chuỗi (QuotationItemParameter.value) sang context typed:
 * parse được số hữu hạn → number, còn lại giữ string (phục vụ condition ENUM,
 * ví dụ maukhung == "cafe").
 *
 * `enumParamNames`: tên các tham số kiểu ENUM — LUÔN giữ nguyên dạng chuỗi dù
 * giá trị trông giống số (vd "Số cánh" có option "1"/"2") — nếu không, so sánh
 * `==` với literal chuỗi trong Condition/Rule sẽ lệch kiểu (số vs chuỗi) và
 * lỗi. Phát hiện lúc verify Ma trận+Công thức cho sản phẩm cửa lưới (16/07/2026).
 */
export function coerceParameters(
  parameters: Array<{ name: string; value: string }>,
  enumParamNames?: string[] | Set<string>,
): ExpressionContext {
  const enumNames = enumParamNames instanceof Set ? enumParamNames : new Set(enumParamNames ?? []);
  const ctx: ExpressionContext = {};
  for (const p of parameters) {
    if (enumNames.has(p.name)) {
      ctx[p.name] = p.value;
      continue;
    }
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
