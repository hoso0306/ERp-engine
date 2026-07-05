import { Module } from '@nestjs/common';
import { SettingModule } from '../setting/setting.module';
import { WarehouseService } from './warehouse.service';
import { MaterialReceiptController } from './material-receipt.controller';
import { WarehouseController } from './warehouse.controller';

@Module({
  imports: [SettingModule],
  controllers: [MaterialReceiptController, WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
