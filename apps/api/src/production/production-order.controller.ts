import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';

@Controller('production-orders')
export class ProductionOrderController {
  constructor(private readonly productionOrderService: ProductionOrderService) {}

  // Production Order không có Create / Update / Delete API — chỉ sinh tự động
  // từ POST /quotations/:id/approve.

  @Get()
  findAll(@Query() query: ProductionOrderQueryDto) {
    return this.productionOrderService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productionOrderService.findOne(id);
  }

  // ── Workflow actions (Task 04) ──

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(@Param('id') id: string) {
    return this.productionOrderService.start(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id') id: string) {
    return this.productionOrderService.complete(id);
  }
}
