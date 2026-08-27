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
  // Phân bổ khách/công ty chịu (rà soát nghiệp vụ Return, 27/08/2026).
  // Không truyền = mặc định khách chịu 100% (companyBorneAmount = 0).
  customerBorneAmount?: number;
  // Bắt buộc khi companyBorneAmount (= totalValue - customerBorneAmount) > 0.
  companyBorneReason?: string;
}
