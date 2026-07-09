export class CreateMaterialDto {
  name: string;
  unitId: string;
  note?: string;
  minimumStock?: number;
  // Giá bán lẻ (chốt 08/07/2026) — giá vốn vẫn dùng giá nhập (MaterialPrice).
  retailPrice?: number;
  // Các xưởng sử dụng vật tư này (chỉ để lọc — chốt 08/07/2026).
  productionCenterIds?: string[];
}
