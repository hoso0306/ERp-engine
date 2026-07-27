import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OpeningBalanceService } from './opening-balance.service';
import { CreateOpeningBalanceDto } from './dto/create-opening-balance.dto';
import { ReduceOpeningBalanceDto } from './dto/reduce-opening-balance.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';

// opening-balance.md — Công nợ đầu kỳ, không có Create/Update/Delete tự do:
// chỉ tạo mới (migrate dữ liệu go-live) và giảm dần qua action reduce().
@Controller('opening-balances')
@UseGuards(AuthGuard, PermissionGuard)
export class OpeningBalanceController {
  constructor(private readonly openingBalanceService: OpeningBalanceService) {}

  @Post()
  @RequirePermission('debt.create-payment')
  create(
    @Body() dto: CreateOpeningBalanceDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.openingBalanceService.create(dto, req.user?.userId ?? null);
  }

  @Get('by-customer/:customerId')
  @RequirePermission('debt.view')
  findAllByCustomer(@Param('customerId') customerId: string) {
    return this.openingBalanceService.findAllByCustomer(customerId);
  }

  @Get(':id')
  @RequirePermission('debt.view')
  findOne(@Param('id') id: string) {
    return this.openingBalanceService.findOne(id);
  }

  @Post(':id/reduce')
  @RequirePermission('debt.create-payment')
  reduce(
    @Param('id') id: string,
    @Body() dto: ReduceOpeningBalanceDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.openingBalanceService.reduce(id, dto, req.user?.userId ?? null);
  }
}
