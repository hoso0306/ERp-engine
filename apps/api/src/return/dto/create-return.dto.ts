export class CreateReturnItemDto {
  salesOrderItemId!: string;
  returnedQuantity!: number;
  reason!: string;
  note?: string;
}

export class CreateReturnDto {
  salesOrderId!: string;
  returnDate?: string;
  receivedBy?: string;
  note?: string;
  items!: CreateReturnItemDto[];
}
