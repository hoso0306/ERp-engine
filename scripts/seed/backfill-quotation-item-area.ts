import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import {
  coerceParameters,
  computeDerivedParams,
} from '../../apps/api/src/shared/derived-params';

// Backfill 1 lần cho báo giá tạo TRƯỚC khi addItem/updateItem snapshot thêm
// biến phái sinh "area" (BG000031, chốt 11/08/2026) — xem
// apps/api/src/quotation/quotation-workflow.service.ts buildAreaParameterCreate.
// Chỉ backfill đúng "area" (không đụng các biến phái sinh phụ trợ khác như
// "dientichvai" — chỉ dùng nội bộ tính định mức, không phải số đo hiển thị).
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);

  const productsWithArea = await prisma.product.findMany({
    where: { derivedParameters: { some: { name: 'area' } } },
    select: {
      id: true,
      code: true,
      derivedParameters: {
        select: { name: true, expression: true, unit: true },
      },
      parameters: { where: { type: 'ENUM' }, select: { name: true } },
    },
  });
  const productById = new Map(productsWithArea.map((p) => [p.id, p]));
  const productIds = [...productById.keys()];

  const items = await prisma.quotationItem.findMany({
    where: {
      itemType: 'PRODUCT',
      productId: { in: productIds },
      parameters: { none: { name: 'area' } },
    },
    select: {
      id: true,
      productId: true,
      productCode: true,
      quotation: { select: { code: true } },
      parameters: { select: { name: true, value: true, displayOrder: true } },
    },
  });

  console.log(`${items.length} dòng cần backfill "area". DRY_RUN=${DRY_RUN}`);

  let ok = 0;
  let failed = 0;
  for (const item of items) {
    const product = productById.get(item.productId!)!;
    const enumNames = new Set(product.parameters.map((p) => p.name));
    const raw = coerceParameters(
      item.parameters.map((p) => ({ name: p.name, value: p.value })),
      enumNames,
    );
    try {
      const ctx = computeDerivedParams(
        product.derivedParameters.map((d) => ({
          name: d.name,
          expression: d.expression,
        })),
        raw,
      );
      const area = ctx['area'];
      if (typeof area !== 'number') throw new Error('area không phải số');
      const maxDisplayOrder = Math.max(
        0,
        ...item.parameters.map((p) => p.displayOrder),
      );
      console.log(`OK  ${item.quotation.code} ${item.productCode} area=${area}`);
      if (!DRY_RUN) {
        await prisma.quotationItemParameter.create({
          data: {
            quotationItemId: item.id,
            name: 'area',
            label: 'Diện tích',
            value: String(area),
            unit: 'm²',
            displayOrder: maxDisplayOrder + 1,
          },
        });
      }
      ok++;
    } catch (e) {
      console.log(`FAIL ${item.quotation.code} ${item.productCode}: ${(e as Error).message}`);
      failed++;
    }
  }
  console.log(`Xong. OK=${ok} FAIL=${failed}`);
  await app.close();
}
main();
