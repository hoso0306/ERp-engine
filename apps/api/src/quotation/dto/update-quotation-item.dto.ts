export class ParameterValueDto {
  name: string;
  value: string;
}

export class UpdateQuotationItemDto {
  quantity?: number;
  parameters?: ParameterValueDto[];
  note?: string;
  displayOrder?: number;
}
