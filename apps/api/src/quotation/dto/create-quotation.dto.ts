export class CreateQuotationDto {
  customerId: string;
  expiryDate?: string;
  expectedDeliveryDate?: string;
  note?: string;
  shippingFee?: number;
}
