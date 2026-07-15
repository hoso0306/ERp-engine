import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Res, UploadedFile, UseInterceptors, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ProductService } from './product.service';
import { CreatePricingRuleVersionDto } from './dto/create-pricing-rule-version.dto';
import { UpdatePricingRuleVersionDto } from './dto/update-pricing-rule-version.dto';
import { CreatePricingRuleItemDto } from './dto/create-pricing-rule-item.dto';
import { UpdatePricingRuleItemDto } from './dto/update-pricing-rule-item.dto';
import { UpdatePriceMatrixDto } from './dto/update-price-matrix.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('products/:productId/pricing-rule')
@UseGuards(AuthGuard, PermissionGuard)
export class PricingRuleController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findPricingRule(@Param('productId') productId: string) {
    return this.productService.findPricingRule(productId);
  }

  @Post('versions')
  @RequirePermission('product.create')
  createVersion(
    @Param('productId') productId: string,
    @Body() dto: CreatePricingRuleVersionDto,
  ) {
    return this.productService.createPricingRuleVersion(productId, dto);
  }

  @Get('versions/:versionId')
  @RequirePermission('product.view')
  findVersion(@Param('versionId') versionId: string) {
    return this.productService.findPricingRuleVersion(versionId);
  }

  @Patch('versions/:versionId/activate')
  @RequirePermission('product.activate')
  activateVersion(@Param('versionId') versionId: string) {
    return this.productService.activatePricingRuleVersion(versionId);
  }

  @Patch('versions/:versionId')
  @RequirePermission('product.update')
  updateVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdatePricingRuleVersionDto,
  ) {
    return this.productService.updatePricingRuleVersion(versionId, dto);
  }

  @Delete('versions/:versionId')
  @RequirePermission('product.delete')
  deleteVersion(@Param('versionId') versionId: string) {
    return this.productService.deletePricingRuleVersion(versionId);
  }

  @Post('versions/:versionId/duplicate')
  @RequirePermission('product.create')
  duplicateVersion(@Param('versionId') versionId: string) {
    return this.productService.duplicatePricingRuleVersion(versionId);
  }

  @Post('versions/:versionId/items')
  @RequirePermission('product.create')
  createItem(
    @Param('versionId') versionId: string,
    @Body() dto: CreatePricingRuleItemDto,
  ) {
    return this.productService.createPricingRuleItem(versionId, dto);
  }

  @Patch('versions/:versionId/items/:itemId')
  @RequirePermission('product.update')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePricingRuleItemDto,
  ) {
    return this.productService.updatePricingRuleItem(itemId, dto);
  }

  @Delete('versions/:versionId/items/:itemId')
  @RequirePermission('product.delete')
  deleteItem(@Param('itemId') itemId: string) {
    return this.productService.deletePricingRuleItem(itemId);
  }

  @Post('versions/:versionId/preview')
  @RequirePermission('product.view')
  previewPrice(
    @Param('versionId') versionId: string,
    @Body('params') params: Record<string, number>,
  ) {
    return this.productService.previewPrice(versionId, params ?? {});
  }

  @Patch('versions/:versionId/matrix')
  @RequirePermission('product.update')
  updateMatrix(
    @Param('versionId') versionId: string,
    @Body() dto: UpdatePriceMatrixDto,
  ) {
    return this.productService.updatePriceMatrix(versionId, dto.rows ?? []);
  }

  @Get('versions/:versionId/matrix/template')
  @RequirePermission('product.update')
  exportMatrixTemplate(@Param('versionId') versionId: string, @Res() res: Response) {
    return this.productService.exportPriceMatrixTemplate(versionId, res);
  }

  @Post('versions/:versionId/matrix/import-preview')
  @RequirePermission('product.update')
  @UseInterceptors(FileInterceptor('file'))
  importMatrixPreview(
    @Param('versionId') versionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productService.previewPriceMatrixImport(versionId, file.buffer);
  }
}
