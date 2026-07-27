export class CreateVatSettlementItemLineDto {
  productId!: string;
  quantity!: number;
  parameters!: { name: string; value: string }[];
}

export class CreateVatSettlementFromOpeningBalanceDto {
  openingBalanceId!: string;
  lines!: CreateVatSettlementItemLineDto[];
}
