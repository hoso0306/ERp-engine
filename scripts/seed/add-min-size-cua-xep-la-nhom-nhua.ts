/**
 * Thêm quy tắc kích thước tối thiểu cho 4 sản phẩm "[Cửa xếp] Lá nhôm/Lá
 * nhựa" (SP000052/53/54/55): chiều rộng dưới 0,8m tính bằng 0,8m, chiều cao
 * dưới 1,5m tính bằng 1,5m — áp dụng ĐỒNG THỜI, độc lập (không theo bậc diện
 * tích như SP000124-126).
 *
 * Với mỗi sản phẩm:
 * - Pricing Rule: nhân bản version ACTIVE hiện có (duplicatePricingRuleVersion,
 *   giữ nguyên expression/matrix cũ), thêm 2 Pricing Rule Item (MIN_DIMENSION
 *   chieurong 0.8, MIN_DIMENSION chieucao 1.5, không điều kiện), rồi activate.
 * - Validation Rule: 2 dòng WARN tương ứng, thêm thẳng vào Product (không
 *   versioned) — theo đúng convention đã dùng ở SP000124-126.
 * - Không đụng Material Requirement (chỉ là quy tắc tính giá).
 *
 * Idempotent theo dấu hiệu: nếu Product đã có ValidationRule
 * expression="chieurong < 0.8" thì coi như đã áp dụng, bỏ qua.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/add-min-size-cua-xep-la-nhom-nhua.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_CODES = ['SP000052', 'SP000053', 'SP000054', 'SP000055'];

const PRICING_RULE_ITEMS = [
  { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 0.8, condition: null, displayOrder: 1, description: 'Chiều rộng dưới 0,8m tính bằng 0,8m.' },
  { ruleType: 'MIN_DIMENSION', targetParameter: 'chieucao', value: 1.5, condition: null, displayOrder: 2, description: 'Chiều cao dưới 1,5m tính bằng 1,5m.' },
] as const;

const VALIDATION_RULES = [
  { expression: 'chieurong < 0.8', severity: 'WARN', message: 'Chiều rộng < 0,8m sẽ tính bằng 0,8m', displayOrder: 1 },
  { expression: 'chieucao < 1.5', severity: 'WARN', message: 'Chiều cao < 1,5m sẽ tính bằng 1,5m', displayOrder: 2 },
] as const;

let prisma: PrismaService;

async function fixProduct(svc: ProductService, code: string) {
  const product = await prisma.product.findUnique({
    where: { code },
    include: {
      validationRules: true,
      pricingRule: { include: { versions: { where: { status: 'ACTIVE' } } } },
    },
  });
  if (!product) throw new Error(`Không tìm thấy sản phẩm ${code} trên môi trường này.`);

  const alreadyApplied = product.validationRules.some((r) => r.expression === 'chieurong < 0.8');
  if (alreadyApplied) {
    console.log(`  [BỎ QUA] ${code} "${product.name}" đã có Validation Rule "chieurong < 0.8" — coi như đã áp dụng.`);
    return;
  }

  const activePrv = product.pricingRule?.versions[0];
  if (!activePrv) throw new Error(`${code}: không có Pricing Rule Version ACTIVE.`);

  console.log(`  Nhân bản Pricing Rule Version cho ${code}...`);
  const newPrv = await svc.duplicatePricingRuleVersion(activePrv.id);
  for (const item of PRICING_RULE_ITEMS) {
    await svc.createPricingRuleItem(newPrv!.id, item as any);
  }
  await svc.activatePricingRuleVersion(newPrv!.id);

  for (const vr of VALIDATION_RULES) {
    await svc.createValidationRule(product.id, vr as any);
  }

  console.log(`  [XONG] ${code} "${product.name}": +2 Pricing Rule Item, +2 Validation Rule.`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    for (const code of PRODUCT_CODES) {
      console.log(`\n--- ${code} ---`);
      await fixProduct(svc, code);
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
