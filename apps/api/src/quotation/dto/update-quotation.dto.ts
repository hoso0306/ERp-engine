export class UpdateQuotationDto {
  expiryDate?: string | null;
  expectedDeliveryDate?: string | null;
  note?: string | null;
  // Phí vận chuyển (chốt 27/07/2026) — số tiền mặt, không chịu VAT. Xem
  // quotation-workflow.service.ts update().
  shippingFee?: number;
  // Đổi khách hàng (chốt 24/07/2026) — chỉ cho phép khi báo giá đang Nháp,
  // xem quotation-workflow.service.ts update().
  customerId?: string;
}
