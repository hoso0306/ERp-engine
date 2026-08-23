/**
 * Đổi VAT 10% -> 8% cho 5 sản phẩm nhóm Rèm cuốn/Xưởng Cầu Vồng (yêu cầu
 * 12/08/2026): Rèm cuốn lưới, Rèm cuốn tranh, Rèm cuốn trơn, "[RCV] - Thêm/
 * Thay vải Cuốn Lưới", "[RCV] - Thêm/Thay vải Cuốn Trơn".
 *
 * Resolve theo TÊN sản phẩm, KHÔNG theo mã — dải mã SP129-151 lệch giữa
 * Local/Production (xem memory product_sp_code_drift_local_prod).
 *
 * Tôn trọng nguyên tắc Versioning (CLAUDE.md mục 8) — KHÔNG sửa thẳng
 * PricingRuleVersion đang ACTIVE. Với mỗi sản phẩm có VAT != 8%:
 *   1. duplicatePricingRuleVersion(activeVersionId) -> tạo DRAFT mới (clone
 *      nguyên expression/items/matrixRows).
 *   2. updatePricingRuleVersion(draftId, { vatRate: 8 }).
 *   3. activatePricingRuleVersion(draftId) -> tự động ARCHIVED bản cũ.
 * Idempotent — bỏ qua sản phẩm đã có VAT = 8% (vd "Rèm cuốn trơn" trên Local
 * đã sẵn 8% trước khi chạy script này).
 *
 * Chạy: (từ apps/api, container hoặc local)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/update-vat-5-rem-cuon-cau-vong.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAMES = [
  'Rèm cuốn lưới',
  'Rèm cuốn tranh',
  'Rèm cuốn trơn',
  '[RCV] - Thêm/Thay vải Cuốn Lưới',
  '[RCV] - Thêm/Thay vải Cuốn Trơn',
];
const TARGET_VAT = 8;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    for (const name of PRODUCT_NAMES) {
      const product = await prisma.product.findFirst({
        where: { name, deletedAt: null },
        include: { pricingRule: { include: { versions: { where: { status: 'ACTIVE' } } } } },
      });
      if (!product) throw new Error(`Không tìm thấy Product tên="${name}" trên môi trường này.`);
      const active = product.pricingRule?.versions[0];
      if (!active) throw new Error(`${product.code} "${name}" chưa có Pricing Rule Version ACTIVE.`);

      if (Number(active.vatRate) === TARGET_VAT) {
        console.log(`[BỎ QUA] ${product.code} "${name}" đã VAT ${TARGET_VAT}%.`);
        continue;
      }

      const draft = await svc.duplicatePricingRuleVersion(active.id);
      await svc.updatePricingRuleVersion(draft.id, { vatRate: TARGET_VAT } as any);
      await svc.activatePricingRuleVersion(draft.id);
      console.log(`${product.code} "${name}": VAT ${active.vatRate}% -> ${TARGET_VAT}% (version v${active.versionNumber} -> v${draft.versionNumber})`);
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
