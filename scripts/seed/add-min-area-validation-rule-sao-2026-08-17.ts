/**
 * Thêm Validation Rule (WARN) cho 5 sản phẩm nhóm Rèm sáo/lá/hạt vừa được
 * thêm Pricing Rule Item MIN_AREA=1 (Việc 6/7/10, workbench/sessions/2707.md)
 * nhưng thiếu Validation Rule tương ứng — nên khi khách nhập diện tích < 1m²,
 * hệ thống ÂM THẦM tính bằng 1m² (đúng công thức) nhưng KHÔNG hiện thông báo
 * cảnh báo nào cho người dùng biết. Validation Rule là cơ chế RIÊNG, chỉ để
 * hiện message cảnh báo — không ảnh hưởng công thức tính (đã tính đúng từ
 * Pricing Rule Item MIN_AREA).
 *
 * Message theo đúng pattern đã dùng ở các sản phẩm khác (vd Rèm cuốn tranh):
 * "Diện tích < 1m² sẽ tính bằng 1m²".
 *
 * Resolve theo TÊN sản phẩm. Idempotent (bỏ qua sản phẩm đã có Validation
 * Rule với đúng expression này).
 *
 * Chạy (từ apps/api, trong container production):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/add-min-area-validation-rule-sao-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAMES = ['Rèm sáo gỗ', 'Rèm Sáo nhôm', 'Rèm Sáo nhựa', 'Rèm lá lật', 'Rèm Hạt nhựa'];
const EXPRESSION = 'area < 1';
const MESSAGE = 'Diện tích < 1m² sẽ tính bằng 1m².';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    for (const name of PRODUCT_NAMES) {
      const product = await prisma.product.findFirst({ where: { name, deletedAt: null }, include: { validationRules: true } });
      if (!product) throw new Error(`Không tìm thấy sản phẩm "${name}".`);

      const already = (product as any).validationRules.some((vr: any) => vr.expression === EXPRESSION);
      if (already) {
        console.log(`[BỎ QUA] ${product.code} "${name}" đã có Validation Rule "${EXPRESSION}".`);
        continue;
      }

      await svc.createValidationRule(product.id, {
        expression: EXPRESSION,
        severity: 'WARN',
        message: MESSAGE,
        displayOrder: 1,
      } as any);
      console.log(`${product.code} "${name}" -> đã thêm Validation Rule WARN "${EXPRESSION}".`);
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
