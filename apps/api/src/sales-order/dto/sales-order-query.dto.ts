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
  // Lọc theo ngày — chuyển từ FE-only (004-fe-don-hang.md, chỉ lọc trên
  // trang dữ liệu hiện tại) sang server (15/08/2026): lọc client khiến
  // meta.total/phân trang không khớp dữ liệu thật hiển thị, lộ rõ khi kết
  // hợp với ownerId (tổng theo mọi ngày, bảng lại lọc thêm theo ngày ở FE).
  createdFrom?: string;
  createdTo?: string;
  deliveryFrom?: string;
  deliveryTo?: string;
}
