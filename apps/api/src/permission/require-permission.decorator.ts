import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';

// vd @RequirePermission('sales-order.ship') — đọc bởi PermissionGuard, chạy
// ngay sau AuthGuard trong pipeline (xem permission.md mục "Kiến trúc").
export const RequirePermission = (key: string) => SetMetadata(PERMISSION_KEY, key);
