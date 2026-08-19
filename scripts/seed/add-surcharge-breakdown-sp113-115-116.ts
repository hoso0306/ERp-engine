/**
 * Thêm danh sách phụ phí hiển thị dưới đơn giá (SURCHARGE_BREAKDOWN) cho 3
 * sản phẩm SP000113/115/116 — CHỈ để hiển thị cho sale khi thêm dòng báo
 * giá, KHÔNG thay đổi cách tính giá thật (surchargeExpression giữ nguyên
 * 100%, xem pricing-engine.service.ts).
 *
 * Điều kiện + số tiền lấy NGUYÊN VĂN từ surchargeExpression đang ACTIVE của
 * từng sản phẩm (đã đối chiếu trực tiếp trên DB, không suy diễn), nhãn hiển
 * thị lấy nguyên văn ProductParameterOption.label thật.
 *
 * Với mỗi sản phẩm: nhân bản Pricing Rule Version ACTIVE hiện có
 * (duplicatePricingRuleVersion, giữ nguyên expression/matrix/rule cũ), thêm
 * các dòng SURCHARGE_BREAKDOWN, rồi activate.
 *
 * Idempotent theo dấu hiệu: nếu version ACTIVE hiện tại đã có
 * PricingRuleItem ruleType=SURCHARGE_BREAKDOWN thì coi như đã áp dụng, bỏ
 * qua sản phẩm đó.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/add-surcharge-breakdown-sp113-115-116.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const SURCHARGE_ITEMS: Record<
  string,
  { condition: string; value: number; targetParameter: string | null; description: string }[]
> = {
  // if(chieucao < 1.8, area*20000, 0)
  SP000113: [
    { condition: 'chieucao < 1.8', value: 20000, targetParameter: 'area', description: 'Chiều cao dưới 1,8m' },
  ],
  // if(vatlieutay=="tayinox", 460000, 0)
  //   + if(quangcao=="khongqc", 0, if(quangcao=="qc100", 100000, if(quangcao=="qc150", 150000, 200000)))
  //   + if(ong=="ongthuong", 0, if(ong=="ongnhomcung100", 100000, if(ong=="ongnhomcung120", 120000,
  //       if(ong=="ongnhomcung150", 150000, if(ong=="ongsat100", 100000, if(ong=="ongsat120", 120000, 150000))))))
  SP000115: [
    { condition: 'vatlieutay=="tayinox"', value: 460000, targetParameter: null, description: 'Tay inox' },
    { condition: 'quangcao=="qc100"', value: 100000, targetParameter: null, description: 'QC 100k' },
    { condition: 'quangcao=="qc150"', value: 150000, targetParameter: null, description: 'QC150k' },
    { condition: 'quangcao=="qc200"', value: 200000, targetParameter: null, description: 'QC200k' },
    { condition: 'ong=="ongnhomcung100"', value: 100000, targetParameter: null, description: 'ống nhôm cứng 100k' },
    { condition: 'ong=="ongnhomcung120"', value: 120000, targetParameter: null, description: 'ống nhôm cứng 120k' },
    { condition: 'ong=="ongnhomcung150"', value: 150000, targetParameter: null, description: 'ống nhôm cứng 150k' },
    { condition: 'ong=="ongsat100"', value: 100000, targetParameter: null, description: 'ống sắt 100k' },
    { condition: 'ong=="ongsat120"', value: 120000, targetParameter: null, description: 'ống sắt 120k' },
    { condition: 'ong=="ongsat150"', value: 150000, targetParameter: null, description: 'ống sắt 150k' },
  ],
  // if(loai=="tayquay",80000,if(loai=="loxothuong_dai",10000,if(loai=="loxoham_trung",100000,
  //   if(loai=="loxoham_dai",110000,if(loai=="daukeo",80000,if(loai=="daukeotichhop_trung",130000,
  //   if(loai=="daukeotichhop_dai",140000,0)))))))
  //   + if(ong=="ongnhomcung"||ong=="ongsat",area*15000,0)
  SP000116: [
    { condition: 'loai=="tayquay"', value: 80000, targetParameter: null, description: 'Tay quay' },
    { condition: 'loai=="loxothuong_dai"', value: 10000, targetParameter: null, description: 'Lò xo thường (dài)' },
    { condition: 'loai=="loxoham_trung"', value: 100000, targetParameter: null, description: 'Lò xo Hãm (trung)' },
    { condition: 'loai=="loxoham_dai"', value: 110000, targetParameter: null, description: 'Lò xo Hãm (dài)' },
    { condition: 'loai=="daukeo"', value: 80000, targetParameter: null, description: 'Đầu kéo' },
    { condition: 'loai=="daukeotichhop_trung"', value: 130000, targetParameter: null, description: 'Đầu kéo tích hợp (trung)' },
    { condition: 'loai=="daukeotichhop_dai"', value: 140000, targetParameter: null, description: 'Đầu kéo tích hợp (dài)' },
    { condition: 'ong=="ongnhomcung"||ong=="ongsat"', value: 15000, targetParameter: 'area', description: 'Ống nhôm cứng / Ống sắt' },
  ],
};

let prisma: PrismaService;

async function fixProduct(svc: ProductService, code: string) {
  const items = SURCHARGE_ITEMS[code];
  const product = await prisma.product.findUnique({
    where: { code },
    include: {
      pricingRule: {
        include: {
          versions: {
            where: { status: 'ACTIVE' },
            include: { items: true },
          },
        },
      },
    },
  });
  if (!product) throw new Error(`Không tìm thấy sản phẩm ${code} trên môi trường này.`);

  const activePrv = product.pricingRule?.versions[0];
  if (!activePrv) throw new Error(`${code}: không có Pricing Rule Version ACTIVE.`);

  const alreadyApplied = activePrv.items.some((i) => i.ruleType === 'SURCHARGE_BREAKDOWN');
  if (alreadyApplied) {
    console.log(`  [BỎ QUA] ${code} "${product.name}" đã có SURCHARGE_BREAKDOWN — coi như đã áp dụng.`);
    return;
  }

  console.log(`  Nhân bản Pricing Rule Version cho ${code}...`);
  const newPrv = await svc.duplicatePricingRuleVersion(activePrv.id);
  let displayOrder = 1;
  for (const item of items) {
    await svc.createPricingRuleItem(newPrv!.id, {
      ruleType: 'SURCHARGE_BREAKDOWN',
      condition: item.condition,
      value: item.value,
      targetParameter: item.targetParameter,
      description: item.description,
      displayOrder: displayOrder++,
    } as any);
  }
  await svc.activatePricingRuleVersion(newPrv!.id);

  console.log(`  [XONG] ${code} "${product.name}": +${items.length} dòng SURCHARGE_BREAKDOWN.`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    for (const code of Object.keys(SURCHARGE_ITEMS)) {
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
