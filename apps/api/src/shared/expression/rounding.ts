import { RoundType } from '@prisma/client';

/**
 * Làm tròn theo bước (step) — dùng chung cho giá và định mức vật tư.
 * step <= 0 hoặc RoundType.NONE → giữ nguyên giá trị.
 */
export function applyRounding(
  value: number,
  roundType: RoundType,
  step: number,
): number {
  if (step <= 0 || roundType === RoundType.NONE) return value;

  switch (roundType) {
    case RoundType.CEIL:
      return Math.ceil(value / step) * step;
    case RoundType.FLOOR:
      return Math.floor(value / step) * step;
    case RoundType.ROUND:
      return Math.round(value / step) * step;
    default:
      return value;
  }
}
