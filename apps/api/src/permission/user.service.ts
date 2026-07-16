import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from './permission.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const PLACEHOLDER_HASH_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly permissionService: PermissionService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => this.toSafeUser(u));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }
    return this.toSafeUser(user);
  }

  // Không có đăng ký công khai — chỉ Admin/Owner (đã có quyền user.create) tạo
  // User mới (xem permission.md mục "Quản lý User").
  async create(dto: CreateUserDto, actorId: string | null) {
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role || !role.isActive) {
      throw new BadRequestException(
        'Role không tồn tại hoặc đã bị vô hiệu hoá.',
      );
    }

    // Placeholder — được ghi đè ngay bởi setTemporaryPassword() bên dưới.
    // passwordHash NOT NULL nên phải có giá trị hợp lệ ngay khi tạo row.
    const placeholderHash = await bcrypt.hash(
      crypto.randomBytes(16).toString('hex'),
      PLACEHOLDER_HASH_ROUNDS,
    );

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        roleId: dto.roleId,
        passwordHash: placeholderHash,
      },
    });

    // Không tự viết logic hash mật khẩu ở Permission — gọi qua AuthService
    // (Module Ownership, xem permission.md mục "Phụ thuộc Module Authentication").
    const temporaryPassword = await this.authService.setTemporaryPassword(
      user.id,
    );

    await this.permissionService.recordAudit({
      roleId: dto.roleId,
      userId: user.id,
      action: 'USER_CREATED',
      changedBy: actorId,
      payload: { email: dto.email, roleId: dto.roleId },
    });

    const created = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { role: true },
    });

    return { ...this.toSafeUser(created), temporaryPassword };
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }

    if (dto.isActive === false) {
      // Không cho User tự vô hiệu hoá chính mình — áp dụng mọi Role, độc lập
      // với rule "Owner cuối cùng" bên dưới (xem permission.md mục "Quản lý User").
      if (id === actorId) {
        throw new BadRequestException('Không thể tự vô hiệu hoá chính mình.');
      }

      if (user.isActive && user.role.code === 'OWNER') {
        const activeOwnerCount = await this.prisma.user.count({
          where: { isActive: true, role: { code: 'OWNER' } },
        });
        if (activeOwnerCount <= 1) {
          throw new BadRequestException(
            'Không thể vô hiệu hoá tài khoản Owner cuối cùng đang hoạt động.',
          );
        }
      }
    }

    let newRole: { id: string; code: string; isActive: boolean } | null = null;
    if (dto.roleId !== undefined && dto.roleId !== user.roleId) {
      newRole = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!newRole || !newRole.isActive) {
        throw new BadRequestException(
          'Role không tồn tại hoặc đã bị vô hiệu hoá.',
        );
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (newRole) data.role = { connect: { id: newRole.id } };

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: { role: true },
    });

    if (newRole) {
      await this.permissionService.recordAudit({
        roleId: newRole.id,
        userId: updated.id,
        action: 'USER_ROLE_CHANGED',
        changedBy: actorId,
        payload: { fromRole: user.role.code, toRole: newRole.code },
      });
    }

    if (dto.isActive === false && user.isActive) {
      await this.permissionService.recordAudit({
        roleId: updated.roleId,
        userId: updated.id,
        action: 'USER_DISABLED',
        changedBy: actorId,
        payload: {},
      });
    }

    // Task 01 (010-fe-cai-dat-nguoi-dung.md) — cấp lại mật khẩu tạm, đúng
    // thiết kế đã ghi ở authentication.md. Không tự viết logic hash ở đây —
    // gọi qua AuthService (Module Ownership), giống create().
    if (dto.resetPassword === true) {
      const temporaryPassword = await this.authService.setTemporaryPassword(id);
      const refreshed = await this.prisma.user.findUniqueOrThrow({
        where: { id },
        include: { role: true },
      });
      return { ...this.toSafeUser(refreshed), temporaryPassword };
    }

    return this.toSafeUser(updated);
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
    roleId: string;
    mustChangePassword: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    role: { id: string; code: string; name: string };
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      role: { id: user.role.id, code: user.role.code, name: user.role.name },
    };
  }
}
