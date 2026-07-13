export class CreatePricingRuleItemDto {
  ruleType: string;
  targetParameter?: string;
  value?: number;
  /** Rule Language chung: expression boolean, rỗng = luôn áp dụng. */
  condition?: string;
  /** BILLABLE_STEP: khoảng [rangeFrom, rangeTo) → tính bằng billValue. */
  rangeFrom?: number;
  rangeTo?: number;
  billValue?: number;
  description?: string;
  displayOrder?: number;
}
