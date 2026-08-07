/**
 * Tạo sản phẩm "Thêm/Thay vải Cuốn Trơn" (SP000139) — mục ⑩ phiếu tay khách
 * hàng: tính giá khi khách đã có bộ Rèm cuốn trơn (SP000096) rồi, chỉ muốn
 * thay vải. Xem workbench/sessions/2707.md mục 14 để biết đầy đủ bối cảnh.
 * Matrix lưu giá GỐC 100% (y hệt SP000096), hệ số 60% nằm trong expression
 * `unitPrice * area * 0.6` — không tự đồng bộ nếu SP000096 đổi giá sau này.
 *
 * Idempotent theo tên sản phẩm. Yêu cầu VPS đã có ProductType "Rèm cuốn",
 * Unit "m²", Xưởng Cầu Vồng (XW004), Material NL000204.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-them-thay-cuon-tron.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = "Rèm cuốn";
const UNIT_NAME = "m²";
const PRODUCTION_CENTER_CODE = "XW004";
const PRODUCT_NAME = "Thêm/Thay vải Cuốn Trơn";

const MATRIX_ROWS: { dimensions: Record<string, string>; unitPrice: number; displayOrder: number }[] = [
    { dimensions: {"mangremcuon":"mangdet"}, unitPrice: 370000, displayOrder: 0 },
    { dimensions: {"mangremcuon":"mangchesang"}, unitPrice: 380000, displayOrder: 1 },
    { dimensions: {"mangremcuon":"mangcauvong"}, unitPrice: 410000, displayOrder: 2 },
];

const BOM_ITEMS: { materialCode: string; expression: string; wastePercent: number; condition: string | undefined; note: string | undefined; displayOrder: number }[] = [
    { materialCode: "NL000204", expression: "dientichvai", wastePercent: 0, condition: undefined, note: undefined, displayOrder: 1 },
];

let prisma: PrismaService;

async function resolveByName(model: 'productType' | 'unit', name: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { name } });
  if (!row) throw new Error(`Không tìm thấy ${model} với name="${name}" trên môi trường này — kiểm tra lại Master Data trước khi chạy script.`);
  return row.id;
}

async function resolveByCode(model: 'productionCenter', code: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { code } });
  if (!row) throw new Error(`Không tìm thấy ${model} với code="${code}" trên môi trường này — kiểm tra lại Master Data trước khi chạy script.`);
  return row.id;
}

async function resolveMaterialIds(codes: string[]): Promise<Record<string, string>> {
  const rows = await prisma.material.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const map: Record<string, string> = {};
  for (const c of codes) {
    const m = rows.find((r) => r.code === c);
    if (!m) throw new Error(`Material ${c} không tồn tại trên môi trường này.`);
    map[c] = m.id;
  }
  return map;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    console.log('Tra cứu Master Data tham chiếu...');
    const productTypeId = await resolveByName('productType', PRODUCT_TYPE_NAME);
    const unitId = await resolveByName('unit', UNIT_NAME);
    const productionCenterId = await resolveByCode('productionCenter', PRODUCTION_CENTER_CODE);

    const existing = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (existing) {
      console.log(`\n[BỎ QUA] Product "${PRODUCT_NAME}" đã tồn tại (${existing.code}).`);
      return;
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);

  const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

  await svc.createProductParameter(product.id, { name: "chieurong", label: "Chiều rộng", type: "NUMBER", unit: "m", isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: "chieucao", label: "Chiều cao", type: "NUMBER", unit: "m", isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, { name: "marem", label: "Mã rèm", type: "ENUM", isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 3, options: [
      { value: "SVC01", label: "SVC01", displayOrder: 0 },
      { value: "SVC02", label: "SVC02", displayOrder: 1 },
      { value: "SVC03", label: "SVC03", displayOrder: 2 },
      { value: "SVC04", label: "SVC04", displayOrder: 3 },
      { value: "SVC05", label: "SVC05", displayOrder: 4 },
      { value: "SVC06", label: "SVC06", displayOrder: 5 },
      { value: "SVC07", label: "SVC07", displayOrder: 6 },
      { value: "SVC08", label: "SVC08", displayOrder: 7 },
      { value: "SVC09", label: "SVC09", displayOrder: 8 },
      { value: "SVC10", label: "SVC10", displayOrder: 9 },
      { value: "SVC11", label: "SVC11", displayOrder: 10 },
      { value: "SVC12", label: "SVC12", displayOrder: 11 },
      { value: "SVC13", label: "SVC13", displayOrder: 12 },
      { value: "SVC14", label: "SVC14", displayOrder: 13 },
      { value: "SVC15", label: "SVC15", displayOrder: 14 },
      { value: "SVC16", label: "SVC16", displayOrder: 15 },
      { value: "SVC17", label: "SVC17", displayOrder: 16 },
      { value: "SVC18", label: "SVC18", displayOrder: 17 },
    ] } as any);
  await svc.createProductParameter(product.id, { name: "mangremcuon", label: "Loại máng", type: "ENUM", isRequired: true, usedInPricing: true, usedInMaterial: false, displayOrder: 4, options: [
      { value: "mangdet", label: "Máng Dẹt", displayOrder: 0 },
      { value: "mangchesang", label: "Máng che sáng", displayOrder: 1 },
      { value: "mangcauvong", label: "Máng cầu vồng", displayOrder: 2 },
    ] } as any);

  await svc.createDerivedParameter(product.id, { name: "area", expression: "chieurong * chieucao", unit: "m2", displayOrder: 1 } as any);
  await svc.createDerivedParameter(product.id, { name: "dientichvai", expression: "(chieurong-0.02)*(chieucao+0.1)", unit: "m2", displayOrder: 2 } as any);

  await svc.createValidationRule(product.id, { expression: "area < 1", severity: "WARN", message: "Diện tích < 1m² sẽ tính bằng 1m²", displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: "chieucao < 1", severity: "WARN", message: "Chiều cao < 1m sẽ tính bằng 1m", displayOrder: 2 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, { name: "v1", expression: "unitPrice * area * 0.6", priceRoundType: "CEIL", priceRoundValue: 100, vatRate: 10, note: "unitPrice trong matrix là giá GỐC 100% (y hệt SP000096 \"Rèm cuốn trơn\"), hệ số 60% nằm trong expression. Nếu SP000096 đổi giá theo mangremcuon, PHẢI cập nhật lại đúng dòng ở đây (không có cơ chế tự đồng bộ giữa 2 sản phẩm)." } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: "MIN_AREA", targetParameter: undefined, value: 1, condition: undefined, displayOrder: 1, description: "Bộ rèm có diện tích nhỏ hơn 1m² tính bằng 1m². (suy luận theo quy tắc rèm cầu vồng)" } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: "MIN_DIMENSION", targetParameter: "chieucao", value: 1, condition: undefined, displayOrder: 2, description: "Bộ rèm trên 1m² có chiều cao thấp hơn 1m tính bằng 1m. (suy luận theo quy tắc rèm cầu vồng)" } as any);
  await svc.updatePriceMatrix(prv.id, MATRIX_ROWS);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: "v1" } as any);
  const M = await resolveMaterialIds(BOM_ITEMS.map((it) => it.materialCode));
  for (const it of BOM_ITEMS) {
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M[it.materialCode], expression: it.expression, wastePercent: it.wastePercent, condition: it.condition, note: it.note, displayOrder: it.displayOrder } as any);
  }
  await svc.activateMaterialRequirementVersion(mrv.id);
  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}. (${BOM_ITEMS.length} dòng BOM, ${MATRIX_ROWS.length} dòng giá)`);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
