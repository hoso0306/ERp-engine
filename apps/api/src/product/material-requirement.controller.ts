import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateMaterialRequirementVersionDto } from './dto/create-material-requirement-version.dto';
import { UpdateMaterialRequirementVersionDto } from './dto/update-material-requirement-version.dto';
import { CreateMaterialRequirementItemDto } from './dto/create-material-requirement-item.dto';
import { UpdateMaterialRequirementItemDto } from './dto/update-material-requirement-item.dto';

@Controller('products/:productId/material-requirement')
export class MaterialRequirementController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findMaterialRequirement(@Param('productId') productId: string) {
    return this.productService.findMaterialRequirement(productId);
  }

  @Post('versions')
  createVersion(
    @Param('productId') productId: string,
    @Body() dto: CreateMaterialRequirementVersionDto,
  ) {
    return this.productService.createMaterialRequirementVersion(productId, dto);
  }

  @Get('versions/:versionId')
  findVersion(@Param('versionId') versionId: string) {
    return this.productService.findMaterialRequirementVersion(versionId);
  }

  @Patch('versions/:versionId/activate')
  activateVersion(@Param('versionId') versionId: string) {
    return this.productService.activateMaterialRequirementVersion(versionId);
  }

  @Patch('versions/:versionId')
  updateVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdateMaterialRequirementVersionDto,
  ) {
    return this.productService.updateMaterialRequirementVersion(versionId, dto);
  }

  @Delete('versions/:versionId')
  deleteVersion(@Param('versionId') versionId: string) {
    return this.productService.deleteMaterialRequirementVersion(versionId);
  }

  @Post('versions/:versionId/items')
  createItem(
    @Param('versionId') versionId: string,
    @Body() dto: CreateMaterialRequirementItemDto,
  ) {
    return this.productService.createMaterialRequirementItem(versionId, dto);
  }

  @Patch('versions/:versionId/items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMaterialRequirementItemDto,
  ) {
    return this.productService.updateMaterialRequirementItem(itemId, dto);
  }

  @Delete('versions/:versionId/items/:itemId')
  deleteItem(@Param('itemId') itemId: string) {
    return this.productService.deleteMaterialRequirementItem(itemId);
  }

  @Post('versions/:versionId/preview')
  previewMaterial(
    @Param('versionId') versionId: string,
    @Body() inputParams: Record<string, number>,
  ) {
    return this.productService.previewMaterial(versionId, inputParams);
  }
}
