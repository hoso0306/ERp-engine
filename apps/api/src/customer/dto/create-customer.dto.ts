export class CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  province?: string;
  district?: string;
  ward?: string;
  address?: string;
  customerGroupId?: string;
  deliveryRouteId?: string;
  saleId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'ACTIVE' | 'INACTIVE';
  defaultDiscount?: number;
  debtLimit?: number;
  debtTermDays?: number;
  note?: string;
}
