import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

@Controller('pricing-engine')
@UseGuards(AuthGuard, PermissionGuard)
export class PricingEngineController {
  constructor(private readonly pricingEngineService: PricingEngineService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('product.view')
  calculate(@Body() dto: CalculatePriceDto) {
    return this.pricingEngineService.calculate(dto);
  }
}
