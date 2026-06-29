import {
  Controller, Get, Post, Patch, Delete,
  Body, Query, Param, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CustomerService } from './customer.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  findAll(@Query() query: CustomerQueryDto) {
    return this.customerService.findAll(query);
  }

  @Get('deleted')
  findDeleted(@Query() query: CustomerQueryDto) {
    return this.customerService.findDeleted(query);
  }

  @Get('groups')
  findAllGroups() {
    return this.customerService.findAllGroups();
  }

  @Get('routes')
  findAllRoutes() {
    return this.customerService.findAllRoutes();
  }

  @Get('export')
  exportExcel(@Query() query: CustomerQueryDto, @Res() res: Response) {
    return this.customerService.exportExcel(res, query);
  }

  @Get('template')
  exportTemplate(@Res() res: Response) {
    return this.customerService.exportTemplate(res);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.customerService.importExcel(file.buffer);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerService.softDelete(id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.customerService.restore(id);
  }
}
