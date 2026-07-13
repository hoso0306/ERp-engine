export class CreateMaterialRequirementItemDto {
  materialId: string;
  expression: string;
  /** Chọn vật tư theo Configuration: expression boolean, rỗng = dòng luôn dùng. */
  condition?: string;
  wastePercent?: number;
  roundStep?: number;
  note?: string;
  displayOrder?: number;
}
