import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new NotFoundException('Role không tồn tại.');
    }
    return role;
  }

  // code bất biến sau khi tạo — không có DTO nào cho phép sửa lại (xem
  // permission.md mục "Role").
  async create(dto: CreateRoleDto, actorId: string | null) {
    const existing = await this.prisma.role.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Role code "${dto.code}" đã tồn tại.`);
    }

    const role = await this.prisma.role.create({ data: { code: dto.code, name: dto.name } });

    await this.permissionService.recordAudit({
      roleId: role.id,
      action: 'ROLE_CREATED',
      changedBy: actorId,
      payload: { code: role.code, name: role.name },
    });

    return role;
  }

  // Đổi tên + gán/gỡ Permission (permissionIds thay thế toàn bộ tập hiện tại).
  async update(id: string, dto: UpdateRoleDto, actorId: string | null) {
    const role = await this.findOne(id);

    if (dto.name !== undefined) {
      await this.prisma.role.update({ where: { id }, data: { name: dto.name } });
    }

    if (dto.permissionIds !== undefined) {
      const currentIds = new Set(role.rolePermissions.map((rp) => rp.permissionId));
      const nextIds = new Set(dto.permissionIds);

      const toGrant = [...nextIds].filter((permissionId) => !currentIds.has(permissionId));
      const toRevoke = [...currentIds].filter((permissionId) => !nextIds.has(permissionId));

      if (toGrant.length > 0) {
        const permissions = await this.prisma.permission.findMany({
          where: { id: { in: toGrant } },
        });
        if (permissions.length !== toGrant.length) {
          throw new BadRequestException('Một hoặc nhiều permissionId không tồn tại.');
        }
        for (const permission of permissions) {
          await this.prisma.rolePermission.create({
            data: { roleId: id, permissionId: permission.id },
          });
          await this.permissionService.recordAudit({
            roleId: id,
            permissionId: permission.id,
            action: 'GRANT',
            changedBy: actorId,
            payload: { permissionKey: permission.key },
          });
        }
      }

      if (toRevoke.length > 0) {
        const permissions = await this.prisma.permission.findMany({
          where: { id: { in: toRevoke } },
        });
        await this.prisma.rolePermission.deleteMany({
          where: { roleId: id, permissionId: { in: toRevoke } },
        });
        for (const permission of permissions) {
          await this.permissionService.recordAudit({
            roleId: id,
            permissionId: permission.id,
            action: 'REVOKE',
            changedBy: actorId,
            payload: { permissionKey: permission.key },
          });
        }
      }
    }

    return this.findOne(id);
  }

  // Không được Disable nếu còn User đang dùng Role đó (xem permission.md mục "Role").
  async disable(id: string, actorId: string | null) {
    const role = await this.findOne(id);

    const activeUserCount = await this.prisma.user.count({
      where: { roleId: id, isActive: true },
    });
    if (activeUserCount > 0) {
      throw new BadRequestException(
        'Không thể vô hiệu hoá Role còn User đang sử dụng — hãy chuyển User sang Role khác trước.',
      );
    }

    const updated = await this.prisma.role.update({ where: { id }, data: { isActive: false } });

    await this.permissionService.recordAudit({
      roleId: id,
      action: 'ROLE_DISABLED',
      changedBy: actorId,
      payload: { code: role.code },
    });

    return updated;
  }
}
