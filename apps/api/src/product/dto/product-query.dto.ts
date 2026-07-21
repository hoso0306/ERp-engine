export class ProductQueryDto {
  search?: string;
  status?: string;
  productTypeId?: string;
  productionCenterId?: string;
  // 'name_asc' (mặc định, A-Z) | 'created_desc' (sản phẩm mới tạo trước).
  sortBy?: string;
  page?: string;
  limit?: string;
}
