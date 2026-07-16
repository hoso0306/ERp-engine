export class CreateMaterialReceiptItemDto {
  materialId!: string;
  quantity!: number;
}

export class CreateMaterialReceiptDto {
  items!: CreateMaterialReceiptItemDto[];
  supplierName?: string;
  note?: string;
  createdBy?: string;
}
