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
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { OverrideSalesOrderDto } from './dto/override-sales-order.dto';
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';
import { UpdateDeliveryAddressDto } from './dto/update-delivery-address.dto';
import { UpdateCarrierInfoDto } from './dto/update-carrier-info.dto';
import { ExportSalesOrderQueryDto } from './dto/export-sales-order-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { ExcelService } from '../shared/excel/excel.service';

@Controller('sales-orders')
@UseGuards(AuthGuard, PermissionGuard)
export class SalesOrderController {
  constructor(
    private readonly salesOrderService: SalesOrderService,
    private readonly excelService: ExcelService,
  ) {}

  // Sales Order không có Create / Update / Delete API — chỉ sinh tự động từ
  // POST /quotations/:id/approve.

  @Get()
  @RequirePermission('sales-order.view')
  findAll(@Query() query: SalesOrderQueryDto) {
    return this.salesOrderService.findAll(query);
  }

  // Dropdown "Người phụ trách" ở FE (bộ lọc trang + xuất Excel) — mở cho mọi
  // role có sales-order.view, vì đây chỉ là bộ lọc thêm trên danh sách mà họ
  // đã xem được toàn bộ từ trước tới giờ. Quyền export-all chỉ chặn ở bước
  // XUẤT (resolveExportOwnerId), không chặn xem/lọc.
  @Get('export/owners')
  @RequirePermission('sales-order.view')
  listExportOwners() {
    return this.salesOrderService.listExportOwners();
  }

  // Đặt TRƯỚC @Get(':id') — nếu không NestJS sẽ khớp "export" như 1 giá trị
  // :id trước khi tới được route này (route match theo thứ tự khai báo).
  @Get('export')
  @RequirePermission('sales-order.export')
  async exportOrders(
    @Query() query: ExportSalesOrderQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { groupColumns, itemColumns, groups, from, to } =
      await this.salesOrderService.exportOrders(
        req.user.userId,
        req.user.roleId,
        query,
      );
    const filename = `don-hang_${from.toISOString().slice(0, 10)}_${to
      .toISOString()
      .slice(0, 10)}`;
    await this.excelService.exportGrouped(
      res,
      filename,
      groupColumns,
      itemColumns,
      groups,
    );
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
  ship(@Param('id') id: string, @Req() req: { user?: { userId?: string } }) {
    return this.salesOrderService.ship(id, req.user?.userId ?? null);
  }

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.deliver')
  deliver(@Param('id') id: string, @Req() req: { user?: { userId?: string } }) {
    return this.salesOrderService.deliver(id, req.user?.userId ?? null);
  }

  // ── Địa chỉ giao hàng (Task 009) — không phải Manual Override ──

  @Post(':id/update-delivery-address')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.view')
  updateDeliveryAddress(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryAddressDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.salesOrderService.updateDeliveryAddress(
      id,
      dto,
      req.user?.userId ?? null,
    );
  }

  // ── Thông tin nhà xe (009-in-phieu-san-xuat.md) — không phải Manual Override ──

  @Post(':id/update-carrier-info')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.view')
  updateCarrierInfo(
    @Param('id') id: string,
    @Body() dto: UpdateCarrierInfoDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.salesOrderService.updateCarrierInfo(
      id,
      dto,
      req.user?.userId ?? null,
    );
  }

  // ── Manual Override & Cancel (Task 05) ──

  @Post(':id/override')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.override')
  override(
    @Param('id') id: string,
    @Body() dto: OverrideSalesOrderDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.salesOrderService.override(id, dto, req.user?.userId ?? null);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales-order.cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelSalesOrderDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.salesOrderService.cancel(id, dto, req.user?.userId ?? null);
  }

  // Payment: xem POST /payments (Module Công nợ) — record-payment đã bị xoá,
  // xem knowledge/modules/debt.md mục "Workflow".
}
