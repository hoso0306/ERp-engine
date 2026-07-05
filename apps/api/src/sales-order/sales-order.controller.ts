import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { OverrideSalesOrderDto } from './dto/override-sales-order.dto';
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';

@Controller('sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  // Sales Order không có Create / Update / Delete API — chỉ sinh tự động từ
  // POST /quotations/:id/approve.

  @Get()
  findAll(@Query() query: SalesOrderQueryDto) {
    return this.salesOrderService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesOrderService.findOne(id);
  }

  // ── Workflow actions ──

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  ship(@Param('id') id: string) {
    return this.salesOrderService.ship(id);
  }

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  deliver(@Param('id') id: string) {
    return this.salesOrderService.deliver(id);
  }

  // ── Manual Override & Cancel (Task 05) ──

  @Post(':id/override')
  @HttpCode(HttpStatus.OK)
  override(@Param('id') id: string, @Body() dto: OverrideSalesOrderDto) {
    return this.salesOrderService.override(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelSalesOrderDto) {
    return this.salesOrderService.cancel(id, dto);
  }

  // Payment: xem POST /payments (Module Công nợ) — record-payment đã bị xoá,
  // xem knowledge/modules/debt.md mục "Workflow".
}
