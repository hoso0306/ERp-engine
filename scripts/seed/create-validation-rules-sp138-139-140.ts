/**
 * Áp lại phần Validation Rule của mục 9 (workbench/sessions/2707.md) lên
 * Production — 3 Validation Rule (WARN, expression='true' tức luôn hiện)
 * cảnh báo % hệ số công thức cho 3 sản phẩm "Thêm/Thay vải ..." (nhóm dùng
 * hệ số nhân cố định 0.7/0.6 trong công thức giá, xem mục 9 để biết bối
 * cảnh đầy đủ).
 *
 * QUAN TRỌNG — resolve theo TÊN sản phẩm, KHÔNG theo mã code: đã xác nhận
 * (11/08/2026, xem memory product_sp_code_drift_local_prod) dải mã
 * SP000129-143 bị lệch giữa Local/Production. Trên Local 3 sản phẩm này là
 * SP000138/139/140; trên Production cùng 3 sản phẩm lại nằm ở mã
 * SP000137/138/139 (lệch 1) — code SP000140 trên Production là "Hàng phân
 * phối thêm", một sản phẩm hoàn toàn khác, KHÔNG được đụng vào.
 *
 * Idempotent theo (productId, message) — bỏ qua nếu đã có rule cùng message
 * cho đúng sản phẩm đó.
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-validation-rules-sp138-139-140.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

let prisma: PrismaService;

const RULES: { productName: string; message: string; displayOrder: number }[] = [
  { productName: 'Thêm/Thay vải cầu vồng', message: 'Giá thay thế bằng 70% giá gốc.', displayOrder: 3 },
  { productName: 'Thêm/Thay vải Cuốn Trơn', message: 'Giá thay thế bằng 60% giá gốc.', displayOrder: 3 },
  { productName: 'Thêm/Thay vải Cuốn Lưới', message: 'Giá thay thế bằng 60% giá gốc.', displayOrder: 3 },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    for (const r of RULES) {
      const product = await prisma.product.findFirst({ where: { name: r.productName, deletedAt: null } });
      if (!product) throw new Error(`Không tìm thấy Product tên="${r.productName}" trên môi trường này.`);
      const existing = await prisma.validationRule.findFirst({ where: { productId: product.id, message: r.message } });
      if (existing) {
        console.log(`[BỎ QUA] ${product.code} "${product.name}" đã có rule "${r.message}".`);
        continue;
      }
      await svc.createValidationRule(product.id, {
        expression: 'true',
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
