export class UpdateMaterialRequirementItemDto {
  materialId?: string;
  expression?: string;
  /** Chọn vật tư theo Configuration: expression boolean, rỗng/null = dòng luôn dùng. */
  condition?: string | null;
  wastePercent?: number;
  roundStep?: number;
  note?: string;
  displayOrder?: number;
}
