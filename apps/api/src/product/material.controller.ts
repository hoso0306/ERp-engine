import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialQueryDto } from './dto/material-query.dto';
import { CreateMaterialPriceDto } from './dto/create-material-price.dto';
import { UpdateMaterialPriceDto } from './dto/update-material-price.dto';

@Controller('materials')
export class MaterialController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(@Query() query: MaterialQueryDto) {
    return this.productService.findAllMaterials(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findOneMaterial(id);
  }

  @Post()
  create(@Body() dto: CreateMaterialDto) {
    return this.productService.createMaterial(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.productService.updateMaterial(id, dto);
  }

  // ── Material Price (nested) ──

  @Get(':materialId/prices')
  findPrices(@Param('materialId') materialId: string) {
    return this.productService.findMaterialPrices(materialId);
  }

  @Post(':materialId/prices')
  createPrice(
    @Param('materialId') materialId: string,
    @Body() dto: CreateMaterialPriceDto,
  ) {
    return this.productService.createMaterialPrice(materialId, dto);
  }

  @Patch(':materialId/prices/:priceId')
  updatePrice(
    @Param('priceId') priceId: string,
    @Body() dto: UpdateMaterialPriceDto,
  ) {
    return this.productService.updateMaterialPrice(priceId, dto);
  }

  @Delete(':materialId/prices/:priceId')
  deletePrice(@Param('priceId') priceId: string) {
    return this.productService.deleteMaterialPrice(priceId);
  }
}
