export class ProductionOrderQueryDto {
  search?: string;
  status?: string;
  productionCenterId?: string;
  // "Người phụ trách" (chốt 20/08/2026) — cùng SalesOrder.ownerId, lọc qua
  // relation salesOrder (ProductionOrder không lưu riêng field này).
  ownerId?: string;
  // "Hạn hoàn thành" (chốt 20/08/2026) — dùng đúng SalesOrder.expectedDeliveryDate
  // có sẵn (không phải field riêng cho Phiếu SX), cùng tên tham số với
  // SalesOrderQueryDto.deliveryFrom/deliveryTo cho nhất quán.
  deliveryFrom?: string;
  deliveryTo?: string;
  page?: string;
  limit?: string;
}
