/**
 * Tạo sản phẩm "Thêm/Thay vải Cuốn Lưới" (SP000140) — mục ⑪ phiếu tay khách
 * hàng: tính giá khi khách đã có bộ Rèm cuốn lưới (SP000097) rồi, chỉ muốn
 * thay vải. Xem workbench/sessions/2707.md mục 15 để biết đầy đủ bối cảnh.
 * Matrix lưu giá GỐC 100% (y hệt SP000097), hệ số 60% nằm trong expression
 * `unitPrice * area * 0.6` — không tự đồng bộ nếu SP000097 đổi giá sau này.
 *
 * TRƯỚC KHI tạo Product, script tự sửa luôn SP000097 "Rèm cuốn lưới": thêm
 * mã `SVC35` còn thiếu trong dropdown tham số `marem` (Price Matrix và
 * Material Requirement của SP000097 vốn đã tham chiếu SVC35 từ trước — sai
 * sót nhập liệu cũ, không phải do phiên tạo sản phẩm này gây ra). An toàn
 * chạy lại nhiều lần — nếu dropdown đã đủ 6 mã thì bỏ qua bước sửa.
 *
 * Idempotent theo tên sản phẩm. Yêu cầu VPS đã có ProductType "Rèm cuốn",
 * Unit "m²", Xưởng Cầu Vồng (XW004), Material NL000211/NL000212, và Product
 * SP000097 "Rèm cuốn lưới" (để sửa dropdown `marem`).
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-them-thay-cuon-luoi.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = "Rèm cuốn";
const UNIT_NAME = "m²";
const PRODUCTION_CENTER_CODE = "XW004";
const PRODUCT_NAME = "Thêm/Thay vải Cuốn Lưới";

const MATRIX_ROWS: { dimensions: Record<string, string>; unitPrice: number; displayOrder: number }[] = [
    { dimensions: {"mangremcuon":"mangdet"}, unitPrice: 480000, displayOrder: 0 },
    { dimensions: {"mangremcuon":"mangchesang"}, unitPrice: 520000, displayOrder: 1 },
    { dimensions: {"mangremcuon":"mangcauvong"}, unitPrice: 570000, displayOrder: 2 },
];

const BOM_ITEMS: { materialCode: string; expression: string; wastePercent: number; condition: string | undefined; note: string | undefined; displayOrder: number }[] = [
    { materialCode: "NL000211", expression: "dientichvai", wastePercent: 0, condition: "marem == \"SVC30\" || marem == \"SVC31\" || marem == \"SVC32\" || marem == \"SVC34\" || marem == \"SVC35\"", note: undefined, displayOrder: 1 },
    { materialCode: "NL000212", expression: "dientichvai", wastePercent: 0, condition: "marem == \"SVC33\"", note: undefined, displayOrder: 2 },
];

// Danh sách ĐẦY ĐỦ 6 mã — updateProductParameter thay TOÀN BỘ options, phải
// liệt kê đủ cả 6 mã, không phải chỉ thêm SVC35 riêng lẻ.
const SP000097_MAREM_OPTIONS = [
  { value: 'SVC30', label: 'SVC30', displayOrder: 0 },
  { value: 'SVC31', label: 'SVC31', displayOrder: 1 },
  { value: 'SVC32', label: 'SVC32', displayOrder: 2 },
  { value: 'SVC33', label: 'SVC33', displayOrder: 3 },
  { value: 'SVC34', label: 'SVC34', displayOrder: 4 },
  { value: 'SVC35', label: 'SVC35', displayOrder: 5 },
];

let prisma: PrismaService;

async function fixSp000097MaremOptions(svc: ProductService) {
  const product = await prisma.product.findFirst({ where: { code: 'SP000097', deletedAt: null } });
  if (!product) throw new Error('Không tìm thấy SP000097 "Rèm cuốn lưới" trên môi trường này.');
  const marem = await prisma.productParameter.findFirst({ where: { productId: product.id, name: 'marem' }, include: { options: true } });
  if (!marem) throw new Error('SP000097 không có tham số "marem".');
  if (marem.options.length >= 6 && marem.options.some((o) => o.value === 'SVC35')) {
    console.log('  [BỎ QUA] SP000097: dropdown "marem" đã có đủ 6 mã (SVC30-35).');
    return;
  }
  await svc.updateProductParameter(marem.id, { options: SP000097_MAREM_OPTIONS } as any);
  console.log('  [ĐÃ SỬA] SP000097: dropdown "marem" cập nhật đủ 6 mã SVC30-35 (thêm SVC35 còn thiếu).');
}

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

    console.log('\n--- Sửa dropdown "marem" của SP000097 (thêm SVC35 còn thiếu) ---');
    await fixSp000097MaremOptions(svc);

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
  await svc.createProductParameter(product.id, { name: "marem", label: "Mã rèm", type: "ENUM", isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: 3, options: [
      { value: "SVC30", label: "SVC30", displayOrder: 0 },
      { value: "SVC31", label: "SVC31", displayOrder: 1 },
      { value: "SVC32", label: "SVC32", displayOrder: 2 },
      { value: "SVC33", label: "SVC33", displayOrder: 3 },
      { value: "SVC34", label: "SVC34", displayOrder: 4 },
      { value: "SVC35", label: "SVC35", displayOrder: 5 },
    ] } as any);
  await svc.createProductParameter(product.id, { name: "mangremcuon", label: "Loại máng", type: "ENUM", isRequired: true, usedInPricing: true, usedInMaterial: false, displayOrder: 4, options: [
      { value: "mangdet", label: "Máng Dẹt", displayOrder: 0 },
      { value: "mangchesang", label: "Máng che sáng", displayOrder: 1 },
      { value: "mangcauvong", label: "Máng cầu vồng", displayOrder: 2 },
    ] } as any);

  await svc.createDerivedParameter(product.id, { name: "area", expression: "chieurong * chieucao", unit: "m2", displayOrder: 1 } as any);
  await svc.createDerivedParameter(product.id, { name: "dientichvai", expression: "(chieurong-0.02)*(chieucao+0.1)", unit: "m2", displayOrder: 2 } as any);

  await svc.createValidationRule(product.id, { expression: "chieucao < 1", severity: "WARN", message: "Chiều cao < 1m sẽ tính bằng 1m", displayOrder: 2 } as any);
  await svc.createValidationRule(product.id, { expression: "area < 1", severity: "WARN", message: "Diện tích < 1m² sẽ tính bằng 1m²", displayOrder: 1 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, { name: "v1", expression: "unitPrice * area * 0.6", priceRoundType: "CEIL", priceRoundValue: 100, vatRate: 10, note: "unitPrice trong matrix là giá GỐC 100% (y hệt SP000097 \"Rèm cuốn lưới\"), hệ số 60% nằm trong expression. Nếu SP000097 đổi giá theo mangremcuon, PHẢI cập nhật lại đúng dòng ở đây (không có cơ chế tự đồng bộ giữa 2 sản phẩm)." } as any);
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
