export class ProductParameterOptionDto {
  value: string;
  label?: string;
  displayOrder?: number;
}

export class CreateProductParameterDto {
  name: string;
  label: string;
  type: string;
  unit?: string;
  defaultValue?: string;
  isRequired?: boolean;
  minValue?: number;
  maxValue?: number;
  step?: number;
  usedInPricing?: boolean;
  usedInMaterial?: boolean;
  displayOrder?: number;
  options?: ProductParameterOptionDto[];
}
