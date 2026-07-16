import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ReturnService } from './return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnQueryDto } from './dto/return-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('returns')
@UseGuards(AuthGuard, PermissionGuard)
export class ReturnController {
  constructor(private readonly returnService: ReturnService) {}

  @Get()
  @RequirePermission('return.view')
  findAll(@Query() query: ReturnQueryDto) {
    return this.returnService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('return.view')
  findOne(@Param('id') id: string) {
    return this.returnService.findOne(id);
  }

  @Post()
  @RequirePermission('return.create')
  create(@Body() dto: CreateReturnDto) {
    return this.returnService.create(dto);
  }

  // Action "Hoàn tất xử lý" — một chiều PROCESSING → COMPLETED. Dùng lại
  // permission return.update (đã chốt 05/07/2026 — không seed key mới).
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('return.update')
  complete(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.returnService.complete(id, req.user?.userId ?? null);
  }
}
