export class SalesOrderQueryDto {
  search?: string;
  status?: string;
  paymentStatus?: string;
  customerId?: string;
  page?: string;
  limit?: string;
  // Lọc theo người phụ trách (SalesOrder.ownerId) — mở cho mọi role có
  // sales-order.view (không giới hạn như export), vì list đã hiển thị đầy đủ
  // đơn cho mọi role có view từ trước tới giờ, đây chỉ là bộ lọc thêm.
  ownerId?: string;
}
