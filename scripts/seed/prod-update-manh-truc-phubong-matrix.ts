/**
 * Bản dành cho PRODUCTION của update-manh-truc-phubong-matrix.ts — resolve
 * sản phẩm theo TÊN ("Mành Trúc") thay vì code, vì code SP có drift đã biết
 * giữa local/production ở dải SP000129-143 (xem memory product-sp-code-drift-local-prod).
 * Logic thay đổi giống hệt bản local, chỉ khác cách tìm product.
 *
 * Chạy trong container erp-api trên VPS (cwd /repo/apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/prod-update-manh-truc-phubong-matrix.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const NEW_MATRIX: { loaimanh: string; phubong: string; unitPrice: number }[] = [
  { loaimanh: 'tron', phubong: 'khong', unitPrice: 165000 },
  { loaimanh: 'tron', phubong: 'co', unitPrice: 175000 },
  { loaimanh: 'in_tranh', phubong: 'khong', unitPrice: 295000 },
  { loaimanh: 'in_tranh', phubong: 'co', unitPrice: 305000 },
];

let prisma: PrismaService;
let svc: ProductService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  svc = app.get(ProductService);

  try {
    const product = await prisma.product.findFirst({
      where: { name: 'Mành Trúc', deletedAt: null },
      include: {
        pricingRule: {
          include: {
            versions: {
              where: { status: 'ACTIVE' },
              include: { matrixRows: { orderBy: { displayOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!product) throw new Error('Không tìm thấy sản phẩm "Mành Trúc".');
    const active = product.pricingRule?.versions[0];
    if (!active) throw new Error(`${product.code} chưa có Pricing Rule Version ACTIVE.`);

    console.log(`--- ${product.code} "${product.name}" ---`);
    console.log(`  Version active hiện tại: v${active.versionNumber}, surcharge=${active.surchargeExpression}`);
    console.log(`  Matrix hiện tại: ${active.matrixRows.map((r) => JSON.stringify(r.dimensions) + '=' + r.unitPrice).join(', ')}`);

    const duplicated: any = await svc.duplicatePricingRuleVersion(active.id);
    console.log(`  Đã tạo DRAFT mới: v${duplicated.versionNumber}`);

    const newRows = NEW_MATRIX.map((m, idx) => ({
      dimensions: { loaimanh: m.loaimanh, phubong: m.phubong },
      unitPrice: m.unitPrice,
      displayOrder: idx,
    }));
    await svc.updatePriceMatrix(duplicated.id, newRows);
    console.log(`  Đã cập nhật matrix: ${newRows.length} dòng`);

    await svc.updatePricingRuleVersion(duplicated.id, { surchargeExpression: null } as any);
    console.log(`  Đã xoá surchargeExpression`);

    await svc.activatePricingRuleVersion(duplicated.id);
    console.log(`  Đã activate v${duplicated.versionNumber} (v${active.versionNumber} cũ chuyển ARCHIVED)`);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
