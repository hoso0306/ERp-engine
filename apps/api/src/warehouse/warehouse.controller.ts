import { Controller, Get, Query } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { WarehouseTransactionQueryDto } from './dto/warehouse-transaction-query.dto';
import { StockQueryDto } from './dto/stock-query.dto';

@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('transactions')
  findAllTransactions(@Query() query: WarehouseTransactionQueryDto) {
    return this.warehouseService.findAllTransactions(query);
  }

  @Get('stock')
  getCurrentStock(@Query() query: StockQueryDto) {
    return this.warehouseService.getCurrentStock(query);
  }
}
