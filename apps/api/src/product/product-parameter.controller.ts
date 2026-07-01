import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductParameterDto } from './dto/create-product-parameter.dto';
import { UpdateProductParameterDto } from './dto/update-product-parameter.dto';

@Controller('products/:productId/parameters')
export class ProductParameterController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(@Param('productId') productId: string) {
    return this.productService.findProductParameters(productId);
  }

  @Post()
  create(@Param('productId') productId: string, @Body() dto: CreateProductParameterDto) {
    return this.productService.createProductParameter(productId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductParameterDto) {
    return this.productService.updateProductParameter(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.deleteProductParameter(id);
  }
}
