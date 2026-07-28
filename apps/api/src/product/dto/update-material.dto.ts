export class UpdateMaterialDto {
  code?: string;
  name?: string;
  unitId?: string;
  isActive?: boolean;
  note?: string;
  minimumStock?: number | null;
  // Giá bán lẻ (chốt 08/07/2026) — null để xoá; giá vốn vẫn dùng giá nhập.
  retailPrice?: number | null;
  // Set lại toàn bộ danh sách xưởng (mảng rỗng = bỏ hết).
  productionCenterIds?: string[];

  // Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025).
  isRetailable?: boolean;
  // null = bỏ đơn vị bán lẻ riêng (dùng chung unitId gốc).
  retailUnitId?: string | null;
  retailConversionFactor?: number | null;
  retailVatRate?: number;
}
