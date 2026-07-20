export class CreatePricingRuleVersionDto {
  name?: string;
  expression?: string;
  surchargeExpression?: string;
  priceRoundType?: string;
  priceRoundValue?: number;
  vatRate?: number;
  note?: string;
}
