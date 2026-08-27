export class ReceivableQueryDto {
  search?: string;
  paymentStatus?: string;
  overdue?: string;
  risk?: string;
  creditExceeded?: string;
  // 'remaining_desc' | 'due_asc' — mặc định (không truyền hoặc giá trị khác)
  // giữ nguyên sắp xếp cũ createdAt desc.
  sortBy?: string;
  page?: string;
  limit?: string;
  // Tab "Công nợ" trong trang chi tiết khách hàng — lọc đúng 1 khách hàng,
  // liệt kê CẢ đơn đã thu đủ (khác findReceivablesByCustomer chỉ lấy đơn còn nợ).
  customerId?: string;
  // Lọc theo người phụ trách đơn hàng (SalesOrder.ownerId) — tab "Theo đơn
  // hàng" (rà soát 27/08/2026), cùng field/pattern với bộ lọc "Người phụ
  // trách" ở trang Đơn hàng (sales-order-query.dto.ts).
  ownerId?: string;
  // Định dạng file export (GET /receivables/export) — 'pdf' | 'xlsx' (mặc
  // định nếu không truyền), cùng convention report.md "Excel & PDF Export".
  format?: string;
  // 'createdAt' (mặc định) | 'dueDate' — mốc ngày dùng để lọc from/to.
  dateField?: string;
  from?: string;
  to?: string;
}
