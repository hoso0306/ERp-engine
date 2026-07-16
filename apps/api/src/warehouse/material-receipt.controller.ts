import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { CreateMaterialReceiptDto } from './dto/create-material-receipt.dto';
import { MaterialReceiptQueryDto } from './dto/material-receipt-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('material-receipts')
@UseGuards(AuthGuard, PermissionGuard)
export class MaterialReceiptController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @RequirePermission('warehouse.receipt')
  create(
    @Body() dto: CreateMaterialReceiptDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.warehouseService.createMaterialReceipt(
      dto,
      req.user?.userId ?? null,
    );
  }

  @Get()
  @RequirePermission('warehouse.view')
  findAll(@Query() query: MaterialReceiptQueryDto) {
    return this.warehouseService.findAllMaterialReceipts(query);
  }

  @Get(':id')
  @RequirePermission('warehouse.view')
  findOne(@Param('id') id: string) {
    return this.warehouseService.findOneMaterialReceipt(id);
  }
}
