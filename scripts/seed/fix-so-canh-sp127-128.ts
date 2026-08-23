/**
 * Áp lại mục 12+13 (workbench/sessions/2707.md) lên Production cho SP000127 +
 * SP000128 — bỏ tham số "Số cánh" (socanh) + đưa Material Requirement Version
 * ACTIVE về đúng trạng thái cuối cùng đã verify trên Local (18 dòng/sản phẩm,
 * gộp cả thay đổi mục 12 lẫn mục 13). Dữ liệu ITEMS lấy nguyên văn từ Local DB
 * (ACTIVE version SP127 v5 / SP128 v4), không suy diễn lại công thức.
 *
 * An toàn theo mã: đã xác nhận riêng (11/08/2026) code SP000127/SP000128 khớp
 * đúng cùng sản phẩm giữa Local và Production (không nằm trong dải lệch mã
 * SP000129-143 đã ghi nhận trong memory product_sp_code_drift_local_prod).
 *
 * Cách làm: KHÔNG nhân bản version cũ rồi sửa từng dòng (dễ sai sót khi copy
 * tay 18 dòng công thức) — nhân bản để lấy version DRAFT mới hợp lệ, xoá sạch
 * item cũ, rồi tạo lại đúng 18 dòng theo dump đã verify, cuối cùng activate.
 * Kết quả cuối giống hệt làm tuần tự mục 12 rồi mục 13, chỉ khác đường đi.
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/fix-so-canh-sp127-128.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

type Item = {
  materialCode: string;
  expression: string;
  wastePercent: number;
  roundStep: number | undefined;
  note: string | undefined;
  displayOrder: number;
  condition: string | undefined;
};

const ITEMS: Record<string, Item[]> = {
  SP000127: [
    { materialCode: 'NL000015', expression: 'area*1.8', wastePercent: 8, roundStep: 0.0001, note: undefined, displayOrder: 1, condition: undefined },
    { materialCode: 'NL000017', expression: '4', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 2, condition: undefined },
    { materialCode: 'NL000023', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 4, condition: undefined },
    { materialCode: 'NL000020', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 5, condition: undefined },
    { materialCode: 'NL000010', expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 6, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000045', expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 7, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000024', expression: '4*chieucao', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 8, condition: undefined },
    { materialCode: 'NL000012', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 10, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000047', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 11, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000013', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 12, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000048', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 13, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000008', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 14, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000043', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 15, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000009', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 16, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000044', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 17, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000011', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 18, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000046', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 19, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000016', expression: '((chieucao-0.08)/0.4+1)*(chieucao+chieurong+0.15)', wastePercent: 0, roundStep: 1, note: undefined, displayOrder: 20, condition: undefined },
  ],
  SP000128: [
    { materialCode: 'NL000015', expression: 'area*1.8', wastePercent: 8, roundStep: 0.0001, note: undefined, displayOrder: 1, condition: undefined },
    { materialCode: 'NL000017', expression: '4', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 2, condition: undefined },
    { materialCode: 'NL000023', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 4, condition: undefined },
    { materialCode: 'NL000020', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 5, condition: undefined },
    { materialCode: 'NL000010', expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 6, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000045', expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 7, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000024', expression: '4*chieucao', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 8, condition: undefined },
    { materialCode: 'NL000012', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 10, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000047', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 11, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000013', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 12, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000048', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 13, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000025', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 14, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000049', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 15, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000026', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 16, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000050', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 17, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000027', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 18, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000051', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: 0.0001, note: undefined, displayOrder: 19, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000016', expression: '((chieucao-0.08)/0.4+1)*(chieucao+chieurong+0.15)', wastePercent: 0, roundStep: 1, note: undefined, displayOrder: 20, condition: undefined },
  ],
};

let prisma: PrismaService;

async function processProduct(svc: ProductService, code: string) {
  const items = ITEMS[code];
  const product = await prisma.product.findUnique({ where: { code } });
  if (!product) throw new Error(`Không tìm thấy Product code=${code} trên môi trường này.`);
  console.log(`\n--- ${code} "${product.name}" ---`);

  const req = await prisma.materialRequirement.findUnique({ where: { productId: product.id } });
  if (!req) throw new Error(`${code}: chưa có Material Requirement.`);
  const active = await prisma.materialRequirementVersion.findFirst({
    where: { materialRequirementId: req.id, status: 'ACTIVE' },
  });
  if (!active) throw new Error(`${code}: không tìm thấy Material Requirement Version ACTIVE.`);
  console.log(`  Version ACTIVE hiện tại: v${active.versionNumber} (${active.id})`);

  const materialCodes = Array.from(new Set(items.map((it) => it.materialCode)));
  const materials = await prisma.material.findMany({ where: { code: { in: materialCodes } }, select: { id: true, code: true } });
  const materialIdByCode: Record<string, string> = {};
  for (const c of materialCodes) {
    const m = materials.find((r) => r.code === c);
    if (!m) throw new Error(`${code}: Material ${c} không tồn tại trên môi trường này.`);
    materialIdByCode[c] = m.id;
  }

  const dup = await svc.duplicateMaterialRequirementVersion(active.id);
  console.log(`  Nhân bản thành DRAFT v${dup!.versionNumber} (${dup!.id})`);
  for (const it of dup!.items) {
    await svc.deleteMaterialRequirementItem(it.id);
  }
  console.log(`  Đã xoá ${dup!.items.length} item cũ trong DRAFT.`);

  for (const it of items) {
    await svc.createMaterialRequirementItem(dup!.id, {
      materialId: materialIdByCode[it.materialCode],
      expression: it.expression,
      wastePercent: it.wastePercent,
      roundStep: it.roundStep,
      note: it.note,
      displayOrder: it.displayOrder,
      condition: it.condition,
    } as any);
  }
  console.log(`  Đã tạo ${items.length} item mới.`);

  await svc.activateMaterialRequirementVersion(dup!.id);
  console.log(`  Đã kích hoạt v${dup!.versionNumber}.`);

  const socanh = await prisma.productParameter.findFirst({ where: { productId: product.id, name: 'socanh' } });
  if (socanh) {
    await svc.deleteProductParameter(socanh.id);
    console.log('  Đã xoá tham số "Số cánh" (socanh).');
  } else {
    console.log('  [BỎ QUA] Không còn tham số "socanh" (đã xoá từ trước).');
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    for (const code of Object.keys(ITEMS)) {
      await processProduct(svc, code);
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
