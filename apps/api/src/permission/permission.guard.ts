import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from './permission.service';
import { PERMISSION_KEY } from './require-permission.decorator';
import type { AuthenticatedRequest } from '../auth/auth.guard';

// Chạy ngay sau AuthGuard (đã xác định req.user.roleId) — kiểm tra
// Role → RolePermission → Permission.key (xem permission.md mục "Kiến trúc").
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredKey = this.reflector.get<string | undefined>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    // Không gắn @RequirePermission — không phải endpoint thuộc hệ thống
    // Role/Permission (vd endpoint Authentication tự quản, xem 013-permission.md Task 02).
    if (!requiredKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const roleId = request.user?.roleId;
    if (!roleId) {
      throw new ForbiddenException('Không xác định được quyền của người dùng.');
    }

    const allowed = await this.permissionService.hasPermission(
      roleId,
      requiredKey,
    );
    if (!allowed) {
      throw new ForbiddenException(`Không có quyền "${requiredKey}".`);
    }
    return true;
  }
}
