import { Module } from '@nestjs/common';
import { ReturnService } from './return.service';
import { ReturnController } from './return.controller';
import { RecoveryInventoryController } from './recovery-inventory.controller';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [PermissionModule],
  controllers: [ReturnController, RecoveryInventoryController],
  providers: [ReturnService],
  exports: [ReturnService],
})
export class ReturnModule {}
