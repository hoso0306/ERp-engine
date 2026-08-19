export class CreateOpeningBalanceDto {
  customerId!: string;
  // Số tiền công nợ đầu kỳ, đã gồm VAT — bắt buộc, nhập trực tiếp (không còn
  // suy ra từ track trước-VAT nào khác, xem opening-balance.md).
  amount!: number;
  note?: string;
}
