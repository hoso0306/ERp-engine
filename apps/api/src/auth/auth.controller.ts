import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.guard';
import { PermissionService } from '../permission/permission.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip ?? null);
  }

  // Không gắn PermissionGuard — chỉ AuthGuard (biết đang là ai) là đủ, xem
  // đổi mật khẩu/đăng xuất/xem thông tin chính mình là quyền mặc định đi kèm
  // session hợp lệ (permission.md mục "Kiến trúc"). Mở rộng thêm `permissions`
  // để FE ẩn/hiện Menu theo Role hiện tại (013-permission.md Task 05).
  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: AuthenticatedRequest) {
    const user = await this.authService.getMe(req.user.userId);
    const permissions = await this.permissionService.getPermissionKeysForRole(
      user.roleId,
    );
    return { ...user, permissions };
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return this.authService.logout();
  }
}
