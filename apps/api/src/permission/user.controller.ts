import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';

// CRUD User thuộc Permission module, không thuộc Authentication (xem
// permission.md mục "Quản lý User"). Không có Delete — chỉ isActive = false.
@Controller('users')
@UseGuards(AuthGuard, PermissionGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RequirePermission('user.view')
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @RequirePermission('user.view')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @RequirePermission('user.create')
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.userService.create(dto, req.user.userId);
  }

  @Patch(':id')
  @RequirePermission('user.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.userService.update(id, dto, req.user.userId);
  }
}
