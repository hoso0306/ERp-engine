export class UpdatePricingRuleVersionDto {
  name?: string | null;
  expression?: string | null;
  priceRoundType?: string;
  priceRoundValue?: number | null;
  vatRate?: number;
  note?: string | null;
}
