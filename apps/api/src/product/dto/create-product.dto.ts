export class CreateProductDto {
  name: string;
  productTypeId: string;
  unitId: string;
  productionCenterId?: string;
  description?: string;
}
