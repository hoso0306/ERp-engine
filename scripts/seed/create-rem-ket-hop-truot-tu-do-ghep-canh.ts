/**
 * Tạo sản phẩm "[Rèm kết hợp trượt tự do ghép cánh] Hệ 27/30" — mục ⑤ phiếu
 * tay khách hàng: bộ cửa ghép từ cả cánh Lưới lẫn cánh Rèm (khác các sản
 * phẩm "Trượt tự do" đã có trong workbench/sessions/2707.md mục 3-7, vốn
 * chỉ toàn Lưới hoặc toàn Rèm). Thiết kế đã chốt với người dùng trong phiên
 * làm việc hiện tại — xem workbench/sessions/2707.md mục 9, 9b.
 *
 * Idempotent theo tên sản phẩm: nếu Product cùng tên đã tồn tại thì bỏ qua,
 * an toàn chạy lại nhiều lần.
 *
 * Tra cứu ProductType/Unit theo `name`, ProductionCenter/Material theo `code`
 * — chạy được trên cả Local lẫn VPS miễn 2 môi trường cùng Master Data.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-rem-ket-hop-truot-tu-do-ghep-canh.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Rèm kết hợp';
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
const MAREM_DELTA: Record<string, number> = {
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
const CACHGHEP_OPTIONS = [
  { value: '1luoi_1rem', label: '1 cánh lưới + 1 cánh rèm', displayOrder: 0 },
  { value: '1luoi_2rem', label: '1 cánh lưới + 2 cánh rèm', displayOrder: 1 },
  { value: '1rem_2luoi', label: '1 cánh rèm + 2 cánh lưới', displayOrder: 2 },
];
// Khung nhôm Hệ 27/30 (đối chiếu SP000131/132/133/134 làm chuẩn tham khảo)
const CODES_BY_HE: Record<27 | 30, { dungtrong: string; dungtrongVanGo: string; dungngoai: string; dungngoaiVanGo: string; thanhchay: string; thanhchayVanGo: string }> = {
  27: {
    dungtrong: 'NL000008', dungtrongVanGo: 'NL000043',
    dungngoai: 'NL000009', dungngoaiVanGo: 'NL000044',
    thanhchay: 'NL000011', thanhchayVanGo: 'NL000046',
  },
  30: {
    dungtrong: 'NL000025', dungtrongVanGo: 'NL000049',
    dungngoai: 'NL000026', dungngoaiVanGo: 'NL000050',
    thanhchay: 'NL000027', thanhchayVanGo: 'NL000051',
  },
};

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

async function productExists(name: string): Promise<boolean> {
  const existing = await prisma.product.findFirst({ where: { name, deletedAt: null } });
  return !!existing;
}

async function createRemKetHopTruotTuDoGhepCanh(
  svc: ProductService,
  he: 27 | 30,
  productTypeId: string,
  unitId: string,
  productionCenterId: string,
) {
  const name = `[Rèm kết hợp trượt tự do ghép cánh] Hệ ${he}`;
  if (await productExists(name)) {
    console.log(`  [BỎ QUA] "${name}" đã tồn tại.`);
    return;
  }

  const codes = CODES_BY_HE[he];
  const M = await resolveMaterialIds([
    'NL000015', 'NL000017', 'NL000023', 'NL000020', 'NL000010', 'NL000045', 'NL000024',
    'NL000012', 'NL000047', 'NL000013', 'NL000048',
    codes.dungtrong, codes.dungtrongVanGo,
    codes.dungngoai, codes.dungngoaiVanGo,
    codes.thanhchay, codes.thanhchayVanGo,
    ...Object.values(MAREM_MATERIAL_CODE),
  ]);

  const product = await svc.createProduct({ name, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${name}"`);

  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, { name: 'marem', label: 'Mã rèm', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3, options: MAREM_CODES.map((v, i) => ({ value: v, label: v === 'tranh1mat' ? 'In tranh 1 mặt' : v === 'tranh2mat' ? 'In tranh 2 mặt' : v, displayOrder: i })) } as any);
  await svc.createProductParameter(product.id, { name: 'maukhung', label: 'Màu khung', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 4, options: MAUKHUNG_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'loaicua', label: 'Loại cửa', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 5, options: LOAICUA_OPTIONS } as any);
  await svc.createProductParameter(product.id, { name: 'cachghep', label: 'Cách ghép', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 6, options: CACHGHEP_OPTIONS } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: 'cachghep == "1luoi_1rem" && (chieurong < 2 || area < 3)', severity: 'WARN', message: '1 lưới + 1 rèm: kích thước tối thiểu (rộng ≥2m, diện tích ≥3m²).', displayOrder: 1 } as any);
  await svc.createValidationRule(product.id, { expression: 'cachghep == "1luoi_2rem" && (chieurong < 3 || area < 4)', severity: 'WARN', message: '1 lưới + 2 rèm: kích thước tối thiểu (rộng ≥3m, diện tích ≥4m²).', displayOrder: 2 } as any);
  await svc.createValidationRule(product.id, { expression: 'cachghep == "1rem_2luoi" && (chieurong < 3 || area < 4)', severity: 'WARN', message: '1 rèm + 2 lưới: kích thước tối thiểu (rộng ≥3m, diện tích ≥4m²).', displayOrder: 3 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'unitPrice * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 10 } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 2, condition: 'cachghep == "1luoi_1rem"', displayOrder: 1, description: '1 lưới + 1 rèm: rộng < 2m tính bằng 2m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 3, condition: 'cachghep == "1luoi_2rem"', displayOrder: 2, description: '1 lưới + 2 rèm: rộng < 3m tính bằng 3m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieurong', value: 3, condition: 'cachghep == "1rem_2luoi"', displayOrder: 3, description: '1 rèm + 2 lưới: rộng < 3m tính bằng 3m.' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 3, condition: 'cachghep == "1luoi_1rem"', displayOrder: 4, description: '1 lưới + 1 rèm: diện tích < 3m² tính bằng 3m².' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 4, condition: 'cachghep == "1luoi_2rem"', displayOrder: 5, description: '1 lưới + 2 rèm: diện tích < 4m² tính bằng 4m².' } as any);
  await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 4, condition: 'cachghep == "1rem_2luoi"', displayOrder: 6, description: '1 rèm + 2 lưới: diện tích < 4m² tính bằng 4m².' } as any);

  // Giá = base(cachghep) [+30k/m² nếu Hệ 30] + phụ phí marem (tái dùng mức
  // của SP000133) + vân gỗ +30k/m² — đúng chú thích phiếu tay "Hệ 30 +30k/m²".
  const CACHGHEP_BASE: Record<string, number> = { '1luoi_1rem': 460000, '1luoi_2rem': 540000, '1rem_2luoi': 500000 };
  const heSurcharge = he === 30 ? 30000 : 0;
  const matrixRows: any[] = [];
  let order = 0;
  for (const cachghep of ['1luoi_1rem', '1luoi_2rem', '1rem_2luoi']) {
    for (const mk of ['trang', 'ghi', 'cafe', 'van_go']) {
      for (const marem of MAREM_CODES) {
        const price = CACHGHEP_BASE[cachghep] + heSurcharge + MAREM_DELTA[marem] + (mk === 'van_go' ? 30000 : 0);
        matrixRows.push({ dimensions: { cachghep, maukhung: mk, marem }, unitPrice: price, displayOrder: order++ });
      }
    }
  }
  await svc.updatePriceMatrix(prv.id, matrixRows);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
  const items: any[] = [];
  let d = 1;

  // Lưới chống muỗi — công thức riêng theo từng cách ghép
  items.push({ materialId: M['NL000015'], expression: 'chieurong*chieucao', wastePercent: 8, roundStep: 0.0001, condition: 'cachghep == "1luoi_1rem"', displayOrder: d++ });
  items.push({ materialId: M['NL000015'], expression: 'chieucao*chieurong/3', wastePercent: 8, roundStep: 0.0001, condition: 'cachghep == "1luoi_2rem"', displayOrder: d++ });
  items.push({ materialId: M['NL000015'], expression: 'chieucao*chieurong*2/3', wastePercent: 8, roundStep: 0.0001, condition: 'cachghep == "1rem_2luoi"', displayOrder: d++ });

  // Rèm theo marem — full Rộng×Cao cho "1luoi_1rem"/"1luoi_2rem", 1/3 cho "1rem_2luoi"
  for (const marem of MAREM_CODES) {
    items.push({ materialId: M[MAREM_MATERIAL_CODE[marem]], expression: 'chieurong*chieucao', wastePercent: 8, roundStep: 0.0001, condition: `marem == "${marem}" && cachghep != "1rem_2luoi"`, displayOrder: d++ });
    items.push({ materialId: M[MAREM_MATERIAL_CODE[marem]], expression: 'chieucao*chieurong/3', wastePercent: 8, roundStep: 0.0001, condition: `marem == "${marem}" && cachghep == "1rem_2luoi"`, displayOrder: d++ });
  }

  // Bánh xe (Con lăn đồng) = tổng cánh × 4 (2 cánh) / × 6 (3 cánh)
  items.push({ materialId: M['NL000017'], expression: '8', condition: 'cachghep == "1luoi_1rem"', displayOrder: d++ });
  items.push({ materialId: M['NL000017'], expression: '18', condition: 'cachghep != "1luoi_1rem"', displayOrder: d++ });

  items.push({ materialId: M['NL000023'], expression: '1', displayOrder: d++ }); // PK Nhựa luôn bộ 2 cánh
  items.push({ materialId: M['NL000020'], expression: '1', displayOrder: d++ }); // PHI_SAN_XUAT

  items.push({ materialId: M['NL000010'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000045'], expression: 'chieucao*2*0.09', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });

  items.push({ materialId: M['NL000024'], expression: '6*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'cachghep == "1luoi_1rem"', displayOrder: d++ });
  items.push({ materialId: M['NL000024'], expression: '8*chieucao', wastePercent: 5, roundStep: 0.0001, condition: 'cachghep != "1luoi_1rem"', displayOrder: d++ });

  items.push({ materialId: M['NL000012'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000047'], expression: '(chieurong-0.0034)*0.278', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000013'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M['NL000048'], expression: '(chieurong-0.0034)*0.203', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });

  items.push({ materialId: M[codes.dungtrong], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungtrongVanGo], expression: '(chieucao-0.003)*0.198*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungngoai], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.dungngoaiVanGo], expression: '(chieucao-0.0014)*0.196*2', wastePercent: 5, roundStep: 0.0001, condition: 'maukhung == "van_go"', displayOrder: d++ });

  // Thanh chạy — tổng cánh 2 → ×4, tổng cánh 3 → ×6 (đối chiếu SP000131/132)
  items.push({ materialId: M[codes.thanhchay], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'cachghep == "1luoi_1rem" && maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchayVanGo], expression: 'chieucao*4*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'cachghep == "1luoi_1rem" && maukhung == "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchay], expression: 'chieucao*6*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'cachghep != "1luoi_1rem" && maukhung != "van_go"', displayOrder: d++ });
  items.push({ materialId: M[codes.thanhchayVanGo], expression: 'chieucao*6*0.425', wastePercent: 5, roundStep: 0.0001, condition: 'cachghep != "1luoi_1rem" && maukhung == "van_go"', displayOrder: d++ });

  for (const it of items) await svc.createMaterialRequirementItem(mrv.id, it);
  await svc.activateMaterialRequirementVersion(mrv.id);
  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}. (${items.length} dòng BOM, ${matrixRows.length} dòng giá)`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    console.log('Tra cứu Master Data tham chiếu...');
    const productTypeId = await resolveByName('productType', PRODUCT_TYPE_NAME);
    const unitId = await resolveByName('unit', UNIT_NAME_M2);
    const productionCenterId = await resolveByCode('productionCenter', PRODUCTION_CENTER_CODE);

    console.log('\n--- Rèm kết hợp trượt tự do ghép cánh Hệ 27 ---');
    await createRemKetHopTruotTuDoGhepCanh(svc, 27, productTypeId, unitId, productionCenterId);

    console.log('\n--- Rèm kết hợp trượt tự do ghép cánh Hệ 30 ---');
    await createRemKetHopTruotTuDoGhepCanh(svc, 30, productTypeId, unitId, productionCenterId);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
