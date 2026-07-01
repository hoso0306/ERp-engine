export class UpdateProductParameterOptionDto {
  value: string;
  label?: string;
  displayOrder?: number;
}

export class UpdateProductParameterDto {
  name?: string;
  label?: string;
  type?: string;
  unit?: string;
  defaultValue?: string | null;
  isRequired?: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  step?: number | null;
  usedInPricing?: boolean;
  usedInMaterial?: boolean;
  displayOrder?: number;
  options?: UpdateProductParameterOptionDto[];
}
