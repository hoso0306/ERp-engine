import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateDerivedParameterDto, UpdateDerivedParameterDto } from './dto/derived-parameter.dto';

@Controller('products/:productId/derived-parameters')
export class DerivedParameterController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(@Param('productId') productId: string) {
    return this.productService.findDerivedParameters(productId);
  }

  @Post()
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateDerivedParameterDto,
  ) {
    return this.productService.createDerivedParameter(productId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDerivedParameterDto) {
    return this.productService.updateDerivedParameter(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.deleteDerivedParameter(id);
  }
}
