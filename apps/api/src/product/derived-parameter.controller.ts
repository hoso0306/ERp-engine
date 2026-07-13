import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateDerivedParameterDto, UpdateDerivedParameterDto } from './dto/derived-parameter.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('products/:productId/derived-parameters')
@UseGuards(AuthGuard, PermissionGuard)
export class DerivedParameterController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findAll(@Param('productId') productId: string) {
    return this.productService.findDerivedParameters(productId);
  }

  @Post()
  @RequirePermission('product.create')
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateDerivedParameterDto,
  ) {
    return this.productService.createDerivedParameter(productId, dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateDerivedParameterDto) {
    return this.productService.updateDerivedParameter(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id') id: string) {
    return this.productService.deleteDerivedParameter(id);
  }
}
