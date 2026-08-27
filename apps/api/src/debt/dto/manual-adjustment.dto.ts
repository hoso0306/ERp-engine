export class ManualAdjustmentDto {
  amount!: number;
  reason!: string;
  // Return gây ra điều chỉnh này (nếu có) — chỉ để truy vết + deep-link
  // trong Timeline payload, không phải FK (rà soát nghiệp vụ Return
  // 27/08/2026).
  returnCode?: string;
  returnId?: string;
}
