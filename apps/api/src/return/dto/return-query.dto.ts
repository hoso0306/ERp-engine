export class ReturnQueryDto {
  search?: string;
  salesOrderId?: string;
  customerId?: string;
  // Lọc theo trạng thái xử lý: PROCESSING | COMPLETED (return.md "Trạng thái Return").
  status?: string;
  page?: string;
  limit?: string;
}
