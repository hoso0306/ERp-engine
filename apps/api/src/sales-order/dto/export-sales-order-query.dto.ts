// Query cho GET /sales-orders/export. ownerId bỏ trống = tự xuất đơn của
// chính người gọi API; 'all' hoặc userId khác = xem theo người khác/tất cả,
// yêu cầu permission sales-order.export-all (check trong service, không
// check được ở decorator vì @RequirePermission chỉ nhận 1 key tĩnh).
// from/to bỏ trống = mặc định 12 tháng gần nhất (khác ReportQueryDto —
// report bắt buộc from/to, còn export này cho phép bỏ trống).
export class ExportSalesOrderQueryDto {
  ownerId?: string;
  from?: string;
  to?: string;
  status?: string;
  // Xuất Excel theo ĐÚNG bộ lọc đang xem trên trang Đơn hàng — cùng field
  // với SalesOrderQueryDto/trang FE (search theo mã đơn/mã BG/tên-SĐT khách,
  // deliveryFrom/deliveryTo lọc theo expectedDeliveryDate).
  search?: string;
  deliveryFrom?: string;
  deliveryTo?: string;
}
