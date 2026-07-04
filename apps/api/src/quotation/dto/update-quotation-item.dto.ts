export class ParameterValueDto {
  name: string;
  value: string;
}

export class UpdateQuotationItemDto {
  quantity?: number;
  parameters?: ParameterValueDto[];
  additionalDiscountPercent?: number;
  additionalDiscountAmount?: number;
  discountReason?: string;
  discountBy?: string;
  displayOrder?: number;
}
