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
  UseGuards,
} from '@nestjs/common';
import { ReturnService } from './return.service';
import { RecoveryInventoryQueryDto } from './dto/recovery-inventory-query.dto';
import { MarkUsedDto } from './dto/mark-used.dto';
import { UpdateRecoveryInventoryDto } from './dto/update-recovery-inventory.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('recovery-inventory')
@UseGuards(AuthGuard, PermissionGuard)
export class RecoveryInventoryController {
  constructor(private readonly returnService: ReturnService) {}

  // Không có Create/Delete — Recovery Inventory chỉ sinh tự động từ
  // POST /returns, và chỉ chuyển DISPOSED thay vì xoá (xem return.md).

  @Get()
  @RequirePermission('return.view')
  findAll(@Query() query: RecoveryInventoryQueryDto) {
    return this.returnService.findAllRecoveryInventory(query);
  }

  @Get(':id')
  @RequirePermission('return.view')
  findOne(@Param('id') id: string) {
    return this.returnService.findOneRecoveryInventory(id);
  }

  // ── Workflow (Task 05) — chỉ thực hiện được khi AVAILABLE ──

  @Post(':id/mark-used')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('return.mark-used')
  markUsed(@Param('id') id: string, @Body() dto: MarkUsedDto) {
    return this.returnService.markUsed(id, dto);
  }

  @Post(':id/dispose')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('return.dispose')
  dispose(@Param('id') id: string) {
    return this.returnService.dispose(id);
  }

  // ── Management (Task 06) — sửa location/imageUrl/status thủ công, khác với
  // Business Action mark-used/dispose (Task 05) nên dùng permission riêng.
  @Put(':id')
  @RequirePermission('return.update')
  update(@Param('id') id: string, @Body() dto: UpdateRecoveryInventoryDto) {
    return this.returnService.updateRecoveryInventory(id, dto);
  }
}
