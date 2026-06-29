import { Controller, Get, Query } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  findAll(@Query() query: CustomerQueryDto) {
    return this.customerService.findAll(query);
  }

  @Get('groups')
  findAllGroups() {
    return this.customerService.findAllGroups();
  }

  @Get('routes')
  findAllRoutes() {
    return this.customerService.findAllRoutes();
  }
}
