import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductionCenterDto } from './dto/create-production-center.dto';
import { UpdateProductionCenterDto } from './dto/update-production-center.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('production-centers')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductionCenterController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('production-center.view')
  findAll() {
    return this.productService.findAllProductionCenters();
  }

  @Get(':id')
  @RequirePermission('production-center.view')
  findOne(@Param('id') id: string) {
    return this.productService.findOneProductionCenter(id);
  }

  @Post()
  @RequirePermission('production-center.create')
  create(@Body() dto: CreateProductionCenterDto) {
    return this.productService.createProductionCenter(dto);
  }

  @Patch(':id')
  @RequirePermission('production-center.update')
  update(@Param('id') id: string, @Body() dto: UpdateProductionCenterDto) {
    return this.productService.updateProductionCenter(id, dto);
  }

  @Delete(':id')
  @RequirePermission('production-center.delete')
  remove(@Param('id') id: string) {
    return this.productService.deleteProductionCenter(id);
  }
}
