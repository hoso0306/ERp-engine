/**
 * Áp lại mục 14 (workbench/sessions/2707.md) lên Production — bỏ tham số
 * "Số cánh" (socanh) + đưa Material Requirement Version ACTIVE về đúng trạng
 * thái cuối cùng đã verify trên Local cho 2 sản phẩm "Rèm tổ ong Trượt tự do"
 * Hệ 27/30 (30 dòng/sản phẩm). Dữ liệu ITEMS lấy nguyên văn từ Local DB
 * (SP000129 v3 / SP000130 v3 ACTIVE).
 *
 * QUAN TRỌNG — resolve theo TÊN sản phẩm, KHÔNG theo mã code: đã xác nhận
 * (11/08/2026, xem memory product_sp_code_drift_local_prod) trên Production
 * mã SP000129/130 trỏ tới sản phẩm KHÁC ("Cửa lưới trượt tự do ghép cánh").
 * Sản phẩm "Rèm tổ ong Trượt tự do" thật trên Production nằm ở mã
 * SP000131/132 — đã xác nhận (kiểm tra riêng qua SSH) 2 mã này còn tham số
 * "socanh", 0 báo giá nào tham chiếu, không còn expression nào khác (Pricing/
 * Validation/Derived) tham chiếu socanh — an toàn để áp thay đổi.
 *
 * Cách làm: giống fix-so-canh-sp127-128.ts — nhân bản version ACTIVE thành
 * DRAFT, xoá sạch item cũ, tạo lại đúng 30 dòng theo dump đã verify, activate.
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/fix-so-canh-rem-to-ong.ts
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

// Khớp tên sản phẩm THẬT (không dùng code — xem cảnh báo lệch mã ở đầu file).
const ITEMS: Record<string, Item[]> = {
  '[Rèm tổ ong Trượt tự do] Hệ 27': [
    { materialCode: 'NL000020', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000023', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000030', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'marem == "G001"' },
    { materialCode: 'NL000047', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000013', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000048', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000008', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000043', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000009', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000044', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000011', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000046', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000017', expression: '4', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000010', expression: '(chieucao-0.005)*0.09*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000045', expression: '(chieucao-0.005)*0.09*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000024', expression: '4*chieucao', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000012', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000031', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 1, condition: 'marem == "G002"' },
    { materialCode: 'NL000032', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 2, condition: 'marem == "G003"' },
    { materialCode: 'NL000033', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 3, condition: 'marem == "G004"' },
    { materialCode: 'NL000034', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 4, condition: 'marem == "G005"' },
    { materialCode: 'NL000035', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 5, condition: 'marem == "G006"' },
    { materialCode: 'NL000036', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 6, condition: 'marem == "G007"' },
    { materialCode: 'NL000037', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 7, condition: 'marem == "G008"' },
    { materialCode: 'NL000038', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 8, condition: 'marem == "DX0202"' },
    { materialCode: 'NL000039', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 9, condition: 'marem == "DX0206"' },
    { materialCode: 'NL000040', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 10, condition: 'marem == "DX0502"' },
    { materialCode: 'NL000041', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 11, condition: 'marem == "tranh1mat"' },
    { materialCode: 'NL000042', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 12, condition: 'marem == "tranh2mat"' },
    { materialCode: 'NL000016', expression: '((chieucao-0.08)/0.4+1)*(chieucao+chieurong+0.15)', wastePercent: 0, roundStep: 1, note: undefined, displayOrder: 13, condition: undefined },
  ],
  '[Rèm tổ ong Trượt tự do] Hệ 30': [
    { materialCode: 'NL000020', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000047', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000013', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000048', expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000025', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000049', expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000026', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000050', expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000027', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000051', expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000030', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'marem == "G001"' },
    { materialCode: 'NL000017', expression: '4', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000023', expression: '1', wastePercent: 0, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000010', expression: '(chieucao-0.005)*0.09*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000045', expression: '(chieucao-0.005)*0.09*2', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung == "van_go"' },
    { materialCode: 'NL000024', expression: '4*chieucao', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: undefined },
    { materialCode: 'NL000012', expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: undefined, note: undefined, displayOrder: 0, condition: 'maukhung != "van_go"' },
    { materialCode: 'NL000031', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 1, condition: 'marem == "G002"' },
    { materialCode: 'NL000032', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 2, condition: 'marem == "G003"' },
    { materialCode: 'NL000033', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 3, condition: 'marem == "G004"' },
    { materialCode: 'NL000034', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 4, condition: 'marem == "G005"' },
    { materialCode: 'NL000035', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 5, condition: 'marem == "G006"' },
    { materialCode: 'NL000036', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 6, condition: 'marem == "G007"' },
    { materialCode: 'NL000037', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 7, condition: 'marem == "G008"' },
    { materialCode: 'NL000038', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 8, condition: 'marem == "DX0202"' },
    { materialCode: 'NL000039', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 9, condition: 'marem == "DX0206"' },
    { materialCode: 'NL000040', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 10, condition: 'marem == "DX0502"' },
    { materialCode: 'NL000041', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 11, condition: 'marem == "tranh1mat"' },
    { materialCode: 'NL000042', expression: 'area*1.5', wastePercent: 8, roundStep: undefined, note: undefined, displayOrder: 12, condition: 'marem == "tranh2mat"' },
    { materialCode: 'NL000016', expression: '((chieucao-0.08)/0.4+1)*(chieucao+chieurong+0.15)', wastePercent: 0, roundStep: 1, note: undefined, displayOrder: 13, condition: undefined },
  ],
};

let prisma: PrismaService;

async function processProduct(svc: ProductService, productName: string) {
  const items = ITEMS[productName];
  const product = await prisma.product.findFirst({ where: { name: productName, deletedAt: null } });
  if (!product) throw new Error(`Không tìm thấy Product tên="${productName}" trên môi trường này.`);
  console.log(`\n--- ${product.code} "${product.name}" ---`);

  const req = await prisma.materialRequirement.findUnique({ where: { productId: product.id } });
  if (!req) throw new Error(`${productName}: chưa có Material Requirement.`);
  const active = await prisma.materialRequirementVersion.findFirst({
    where: { materialRequirementId: req.id, status: 'ACTIVE' },
  });
  if (!active) throw new Error(`${productName}: không tìm thấy Material Requirement Version ACTIVE.`);
  console.log(`  Version ACTIVE hiện tại: v${active.versionNumber} (${active.id})`);

  const materialCodes = Array.from(new Set(items.map((it) => it.materialCode)));
  const materials = await prisma.material.findMany({ where: { code: { in: materialCodes } }, select: { id: true, code: true } });
  const materialIdByCode: Record<string, string> = {};
  for (const c of materialCodes) {
    const m = materials.find((r) => r.code === c);
    if (!m) throw new Error(`${productName}: Material ${c} không tồn tại trên môi trường này.`);
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
    for (const name of Object.keys(ITEMS)) {
      await processProduct(svc, name);
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
