export class UpdateMaterialDto {
  code?: string;
  name?: string;
  unitId?: string;
  isActive?: boolean;
  note?: string;
  minimumStock?: number | null;
  // Giá bán lẻ (chốt 08/07/2026) — null để xoá; giá vốn vẫn dùng giá nhập.
  retailPrice?: number | null;
}
