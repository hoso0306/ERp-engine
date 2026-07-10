import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';

// Task 00 (010-fe-cai-dat-nguoi-dung.md) — Permission không có CRUD API (chỉ
// seed sẵn, xem permission.md), nhưng FE cần đọc toàn bộ danh mục để dựng màn
// gán quyền cho Role. Đây là Read API thuần, không thêm Business Rule/permission
// key mới — dùng lại role.view vì chỉ phục vụ màn sửa Role.
@Controller('permissions')
@UseGuards(AuthGuard, PermissionGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @RequirePermission('role.view')
  findAll() {
    return this.permissionService.findAllCatalog();
  }
}
