import { Global, Module } from '@nestjs/common';
import { PdfService } from './pdf.service';

// Cùng vị trí quy ước và cùng pattern @Global với ExcelModule
// (apps/api/src/shared/excel/excel.module.ts).
@Global()
@Module({
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
