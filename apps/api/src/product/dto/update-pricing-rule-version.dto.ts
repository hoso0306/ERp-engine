export class UpdatePricingRuleVersionDto {
  name?: string | null;
  expression?: string | null;
  priceRoundType?: string;
  priceRoundValue?: number | null;
  note?: string | null;
}
