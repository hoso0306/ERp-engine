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
}
