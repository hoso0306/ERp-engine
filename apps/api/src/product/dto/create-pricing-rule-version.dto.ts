export class CreatePricingRuleVersionDto {
  name?: string;
  expression?: string;
  priceRoundType?: string;
  priceRoundValue?: number;
  vatRate?: number;
  note?: string;
}
