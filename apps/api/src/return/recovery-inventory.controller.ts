import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReturnService } from './return.service';
import { RecoveryInventoryQueryDto } from './dto/recovery-inventory-query.dto';
import { MarkUsedDto } from './dto/mark-used.dto';
import { UpdateRecoveryInventoryDto } from './dto/update-recovery-inventory.dto';

@Controller('recovery-inventory')
export class RecoveryInventoryController {
  constructor(private readonly returnService: ReturnService) {}

  // Không có Create/Delete — Recovery Inventory chỉ sinh tự động từ
  // POST /returns, và chỉ chuyển DISPOSED thay vì xoá (xem return.md).

  @Get()
  findAll(@Query() query: RecoveryInventoryQueryDto) {
    return this.returnService.findAllRecoveryInventory(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.returnService.findOneRecoveryInventory(id);
  }

  // ── Workflow (Task 05) — chỉ thực hiện được khi AVAILABLE ──

  @Post(':id/mark-used')
  @HttpCode(HttpStatus.OK)
  markUsed(@Param('id') id: string, @Body() dto: MarkUsedDto) {
    return this.returnService.markUsed(id, dto);
  }

  @Post(':id/dispose')
  @HttpCode(HttpStatus.OK)
  dispose(@Param('id') id: string) {
    return this.returnService.dispose(id);
  }

  // ── Management (Task 06) — location/status/imageUrl ──

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecoveryInventoryDto) {
    return this.returnService.updateRecoveryInventory(id, dto);
  }
}
