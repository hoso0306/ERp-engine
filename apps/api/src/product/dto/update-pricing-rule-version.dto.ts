export class UpdatePricingRuleVersionDto {
  name?: string | null;
  expression?: string | null;
  priceRoundType?: string;
  priceRoundValue?: number | null;
  vatRate?: number;
  matrixUnitLabel?: string | null;
  note?: string | null;
}
