import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { CreateMaterialReceiptDto } from './dto/create-material-receipt.dto';
import { MaterialReceiptQueryDto } from './dto/material-receipt-query.dto';

@Controller('material-receipts')
export class MaterialReceiptController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  create(@Body() dto: CreateMaterialReceiptDto) {
    return this.warehouseService.createMaterialReceipt(dto);
  }

  @Get()
  findAll(@Query() query: MaterialReceiptQueryDto) {
    return this.warehouseService.findAllMaterialReceipts(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.warehouseService.findOneMaterialReceipt(id);
  }
}
