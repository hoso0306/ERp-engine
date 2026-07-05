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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip ?? null);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout() {
    return this.authService.logout();
  }
}
