import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CustomerService } from './customer.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerProductDiscountDto } from './dto/create-customer-product-discount.dto';
import { UpdateCustomerProductDiscountDto } from './dto/update-customer-product-discount.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('customers')
@UseGuards(AuthGuard, PermissionGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @RequirePermission('customer.view')
  findAll(@Query() query: CustomerQueryDto) {
    return this.customerService.findAll(query);
  }

  @Get('deleted')
  @RequirePermission('customer.view')
  findDeleted(@Query() query: CustomerQueryDto) {
    return this.customerService.findDeleted(query);
  }

  @Get('groups')
  @RequirePermission('customer.view')
  findAllGroups() {
    return this.customerService.findAllGroups();
  }

  @Get('routes')
  @RequirePermission('customer.view')
  findAllRoutes() {
    return this.customerService.findAllRoutes();
  }

  @Get('export')
  @RequirePermission('customer.export')
  exportExcel(@Query() query: CustomerQueryDto, @Res() res: Response) {
    return this.customerService.exportExcel(res, query);
  }

  @Get('template')
  @RequirePermission('customer.create')
  exportTemplate(@Res() res: Response) {
    return this.customerService.exportTemplate(res);
  }

  @Get(':id')
  @RequirePermission('customer.view')
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Get(':id/debt-summary')
  @RequirePermission('customer.view')
  getDebtSummary(@Param('id') id: string) {
    return this.customerService.getDebtSummary(id);
  }

  @Post()
  @RequirePermission('customer.create')
  create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @Post('import')
  @RequirePermission('customer.create')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.customerService.importExcel(file.buffer);
  }

  @Patch(':id')
  @RequirePermission('customer.update')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('customer.delete')
  remove(@Param('id') id: string) {
    return this.customerService.softDelete(id);
  }

  @Patch(':id/restore')
  @RequirePermission('customer.update')
  restore(@Param('id') id: string) {
    return this.customerService.restore(id);
  }

  // ── Chiết khấu theo Khách hàng × Sản phẩm (nested) ──

  @Get(':id/product-discounts/lookup')
  @RequirePermission('customer.view')
  lookupProductDiscount(
    @Param('id') id: string,
    @Query('productId') productId: string,
  ) {
    return this.customerService.lookupProductDiscount(id, productId);
  }

  @Get(':id/product-discounts')
  @RequirePermission('customer.view')
  findProductDiscounts(@Param('id') id: string) {
    return this.customerService.findProductDiscounts(id);
  }

  @Post(':id/product-discounts')
  @RequirePermission('customer.update')
  createProductDiscount(
    @Param('id') id: string,
    @Body() dto: CreateCustomerProductDiscountDto,
  ) {
    return this.customerService.createProductDiscount(id, dto);
  }

  @Patch(':id/product-discounts/:discountId')
  @RequirePermission('customer.update')
  updateProductDiscount(
    @Param('id') id: string,
    @Param('discountId') discountId: string,
    @Body() dto: UpdateCustomerProductDiscountDto,
  ) {
    return this.customerService.updateProductDiscount(id, discountId, dto);
  }

  @Delete(':id/product-discounts/:discountId')
  @RequirePermission('customer.update')
  deleteProductDiscount(
    @Param('id') id: string,
    @Param('discountId') discountId: string,
  ) {
    return this.customerService.deleteProductDiscount(id, discountId);
  }
}
