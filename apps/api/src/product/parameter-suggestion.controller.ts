import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('product-parameters')
@UseGuards(AuthGuard, PermissionGuard)
export class ParameterSuggestionController {
  constructor(private readonly productService: ProductService) {}

  @Get('suggestions')
  @RequirePermission('product.view')
  getSuggestions(@Query('q') q?: string) {
    return this.productService.getParameterNameSuggestions(q);
  }
}
