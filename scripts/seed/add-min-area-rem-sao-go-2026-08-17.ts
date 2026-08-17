/**
 * Thêm Quy định "Diện tích < 1m² tính bằng 1m²" (Pricing Rule Item MIN_AREA)
 * vào sản phẩm "Rèm sáo gỗ" — hiện Pricing Rule Version ACTIVE (v2) chưa có
 * rule nào, expression = "dongia * area" (giá bán nhập tay theo m²).
 *
 * Cách làm (đúng nguyên tắc Versioning — KHÔNG sửa version ACTIVE):
 *   1. duplicatePricingRuleVersion(activeVersionId) -> DRAFT mới (giữ nguyên
 *      expression/làm tròn/VAT)
 *   2. createPricingRuleItem: MIN_AREA, value=1
 *   3. activatePricingRuleVersion(draftId) -> version cũ tự ARCHIVED
 *
 * Resolve theo TÊN sản phẩm ("Rèm sáo gỗ"), không theo mã code.
 * Idempotent: bỏ qua nếu version ACTIVE đã có sẵn rule MIN_AREA.
 *
 * Chạy (từ apps/api, trong container production):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/add-min-area-rem-sao-go-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAME = 'Rèm sáo gỗ';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const product = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (!product) throw new Error(`Không tìm thấy sản phẩm "${PRODUCT_NAME}".`);

    const activeVersion = await prisma.pricingRuleVersion.findFirst({
      where: { pricingRule: { productId: product.id }, status: 'ACTIVE' },
      include: { items: true },
    });
    if (!activeVersion) throw new Error(`${product.code}: không tìm thấy Pricing Rule Version ACTIVE.`);

    const hasMinArea = activeVersion.items.some((it) => it.ruleType === 'MIN_AREA');
    if (hasMinArea) {
      console.log(`[BỎ QUA] ${product.code} "${PRODUCT_NAME}" đã có rule MIN_AREA.`);
      return;
    }

    console.log(`--- ${product.code} | ${PRODUCT_NAME} ---`);
    const draft: any = await svc.duplicatePricingRuleVersion(activeVersion.id);
    console.log(`  Đã nhân bản version ACTIVE -> DRAFT v${draft.versionNumber} (${draft.id}).`);

    await svc.createPricingRuleItem(draft.id, {
      ruleType: 'MIN_AREA',
      value: 1,
      description: 'Diện tích < 1m² tính bằng 1m².',
      displayOrder: 1,
    } as any);
    console.log('  Đã thêm rule MIN_AREA = 1m².');

    await svc.activatePricingRuleVersion(draft.id);
    console.log(`  Đã kích hoạt v${draft.versionNumber}.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
