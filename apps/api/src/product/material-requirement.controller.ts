import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ProductService } from './product.service';
import { CreateMaterialRequirementVersionDto } from './dto/create-material-requirement-version.dto';
import { UpdateMaterialRequirementVersionDto } from './dto/update-material-requirement-version.dto';
import { CreateMaterialRequirementItemDto } from './dto/create-material-requirement-item.dto';
import { UpdateMaterialRequirementItemDto } from './dto/update-material-requirement-item.dto';
import { BulkUpsertMaterialRequirementItemsDto } from './dto/bulk-upsert-material-requirement-items.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('products/:productId/material-requirement')
@UseGuards(AuthGuard, PermissionGuard)
export class MaterialRequirementController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findMaterialRequirement(@Param('productId') productId: string) {
    return this.productService.findMaterialRequirement(productId);
  }

  @Post('versions')
  @RequirePermission('product.create')
  createVersion(
    @Param('productId') productId: string,
    @Body() dto: CreateMaterialRequirementVersionDto,
  ) {
    return this.productService.createMaterialRequirementVersion(productId, dto);
  }

  @Get('versions/:versionId')
  @RequirePermission('product.view')
  findVersion(@Param('versionId') versionId: string) {
    return this.productService.findMaterialRequirementVersion(versionId);
  }

  @Patch('versions/:versionId/activate')
  @RequirePermission('product.activate')
  activateVersion(@Param('versionId') versionId: string) {
    return this.productService.activateMaterialRequirementVersion(versionId);
  }

  @Patch('versions/:versionId')
  @RequirePermission('product.update')
  updateVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdateMaterialRequirementVersionDto,
  ) {
    return this.productService.updateMaterialRequirementVersion(versionId, dto);
  }

  @Delete('versions/:versionId')
  @RequirePermission('product.delete')
  deleteVersion(@Param('versionId') versionId: string) {
    return this.productService.deleteMaterialRequirementVersion(versionId);
  }

  @Post('versions/:versionId/duplicate')
  @RequirePermission('product.create')
  duplicateVersion(@Param('versionId') versionId: string) {
    return this.productService.duplicateMaterialRequirementVersion(versionId);
  }

  @Post('versions/:versionId/items')
  @RequirePermission('product.create')
  createItem(
    @Param('versionId') versionId: string,
    @Body() dto: CreateMaterialRequirementItemDto,
  ) {
    return this.productService.createMaterialRequirementItem(versionId, dto);
  }

  @Patch('versions/:versionId/items/:itemId')
  @RequirePermission('product.update')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMaterialRequirementItemDto,
  ) {
    return this.productService.updateMaterialRequirementItem(itemId, dto);
  }

  @Delete('versions/:versionId/items/:itemId')
  @RequirePermission('product.delete')
  deleteItem(@Param('itemId') itemId: string) {
    return this.productService.deleteMaterialRequirementItem(itemId);
  }

  @Post('versions/:versionId/preview')
  @RequirePermission('product.view')
  previewMaterial(
    @Param('versionId') versionId: string,
    @Body() inputParams: Record<string, number>,
  ) {
    return this.productService.previewMaterial(versionId, inputParams);
  }

  @Get('versions/:versionId/items/template')
  @RequirePermission('product.update')
  exportItemsTemplate(
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ) {
    return this.productService.exportMaterialRequirementTemplate(
      versionId,
      res,
    );
  }

  @Post('versions/:versionId/items/import-preview')
  @RequirePermission('product.update')
  @UseInterceptors(FileInterceptor('file'))
  importItemsPreview(
    @Param('versionId') versionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productService.previewMaterialRequirementImport(
      versionId,
      file.buffer,
    );
  }

  @Put('versions/:versionId/items')
  @RequirePermission('product.update')
  bulkUpsertItems(
    @Param('versionId') versionId: string,
    @Body() dto: BulkUpsertMaterialRequirementItemsDto,
  ) {
    return this.productService.bulkUpsertMaterialRequirementItems(
      versionId,
      dto.rows ?? [],
    );
  }
}
