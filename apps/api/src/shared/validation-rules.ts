import { BadRequestException } from '@nestjs/common';
import { evaluateBoolean, ExpressionContext } from './expression';

/**
 * Validation Rule (Sprint 03 Task 06) — chạy khi tạo/sửa dòng báo giá.
 * Expression mô tả điều kiện VI PHẠM: true → cảnh báo (WARN) hoặc chặn (BLOCK).
 * Đây là một bước trong luồng, không phải module Engine riêng (nguyên tắc 12).
 */
export interface ValidationRuleDef {
  expression: string;
  severity: 'WARN' | 'BLOCK';
  message: string;
}

export interface ValidationOutcome {
  /** Thông báo của các rule WARN bị vi phạm — cho phép tiếp tục, FE hiển thị. */
  warnings: string[];
}

export function runValidationRules(
  rules: ValidationRuleDef[],
  ctx: ExpressionContext,
): ValidationOutcome {
  const warnings: string[] = [];

  for (const rule of rules) {
    let violated: boolean;
    try {
      violated = evaluateBoolean(rule.expression, ctx);
    } catch (e) {
      // Rule hỏng là lỗi master data — báo rõ để admin sửa, không âm thầm bỏ qua.
      throw new BadRequestException(
        `Validation rule "${rule.message}" (${rule.expression}) lỗi: ${(e as Error).message}`,
      );
    }
    if (!violated) continue;

    if (rule.severity === 'BLOCK') {
      throw new BadRequestException(rule.message);
    }
    warnings.push(rule.message);
  }

  return { warnings };
}
