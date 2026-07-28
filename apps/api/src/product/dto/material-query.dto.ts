export class MaterialQueryDto {
  search?: string;
  isActive?: string;
  // Lọc theo xưởng sản xuất (chốt 08/07/2026 — vật tư thuộc nhiều xưởng).
  productionCenterId?: string;
  // Lọc "Vật tư bán lẻ" (chốt 28/07/2026, sprint-04/025).
  isRetailable?: string;
  page?: string;
  limit?: string;
}
