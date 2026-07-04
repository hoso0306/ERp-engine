import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PricingEngineService } from './pricing-engine.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@Controller('pricing-engine')
export class PricingEngineController {
  constructor(private readonly pricingEngineService: PricingEngineService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(@Body() dto: CalculatePriceDto) {
    return this.pricingEngineService.calculate(dto);
  }
}
