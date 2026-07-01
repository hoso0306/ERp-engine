import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreatePricingRuleVersionDto } from './dto/create-pricing-rule-version.dto';
import { UpdatePricingRuleVersionDto } from './dto/update-pricing-rule-version.dto';
import { CreatePricingRuleItemDto } from './dto/create-pricing-rule-item.dto';
import { UpdatePricingRuleItemDto } from './dto/update-pricing-rule-item.dto';

@Controller('products/:productId/pricing-rule')
export class PricingRuleController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findPricingRule(@Param('productId') productId: string) {
    return this.productService.findPricingRule(productId);
  }

  @Post('versions')
  createVersion(
    @Param('productId') productId: string,
    @Body() dto: CreatePricingRuleVersionDto,
  ) {
    return this.productService.createPricingRuleVersion(productId, dto);
  }

  @Get('versions/:versionId')
  findVersion(@Param('versionId') versionId: string) {
    return this.productService.findPricingRuleVersion(versionId);
  }

  @Patch('versions/:versionId/activate')
  activateVersion(@Param('versionId') versionId: string) {
    return this.productService.activatePricingRuleVersion(versionId);
  }

  @Patch('versions/:versionId')
  updateVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdatePricingRuleVersionDto,
  ) {
    return this.productService.updatePricingRuleVersion(versionId, dto);
  }

  @Delete('versions/:versionId')
  deleteVersion(@Param('versionId') versionId: string) {
    return this.productService.deletePricingRuleVersion(versionId);
  }

  @Post('versions/:versionId/items')
  createItem(
    @Param('versionId') versionId: string,
    @Body() dto: CreatePricingRuleItemDto,
  ) {
    return this.productService.createPricingRuleItem(versionId, dto);
  }

  @Patch('versions/:versionId/items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePricingRuleItemDto,
  ) {
    return this.productService.updatePricingRuleItem(itemId, dto);
  }

  @Delete('versions/:versionId/items/:itemId')
  deleteItem(@Param('itemId') itemId: string) {
    return this.productService.deletePricingRuleItem(itemId);
  }

  @Post('versions/:versionId/preview')
  previewPrice(
    @Param('versionId') versionId: string,
    @Body('params') params: Record<string, number>,
  ) {
    return this.productService.previewPrice(versionId, params ?? {});
  }
}
