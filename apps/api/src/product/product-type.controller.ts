import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

@Controller('product-types')
export class ProductTypeController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll() {
    return this.productService.findAllProductTypes();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOneProductType(id);
  }

  @Post()
  create(@Body() dto: CreateProductTypeDto) {
    return this.productService.createProductType(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductTypeDto) {
    return this.productService.updateProductType(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.deleteProductType(id);
  }
}
