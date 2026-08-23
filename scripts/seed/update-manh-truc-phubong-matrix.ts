/**
 * Đổi cách tính giá "Phủ bóng" của SP000143 "Mành Trúc" theo yêu cầu 2026-08-12:
 * từ phụ phí (surchargeExpression: +10.000đ/m², cộng sau discount, không bị
 * chiết khấu ăn vào) sang đưa thẳng vào Price Matrix (dimension thứ 2, cùng
 * với `loaimanh`) — chấp nhận khoản 10.000đ/m² này từ nay BỊ chiết khấu ăn vào
 * giống phần còn lại của đơn giá.
 *
 * Giá matrix mới (gộp thẳng +10.000đ vào đơn giá gốc):
 *   loaimanh=tron,     phubong=khong -> 165.000
 *   loaimanh=tron,     phubong=co    -> 175.000
 *   loaimanh=in_tranh, phubong=khong -> 295.000
 *   loaimanh=in_tranh, phubong=co    -> 305.000
 *
 * Cách làm: dùng đúng workflow "sửa version ACTIVE" của app — duplicate
 * version đang active thành DRAFT mới, thay 2 dòng matrix cũ (chỉ có
 * `loaimanh`) bằng 4 dòng mới (co `loaimanh` + `phubong`), xoá
 * surchargeExpression (set null), rồi activate. Version cũ giữ nguyên
 * (ARCHIVED) theo nguyên tắc Versioning.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/update-manh-truc-phubong-matrix.ts
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
      where: { code: 'SP000143', deletedAt: null },
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
    if (!product) throw new Error('Không tìm thấy sản phẩm SP000143.');
    const active = product.pricingRule?.versions[0];
    if (!active) throw new Error('SP000143 chưa có Pricing Rule Version ACTIVE.');

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
