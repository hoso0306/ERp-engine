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
} from '@nestjs/common';
import { QuotationWorkflowService } from './quotation-workflow.service';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { CancelQuotationDto } from './dto/cancel-quotation.dto';
import { OverrideQuotationDto } from './dto/override-quotation.dto';

@Controller('quotations')
export class QuotationController {
  constructor(private readonly workflow: QuotationWorkflowService) {}

  @Get()
  findAll(@Query() query: QuotationQueryDto) {
    return this.workflow.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workflow.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateQuotationDto) {
    return this.workflow.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    return this.workflow.update(id, dto);
  }

  // ── Workflow actions ──

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@Param('id') id: string) {
    return this.workflow.send(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string) {
    return this.workflow.approve(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelQuotationDto) {
    return this.workflow.cancel(id, dto);
  }

  @Post(':id/override')
  @HttpCode(HttpStatus.OK)
  override(@Param('id') id: string, @Body() dto: OverrideQuotationDto) {
    return this.workflow.override(id, dto);
  }

  // ── QuotationItem CRUD ──

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateQuotationItemDto) {
    return this.workflow.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuotationItemDto,
  ) {
    return this.workflow.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.workflow.removeItem(id, itemId);
  }
}
