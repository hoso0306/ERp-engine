export class MaterialQueryDto {
  search?: string;
  isActive?: string;
  // Lọc theo xưởng sản xuất (chốt 08/07/2026 — vật tư thuộc nhiều xưởng).
  productionCenterId?: string;
  page?: string;
  limit?: string;
}
