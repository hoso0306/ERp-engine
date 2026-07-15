export class MaterialRequirementBulkItemDto {
  materialId: string;
  expression: string;
  condition?: string | null;
  wastePercent?: number;
  roundStep?: number | null;
  note?: string | null;
}

export class BulkUpsertMaterialRequirementItemsDto {
  rows: MaterialRequirementBulkItemDto[];
}
