export class PaymentQueryDto {
  // Tab "Phiếu thu" (toàn hệ thống ở /debts/payments, hoặc lồng trong tab
  // Công nợ của 1 khách hàng khi có customerId) — lọc theo khoảng ngày thu.
  customerId?: string;
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}
