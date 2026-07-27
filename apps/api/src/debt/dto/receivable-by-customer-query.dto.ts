export class ReceivableByCustomerQueryDto {
  search?: string;
  // 'remaining_desc' (mặc định) | 'name_asc'
  sortBy?: string;
  // Khách có ít nhất 1 đơn quá hạn (daysOverdue > 0, tính từ dueDate sớm
  // nhất còn mở của khách) — tương đương tab "Quá hạn" bên view theo đơn.
  overdue?: string;
  creditExceeded?: string;
  page?: string;
  limit?: string;
}
