/**
 * "Rèm sáo gỗ" + "Rèm Sáo nhôm" — chuyển Production Center sang "Hàng phân
 * phối" (XW006), thay cho "Xưởng Cầu Vồng" (XW004) — chốt 17/08/2026,
 * workbench/sessions/2707.md mục 8. Field `productionCenterId` nằm trực tiếp
 * trên Product (không versioned) — dùng thẳng `ProductService.updateProduct()`.
 * Không ảnh hưởng đơn hàng/báo giá cũ đã snapshot Production Center tại thời
 * điểm xác nhận (Business Snapshot Rule).
 *
 * Resolve theo TÊN sản phẩm + TÊN Production Center (không theo mã — mã
 * auto-increment lệch giữa Local/Production). Idempotent — bỏ qua sản phẩm
 * nào đã đúng Production Center rồi.
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/set-hang-phan-phoi-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCTION_CENTER_NAME = 'Hàng phân phối';
const PRODUCT_NAMES = ['Rèm sáo gỗ', 'Rèm Sáo nhôm'];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const center = await prisma.productionCenter.findFirst({ where: { name: PRODUCTION_CENTER_NAME } });
    if (!center) throw new Error(`Không tìm thấy Production Center tên="${PRODUCTION_CENTER_NAME}" trên môi trường này.`);
    console.log(`Production Center đích: ${center.name} (${center.id})`);

    for (const name of PRODUCT_NAMES) {
      const product = await prisma.product.findFirst({ where: { name, deletedAt: null } });
      if (!product) throw new Error(`Không tìm thấy Product tên="${name}" trên môi trường này.`);
      if (product.productionCenterId === center.id) {
        console.log(`  [BỎ QUA] ${product.code} "${product.name}" đã ở đúng Production Center.`);
        continue;
      }
      await svc.updateProduct(product.id, { productionCenterId: center.id } as any);
      console.log(`  ${product.code} "${product.name}": đã đổi Production Center -> ${center.name}.`);
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
