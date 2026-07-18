export class RecoveryInventoryQueryDto {
  search?: string;
  status?: string;
  // 'created_asc' | 'created_desc' — mặc định (không truyền hoặc giá trị
  // khác) giữ nguyên sắp xếp cũ createdAt desc.
  sortBy?: string;
  page?: string;
  limit?: string;
}
