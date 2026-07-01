export class UpdatePricingRuleVersionDto {
  name?: string;
  expression?: string;
  priceRoundType?: string;
  priceRoundValue?: number | null;
  note?: string;
}
