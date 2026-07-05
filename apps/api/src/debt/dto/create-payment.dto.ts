export class CreatePaymentDto {
  salesOrderId!: string;
  amount!: number;
  paymentMethod!: string;
  paymentDate?: string;
  referenceNumber?: string;
  note?: string;
  createdBy?: string;
}
