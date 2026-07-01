export class CreatePricingRuleItemDto {
  ruleType: string;
  targetParameter?: string;
  value: number;
  description?: string;
  displayOrder?: number;
}
