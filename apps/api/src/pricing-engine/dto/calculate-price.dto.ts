export class ParameterInputDto {
  name: string;
  value: string;
}

export class CalculatePriceDto {
  productId: string;
  parameters: ParameterInputDto[];
}

export class CalculatePriceResultDto {
  systemPrice: number;
  pricingRuleVersionId: string;
  adjustedVariables: Record<string, number>;
}
