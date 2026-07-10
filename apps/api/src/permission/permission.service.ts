import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionAuditAction, Prisma } from '@prisma/client';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  // Task 00 (010-fe-cai-dat-nguoi-dung.md) — danh mục đầy đủ để dựng UI gán
  // quyền cho Role (khác getPermissionKeysForRole, chỉ trả quyền ĐÃ gán).
  async findAllCatalog() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  // Dùng bởi PermissionGuard (Task 01) và Dashboard KPI filtering (Task 06).
  async getPermissionKeysForRole(roleId: string): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rolePermissions.map((rp) => rp.permission.key);
  }

  async hasPermission(roleId: string, key: string): Promise<boolean> {
    const match = await this.prisma.rolePermission.findFirst({
      where: { roleId, permission: { key } },
      select: { id: true },
    });
    return match !== null;
  }

  // Append-only (xem permission.md mục "Audit") — không có Update/Delete.
  async recordAudit(params: {
    roleId: string;
    permissionId?: string | null;
    userId?: string | null;
    action: PermissionAuditAction;
    changedBy: string | null;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.permissionAudit.create({
      data: {
        roleId: params.roleId,
        permissionId: params.permissionId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        changedBy: params.changedBy,
        payload: params.payload,
      },
    });
  }
}
