export class UpdateQuotationDto {
  expiryDate?: string | null;
  expectedDeliveryDate?: string | null;
  note?: string | null;
  // Đổi khách hàng (chốt 24/07/2026) — chỉ cho phép khi báo giá đang Nháp,
  // xem quotation-workflow.service.ts update().
  customerId?: string;
}
