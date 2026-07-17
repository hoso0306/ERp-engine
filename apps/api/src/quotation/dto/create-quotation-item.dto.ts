export class ParameterValueDto {
  name: string;
  value: string;
}

export class CreateQuotationItemDto {
  productId: string;
  quantity: number;
  parameters: ParameterValueDto[];
  note?: string;
  displayOrder?: number;
}
