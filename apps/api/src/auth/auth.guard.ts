import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

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
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Thiếu token xác thực.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; roleId?: string }>(
        token,
      );
      request.user = { userId: payload.sub, roleId: payload.roleId };
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
