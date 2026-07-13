import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateValidationRuleDto, UpdateValidationRuleDto } from './dto/validation-rule.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('products/:productId/validation-rules')
@UseGuards(AuthGuard, PermissionGuard)
export class ValidationRuleController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findAll(@Param('productId') productId: string) {
    return this.productService.findValidationRules(productId);
  }

  @Post()
  @RequirePermission('product.create')
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateValidationRuleDto,
  ) {
    return this.productService.createValidationRule(productId, dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateValidationRuleDto) {
    return this.productService.updateValidationRule(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id') id: string) {
    return this.productService.deleteValidationRule(id);
  }
}
