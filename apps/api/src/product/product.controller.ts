import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productService.findAllProducts(query);
  }

  @Get('deleted')
  findDeleted(@Query() query: ProductQueryDto) {
    return this.productService.findDeletedProducts(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOneProduct(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productService.createProduct(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.updateProduct(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.productService.updateProductStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.softDeleteProduct(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.productService.restoreProduct(id);
  }
}
