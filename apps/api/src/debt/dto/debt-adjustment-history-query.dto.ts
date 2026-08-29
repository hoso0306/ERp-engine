// Tab "Lịch sử giảm trừ/công nợ đầu kỳ" trong trang chi tiết khách hàng —
// xem DebtService.getDebtAdjustmentHistoryByCustomer().
export class DebtAdjustmentHistoryQueryDto {
  from?: string;
  to?: string;
  page?: string;
  limit?: string;
}
