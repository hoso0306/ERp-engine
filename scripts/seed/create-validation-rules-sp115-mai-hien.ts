/**
 * Thêm 5 Validation Rule (WARN) cho sản phẩm "Mái hiên di động" (SP000115),
 * cảnh báo số bộ linh kiện tay đỡ cần cấp theo chiều rộng mặt tiền
 * (param `chieurong`, đơn vị m):
 *
 *   <= 4,5m           -> đủ 2 tay
 *   > 4,5m và < 5,5m  -> đủ 2 tay + phụ thu nếu lắp 3 tay
 *   5,5m - 6,3m       -> đủ 3 tay
 *   > 6,3m và < 7,2m  -> đủ 3 tay + phụ thu nếu lắp 4 tay
 *   >= 7,2m           -> đủ 4 tay
 *
 * Resolve theo TÊN sản phẩm (không theo mã code) — xem memory
 * product_sp_code_drift_local_prod, đề phòng lệch mã giữa Local/Production.
 *
 * Idempotent theo (productId, message) — bỏ qua nếu đã có rule cùng message
 * cho đúng sản phẩm đó.
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-validation-rules-sp115-mai-hien.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAME = 'Mái hiên di động';

const RULES: { expression: string; message: string; displayOrder: number }[] = [
  {
    expression: 'chieurong <= 4.5',
    message: 'Mặt tiền ≤4,5m: cấp đủ bộ linh kiện 2 tay',
    displayOrder: 3,
  },
  {
    expression: 'chieurong > 4.5 && chieurong < 5.5',
    message: 'Đủ 2 tay+pk. Phụ thu thêm nếu lắp 3 tay',
    displayOrder: 4,
  },
  {
    expression: 'chieurong >= 5.5 && chieurong <= 6.3',
    message: 'Mặt tiền 5,5m-6,3m: cấp đủ bộ linh kiện 3 tay',
    displayOrder: 5,
  },
  {
    expression: 'chieurong > 6.3 && chieurong < 7.2',
    message: 'Đủ 3 tay+pk. Phụ thu thêm nếu lắp 4 tay',
    displayOrder: 6,
  },
  {
    expression: 'chieurong >= 7.2',
    message: 'Mặt tiền ≥7,2m: cấp đủ bộ linh kiện 4 tay',
    displayOrder: 7,
  },
];

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    const product = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (!product) throw new Error(`Không tìm thấy Product tên="${PRODUCT_NAME}" trên môi trường này.`);

    for (const r of RULES) {
      const existing = await prisma.validationRule.findFirst({ where: { productId: product.id, message: r.message } });
      if (existing) {
        console.log(`[BỎ QUA] ${product.code} "${product.name}" đã có rule "${r.message}".`);
        continue;
      }
      await svc.createValidationRule(product.id, {
        expression: r.expression,
        severity: 'WARN',
        message: r.message,
        displayOrder: r.displayOrder,
      } as any);
      console.log(`Tạo Validation Rule cho ${product.code} "${product.name}": "${r.message}"`);
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
