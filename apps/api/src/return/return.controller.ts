import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ReturnService } from './return.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnQueryDto } from './dto/return-query.dto';

@Controller('returns')
export class ReturnController {
  constructor(private readonly returnService: ReturnService) {}

  @Get()
  findAll(@Query() query: ReturnQueryDto) {
    return this.returnService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.returnService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateReturnDto) {
    return this.returnService.create(dto);
  }
}
