/**
 * Tạo sản phẩm "Rèm cuốn tranh" — bản sao cấu trúc của SP000096 "Rèm cuốn
 * trơn", chỉ khác: marem chỉ 1 option "Vải in tranh" (thay vì 18 mã SVC), vải
 * dùng vật tư mới (không dùng chung NL000204), giá bán riêng theo mangremcuon.
 * Các vật tư khác (máng/đáy/ống/dây kéo/phụ kiện) DÙNG CHUNG với Rèm cuốn
 * trơn (NL000198-NL000203, NL000205-NL000210).
 *
 * Giá bán KHÔNG phụ thuộc daykeo/ben/day nên các tham số này để
 * usedInPricing=false (chỉ usedInMaterial=true, vẫn dùng trong BOM) — theo
 * chỉ đạo người dùng 2026-08-12: tắt cờ usedInPricing ở tham số không ảnh
 * hưởng giá thay vì lưu matrix rút gọn thủ công. Matrix chỉ sinh từ ENUM còn
 * usedInPricing=true (marem x mangremcuon = 1x3 = 3 dòng), qua đúng tích
 * Descartes mà exportPriceMatrixTemplate/FE dùng — nên vẫn hiển thị đúng lưới
 * trên màn Bảng giá, không có dòng thừa/thiếu.
 *
 * Idempotent theo tên sản phẩm. Yêu cầu local đã có ProductType "Rèm cuốn",
 * Unit "m²", Xưởng Cầu Vồng (XW004), và các Material NL000198-NL000203,
 * NL000205-NL000210 (dùng chung với SP000096).
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-rem-cuon-tranh.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Rèm cuốn';
const UNIT_NAME = 'm²';
const PRODUCTION_CENTER_CODE = 'XW004';
const PRODUCT_NAME = 'Rèm cuốn tranh';
const NEW_MATERIAL_NAME = 'Vải in tranh - Rèm cuốn tranh';

// Tra theo TÊN, không theo mã — mã NL của các vật tư dùng chung có thể lệch
// giữa local/VPS (xem memory "SP code drift local↔prod"), tên thì ổn định.
const SHARED_MATERIAL_NAMES: Record<string, string> = {
  MANG_DET: 'Rèm cuốn - Máng dẹt',
  MANG_CHE_SANG: 'Rèm cuốn - Máng che sáng',
  MANG_CAU_VONG: 'Rèm cuốn - Máng cầu vồng',
  DAY_TRON: 'Rèm cuốn - Đáy tròn',
  DAY_OVAL: 'Rèm cuốn - Đáy Oval',
  DAY_NHUA: 'Rèm cuốn - Đáy nhựa',
  ONG_PHI28: 'Rèm cuốn - Ống cuốn phi28 không sơn',
  ONG_PHI38: 'Rèm cuốn - Ống cuốn phi38 không sơn',
  DAYKEO_DU: 'Rèm cuốn - Dây kéo dù',
  DAYKEO_HAT: 'Rèm cuốn - Dây kéo hạt',
  PK_PHI28: 'Rèm cuốn - Bộ PK (đầu kéo+bát chụp) phi28',
  PK_PHI38: 'Rèm cuốn - Bộ PK (đầu kéo+bát chụp) phi 38',
};

const PRICE_BY_MANG: Record<string, number> = {
  mangdet: 240000,
  mangchesang: 250000,
  mangcauvong: 270000,
};

// ENUM usedInPricing=true (theo đúng thứ tự displayOrder tạo bên dưới) —
// daykeo/ben/day KHÔNG có trong danh sách này vì không ảnh hưởng giá bán.
const ENUM_OPTIONS_FOR_PRICING: { name: string; values: string[] }[] = [
  { name: 'marem', values: ['tranh'] },
  { name: 'mangremcuon', values: ['mangdet', 'mangchesang', 'mangcauvong'] },
];

function buildMatrixRows(): { dimensions: Record<string, string>; unitPrice: number; displayOrder: number }[] {
  let combos: Record<string, string>[] = [{}];
  for (const param of ENUM_OPTIONS_FOR_PRICING) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const value of param.values) next.push({ ...combo, [param.name]: value });
    }
    combos = next;
  }
  return combos.map((dimensions, displayOrder) => ({
    dimensions,
    unitPrice: PRICE_BY_MANG[dimensions.mangremcuon],
    displayOrder,
  }));
}

const MATRIX_ROWS = buildMatrixRows();

let prisma: PrismaService;

async function resolveByName(model: 'productType' | 'unit', name: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { name } });
  if (!row) throw new Error(`Không tìm thấy ${model} với name="${name}" trên môi trường này.`);
  return row.id;
}

async function resolveByCode(model: 'productionCenter', code: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { code } });
  if (!row) throw new Error(`Không tìm thấy ${model} với code="${code}" trên môi trường này.`);
  return row.id;
}

async function resolveMaterialIdsByName(namesByKey: Record<string, string>): Promise<Record<string, string>> {
  const names = Object.values(namesByKey);
  const rows = await prisma.material.findMany({ where: { name: { in: names }, isActive: true }, select: { id: true, code: true, name: true } });
  const map: Record<string, string> = {};
  for (const [key, name] of Object.entries(namesByKey)) {
    const m = rows.find((r) => r.name === name);
    if (!m) throw new Error(`Material "${name}" không tồn tại trên môi trường này.`);
    map[key] = m.id;
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

    console.log(`\n--- Tạo Material "${NEW_MATERIAL_NAME}" ---`);
    let material = await prisma.material.findFirst({ where: { name: NEW_MATERIAL_NAME, isActive: true } });
    if (material) {
      console.log(`  [BỎ QUA] Material đã tồn tại (${material.code}).`);
    } else {
      material = await svc.createMaterial({ name: NEW_MATERIAL_NAME, unitId } as any);
      console.log(`  Tạo ${material.code} "${NEW_MATERIAL_NAME}"`);
      await svc.createMaterialPrice(material.id, {
        price: 95000,
        effectiveFrom: new Date().toISOString(),
        isDefault: true,
        note: 'Giá nhập khởi tạo khi tạo sản phẩm Rèm cuốn tranh',
      } as any);
      console.log('  Tạo giá nhập mặc định: 95.000đ/m²');
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId, productionCenterId } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
    await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
    await svc.createProductParameter(product.id, { name: 'marem', label: 'Mã rèm', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3, options: [
      { value: 'tranh', label: 'Vải in tranh', displayOrder: 0 },
    ] } as any);
    await svc.createProductParameter(product.id, { name: 'mangremcuon', label: 'Loại máng', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 4, options: [
      { value: 'mangdet', label: 'Máng Dẹt', displayOrder: 0 },
      { value: 'mangchesang', label: 'Máng che sáng', displayOrder: 1 },
      { value: 'mangcauvong', label: 'Máng cầu vồng', displayOrder: 2 },
    ] } as any);
    await svc.createProductParameter(product.id, { name: 'daykeo', label: 'Dây kéo', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: 5, options: [
      { value: 'hat', label: 'Hạt', displayOrder: 0 },
      { value: 'du', label: 'Dù', displayOrder: 1 },
    ] } as any);
    await svc.createProductParameter(product.id, { name: 'ben', label: 'Bên', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: 6, options: [
      { value: 'trai', label: 'Trái', displayOrder: 0 },
      { value: 'phai', label: 'Phải', displayOrder: 1 },
    ] } as any);
    await svc.createProductParameter(product.id, { name: 'day', label: 'Đáy', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: 7, options: [
      { value: 'tron', label: 'Tròn', displayOrder: 0 },
      { value: 'oval', label: 'Oval', displayOrder: 1 },
      { value: 'nhua', label: 'Nhựa', displayOrder: 2 },
    ] } as any);

    await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);
    await svc.createDerivedParameter(product.id, { name: 'dientichvai', expression: '(chieurong-0.02)*(chieucao+0.1)', unit: 'm2', displayOrder: 2 } as any);

    await svc.createValidationRule(product.id, { expression: 'area < 1', severity: 'WARN', message: 'Diện tích < 1m² sẽ tính bằng 1m²', displayOrder: 1 } as any);
    await svc.createValidationRule(product.id, { expression: 'chieucao < 1', severity: 'WARN', message: 'Chiều cao < 1m sẽ tính bằng 1m', displayOrder: 2 } as any);

    console.log('  Tạo Pricing Rule Version...');
    const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'unitPrice * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 10, note: 'Giá chỉ phân biệt theo mangremcuon — daykeo/ben/day đã tắt usedInPricing nên không tham gia Bảng giá.' } as any);
    await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', targetParameter: undefined, value: 1, condition: undefined, displayOrder: 1, description: 'Bộ rèm có diện tích nhỏ hơn 1m² tính bằng 1m². (theo quy tắc Rèm cuốn trơn)' } as any);
    await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieucao', value: 1, condition: undefined, displayOrder: 2, description: 'Bộ rèm trên 1m² có chiều cao thấp hơn 1m tính bằng 1m. (theo quy tắc Rèm cuốn trơn)' } as any);
    await svc.updatePriceMatrix(prv.id, MATRIX_ROWS);
    await svc.activatePricingRuleVersion(prv.id);
    console.log(`  Xong (${MATRIX_ROWS.length} dòng giá)`);

    console.log('  Tạo Material Requirement Version (BOM)...');
    const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
    const M = await resolveMaterialIdsByName(SHARED_MATERIAL_NAMES);

    let order = 1;
    await svc.createMaterialRequirementItem(mrv.id, { materialId: material.id, expression: 'dientichvai', wastePercent: 0, condition: undefined, note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['MANG_DET'], expression: 'chieurong*0.239', wastePercent: 0, condition: 'mangremcuon == "mangdet"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['MANG_CHE_SANG'], expression: 'chieurong*0.388', wastePercent: 0, condition: 'mangremcuon == "mangchesang"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['MANG_CAU_VONG'], expression: 'chieurong*0.45', wastePercent: 0, condition: 'mangremcuon == "mangcauvong"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['DAY_TRON'], expression: 'chieurong*0.17', wastePercent: 0, condition: 'day == "tron"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['DAY_OVAL'], expression: 'chieurong*0.239', wastePercent: 0, condition: 'day == "oval"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['DAY_NHUA'], expression: 'chieurong', wastePercent: 0, condition: 'day == "nhua"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['ONG_PHI28'], expression: 'chieurong*0.19', wastePercent: 0, condition: 'chieurong < 1.6', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['ONG_PHI38'], expression: 'chieurong*0.263', wastePercent: 0, condition: 'chieurong >= 1.6', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['DAYKEO_DU'], expression: 'chieucao*2', wastePercent: 0, condition: 'daykeo == "du"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['DAYKEO_HAT'], expression: 'chieucao*2', wastePercent: 0, condition: 'daykeo == "hat"', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['PK_PHI28'], expression: '1', wastePercent: 0, condition: 'chieurong < 1.6', note: undefined, displayOrder: order++ } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M['PK_PHI38'], expression: '1', wastePercent: 0, condition: 'chieurong >= 1.6', note: undefined, displayOrder: order++ } as any);
    await svc.activateMaterialRequirementVersion(mrv.id);
    console.log(`  Xong (${order - 1} dòng BOM)`);

    await svc.updateProductStatus(product.id, 'ACTIVE');
    console.log(`\n=== DONE: ${product.code} "${PRODUCT_NAME}" ===`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
