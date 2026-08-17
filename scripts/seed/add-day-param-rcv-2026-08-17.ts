/**
 * Thêm Product Parameter "day" (Đáy: Đáy nhôm/Đáy nhựa) vào các sản phẩm RCV
 * (Rèm cầu vồng) đang dùng NL000095 (Thanh đáy nhôm) / NL000140 (Thanh đáy
 * nhựa) trong Material Requirement Version ACTIVE. Đổi điều kiện chọn 2 dòng
 * vật tư đó từ theo "mangremcuon" (Loại máng) sang theo "day" độc lập — Đáy
 * và Máng tách rời hoàn toàn (xác nhận người dùng 2026-08-17): khách chọn Máng
 * và Đáy riêng biệt, không ràng buộc nhau.
 *
 * Trước đây "loại đáy" (nhôm/nhựa) được suy ra NGẦM theo mangremcuon (máng
 * nhôm cong/vuông -> đáy nhôm; máng nhựa -> đáy nhựa). Nhóm "Rèm cuốn" đã có
 * sẵn tham số "day" độc lập từ trước (tròn/Oval/nhựa) — RCV thì chưa, đây là
 * lý do bổ sung.
 *
 * Cách làm (đúng nguyên tắc Versioning — KHÔNG sửa version ACTIVE):
 *   1. Thêm Product Parameter "day" (ENUM, usedInPricing=false, usedInMaterial=true,
 *      2 lựa chọn: nhom="Đáy nhôm", nhua="Đáy nhựa")
 *   2. duplicateMaterialRequirementVersion(activeVersionId) -> DRAFT mới
 *      (giữ nguyên mọi dòng khác — máng, ống cuốn, thanh ty, phụ kiện...)
 *   3. Sửa condition của đúng 2 dòng NL000095/NL000140 trong DRAFT mới:
 *        NL000095 (Thanh đáy nhôm): -> day == "nhom"
 *        NL000140 (Thanh đáy nhựa): -> day == "nhua"
 *   4. activateMaterialRequirementVersion(draftId) -> version cũ tự ARCHIVED
 *
 * Resolve theo TÊN Material (không theo mã NL, mã auto-increment có thể lệch
 * giữa Local/Production).
 *
 * Idempotent: bỏ qua sản phẩm đã có tham số "day" (an toàn chạy lại).
 *
 * Chạy (từ apps/api, trong container production):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/add-day-param-rcv-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const NL_NHOM_NAME = 'Thanh đáy nhôm - Rèm cầu vồng RCV';
const NL_NHUA_NAME = 'Thanh đáy nhựa - Rèm cầu vồng RCV';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const nlNhom = await prisma.material.findFirst({ where: { name: NL_NHOM_NAME } });
    const nlNhua = await prisma.material.findFirst({ where: { name: NL_NHUA_NAME } });
    if (!nlNhom || !nlNhua) throw new Error('Không tìm thấy Material "Thanh đáy nhôm/nhựa - Rèm cầu vồng RCV" theo tên trên môi trường này.');

    const items = await prisma.materialRequirementItem.findMany({
      where: {
        materialId: { in: [nlNhom.id, nlNhua.id] },
        materialRequirementVersion: { status: 'ACTIVE' },
      },
      select: {
        materialId: true,
        materialRequirementVersion: {
          select: { id: true, materialRequirement: { select: { productId: true } } },
        },
      },
    });

    const productIds = [...new Set(items.map((i) => i.materialRequirementVersion.materialRequirement.productId))];
    console.log(`Tìm thấy ${productIds.length} sản phẩm RCV cần xử lý.\n`);

    let done = 0;
    let skipped = 0;

    for (const productId of productIds) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { parameters: true },
      });
      if (!product) continue;

      const alreadyHasDay = product.parameters.some((p) => p.name === 'day');
      if (alreadyHasDay) {
        console.log(`[BỎ QUA] ${product.code} đã có tham số "day".`);
        skipped++;
        continue;
      }

      const maxOrder = Math.max(0, ...product.parameters.map((p) => p.displayOrder));

      console.log(`--- ${product.code} | ${product.name} ---`);

      await svc.createProductParameter(product.id, {
        name: 'day',
        label: 'Đáy',
        type: 'ENUM',
        isRequired: true,
        usedInPricing: false,
        usedInMaterial: true,
        displayOrder: maxOrder + 1,
        options: [
          { value: 'nhom', label: 'Đáy nhôm', displayOrder: 0 },
          { value: 'nhua', label: 'Đáy nhựa', displayOrder: 1 },
        ],
      } as any);
      console.log('  Đã thêm tham số "day" (Đáy nhôm / Đáy nhựa).');

      const activeVersion = await prisma.materialRequirementVersion.findFirst({
        where: { materialRequirement: { productId: product.id }, status: 'ACTIVE' },
      });
      if (!activeVersion) throw new Error(`${product.code}: không tìm thấy Material Requirement Version ACTIVE.`);

      const draft: any = await svc.duplicateMaterialRequirementVersion(activeVersion.id);
      console.log(`  Đã nhân bản version ACTIVE -> DRAFT v${draft.versionNumber} (${draft.id}).`);

      const itemNhom = draft.items.find((it: any) => it.materialId === nlNhom.id);
      const itemNhua = draft.items.find((it: any) => it.materialId === nlNhua.id);
      if (!itemNhom || !itemNhua) throw new Error(`${product.code}: DRAFT mới thiếu dòng NL000095/NL000140.`);

      await svc.updateMaterialRequirementItem(itemNhom.id, { condition: 'day == "nhom"' } as any);
      await svc.updateMaterialRequirementItem(itemNhua.id, { condition: 'day == "nhua"' } as any);
      console.log('  Đã đổi condition: NL000095 -> day == "nhom", NL000140 -> day == "nhua".');

      await svc.activateMaterialRequirementVersion(draft.id);
      console.log(`  Đã kích hoạt v${draft.versionNumber}.\n`);

      done++;
    }

    console.log(`\nHoàn tất. Đã xử lý: ${done}, bỏ qua (đã có sẵn): ${skipped}.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
