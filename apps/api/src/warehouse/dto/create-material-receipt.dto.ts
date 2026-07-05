export class CreateMaterialReceiptDto {
  materialId!: string;
  quantity!: number;
  supplierName?: string;
  note?: string;
  createdBy?: string;
}
