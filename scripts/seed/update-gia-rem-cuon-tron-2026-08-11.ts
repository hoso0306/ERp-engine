/**
 * Cập nhật giá bán SP000096 "Rèm cuốn trơn" và SP000139 "Thêm/Thay vải Cuốn
 * Trơn" theo yêu cầu 2026-08-11:
 *   Máng thường (mangdet):     370.000 -> 160.000
 *   Máng che sáng (mangchesang):380.000 -> 170.000
 *   Máng cầu vồng (mangcauvong):410.000 -> 185.000
 *
 * SP000139 lưu giá GỐC 100% y hệt SP000096 trong matrix (hệ số 0.6 nằm trong
 * expression `unitPrice * area * 0.6`), nên matrix của nó cũng nhận đúng 3
 * giá gốc mới ở trên — không nhân 0.6 khi ghi vào matrix.
 *
 * Cách làm: dùng đúng workflow "sửa version ACTIVE" của app — duplicate
 * version đang active thành DRAFT mới (giữ nguyên expression/rule items),
 * chỉ đổi giá trong matrix, rồi activate. Version cũ được giữ nguyên
 * (ARCHIVED) theo nguyên tắc Versioning.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/update-gia-rem-cuon-tron-2026-08-11.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const NEW_PRICE_BY_MANG: Record<string, number> = {
  mangdet: 160000,
  mangchesang: 170000,
  mangcauvong: 185000,
};

let prisma: PrismaService;
let svc: ProductService;

async function updateProductPrice(productName: string) {
  const product = await prisma.product.findFirst({
    where: { name: productName, deletedAt: null },
    include: {
      pricingRule: {
        include: {
          versions: {
            where: { status: 'ACTIVE' },
            include: {
              matrixRows: { orderBy: { displayOrder: 'asc' } },
            },
          },
        },
      },
    },
  });
  if (!product) throw new Error(`Không tìm thấy sản phẩm "${productName}"`);
  const active = product.pricingRule?.versions[0];
  if (!active) throw new Error(`"${productName}" (${product.code}) chưa có Pricing Rule Version ACTIVE`);

  console.log(`\n--- ${product.code} "${productName}" ---`);
  console.log(`  Version active hiện tại: ${active.name} (v${active.versionNumber}), ${active.matrixRows.length} dòng matrix`);

  const missing = active.matrixRows.filter(
    (r) => !(r.dimensions as Record<string, string>).mangremcuon || !(NEW_PRICE_BY_MANG[(r.dimensions as Record<string, string>).mangremcuon]),
  );
  if (missing.length > 0) {
    throw new Error(`"${productName}": có ${missing.length} dòng matrix không xác định được mangremcuon để map giá mới. Dừng lại, không đổi gì.`);
  }

  const duplicated: any = await svc.duplicatePricingRuleVersion(active.id);
  console.log(`  Đã tạo DRAFT mới: v${duplicated.versionNumber}`);

  const newRows = duplicated.matrixRows.map((r: any) => ({
    dimensions: r.dimensions,
    unitPrice: NEW_PRICE_BY_MANG[(r.dimensions as Record<string, string>).mangremcuon],
    displayOrder: r.displayOrder,
  }));
  await svc.updatePriceMatrix(duplicated.id, newRows);
  console.log(`  Đã cập nhật giá cho ${newRows.length} dòng matrix`);

  await svc.activatePricingRuleVersion(duplicated.id);
  console.log(`  Đã activate v${duplicated.versionNumber} (v${active.versionNumber} cũ chuyển ARCHIVED)`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  svc = app.get(ProductService);

  try {
    await updateProductPrice('Rèm cuốn trơn');
    await updateProductPrice('Thêm/Thay vải Cuốn Trơn');
    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
