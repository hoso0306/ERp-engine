import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('product-types')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductTypeController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findAll() {
    return this.productService.findAllProductTypes();
  }

  @Get(':id')
  @RequirePermission('product.view')
  findOne(@Param('id') id: string) {
    return this.productService.findOneProductType(id);
  }

  @Post()
  @RequirePermission('product.create')
  create(@Body() dto: CreateProductTypeDto) {
    return this.productService.createProductType(dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateProductTypeDto) {
    return this.productService.updateProductType(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id') id: string) {
    return this.productService.deleteProductType(id);
  }
}
