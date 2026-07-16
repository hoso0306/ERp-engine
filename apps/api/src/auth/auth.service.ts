import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from '../setting/setting.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly settingService: SettingService,
  ) {}

  // ─────────────────────────────────────────────────────
  // Login Flow (Task 01)
  // ─────────────────────────────────────────────────────

  async login(dto: LoginDto, ip: string | null) {
    // Không phân biệt "email không tồn tại" / "sai mật khẩu" — cùng một lỗi
    // chung (tránh lộ email nào đã đăng ký).
    const invalidCredentials = () =>
      new UnauthorizedException('Email hoặc mật khẩu không đúng.');

    if (!dto.email || !dto.password) {
      throw invalidCredentials();
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw invalidCredentials();
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw invalidCredentials();
    }

    const accessToken = await this.issueToken(user.id, user.roleId);

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    return {
      accessToken,
      user: this.toSafeUser(updated),
      mustChangePassword: updated.mustChangePassword,
    };
  }

  // ─────────────────────────────────────────────────────
  // Token (Task 02) — thời hạn đọc từ Settings.Security.sessionTimeout (phút),
  // không hard-code. roleId nằm trong payload để PermissionGuard đọc thẳng từ
  // req.user, không phải query lại DB mỗi request (013-permission.md).
  // Public vì AuthGuard cũng gọi lại để cấp token mới mỗi request hợp lệ
  // (sliding session, 16/07/2026 — xem auth.guard.ts).
  // ─────────────────────────────────────────────────────

  async issueToken(userId: string, roleId?: string) {
    const sessionTimeoutMinutes = await this.settingService.getNumberValue(
      'Security',
      'sessionTimeout',
    );

    return this.jwtService.signAsync(
      { sub: userId, ...(roleId ? { roleId } : {}) },
      { expiresIn: `${sessionTimeoutMinutes}m` },
    );
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại.');
    }
    return this.toSafeUser(user);
  }

  // ─────────────────────────────────────────────────────
  // Đổi mật khẩu (Task 03) — chỉ tự đổi cho chính mình (userId từ Guard).
  // ─────────────────────────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (!dto.newPassword || dto.newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại.');
    }

    const oldPasswordMatches = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!oldPasswordMatches) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  // Logout (Task 04) — V1 stateless, không blacklist token.
  // ─────────────────────────────────────────────────────

  logout() {
    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  // Đặt mật khẩu tạm (Task 05) — method nội bộ, KHÔNG có HTTP endpoint.
  // 013-permission.md gọi trực tiếp khi tạo/reset User.
  // ─────────────────────────────────────────────────────

  async setTemporaryPassword(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại.');
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

    const forceChangePasswordOnFirstLogin = await this.settingService.getBooleanValue(
      'Security',
      'forceChangePasswordOnFirstLogin',
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: forceChangePasswordOnFirstLogin,
      },
    });

    // Trả về plaintext đúng một lần duy nhất — không lưu plaintext ở đâu khác.
    return temporaryPassword;
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
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roleId: user.roleId,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
