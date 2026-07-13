export class UpdatePricingRuleItemDto {
  ruleType?: string;
  targetParameter?: string;
  value?: number;
  /** Rule Language chung: expression boolean, rỗng/null = luôn áp dụng. */
  condition?: string | null;
  rangeFrom?: number | null;
  rangeTo?: number | null;
  billValue?: number | null;
  description?: string;
  displayOrder?: number;
}
