import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateValidationRuleDto, UpdateValidationRuleDto } from './dto/validation-rule.dto';

@Controller('products/:productId/validation-rules')
export class ValidationRuleController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll(@Param('productId') productId: string) {
    return this.productService.findValidationRules(productId);
  }

  @Post()
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateValidationRuleDto,
  ) {
    return this.productService.createValidationRule(productId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateValidationRuleDto) {
    return this.productService.updateValidationRule(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.deleteValidationRule(id);
  }
}
