import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductionCenterDto } from './dto/create-production-center.dto';
import { UpdateProductionCenterDto } from './dto/update-production-center.dto';

@Controller('production-centers')
export class ProductionCenterController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll() {
    return this.productService.findAllProductionCenters();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOneProductionCenter(id);
  }

  @Post()
  create(@Body() dto: CreateProductionCenterDto) {
    return this.productService.createProductionCenter(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductionCenterDto) {
    return this.productService.updateProductionCenter(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.deleteProductionCenter(id);
  }
}
