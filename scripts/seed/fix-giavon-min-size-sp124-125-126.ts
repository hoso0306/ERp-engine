/**
 * Thêm giá vốn (PK + công SX) và quy định kích thước tối thiểu cho 3 sản
 * phẩm "Thay/Thêm" SP000124/125/126 — mục 10 workbench/sessions/2707.md.
 * Đã áp dụng và verify trên Local (previewPrice/previewMaterial), script này
 * chỉ để tái tạo đúng thay đổi đó trên môi trường khác (VPS) — KHÔNG suy
 * diễn lại, dữ liệu lấy nguyên văn từ bản đã duyệt trên Local.
 *
 * Với mỗi sản phẩm:
 * - Material Requirement: nhân bản version ACTIVE hiện có
 *   (duplicateMaterialRequirementVersion, giữ nguyên mọi dòng cũ), thêm 2
 *   dòng vật tư mới (PK nhựa đúng số cánh + PHI_SAN_XUAT), rồi activate.
 * - Pricing Rule: nhân bản version ACTIVE hiện có
 *   (duplicatePricingRuleVersion, giữ nguyên expression/matrix/mọi dòng cũ),
 *   thêm 3 Pricing Rule Item (MIN_AREA 0.7 → MIN_AREA 1 → MIN_DIMENSION
 *   chieurong 1), rồi activate. KHÔNG đổi priceRoundType/vatRate hiện có
 *   của từng sản phẩm.
 * - Validation Rule: 3 dòng WARN tương ứng, thêm thẳng vào Product (không
 *   versioned) — copy nguyên văn từ SP000048 "[Rèm kết hợp - Kéo ngang]".
 *
 * Idempotent theo dấu hiệu: nếu Product đã có ValidationRule
 * expression="area < 0.7" thì coi như đã áp dụng, bỏ qua toàn bộ (an toàn
 * chạy lại nhiều lần, không nhân đôi version).
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/fix-giavon-min-size-sp124-125-126.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const VALIDATION_RULES = [
  { expression: 'area < 0.7', severity: 'WARN', message: 'Diện tích < 0,7m² sẽ tính bằng 0,7m²', displayOrder: 1 },
  { expression: 'area >= 0.7 && area < 1', severity: 'WARN', message: 'Diện tích từ 0,7 đến dưới 1m² sẽ tính bằng 1m²', displayOrder: 2 },
  { expression: 'area >= 1 && chieurong < 1', severity: 'WARN', message: 'Chiều rộng < 1m sẽ tính bằng 1m', displayOrder: 3 },
] as const;

const PRICING_RULE_ITEMS = [
  { ruleType: 'MIN_AREA', targetParameter: null, value: 0.7, condition: null, displayOrder: 1, description: 'Diện tích dưới 0,7m² tính bằng 0,7m².' },
  { ruleType: 'MIN_AREA', targetParameter: null, value: 1, condition: 'area >= 0.7 && area < 1', displayOrder: 2, description: 'Diện tích từ 0,7 đến dưới 1m² tính bằng 1m².' },
  { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 1, condition: 'area >= 1', displayOrder: 3, description: 'Diện tích đã >=1m²: chiều rộng dưới 1m tính bằng 1m.' },
] as const;

// SP000124/126 dùng bộ PK 1 cánh (NL000022), SP000125 dùng bộ PK 2 cánh
// (NL000023) — cả 3 đều thêm PHI_SAN_XUAT Cửa lưới - Vách tổ ong (NL000020).
const MATERIAL_ADDITIONS: Record<string, string[]> = {
  SP000124: ['NL000022', 'NL000020'],
  SP000125: ['NL000023', 'NL000020'],
  SP000126: ['NL000022', 'NL000020'],
};

let prisma: PrismaService;

async function fixProduct(svc: ProductService, code: string) {
  const product = await prisma.product.findUnique({
    where: { code },
    include: {
      validationRules: true,
      pricingRule: { include: { versions: { where: { status: 'ACTIVE' } } } },
      materialRequirement: { include: { versions: { where: { status: 'ACTIVE' } } } },
    },
  });
  if (!product) throw new Error(`Không tìm thấy sản phẩm ${code} trên môi trường này.`);

  const alreadyApplied = product.validationRules.some((r) => r.expression === 'area < 0.7');
  if (alreadyApplied) {
    console.log(`  [BỎ QUA] ${code} "${product.name}" đã có Validation Rule "area < 0.7" — coi như đã áp dụng.`);
    return;
  }

  const activeMrv = product.materialRequirement?.versions[0];
  if (!activeMrv) throw new Error(`${code}: không có Material Requirement Version ACTIVE.`);
  const activePrv = product.pricingRule?.versions[0];
  if (!activePrv) throw new Error(`${code}: không có Pricing Rule Version ACTIVE.`);

  const materialCodes = MATERIAL_ADDITIONS[code];
  const materials = await prisma.material.findMany({ where: { code: { in: materialCodes } } });

  console.log(`  Nhân bản Material Requirement Version cho ${code}...`);
  const newMrv = await svc.duplicateMaterialRequirementVersion(activeMrv.id);
  const existingItemCount = await prisma.materialRequirementItem.count({ where: { materialRequirementVersionId: newMrv!.id } });
  let displayOrder = existingItemCount + 1;
  for (const mcode of materialCodes) {
    const mat = materials.find((m) => m.code === mcode);
    if (!mat) throw new Error(`Material ${mcode} không tồn tại trên môi trường này.`);
    await svc.createMaterialRequirementItem(newMrv!.id, { materialId: mat.id, expression: '1', wastePercent: 0, displayOrder: displayOrder++ } as any);
  }
  await svc.activateMaterialRequirementVersion(newMrv!.id);

  console.log(`  Nhân bản Pricing Rule Version cho ${code}...`);
  const newPrv = await svc.duplicatePricingRuleVersion(activePrv.id);
  for (const item of PRICING_RULE_ITEMS) {
    await svc.createPricingRuleItem(newPrv!.id, item as any);
  }
  await svc.activatePricingRuleVersion(newPrv!.id);

  for (const vr of VALIDATION_RULES) {
    await svc.createValidationRule(product.id, vr as any);
  }

  console.log(`  [XONG] ${code} "${product.name}": +${materialCodes.length} dòng BOM, +3 Pricing Rule Item, +3 Validation Rule.`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    for (const code of ['SP000124', 'SP000125', 'SP000126']) {
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
