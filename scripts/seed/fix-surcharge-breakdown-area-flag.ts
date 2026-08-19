/**
 * Sửa lỗi targetParameter="area" bị mất khi tạo PricingRuleItem
 * SURCHARGE_BREAKDOWN (bug ở createPricingRuleItem() — đã fix trong
 * product.service.ts, script này chỉ sửa lại 2 dòng dữ liệu đã tạo sai lúc
 * chưa fix). Nhân bản version ACTIVE hiện tại, xoá đúng 2 dòng
 * SURCHARGE_BREAKDOWN bị thiếu targetParameter đúng ra phải là "area", thêm
 * lại đúng, rồi activate.
 *
 * Idempotent: nếu dòng cần sửa đã có targetParameter="area" thì bỏ qua.
 *
 * Xác định sản phẩm theo TÊN, không theo mã (mã lệch giữa Local/VPS, xác
 * nhận với người dùng 19/08/2026 — xem add-surcharge-breakdown-sp113-115-116.ts).
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/fix-surcharge-breakdown-area-flag.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const FIXES: Record<string, { description: string; condition: string; value: number }> = {
  'Rèm ngăn lạnh - Loại thu xếp': { description: 'Chiều cao dưới 1,8m', condition: 'chieucao < 1.8', value: 20000 },
  'Bạt Cuốn': { description: 'Ống nhôm cứng / Ống sắt', condition: 'ong=="ongnhomcung"||ong=="ongsat"', value: 15000 },
};

let prisma: PrismaService;

async function fixProduct(svc: ProductService, name: string) {
  const fix = FIXES[name];
  const candidates = await prisma.product.findMany({
    where: { name },
    include: { pricingRule: { include: { versions: { where: { status: 'ACTIVE' }, include: { items: true } } } } },
  });
  if (candidates.length === 0) throw new Error(`Không tìm thấy sản phẩm tên "${name}".`);
  if (candidates.length > 1) {
    throw new Error(
      `Có ${candidates.length} sản phẩm cùng tên "${name}" (mã: ${candidates.map((p) => p.code).join(', ')}) — cần xử lý tay.`,
    );
  }
  const product = candidates[0];
  const activePrv = product.pricingRule!.versions[0];

  const wrongItem = activePrv.items.find(
    (i) => i.ruleType === 'SURCHARGE_BREAKDOWN' && i.description === fix.description,
  );
  if (!wrongItem) throw new Error(`"${name}" (${product.code}): không tìm thấy dòng SURCHARGE_BREAKDOWN "${fix.description}".`);
  if (wrongItem.targetParameter === 'area') {
    console.log(`  [BỎ QUA] "${name}" (${product.code}): "${fix.description}" đã đúng targetParameter=area.`);
    return;
  }

  console.log(`  Nhân bản Pricing Rule Version cho "${name}" (${product.code})...`);
  const newPrv = await svc.duplicatePricingRuleVersion(activePrv.id);
  const copiedWrongItem = (
    await prisma.pricingRuleItem.findMany({ where: { pricingRuleVersionId: newPrv!.id } })
  ).find((i) => i.ruleType === 'SURCHARGE_BREAKDOWN' && i.description === fix.description)!;

  await svc.deletePricingRuleItem(copiedWrongItem.id);
  await svc.createPricingRuleItem(newPrv!.id, {
    ruleType: 'SURCHARGE_BREAKDOWN',
    condition: fix.condition,
    value: fix.value,
    targetParameter: 'area',
    description: fix.description,
    displayOrder: copiedWrongItem.displayOrder,
  } as any);
  await svc.activatePricingRuleVersion(newPrv!.id);

  console.log(`  [XONG] "${name}" (${product.code}): sửa "${fix.description}" -> targetParameter=area.`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    for (const name of Object.keys(FIXES)) {
      console.log(`\n--- ${name} ---`);
      await fixProduct(svc, name);
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
