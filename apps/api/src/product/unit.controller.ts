import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Controller('units')
export class UnitController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll() {
    return this.productService.findAllUnits();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOneUnit(id);
  }

  @Post()
  create(@Body() dto: CreateUnitDto) {
    return this.productService.createUnit(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.productService.updateUnit(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.deleteUnit(id);
  }
}
