import { Module } from '@nestjs/common';
import { BomEngineService } from './bom-engine.service';

@Module({
  providers: [BomEngineService],
  exports: [BomEngineService],
})
export class BomEngineModule {}
