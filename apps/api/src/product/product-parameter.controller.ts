import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductParameterDto } from './dto/create-product-parameter.dto';
import { UpdateProductParameterDto } from './dto/update-product-parameter.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('products/:productId/parameters')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductParameterController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findAll(@Param('productId') productId: string) {
    return this.productService.findProductParameters(productId);
  }

  @Post()
  @RequirePermission('product.create')
  create(@Param('productId') productId: string, @Body() dto: CreateProductParameterDto) {
    return this.productService.createProductParameter(productId, dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateProductParameterDto) {
    return this.productService.updateProductParameter(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id') id: string) {
    return this.productService.deleteProductParameter(id);
  }
}
