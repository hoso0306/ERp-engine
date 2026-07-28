export class CreateMaterialDto {
  name: string;
  unitId: string;
  note?: string;
  minimumStock?: number;
  // Giá bán lẻ (chốt 08/07/2026) — giá vốn vẫn dùng giá nhập (MaterialPrice).
  retailPrice?: number;
  // Các xưởng sử dụng vật tư này (chỉ để lọc — chốt 08/07/2026).
  productionCenterIds?: string[];

  // Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025).
  isRetailable?: boolean;
  retailUnitId?: string;
  retailConversionFactor?: number;
  retailVatRate?: number;
}
