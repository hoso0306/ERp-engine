import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

export interface AuthenticatedUser {
  userId: string;
  roleId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

// Xác thực JWT thủ công (không dùng Passport) — parse Authorization: Bearer,
// verify hợp lệ + chưa hết hạn, gắn req.user. Pipeline: AuthGuard → PermissionGuard
// (013-permission.md) → Business (xem authentication.md).
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Thiếu token xác thực.');
    }

    let payload: { sub: string; roleId?: string };
    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        roleId?: string;
      }>(token);
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }

    request.user = { userId: payload.sub, roleId: payload.roleId };
    await this.refreshToken(context, payload);

    return true;
  }

  // Sliding session (16/07/2026): mỗi request hợp lệ được cấp lại token mới
  // qua header X-Refreshed-Token — token chỉ hết hạn khi KHÔNG còn hoạt động
  // (gọi API) trong đủ sessionTimeout phút liên tục, không phải hạn cứng tính
  // từ lúc đăng nhập. Best-effort: lỗi cấp lại không được chặn request gốc.
  private async refreshToken(
    context: ExecutionContext,
    payload: { sub: string; roleId?: string },
  ): Promise<void> {
    try {
      const refreshed = await this.authService.issueToken(
        payload.sub,
        payload.roleId,
      );
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('X-Refreshed-Token', refreshed);
    } catch {
      /* best-effort — không chặn request nếu cấp lại token thất bại */
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
