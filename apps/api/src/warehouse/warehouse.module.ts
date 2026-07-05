import { Module } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { MaterialReceiptController } from './material-receipt.controller';
import { WarehouseController } from './warehouse.controller';

@Module({
  controllers: [MaterialReceiptController, WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
