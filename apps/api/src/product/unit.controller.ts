import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('units')
@UseGuards(AuthGuard, PermissionGuard)
export class UnitController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @RequirePermission('product.view')
  findAll() {
    return this.productService.findAllUnits();
  }

  @Get(':id')
  @RequirePermission('product.view')
  findOne(@Param('id') id: string) {
    return this.productService.findOneUnit(id);
  }

  @Post()
  @RequirePermission('product.create')
  create(@Body() dto: CreateUnitDto) {
    return this.productService.createUnit(dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.productService.updateUnit(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id') id: string) {
    return this.productService.deleteUnit(id);
  }
}
