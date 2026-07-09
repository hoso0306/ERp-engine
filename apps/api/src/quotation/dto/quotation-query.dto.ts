export class QuotationQueryDto {
  search?: string;
  // Một trạng thái hoặc danh sách phân tách bằng dấu phẩy (vd "DRAFT,SENT"
  // cho tab "Chờ xử lý" — thiết kế chốt 08/07/2026).
  status?: string;
  customerId?: string;
  // Lọc theo khoảng ngày tạo (yyyy-mm-dd) — testlan1 mục Báo giá.
  createdFrom?: string;
  createdTo?: string;
  page?: string;
  limit?: string;
}
