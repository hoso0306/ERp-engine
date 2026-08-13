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
  /** Đơn giá/m² sửa tay — bỏ qua tra Price Matrix (chỉ áp dụng sản phẩm có Matrix). */
  unitPrice?: number;
}
