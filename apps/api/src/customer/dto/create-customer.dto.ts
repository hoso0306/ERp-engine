export class CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  // Khách doanh nghiệp (chốt 08/07/2026) — tuỳ chọn, khách lẻ để trống.
  companyName?: string;
  taxCode?: string;
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
