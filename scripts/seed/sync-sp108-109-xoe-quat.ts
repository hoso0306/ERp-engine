/**
 * Đồng bộ SP000108/109 từ Production về Local — trên Production 2 sản phẩm
 * này đã được sửa trực tiếp (không qua Local trước): đổi tên thành
 * "-Xoè Quạt", thêm param `maukhung` (Trắng/Ghi/Cafe/Vân gỗ), và bảng giá
 * ma trận marem×maukhung (44 dòng/sp) thay cho bảng giá phẳng theo marem cũ
 * (chốt 14/08/2026, xem workbench/sessions cùng ngày).
 *
 * KHÔNG đổi Validation Rules và Material Requirement — đã giống hệt nhau
 * giữa 2 môi trường, xác nhận qua kiểm tra DB trực tiếp.
 *
 * Resolve theo MÃ (SP000108/109 — đã xác nhận không nằm trong dải lệch mã
 * đã biết trước đây, nhưng để chắc chắn script vẫn kiểm tra lại tên hiện tại
 * trước khi sửa).
 *
 * Idempotent: bỏ qua nếu tên sản phẩm đã khớp đúng tên Production (coi như
 * đã đồng bộ rồi).
 *
 * Chạy: (từ apps/api, local — script này chỉ chạy ở LOCAL, không chạy lại
 * trên Production vì Production đã là nguồn đúng)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/sync-sp108-109-xoe-quat.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const MAUKHUNG_OPTIONS = [
  { value: 'trang', label: 'Trắng' },
  { value: 'ghi', label: 'Ghi' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'van_go', label: 'Vân gỗ' },
];

const MAREM_GROUP: Record<string, 'G' | 'DX'> = {
  G001: 'G', G002: 'G', G003: 'G', G004: 'G', G005: 'G', G006: 'G', G007: 'G', G008: 'G',
  DX0202: 'DX', DX0206: 'DX', DX0502: 'DX',
};
const MAUKHUNG_GROUP: Record<string, 'normal' | 'wood'> = {
  trang: 'normal', ghi: 'normal', cafe: 'normal', van_go: 'wood',
};

type Spec = {
  code: string;
  newName: string;
  prices: { G_normal: number; G_wood: number; DX_normal: number; DX_wood: number };
};

const SPECS: Spec[] = [
  {
    code: 'SP000108',
    newName: '[Vòm tổ ong] -Xoè Quạt - Hệ xếp TL27',
    prices: { G_normal: 400000, G_wood: 430000, DX_normal: 430000, DX_wood: 460000 },
  },
  {
    code: 'SP000109',
    newName: '[Vòm tổ ong] -Xoè quạt - Hệ xếp TL30',
    prices: { G_normal: 410000, G_wood: 440000, DX_normal: 440000, DX_wood: 470000 },
  },
];

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    for (const spec of SPECS) {
      const product = await prisma.product.findUnique({ where: { code: spec.code } });
      if (!product) throw new Error(`Không tìm thấy Product mã="${spec.code}" trên môi trường này.`);

      if (product.name === spec.newName) {
        console.log(`[BỎ QUA] ${spec.code} đã có tên đúng "${spec.newName}" — coi như đã đồng bộ.`);
        continue;
      }

      console.log(`\n${spec.code}: "${product.name}" -> "${spec.newName}"`);
      await svc.updateProduct(product.id, { name: spec.newName } as any);
      console.log('  Đã đổi tên.');

      const existingMaukhung = await prisma.productParameter.findFirst({
        where: { productId: product.id, name: 'maukhung' },
      });
      if (!existingMaukhung) {
        await svc.createProductParameter(product.id, {
          name: 'maukhung', label: 'Màu khung', type: 'ENUM',
          isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3,
          options: MAUKHUNG_OPTIONS,
        } as any);
        console.log('  Đã thêm param maukhung (Trắng/Ghi/Cafe/Vân gỗ).');
      } else {
        console.log('  [BỎ QUA] param maukhung đã tồn tại.');
      }

      const pricingRule = await svc.findPricingRule(product.id);
      const activeVersion = pricingRule.versions.find((v: any) => v.status === 'ACTIVE');
      if (!activeVersion) throw new Error(`${spec.code} chưa có Pricing Rule Version ACTIVE nào.`);

      const marem = await prisma.productParameter.findFirst({
        where: { productId: product.id, name: 'marem' },
        include: { options: true },
      });
      if (!marem) throw new Error(`${spec.code} không có param marem.`);

      const draft = await svc.duplicatePricingRuleVersion(activeVersion.id);
      const rows = marem.options.flatMap((m) =>
        MAUKHUNG_OPTIONS.map((mk) => {
          const group = MAREM_GROUP[m.value];
          const woodOrNormal = MAUKHUNG_GROUP[mk.value];
          const priceKey = `${group}_${woodOrNormal}` as keyof Spec['prices'];
          return { dimensions: { marem: m.value, maukhung: mk.value }, unitPrice: spec.prices[priceKey] };
        }),
      );
      await svc.updatePriceMatrix(draft!.id, rows as any);
      await svc.activatePricingRuleVersion(draft!.id);
      console.log(`  Đã tạo bảng giá ma trận mới (${rows.length} dòng: marem×maukhung), đã ACTIVE.`);
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
