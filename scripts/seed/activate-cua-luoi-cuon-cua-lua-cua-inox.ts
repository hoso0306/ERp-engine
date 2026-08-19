/**
 * Activate 3 sản phẩm mới (Cửa lưới cuốn/Cửa lùa/Cửa inox mở quay) sau khi
 * đã tạo bằng create-cua-luoi-cuon-cua-lua-cua-inox.ts — tra theo TÊN,
 * không theo mã (mã lệch giữa Local/VPS).
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/activate-cua-luoi-cuon-cua-lua-cua-inox.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const NAMES = ['Cửa lưới cuốn', 'Cửa lùa', 'Cửa inox mở quay'];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    for (const name of NAMES) {
      const candidates = await prisma.product.findMany({ where: { name } });
      if (candidates.length === 0) throw new Error(`Không tìm thấy sản phẩm tên "${name}".`);
      if (candidates.length > 1) {
        throw new Error(`Có ${candidates.length} sản phẩm cùng tên "${name}" — cần xử lý tay.`);
      }
      const product = candidates[0];
      if (product.status === 'ACTIVE') {
        console.log(`[BỎ QUA] "${name}" (${product.code}) đã ACTIVE.`);
        continue;
      }
      const updated = await svc.updateProductStatus(product.id, 'ACTIVE');
      console.log(`"${name}" (${updated.code}) -> ${updated.status}`);
    }
  } finally {
    await app.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
