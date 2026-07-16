import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialQueryDto } from './dto/material-query.dto';
import { CreateMaterialPriceDto } from './dto/create-material-price.dto';
import { UpdateMaterialPriceDto } from './dto/update-material-price.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('materials')
@UseGuards(AuthGuard, PermissionGuard)
export class MaterialController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findAll(@Query() query: MaterialQueryDto) {
    return this.productService.findAllMaterials(query);
  }

  @Get(':id')
  @RequirePermission('product.view')
  findOne(@Param('id') id: string) {
    return this.productService.findOneMaterial(id);
  }

  @Post()
  @RequirePermission('product.create')
  create(@Body() dto: CreateMaterialDto) {
    return this.productService.createMaterial(dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.productService.updateMaterial(id, dto);
  }

  // ── Material Price (nested) ──

  @Get(':materialId/prices')
  @RequirePermission('product.view')
  findPrices(@Param('materialId') materialId: string) {
    return this.productService.findMaterialPrices(materialId);
  }

  @Post(':materialId/prices')
  @RequirePermission('product.create')
  createPrice(
    @Param('materialId') materialId: string,
    @Body() dto: CreateMaterialPriceDto,
  ) {
    return this.productService.createMaterialPrice(materialId, dto);
  }

  @Patch(':materialId/prices/:priceId')
  @RequirePermission('product.update')
  updatePrice(
    @Param('priceId') priceId: string,
    @Body() dto: UpdateMaterialPriceDto,
  ) {
    return this.productService.updateMaterialPrice(priceId, dto);
  }

  @Delete(':materialId/prices/:priceId')
  @RequirePermission('product.delete')
  deletePrice(@Param('priceId') priceId: string) {
    return this.productService.deleteMaterialPrice(priceId);
  }
}
