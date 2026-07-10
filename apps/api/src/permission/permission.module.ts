import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './permission.guard';
import { PermissionController } from './permission.controller';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';

@Module({
  // forwardRef vì AuthModule cũng import ngược lại PermissionModule để mở
  // rộng GET /auth/me với danh sách permissions (013-permission.md Task 05) —
  // phụ thuộc 2 chiều có chủ đích (xem permission.md mục "Phụ thuộc Module Authentication").
  imports: [forwardRef(() => AuthModule)],
  controllers: [UserController, RoleController, PermissionController],
  providers: [PermissionService, PermissionGuard, UserService, RoleService],
  // Re-export AuthModule — mọi module cần PermissionGuard cũng cần AuthGuard
  // chạy trước nó trong pipeline (xem permission.md mục "Kiến trúc"), tránh
  // phải import cả hai module riêng lẻ ở từng nơi.
  exports: [PermissionService, PermissionGuard, AuthModule],
})
export class PermissionModule {}
