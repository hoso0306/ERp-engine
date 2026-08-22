/**
 * Đổi mức làm tròn Pricing Rule Version từ CEIL 100 -> CEIL 10 cho các sản
 * phẩm mà bản in Báo giá hiển thị "Đơn giá/m²" bằng cách CHIA NGƯỢC (Thành
 * Tiền hoặc systemPrice-sau-CK / diện tích) — xem
 * apps/web/src/app/quotations/[id]/print/page.tsx (EFFECTIVE_UNIT_PRICE_PRODUCT_NAMES
 * + isRcvProduct). Với kiểu hiển thị này, làm tròn CÀNG THÔ (bội số càng
 * lớn) thì đơn giá/m² chia ngược ra giữa các dòng cùng sản phẩm càng LỆCH
 * NHIỀU (đã tính minh hoạ với người dùng qua BG000061 — CEIL 100 lệch vài
 * đồng, CEIL 1000 lệch tới ~90đ). CEIL 10 giảm lệch xuống mức không đáng kể
 * (~1-2đ) mà Thành Tiền mỗi dòng vẫn là số tròn chục — chốt 20/08/2026.
 *
 * KHÔNG áp dụng cho Bạt Cuốn dù cùng thuộc EFFECTIVE_UNIT_PRICE_PRODUCT_NAMES
 * — hiện đang priceRoundType=NONE (không làm tròn), không có gì để "đổi lại".
 *
 * Xác định sản phẩm theo TÊN, KHÔNG theo mã — mã lệch giữa Local/VPS (xem
 * scripts/seed/add-surcharge-breakdown-sp113-115-116.ts, bài học 19/08/2026).
 *
 * Đúng nguyên tắc Versioning: KHÔNG sửa version ACTIVE trực tiếp — nhân bản
 * (duplicatePricingRuleVersion, giữ nguyên expression/rule items/matrix),
 * chỉ đổi priceRoundValue: 100 -> 10, rồi activate version mới.
 *
 * Idempotent: nếu version ACTIVE hiện tại đã priceRoundType=CEIL và
 * priceRoundValue=10 thì bỏ qua. Nếu version ACTIVE không phải CEIL 100 đúng
 * như khảo sát ban đầu (vd đã bị đổi khác từ lúc khảo sát) thì DỪNG và báo
 * lỗi, không tự đoán.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/change-ceil100-to-ceil10-effective-unit-price.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAMES = [
  '[RCV] OMEGA - OG',
  '[RCV] CARTIER - CT',
  '[RCV] VALENTINO - VE',
  '[RCV] HENIKEN - HK',
  '[RCV] VATICAN - VA',
  '[RCV] DYLAN - DL',
  '[RCV] LUXURA - LX',
  '[RCV] SAMSON - SS',
  '[RCV] RHANA - RA',
  '[RCV] VICTORY - VT',
  '[RCV] SUNDIVA - SD86',
  '[RCV] ROYOL - RO',
  '[RCV] FAMILY - FL',
  '[RCV] GALAXY - GA',
  '[RCV] ROMANTIC - RT',
  '[RCV] MOUTAIN - MT',
  '[RCV] OLIVER - OL',
  '[RCV] TOKYO - TK',
  '[RCV] CHARMING - CG21',
  '[RCV] APOLO - AP',
  '[RCV] INTERONE - IT',
  '[RCV] FANTACY - FS',
  '[RCV] ATLANTIC - AC24',
  '[RCV] TULIPS - TL',
  '[RCV] VENICE - VC96',
  '[RCV] LUCKY - LK39',
  '[RCV] FLAMINGO - FM91',
  '[RCV] ARMANI - AM33',
  '[RCV] BURBERY - BB50',
  '[RCV] WOODLOOK - WL',
  '[RCV] PALACE - PA',
  '[RCV] GREENBAY - GE18',
  '[RCV] CAVANI - CV',
  '[RCV] LIBERTY - LB15',
  '[RCV] KOSY - KO',
  '[RCV] MARCELO - MC16',
  '[RCV] CARA - CR',
  '[RCV] LOTUS - LS38',
  '[RCV] BASIC EDITION 1 - BS1',
  '[RCV] BASIC EDITION 2 - BS19',
  '[RCV]-Thêm/Thay vải cầu vồng',
  '[RCV] - Thêm/Thay vải Cuốn Trơn',
  '[RCV] - Thêm/Thay vải Cuốn Lưới',
  '[RCV] - Rèm cầu vồng in tranh',
  'Mành Tăm',
  'Rèm sáo gỗ',
];

let prisma: PrismaService;

async function fixProduct(svc: ProductService, name: string) {
  const candidates = await prisma.product.findMany({
    where: { name },
    include: {
      pricingRule: {
        include: {
          versions: {
            where: { status: 'ACTIVE' },
          },
        },
      },
    },
  });
  if (candidates.length === 0) throw new Error(`Không tìm thấy sản phẩm tên "${name}" trên môi trường này.`);
  if (candidates.length > 1) {
    throw new Error(
      `Có ${candidates.length} sản phẩm cùng tên "${name}" (mã: ${candidates.map((p) => p.code).join(', ')}) — cần xử lý tay, không tự đoán đúng cái nào.`,
    );
  }
  const product = candidates[0];

  const activePrv = product.pricingRule?.versions[0];
  if (!activePrv) throw new Error(`"${name}" (${product.code}): không có Pricing Rule Version ACTIVE.`);

  if (activePrv.priceRoundType === 'CEIL' && Number(activePrv.priceRoundValue) === 10) {
    console.log(`  [BỎ QUA] "${name}" (${product.code}) đã là CEIL 10.`);
    return;
  }
  if (!(activePrv.priceRoundType === 'CEIL' && Number(activePrv.priceRoundValue) === 100)) {
    throw new Error(
      `"${name}" (${product.code}): version ACTIVE hiện là ${activePrv.priceRoundType} ${activePrv.priceRoundValue} — khác CEIL 100 dự kiến, dừng lại để kiểm tra tay.`,
    );
  }

  console.log(`  Nhân bản Pricing Rule Version cho "${name}" (${product.code})...`);
  const newPrv = await svc.duplicatePricingRuleVersion(activePrv.id);
  await svc.updatePricingRuleVersion(newPrv!.id, { priceRoundValue: 10 } as any);
  await svc.activatePricingRuleVersion(newPrv!.id);

  console.log(`  [XONG] "${name}" (${product.code}): CEIL 100 -> CEIL 10.`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    for (const name of PRODUCT_NAMES) {
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
