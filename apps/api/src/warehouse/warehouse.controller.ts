import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseTransactionQueryDto } from './dto/warehouse-transaction-query.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('warehouse')
@UseGuards(AuthGuard, PermissionGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('transactions')
  @RequirePermission('warehouse.view')
  findAllTransactions(@Query() query: WarehouseTransactionQueryDto) {
    return this.warehouseService.findAllTransactions(query);
  }

  @Get('stock')
  @RequirePermission('warehouse.view')
  getCurrentStock(@Query() query: StockQueryDto) {
    return this.warehouseService.getCurrentStock(query);
  }
}
