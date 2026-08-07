/**
 * Tạo 8 sản phẩm dòng "Trượt tự do" (Cửa lưới + Rèm tổ ong, không ghép +
 * ghép cánh, hệ 27/30) — dùng cho deploy lên môi trường mới (VPS production)
 * sau khi đã tạo/duyệt trên Local trong phiên làm việc ghi ở
 * workbench/sessions/2707.md (mục 3, 3b, 4, 4b, 5, 5b, 6, 6b, 7).
 *
 * Idempotent theo `code` sản phẩm đã fix cứng bên dưới: nếu Product cùng
 * tên đã tồn tại thì bỏ qua (không tạo trùng), an toàn chạy lại nhiều lần.
 *
 * Tra cứu ProductType/Unit/ProductionCenter/Material theo CODE (không
 * hardcode cuid) để chạy được trên cả Local lẫn VPS miễn 2 môi trường có
 * cùng các mã tham chiếu này (đã xác nhận qua nhiều lần deploy trong dự án
 * — Local/VPS đồng bộ Master Data cơ bản).
 *
 * Chạy: (từ apps/api, đã cd đúng thư mục vì cần tsconfig-paths/register)
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     ../../scripts/seed/create-truot-tu-do-products.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

// ProductType/Unit chỉ có `name` unique (không có field `code` trong schema)
// — tra theo tên đúng chính tả hiện có trên Local. ProductionCenter/Material
// có `code` riêng nên tra theo code (ổn định hơn tên, không đổi qua các môi
// trường).
const PRODUCT_TYPE_NAME_CUA_LUOI = 'Cửa lưới chống muỗi';
const PRODUCT_TYPE_NAME_REM = 'Rèm tổ ong';
const UNIT_NAME_M2 = 'm²';
const PRODUCTION_CENTER_CODE = 'XW001';

const MAREM_CODES = [
  'G001', 'G002', 'G003', 'G004', 'G005', 'G006', 'G007', 'G008',
  'DX0202', 'DX0206', 'DX0502', 'tranh1mat', 'tranh2mat',
];
const MAREM_MATERIAL_CODE: Record<string, string> = {
  G001: 'NL000030', G002: 'NL000031', G003: 'NL000032', G004: 'NL000033',
  G005: 'NL000034', G006: 'NL000035', G007: 'NL000036', G008: 'NL000037',
  DX0202: 'NL000038', DX0206: 'NL000039', DX0502: 'NL000040',
  tranh1mat: 'NL000041', tranh2mat: 'NL000042',
};
const MAREM_DELTA_GHEP: Record<string, number> = {
  G001: 0, G002: 0, G003: 0, G004: 0, G005: 0, G006: 0, G007: 0, G008: 0,
  DX0202: 30000, DX0206: 30000, DX0502: 30000,
  tranh1mat: 130000, tranh2mat: 230000,
};
const MAUKHUNG_OPTIONS = [
  { value: 'trang', label: 'Trắng', displayOrder: 0 },
  { value: 'ghi', label: 'Ghi', displayOrder: 1 },
  { value: 'cafe', label: 'Café', displayOrder: 2 },
  { value: 'van_go', label: 'Vân gỗ', displayOrder: 3 },
];
const LOAICUA_OPTIONS = [
  { value: 'cuadi', label: 'Cửa đi', displayOrder: 0 },
  { value: 'cuaso', label: 'Cửa sổ', displayOrder: 1 },
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

async function productExists(svc: ProductService, name: string): Promise<boolean> {
  const existing = await prisma.product.findFirst({ where: { name, deletedAt: null } });
  return !!existing;
}

// ─────────────────────────────────────────────────────
// SP: [Cửa lưới trượt tự do] Hệ 27 / Hệ 30 (không ghép cánh, socanh 1/2)
// ─────────────────────────────────────────────────────
async function createCuaLuoiTruotTuDo(
  svc: ProductService,
  he: 27 | 30,
  productTypeId: string,
  unitId: string,
  productionCenterId: string,
) {
  const name = `[Cửa lưới trượt tự do] Hệ ${he}`;
  if (await productExists(svc, name)) {
    console.log(`  [BỎ QUA] "${name}" đã tồn tại.`);
    return;
  }

  const isHe27 = he === 27;
  const codes = isHe27
    ? { dungtrong: 'NL000008', dungtrongVanGo: 'NL000043', dungngoai: 'NL000009', dungngoaiVanGo: 'NL000044', thanhchay: 'NL000011', thanhchayVanGo: 'NL000046' }
    : { dungtrong: 'NL000025', dungtrongVanGo: 'NL000049', dungngoai: 'NL000026', dungngoaiVanGo: 'NL000050', thanhchay: 'NL000027', thanhchayVanGo: 'NL000051' };
  const M = await resolveMaterialIds([
    'NL000015', 'NL000017', 'NL000022', 'NL000023', 'NL000020', 'NL000010', 'NL000045',
    'NL000024', 'NL000012', 'NL000047', 'NL000013', 'NL000048',
    codes.dungtrong, codes.dungtrongVanGo, codes.dungngoai, codes.dungngoaiVanGo, codes.thanhchay, codes.thanhchayVanGo,
  ]);

  const product = await svc.createProduct({ name, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${name}"`);

  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, { name: 'maukhung', label: 'Màu khung', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3, options: MAUKHUNG_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'loaicua', label: 'Loại cửa', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 4, options: LOAICUA_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'socanh', label: 'Số cánh', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: 5, options: [{ value: '1', label: 'Mở 1 cánh', displayOrder: 0 }, { value: '2', label: 'Mở 2 cánh', displayOrder: 1 }] } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: 'chieurong < 1 || area < 2', severity: 'WARN', message: 'Kích thước tối thiểu (rộng ≥1m, diện tích ≥2m²).', displayOrder: 1 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'unitPrice * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 10 } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 1, displayOrder: 1, description: 'Chiều rộng < 1m tính bằng 1m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 2, displayOrder: 2, description: 'Diện tích < 2m² tính bằng 2m².' } as any);

  const base = isHe27 ? 360000 : 415000;
  const wood = isHe27 ? 390000 : 445000;
  await svc.updatePriceMatrix(prv.id, [
    { dimensions: { maukhung: 'trang' }, unitPrice: base, displayOrder: 0 },
    { dimensions: { maukhung: 'ghi' }, unitPrice: base, displayOrder: 1 },
    { dimensions: { maukhung: 'cafe' }, unitPrice: base, displayOrder: 2 },
    { dimensions: { maukhung: 'van_go' }, unitPrice: wood, displayOrder: 3 },
  ] as any);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
  const items: any[] = [
    { materialId: M['NL000015'], expression: 'area', wastePercent: 8, roundStep: 0.0001, displayOrder: 1 },
    { materialId: M['NL000017'], expression: '2', condition: 'socanh == "1"', displayOrder: 2 },
    { materialId: M['NL000017'], expression: '4', condition: 'socanh == "2"', displayOrder: 3 },
    { materialId: M['NL000022'], expression: '1', condition: 'socanh == "1"', displayOrder: 4 },
    { materialId: M['NL000023'], expression: '1', condition: 'socanh == "2"', displayOrder: 5 },
    { materialId: M['NL000020'], expression: '1', displayOrder: 6 },
    { materialId: M['NL000010'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 7 },
    { materialId: M['NL000045'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 8 },
    { materialId: M['NL000024'], expression: 'chieucao*2+2', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "1"', displayOrder: 9 },
    { materialId: M['NL000024'], expression: 'chieucao*4+2', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2"', displayOrder: 10 },
    { materialId: M['NL000012'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 11 },
    { materialId: M['NL000047'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 12 },
    { materialId: M['NL000013'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 13 },
    { materialId: M['NL000048'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 14 },
    { materialId: M[codes.dungtrong], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 15 },
    { materialId: M[codes.dungtrongVanGo], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 16 },
    { materialId: M[codes.dungngoai], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 17 },
    { materialId: M[codes.dungngoaiVanGo], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 18 },
    { materialId: M[codes.thanhchay], expression: 'chieucao*2*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "1" && maukhung != "van_go"', displayOrder: 19 },
    { materialId: M[codes.thanhchayVanGo], expression: 'chieucao*2*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "1" && maukhung == "van_go"', displayOrder: 20 },
    { materialId: M[codes.thanhchay], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2" && maukhung != "van_go"', displayOrder: 21 },
    { materialId: M[codes.thanhchayVanGo], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2" && maukhung == "van_go"', displayOrder: 22 },
  ];
  for (const it of items) await svc.createMaterialRequirementItem(mrv.id, it);
  await svc.activateMaterialRequirementVersion(mrv.id);
  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}.`);
}

// ─────────────────────────────────────────────────────
// SP: [Cửa lưới trượt tự do ghép cánh] Hệ 27 / Hệ 30 (socanh 2/3/4)
// ─────────────────────────────────────────────────────
async function createCuaLuoiGhepCanh(
  svc: ProductService,
  he: 27 | 30,
  productTypeId: string,
  unitId: string,
  productionCenterId: string,
) {
  const name = `[Cửa lưới trượt tự do ghép cánh] Hệ ${he}`;
  if (await productExists(svc, name)) {
    console.log(`  [BỎ QUA] "${name}" đã tồn tại.`);
    return;
  }

  const isHe27 = he === 27;
  const codes = isHe27
    ? { dungtrong: 'NL000008', dungtrongVanGo: 'NL000043', dungngoai: 'NL000009', dungngoaiVanGo: 'NL000044', thanhchay: 'NL000011', thanhchayVanGo: 'NL000046' }
    : { dungtrong: 'NL000025', dungtrongVanGo: 'NL000049', dungngoai: 'NL000026', dungngoaiVanGo: 'NL000050', thanhchay: 'NL000027', thanhchayVanGo: 'NL000051' };
  const M = await resolveMaterialIds([
    'NL000015', 'NL000017', 'NL000023', 'NL000020', 'NL000010', 'NL000045', 'NL000024',
    'NL000012', 'NL000047', 'NL000013', 'NL000048',
    codes.dungtrong, codes.dungtrongVanGo, codes.dungngoai, codes.dungngoaiVanGo, codes.thanhchay, codes.thanhchayVanGo,
  ]);

  const product = await svc.createProduct({ name, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${name}"`);

  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, { name: 'maukhung', label: 'Màu khung', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3, options: MAUKHUNG_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'loaicua', label: 'Loại cửa', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 4, options: LOAICUA_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'socanh', label: 'Số cánh', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 5, options: [{ value: '2', label: 'Ghép 2 cánh', displayOrder: 0 }, { value: '3', label: 'Ghép 3 cánh', displayOrder: 1 }, { value: '4', label: 'Ghép 4 cánh', displayOrder: 2 }] } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: 'socanh == "2" && (chieurong < 2 || area < 3)', severity: 'WARN', message: 'Ghép 2 cánh: kích thước tối thiểu (rộng ≥2m, diện tích ≥3m²).', displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: 'socanh == "3" && (chieurong < 3 || area < 4)', severity: 'WARN', message: 'Ghép 3 cánh: kích thước tối thiểu (rộng ≥3m, diện tích ≥4m²).', displayOrder: 2 } as any);
  await svc.createValidationRule(product.id, { expression: 'socanh == "4" && (chieurong < 4 || area < 5)', severity: 'WARN', message: 'Ghép 4 cánh: kích thước tối thiểu (rộng ≥4m, diện tích ≥5m²).', displayOrder: 3 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'unitPrice * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 10 } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 2, condition: 'socanh == "2"', displayOrder: 1, description: 'Ghép 2 cánh: rộng < 2m tính bằng 2m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 3, condition: 'socanh == "3"', displayOrder: 2, description: 'Ghép 3 cánh: rộng < 3m tính bằng 3m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 4, condition: 'socanh == "4"', displayOrder: 3, description: 'Ghép 4 cánh: rộng < 4m tính bằng 4m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 3, condition: 'socanh == "2"', displayOrder: 4, description: 'Ghép 2 cánh: diện tích < 3m² tính bằng 3m².' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 4, condition: 'socanh == "3"', displayOrder: 5, description: 'Ghép 3 cánh: diện tích < 4m² tính bằng 4m².' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 5, condition: 'socanh == "4"', displayOrder: 6, description: 'Ghép 4 cánh: diện tích < 5m² tính bằng 5m².' } as any);

  const bases = isHe27 ? { '2': 390000, '3': 420000, '4': 450000 } : { '2': 420000, '3': 450000, '4': 480000 };
  const matrixRows: any[] = [];
  let order = 0;
  for (const socanh of ['2', '3', '4']) {
    for (const mk of ['trang', 'ghi', 'cafe', 'van_go']) {
      const price = (bases as any)[socanh] + (mk === 'van_go' ? 30000 : 0);
      matrixRows.push({ dimensions: { socanh, maukhung: mk }, unitPrice: price, displayOrder: order++ });
    }
  }
  await svc.updatePriceMatrix(prv.id, matrixRows);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
  const items: any[] = [
    { materialId: M['NL000015'], expression: 'area', wastePercent: 8, roundStep: 0.0001, displayOrder: 1 },
    { materialId: M['NL000017'], expression: '8', condition: 'socanh == "2"', displayOrder: 2 },
    { materialId: M['NL000017'], expression: '12', condition: 'socanh == "3"', displayOrder: 3 },
    { materialId: M['NL000017'], expression: '16', condition: 'socanh == "4"', displayOrder: 4 },
    { materialId: M['NL000023'], expression: '1', displayOrder: 5 },
    { materialId: M['NL000020'], expression: '1', displayOrder: 6 },
    { materialId: M['NL000010'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 7 },
    { materialId: M['NL000045'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 8 },
    { materialId: M['NL000024'], expression: '6*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2"', displayOrder: 9 },
    { materialId: M['NL000024'], expression: '8*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "3"', displayOrder: 10 },
    { materialId: M['NL000024'], expression: '10*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "4"', displayOrder: 11 },
    { materialId: M['NL000012'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 12 },
    { materialId: M['NL000047'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 13 },
    { materialId: M['NL000013'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 14 },
    { materialId: M['NL000048'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 15 },
    { materialId: M[codes.dungtrong], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 16 },
    { materialId: M[codes.dungtrongVanGo], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 17 },
    { materialId: M[codes.dungngoai], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: 18 },
    { materialId: M[codes.dungngoaiVanGo], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: 19 },
    { materialId: M[codes.thanhchay], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2" && maukhung != "van_go"', displayOrder: 20 },
    { materialId: M[codes.thanhchayVanGo], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2" && maukhung == "van_go"', displayOrder: 21 },
    { materialId: M[codes.thanhchay], expression: 'chieucao*6*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "3" && maukhung != "van_go"', displayOrder: 22 },
    { materialId: M[codes.thanhchayVanGo], expression: 'chieucao*6*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "3" && maukhung == "van_go"', displayOrder: 23 },
    { materialId: M[codes.thanhchay], expression: 'chieucao*8*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "4" && maukhung != "van_go"', displayOrder: 24 },
    { materialId: M[codes.thanhchayVanGo], expression: 'chieucao*8*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "4" && maukhung == "van_go"', displayOrder: 25 },
  ];
  for (const it of items) await svc.createMaterialRequirementItem(mrv.id, it);
  await svc.activateMaterialRequirementVersion(mrv.id);
  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}.`);
}

// ─────────────────────────────────────────────────────
// SP: [Rèm tổ ong Trượt tự do] Hệ 27 / Hệ 30 (không ghép cánh, socanh 1/2)
// — tái tạo đúng theo cấu hình hiện có trên Local (do phiên song song tạo,
//   06/08/2026), ĐÃ áp fix bỏ hệ số Rèm (mục 7, 07/08/2026).
// ─────────────────────────────────────────────────────
async function createRemTruotTuDo(
  svc: ProductService,
  he: 27 | 30,
  productTypeId: string,
  unitId: string,
  productionCenterId: string,
) {
  const name = `[Rèm tổ ong Trượt tự do] Hệ ${he}`;
  if (await productExists(svc, name)) {
    console.log(`  [BỎ QUA] "${name}" đã tồn tại.`);
    return;
  }

  const isHe27 = he === 27;
  const codes = isHe27
    ? { dungtrong: 'NL000008', dungtrongVanGo: 'NL000043', dungngoai: 'NL000009', dungngoaiVanGo: 'NL000044', thanhchay: 'NL000011', thanhchayVanGo: 'NL000046' }
    : { dungtrong: 'NL000025', dungtrongVanGo: 'NL000049', dungngoai: 'NL000026', dungngoaiVanGo: 'NL000050', thanhchay: 'NL000027', thanhchayVanGo: 'NL000051' };
  const M = await resolveMaterialIds([
    'NL000017', 'NL000023', 'NL000020', 'NL000010', 'NL000045', 'NL000024',
    'NL000012', 'NL000047', 'NL000013', 'NL000048',
    codes.dungtrong, codes.dungtrongVanGo, codes.dungngoai, codes.dungngoaiVanGo, codes.thanhchay, codes.thanhchayVanGo,
    ...Object.values(MAREM_MATERIAL_CODE),
  ]);

  const product = await svc.createProduct({ name, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${name}"`);

  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, { name: 'marem', label: 'Mã rèm', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3, options: MAREM_CODES.map((v, i) => ({ value: v, label: v === 'tranh1mat' ? 'In tranh 1 mặt' : v === 'tranh2mat' ? 'In tranh 2 mặt' : v, displayOrder: i })) } as any);
  await svc.createProductParameter(product.id, { name: 'maukhung', label: 'Màu khung', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 4, options: MAUKHUNG_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'loaicua', label: 'Loại cửa', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 5, options: LOAICUA_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'socanh', label: 'Số cánh', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: 6, options: [{ value: '1', label: '1', displayOrder: 0 }, { value: '2', label: '2', displayOrder: 1 }] } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm²', displayOrder: 0 } as any);
  await svc.createValidationRule(product.id, { expression: 'chieurong < 1', severity: 'WARN', message: 'Chiều rộng nhỏ hơn 1m, hệ thống sẽ tính giá theo 1m.', displayOrder: 0 } as any);
  await svc.createValidationRule(product.id, { expression: 'area < 2', severity: 'WARN', message: 'Diện tích nhỏ hơn 2m², hệ thống sẽ tính giá theo 2m².', displayOrder: 1 } as any);

  // Đúng cấu hình gốc: priceRoundType NONE, vatRate 0 (khác nhóm Cửa lưới
  // do phiên tạo SP000129/130 chọn khác — giữ nguyên, không tự ý đồng bộ).
  const prv = await svc.createPricingRuleVersion(product.id, { expression: 'unitPrice * area', priceRoundType: 'NONE', vatRate: 0 } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 1, description: 'Chiều rộng < 1m tính = 1m' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 2, description: 'Diện tích < 2m² tính = 2m²' } as any);

  const tierBase = isHe27
    ? { G: 450000, DX: 480000, tranh1mat: 580000, tranh2mat: 680000 }
    : { G: 510000, DX: 540000, tranh1mat: 640000, tranh2mat: 740000 };
  const tierOf = (marem: string) => (marem.startsWith('G') ? tierBase.G : marem.startsWith('DX') ? tierBase.DX : (tierBase as any)[marem]);
  const matrixRows: any[] = [];
  let order = 0;
  for (const mk of ['trang', 'ghi', 'cafe', 'van_go']) {
    for (const marem of MAREM_CODES) {
      const price = tierOf(marem) + (mk === 'van_go' ? 30000 : 0);
      matrixRows.push({ dimensions: { marem, maukhung: mk }, unitPrice: price, displayOrder: order++ });
    }
  }
  await svc.updatePriceMatrix(prv.id, matrixRows);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, {} as any);
  const items: any[] = [];
  let d = 0;
  for (const marem of MAREM_CODES) {
    items.push({ materialId: M[MAREM_MATERIAL_CODE[marem]], expression: 'area', wastePercent: 8, condition: `marem == "${marem}"`, displayOrder: d++ });
  }
  items.push({ materialId: M['NL000017'], expression: '2', condition: 'socanh == "1"', displayOrder: d++ });
  items.push({ materialId: M['NL000017'], expression: '4', condition: 'socanh == "2"', displayOrder: d++ });
  items.push({ materialId: M['NL000023'], expression: '1', displayOrder: d++ });
  items.push({ materialId: M['NL000020'], expression: '1', displayOrder: d++ });
  // Công thức Thanh nam châm/Thanh chạy của dòng Rèm KHÔNG ghép cánh giữ
  // nguyên bản gốc (có trừ hao hụt "-0.005"/"-0.0045") — khác nhóm ghép
  // cánh (mục 6, dùng công thức không trừ hao hụt) vì đây là quyết định
  // riêng của phiên tạo SP000129/130, không phải lỗi cần đồng bộ.
  items.push({ materialId: M['NL000010'], expression: '(chieucao-0.005)*0.09*2', wastePercent: 5, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000045'], expression: '(chieucao-0.005)*0.09*2', wastePercent: 5, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000024'], expression: '4*chieucao', wastePercent: 5, condition: 'socanh == "1"', displayOrder: d++ });
  items.push({ materialId: M['NL000024'], expression: '6*chieucao', wastePercent: 5, condition: 'socanh == "2"', displayOrder: d++ });
  items.push({ materialId: M['NL000012'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000047'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000013'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000048'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungtrong], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungtrongVanGo], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungngoai], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungngoaiVanGo], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchay], expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, condition: 'socanh == "1" && maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchay], expression: '(chieucao-0.0045)*0.425*4', wastePercent: 5, condition: 'socanh == "2" && maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchayVanGo], expression: '(chieucao-0.0045)*0.425*2', wastePercent: 5, condition: 'socanh == "1" && maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchayVanGo], expression: '(chieucao-0.0045)*0.425*4', wastePercent: 5, condition: 'socanh == "2" && maukhung == "van_go"', displayOrder: d++ });

  for (const it of items) await svc.createMaterialRequirementItem(mrv.id, it);
  await svc.activateMaterialRequirementVersion(mrv.id);
  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}.`);
}

// ─────────────────────────────────────────────────────
// SP: [Rèm tổ ong Trượt tự do ghép cánh] Hệ 27 / Hệ 30 (socanh 2/3/4)
// ─────────────────────────────────────────────────────
async function createRemGhepCanh(
  svc: ProductService,
  he: 27 | 30,
  productTypeId: string,
  unitId: string,
  productionCenterId: string,
) {
  const name = `[Rèm tổ ong Trượt tự do ghép cánh] Hệ ${he}`;
  if (await productExists(svc, name)) {
    console.log(`  [BỎ QUA] "${name}" đã tồn tại.`);
    return;
  }

  const isHe27 = he === 27;
  const codes = isHe27
    ? { dungtrong: 'NL000008', dungtrongVanGo: 'NL000043', dungngoai: 'NL000009', dungngoaiVanGo: 'NL000044', thanhchay: 'NL000011', thanhchayVanGo: 'NL000046' }
    : { dungtrong: 'NL000025', dungtrongVanGo: 'NL000049', dungngoai: 'NL000026', dungngoaiVanGo: 'NL000050', thanhchay: 'NL000027', thanhchayVanGo: 'NL000051' };
  const M = await resolveMaterialIds([
    'NL000017', 'NL000023', 'NL000020', 'NL000010', 'NL000045', 'NL000024',
    'NL000012', 'NL000047', 'NL000013', 'NL000048',
    codes.dungtrong, codes.dungtrongVanGo, codes.dungngoai, codes.dungngoaiVanGo, codes.thanhchay, codes.thanhchayVanGo,
    ...Object.values(MAREM_MATERIAL_CODE),
  ]);

  const product = await svc.createProduct({ name, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${name}"`);

  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, { name: 'marem', label: 'Mã rèm', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3, options: MAREM_CODES.map((v, i) => ({ value: v, label: v === 'tranh1mat' ? 'In tranh 1 mặt' : v === 'tranh2mat' ? 'In tranh 2 mặt' : v, displayOrder: i })) } as any);
  await svc.createProductParameter(product.id, { name: 'maukhung', label: 'Màu khung', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 4, options: MAUKHUNG_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'loaicua', label: 'Loại cửa', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 5, options: LOAICUA_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'socanh', label: 'Số cánh', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 6, options: [{ value: '2', label: 'Ghép 2 cánh', displayOrder: 0 }, { value: '3', label: 'Ghép 3 cánh', displayOrder: 1 }, { value: '4', label: 'Ghép 4 cánh', displayOrder: 2 }] } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: 'socanh == "2" && (chieurong < 2 || area < 3)', severity: 'WARN', message: 'Ghép 2 cánh: kích thước tối thiểu (rộng ≥2m, diện tích ≥3m²).', displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: 'socanh == "3" && (chieurong < 3 || area < 4)', severity: 'WARN', message: 'Ghép 3 cánh: kích thước tối thiểu (rộng ≥3m, diện tích ≥4m²).', displayOrder: 2 } as any);
  await svc.createValidationRule(product.id, { expression: 'socanh == "4" && (chieurong < 4 || area < 5)', severity: 'WARN', message: 'Ghép 4 cánh: kích thước tối thiểu (rộng ≥4m, diện tích ≥5m²).', displayOrder: 3 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'unitPrice * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 10 } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 2, condition: 'socanh == "2"', displayOrder: 1, description: 'Ghép 2 cánh: rộng < 2m tính bằng 2m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 3, condition: 'socanh == "3"', displayOrder: 2, description: 'Ghép 3 cánh: rộng < 3m tính bằng 3m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 4, condition: 'socanh == "4"', displayOrder: 3, description: 'Ghép 4 cánh: rộng < 4m tính bằng 4m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 3, condition: 'socanh == "2"', displayOrder: 4, description: 'Ghép 2 cánh: diện tích < 3m² tính bằng 3m².' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 4, condition: 'socanh == "3"', displayOrder: 5, description: 'Ghép 3 cánh: diện tích < 4m² tính bằng 4m².' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 5, condition: 'socanh == "4"', displayOrder: 6, description: 'Ghép 4 cánh: diện tích < 5m² tính bằng 5m².' } as any);

  const socanhBase = isHe27 ? { '2': 480000, '3': 510000, '4': 550000 } : { '2': 510000, '3': 540000, '4': 580000 };
  const matrixRows: any[] = [];
  let order = 0;
  for (const socanh of ['2', '3', '4']) {
    for (const mk of ['trang', 'ghi', 'cafe', 'van_go']) {
      for (const marem of MAREM_CODES) {
        const price = (socanhBase as any)[socanh] + MAREM_DELTA_GHEP[marem] + (mk === 'van_go' ? 30000 : 0);
        matrixRows.push({ dimensions: { socanh, maukhung: mk, marem }, unitPrice: price, displayOrder: order++ });
      }
    }
  }
  await svc.updatePriceMatrix(prv.id, matrixRows);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
  const items: any[] = [];
  let d = 1;
  for (const marem of MAREM_CODES) {
    items.push({ materialId: M[MAREM_MATERIAL_CODE[marem]], expression: 'area', wastePercent: 8, roundStep: 0.0001, condition: `marem == "${marem}"`, displayOrder: d++ });
  }
  items.push({ materialId: M['NL000017'], expression: '8', condition: 'socanh == "2"', displayOrder: d++ });
  items.push({ materialId: M['NL000017'], expression: '12', condition: 'socanh == "3"', displayOrder: d++ });
  items.push({ materialId: M['NL000017'], expression: '16', condition: 'socanh == "4"', displayOrder: d++ });
  items.push({ materialId: M['NL000023'], expression: '1', displayOrder: d++ });
  items.push({ materialId: M['NL000020'], expression: '1', displayOrder: d++ });
  items.push({ materialId: M['NL000010'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000045'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000024'], expression: '6*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2"', displayOrder: d++ });
  items.push({ materialId: M['NL000024'], expression: '8*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "3"', displayOrder: d++ });
  items.push({ materialId: M['NL000024'], expression: '10*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "4"', displayOrder: d++ });
  items.push({ materialId: M['NL000012'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000047'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000013'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000048'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungtrong], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungtrongVanGo], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungngoai], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungngoaiVanGo], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchay], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2" && maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchayVanGo], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "2" && maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchay], expression: 'chieucao*6*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "3" && maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchayVanGo], expression: 'chieucao*6*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "3" && maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchay], expression: 'chieucao*8*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "4" && maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchayVanGo], expression: 'chieucao*8*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'socanh == "4" && maukhung == "van_go"', displayOrder: d++ });

  for (const it of items) await svc.createMaterialRequirementItem(mrv.id, it);
  await svc.activateMaterialRequirementVersion(mrv.id);
  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}.`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    console.log('Tra cứu Master Data tham chiếu...');
    const productTypeCuaLuoiId = await resolveByName('productType', PRODUCT_TYPE_NAME_CUA_LUOI);
    const productTypeRemId = await resolveByName('productType', PRODUCT_TYPE_NAME_REM);
    const unitId = await resolveByName('unit', UNIT_NAME_M2);
    const productionCenterId = await resolveByCode('productionCenter', PRODUCTION_CENTER_CODE);

    console.log('\n--- Cửa lưới trượt tự do (không ghép) ---');
    await createCuaLuoiTruotTuDo(svc, 27, productTypeCuaLuoiId, unitId, productionCenterId);
    await createCuaLuoiTruotTuDo(svc, 30, productTypeCuaLuoiId, unitId, productionCenterId);

    console.log('\n--- Cửa lưới trượt tự do ghép cánh ---');
    await createCuaLuoiGhepCanh(svc, 27, productTypeCuaLuoiId, unitId, productionCenterId);
    await createCuaLuoiGhepCanh(svc, 30, productTypeCuaLuoiId, unitId, productionCenterId);

    console.log('\n--- Rèm tổ ong Trượt tự do (không ghép) ---');
    await createRemTruotTuDo(svc, 27, productTypeRemId, unitId, productionCenterId);
    await createRemTruotTuDo(svc, 30, productTypeRemId, unitId, productionCenterId);

    console.log('\n--- Rèm tổ ong Trượt tự do ghép cánh ---');
    await createRemGhepCanh(svc, 27, productTypeRemId, unitId, productionCenterId);
    await createRemGhepCanh(svc, 30, productTypeRemId, unitId, productionCenterId);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
