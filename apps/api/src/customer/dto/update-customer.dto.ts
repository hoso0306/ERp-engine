export class UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string | null;
  companyName?: string | null;
  taxCode?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  address?: string | null;
  customerGroupId?: string | null;
  deliveryRouteId?: string | null;
  saleId?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'ACTIVE' | 'INACTIVE';
  debtLimit?: number;
  debtTermDays?: number;
  note?: string | null;
  // Thông tin nhà xe mặc định (chốt 24/07/2026) — chỉ để tham khảo.
  defaultCarrierName?: string | null;
  defaultCarrierPhone?: string | null;
  defaultCarrierNote?: string | null;
}
