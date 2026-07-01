export class CreateMaterialPriceDto {
  supplierId?: string;
  price: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isDefault?: boolean;
  note?: string;
}
