// Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025) — dòng MATERIAL,
// không qua CTO/Pricing Rule. finalPrice tuỳ chọn: để trống thì lấy đúng
// Material.retailPrice, nhập vào thì ghi đè thủ công (không có Discount Engine).
export class CreateQuotationMaterialItemDto {
  materialId: string;
  quantity: number;
  finalPrice?: number;
  note?: string;
  displayOrder?: number;
}
