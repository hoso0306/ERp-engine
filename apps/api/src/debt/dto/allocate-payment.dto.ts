export class AllocationOverrideDto {
  receivableId!: string;
  amount!: number;
}

export class AllocatePaymentDto {
  customerId!: string;
  amount!: number;
  paymentMethod!: string;
  paymentDate?: string;
  referenceNumber?: string;
  note?: string;
  createdBy?: string;
  // Cấn tay — nếu không truyền, ERP tự tính FIFO (đơn cũ nhất trước).
  allocations?: AllocationOverrideDto[];
}
