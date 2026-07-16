import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('production-orders')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductionOrderController {
  constructor(
    private readonly productionOrderService: ProductionOrderService,
  ) {}

  // Production Order không có Create / Update / Delete API — chỉ sinh tự động
  // từ POST /quotations/:id/approve.

  @Get()
  @RequirePermission('production.view')
  findAll(@Query() query: ProductionOrderQueryDto) {
    return this.productionOrderService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('production.view')
  findOne(@Param('id') id: string) {
    return this.productionOrderService.findOne(id);
  }

  // ── Workflow actions (Task 04) ──

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('production.start')
  start(@Param('id') id: string) {
    return this.productionOrderService.start(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('production.complete')
  complete(@Param('id') id: string) {
    return this.productionOrderService.complete(id);
  }
}
