import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('products')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findAll(@Query() query: ProductQueryDto) {
    return this.productService.findAllProducts(query);
  }

  @Get('deleted')
  @RequirePermission('product.view')
  findDeleted(@Query() query: ProductQueryDto) {
    return this.productService.findDeletedProducts(query);
  }

  @Get(':id/export')
  @RequirePermission('product.export')
  async exportProduct(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, code } = await this.productService.exportProduct(id);
    const filename = `product-${code}.xlsx`;
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @RequirePermission('product.view')
  findOne(@Param('id') id: string) {
    return this.productService.findOneProduct(id);
  }

  @Post()
  @RequirePermission('product.create')
  create(@Body() dto: CreateProductDto) {
    return this.productService.createProduct(dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.updateProduct(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('product.update')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.productService.updateProductStatus(id, status);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id') id: string) {
    return this.productService.softDeleteProduct(id);
  }

  @Patch(':id/restore')
  @RequirePermission('product.update')
  restore(@Param('id') id: string) {
    return this.productService.restoreProduct(id);
  }
}
