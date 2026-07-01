export class CreateMaterialRequirementItemDto {
  materialId: string;
  expression: string;
  wastePercent?: number;
  roundStep?: number;
  note?: string;
  displayOrder?: number;
}
