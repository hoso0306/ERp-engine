import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { CancelQuotationDto } from './dto/cancel-quotation.dto';
import { OverrideQuotationDto } from './dto/override-quotation.dto';
import { DiscountQuotationDto } from './dto/discount-quotation.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('quotations')
@UseGuards(AuthGuard, PermissionGuard)
export class QuotationController {
  constructor(private readonly workflow: QuotationWorkflowService) {}

  @Get()
  @RequirePermission('quotation.view')
  findAll(@Query() query: QuotationQueryDto) {
    return this.workflow.findAll(query);
  }

  @Get(':id')
  @RequirePermission('quotation.view')
  findOne(@Param('id') id: string) {
    return this.workflow.findOne(id);
  }

  @Post()
  @RequirePermission('quotation.create')
  create(
    @Body() dto: CreateQuotationDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    // createdBy từ JWT — người tạo báo giá là người phụ trách khách, sẽ được
    // snapshot làm SalesOrder.ownerId khi Approve (quyết định 05/07/2026).
    return this.workflow.create(dto, req.user?.userId ?? null);
  }

  @Patch(':id')
  @RequirePermission('quotation.update')
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    return this.workflow.update(id, dto);
  }

  // ── Workflow actions ──

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation.update')
  send(@Param('id') id: string, @Req() req: { user?: { userId?: string } }) {
    return this.workflow.send(id, req.user?.userId ?? null);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation.approve')
  approve(@Param('id') id: string, @Req() req: { user?: { userId?: string } }) {
    // userId để fallback ownerId khi Quotation.createdBy NULL (báo giá tạo
    // trước khi có Auth).
    return this.workflow.approve(id, req.user?.userId ?? null);
  }

  // Action "Tính lại giá" khi Pricing Rule đổi version giữa chừng — cùng
  // quyền với sửa báo giá (chỉ chạy được ở Draft/Sent).
  @Post(':id/recalculate-prices')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation.update')
  recalculatePrices(
    @Param('id') id: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.workflow.recalculatePrices(id, req.user?.userId ?? null);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation.cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelQuotationDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.workflow.cancel(id, dto, req.user?.userId ?? null);
  }

  @Post(':id/override')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation.override')
  override(
    @Param('id') id: string,
    @Body() dto: OverrideQuotationDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.workflow.override(id, dto, req.user?.userId ?? null);
  }

  @Post(':id/discount')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation.update')
  discount(
    @Param('id') id: string,
    @Body() dto: DiscountQuotationDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.workflow.discount(id, dto, req.user?.userId ?? null);
  }

  // ── QuotationItem CRUD ──

  @Post(':id/items')
  @RequirePermission('quotation.update')
  addItem(@Param('id') id: string, @Body() dto: CreateQuotationItemDto) {
    return this.workflow.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission('quotation.update')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuotationItemDto,
  ) {
    return this.workflow.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('quotation.update')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.workflow.removeItem(id, itemId);
  }
}
