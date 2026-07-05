export class UpdateRoleDto {
  name?: string;
  // Danh sách đầy đủ permissionId mà Role này được gán — nếu truyền, thay thế
  // toàn bộ tập Permission hiện tại (diff để ghi PermissionAudit GRANT/REVOKE
  // cho từng permission thay đổi). code không nằm trong DTO này — bất biến
  // sau khi tạo (xem permission.md).
  permissionIds?: string[];
}
