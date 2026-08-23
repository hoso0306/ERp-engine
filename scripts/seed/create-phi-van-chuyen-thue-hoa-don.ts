/**
 * Áp lại mục 7 (workbench/sessions/2707.md) lên Production — tạo 2 Material
 * "PHÍ VẬN CHUYỂN" và "THUẾ HOÁ ĐƠN" (bán lẻ, giá 1đ placeholder, đơn vị
 * "Khoản", VAT bán lẻ 0%) dùng cơ chế Bán lẻ vật tư trong Báo giá. Gọi thẳng
 * ProductService.createMaterial() (đúng luồng generateCode/RunningNumber,
 * validateRetailConfig — y hệt hành vi API thật, chỉ khác không cần JWT).
 * Dữ liệu field lấy nguyên văn từ Material đã tạo + verify trên Local
 * (NL000353/NL000354).
 *
 * Idempotent theo tên (assertUniqueMaterialName trong createMaterial sẽ chặn
 * nếu chạy lại khi đã tồn tại tên trùng).
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-phi-van-chuyen-thue-hoa-don.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    const unit = await prisma.unit.findFirst({ where: { name: 'Khoản' } });
    if (!unit) throw new Error('Không tìm thấy Unit "Khoản" trên môi trường này.');

    const items: { name: string; note?: string }[] = [
      { name: 'PHÍ VẬN CHUYỂN' },
      { name: 'THUẾ HOÁ ĐƠN', note: 'Thuế' },
    ];

    for (const it of items) {
      const existing = await prisma.material.findFirst({ where: { name: { equals: it.name, mode: 'insensitive' } } });
      if (existing) {
        console.log(`[BỎ QUA] "${it.name}" đã tồn tại (${existing.code}).`);
        continue;
      }
      const m = await svc.createMaterial({
        name: it.name,
        unitId: unit.id,
        note: it.note,
        isRetailable: true,
        retailPrice: 1,
        retailVatRate: 0,
      } as any);
      console.log(`Tạo ${m.code} "${m.name}" — isRetailable=${m.isRetailable}, retailPrice=${m.retailPrice}, retailVatRate=${m.retailVatRate}`);
    }
    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
