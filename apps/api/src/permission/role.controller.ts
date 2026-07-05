import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './require-permission.decorator';

// CRUD Role — không có Delete, chỉ Disable (xem permission.md mục "Role").
@Controller('roles')
@UseGuards(AuthGuard, PermissionGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermission('role.view')
  findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @RequirePermission('role.view')
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Post()
  @RequirePermission('role.create')
  create(@Body() dto: CreateRoleDto, @Req() req: AuthenticatedRequest) {
    return this.roleService.create(dto, req.user.userId);
  }

  @Patch(':id')
  @RequirePermission('role.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.roleService.update(id, dto, req.user.userId);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('role.disable')
  disable(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.roleService.disable(id, req.user.userId);
  }
}
