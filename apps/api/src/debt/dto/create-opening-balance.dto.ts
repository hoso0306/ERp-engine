export class CreateOpeningBalanceDto {
  customerId!: string;
  amountBeforeVat!: number;
  // Sau VAT — tuỳ chọn, nếu bỏ trống thì OpeningBalanceService.create() resolve
  // = amountBeforeVat (xem opening-balance.md).
  amount?: number;
  note?: string;
}
