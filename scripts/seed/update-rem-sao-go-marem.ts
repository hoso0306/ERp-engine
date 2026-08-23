/**
 * Cập nhật SP000150 (Local) / SP000146 (Production) "Rèm sáo gỗ" — người dùng
 * vừa chỉnh tay qua UI trên Local (12/08/2026): thêm tham số "Mã rèm" (marem,
 * TEXT, bắt buộc, chỉ mô tả — không usedInPricing/usedInMaterial) chèn giữa
 * Chiều cao và Bản, đồng thời đổi thứ tự hiển thị Giá vốn lên trước Giá bán.
 * Replay lại đúng thay đổi này qua service layer (không phải resync toàn bộ
 * sản phẩm) theo pattern incremental replay đã dùng cho các mục 12-14 của
 * workbench/sessions/2707.md.
 *
 * Thứ tự displayOrder đích (khớp Local hiện tại):
 *   chieurong=1, chieucao=2, marem=3(mới), banrem=4, herem=5, giavon=6, dongia=7
 *
 * Idempotent: bỏ qua nếu "marem" đã tồn tại trên sản phẩm.
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/update-rem-sao-go-marem.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAME = 'Rèm sáo gỗ';

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const product = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (!product) throw new Error(`Không tìm thấy sản phẩm "${PRODUCT_NAME}".`);
    console.log(`Product: ${product.code} "${product.name}"`);

    const params = await prisma.productParameter.findMany({ where: { productId: product.id } });
    const byName = (n: string) => params.find((p) => p.name === n);

    if (byName('marem')) {
      console.log('[BỎ QUA] "marem" đã tồn tại trên sản phẩm này.');
      return;
    }

    const banrem = byName('banrem');
    const herem = byName('herem');
    const giavon = byName('giavon');
    const dongia = byName('dongia');
    if (!banrem || !herem || !giavon || !dongia) {
      throw new Error('Thiếu 1 trong các tham số gốc (banrem/herem/giavon/dongia) — kiểm tra lại sản phẩm trước khi chạy.');
    }

    console.log('--- Tạo tham số "Mã rèm" ---');
    await svc.createProductParameter(product.id, {
      name: 'marem', label: 'Mã rèm', type: 'TEXT', isRequired: true,
      usedInPricing: false, usedInMaterial: false, displayOrder: 3,
    } as any);
    console.log('  Đã tạo "marem" (Mã rèm) tại displayOrder=3');

    console.log('--- Cập nhật lại thứ tự hiển thị ---');
    if (banrem.displayOrder !== 4) {
      await svc.updateProductParameter(banrem.id, { displayOrder: 4 } as any);
      console.log(`  banrem: displayOrder ${banrem.displayOrder} → 4`);
    }
    if (herem.displayOrder !== 5) {
      await svc.updateProductParameter(herem.id, { displayOrder: 5 } as any);
      console.log(`  herem: displayOrder ${herem.displayOrder} → 5`);
    }
    if (giavon.displayOrder !== 6) {
      await svc.updateProductParameter(giavon.id, { displayOrder: 6 } as any);
      console.log(`  giavon: displayOrder ${giavon.displayOrder} → 6`);
    }
    if (dongia.displayOrder !== 7) {
      await svc.updateProductParameter(dongia.id, { displayOrder: 7 } as any);
      console.log(`  dongia: displayOrder ${dongia.displayOrder} → 7`);
    }

    console.log(`\n=== DONE: ${product.code} "${PRODUCT_NAME}" ===`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
