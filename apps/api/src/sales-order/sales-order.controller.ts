import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { OverrideSalesOrderDto } from './dto/override-sales-order.dto';
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('sales-orders')
@UseGuards(AuthGuard, PermissionGuard)
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  // Sales Order không có Create / Update / Delete API — chỉ sinh tự động từ
  // POST /quotations/:id/approve.

  @Get()
  @RequirePermission('sales-order.view')
  findAll(@Query() query: SalesOrderQueryDto) {
    return this.salesOrderService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('sales-order.view')
  findOne(@Param('id') id: string) {
    return this.salesOrderService.findOne(id);
  }

  // ── Workflow actions ──

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.ship')
  ship(@Param('id') id: string) {
    return this.salesOrderService.ship(id);
  }

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.deliver')
  deliver(@Param('id') id: string) {
    return this.salesOrderService.deliver(id);
  }

  // ── Manual Override & Cancel (Task 05) ──

  @Post(':id/override')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.override')
  override(@Param('id') id: string, @Body() dto: OverrideSalesOrderDto) {
    return this.salesOrderService.override(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelSalesOrderDto) {
    return this.salesOrderService.cancel(id, dto);
  }

  // Payment: xem POST /payments (Module Công nợ) — record-payment đã bị xoá,
  // xem knowledge/modules/debt.md mục "Workflow".
}
