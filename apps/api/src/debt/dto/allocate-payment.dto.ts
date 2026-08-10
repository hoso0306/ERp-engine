export class AllocationOverrideDto {
  // Đúng 1 trong 2 (rà soát tab Công nợ, 11/08/2026: Công nợ đầu kỳ cấn trừ
  // chung Allocation Engine với Receivable).
  receivableId?: string;
  openingBalanceId?: string;
  amount!: number;
}

export class AllocatePaymentDto {
  customerId!: string;
  amount!: number;
  paymentMethod!: string;
  paymentDate?: string;
  referenceNumber?: string;
  note?: string;
  // Cấn tay — nếu không truyền, ERP tự tính FIFO (đơn cũ nhất trước).
  allocations?: AllocationOverrideDto[];
}
