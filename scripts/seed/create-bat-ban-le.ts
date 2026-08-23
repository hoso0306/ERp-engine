/**
 * Tạo sản phẩm "Bạt bán lẻ" — bán tấm bạt theo m², dùng chung 10 Material vải
 * bạt đã có sẵn với SP000116 "Bạt Cuốn" (VN01-13, K11-21, T01-07, TW01-05,
 * K04-07, NL000260, NL000261, K01-M, J01-02, KN01-05) và dùng chung Material
 * NL000372 "PHÍ SẢN XUẤT RÈM CUỐN" làm phí sản xuất cố định/đơn.
 *
 * Khác với Bạt Cuốn: không có phụ kiện lò xo/ống/tay quay, không trừ hao hụt
 * khi tính vải (giá vốn = area * giá vốn/m² đúng theo yêu cầu người dùng
 * 2026-08-13), không có MIN_AREA/MIN_DIMENSION, không làm tròn giá bán.
 *
 * mabat dùng từng mã lẻ (không gộp theo khoảng) — theo đúng convention của
 * SP000116 — để nhân viên bán hàng chọn đúng mã cụ thể khách mua.
 *
 * Idempotent theo tên sản phẩm. Yêu cầu đã có ProductType "Bạt cuốn", Unit
 * "m²", ProductionCenter code XW005 (Xưởng Bạt), và các Material nêu trên.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-bat-ban-le.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Bạt cuốn';
const UNIT_NAME = 'm²';
const PRODUCTION_CENTER_CODE = 'XW005';
const PRODUCT_NAME = 'Bạt bán lẻ';
const PHI_SX_MATERIAL_NAME = 'PHÍ SẢN XUẤT RÈM CUỐN'; // NL000372, dùng chung theo chỉ đạo người dùng

// Từng nhóm mã bạt: values = mabat option (từng mã lẻ), material = tên Material dùng chung, sellPrice = giá bán/m2
const GROUPS: {
  materialName: string;
  values: { value: string; label: string }[];
  sellPrice: number;
}[] = [
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Việt Nam VN01, VN02, VN03, VN04, VN05, VN06, VN07, VN08, VN09, VN10, VN11, VN12, VN13',
    values: Array.from({ length: 13 }, (_, i) => {
      const v = `vn${String(i + 1).padStart(2, '0')}`;
      return { value: v, label: `Bạt Việt Nam ${v.toUpperCase()}` };
    }),
    sellPrice: 40000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt 1 màu Myung Sung Hàn Quốc 0.38 K11, K12, K13, K14, K15, K16, K17, K18, K19, K20, K21',
    values: Array.from({ length: 11 }, (_, i) => {
      const v = `k${11 + i}`;
      return { value: v, label: `Bạt Myung Sung Hàn Quốc 0.38 ${v.toUpperCase()}` };
    }),
    sellPrice: 48000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Đài Loan 0.38 T01, T02, T03, T04, T05, T06, T07',
    values: Array.from({ length: 7 }, (_, i) => {
      const v = `t${String(i + 1).padStart(2, '0')}`;
      return { value: v, label: `Bạt Đài Loan 0.38 ${v.toUpperCase()}` };
    }),
    sellPrice: 48000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Đài Loan 0.38 TW01, TW02, TW03, TW04, TW05',
    values: Array.from({ length: 5 }, (_, i) => {
      const v = `tw${String(i + 1).padStart(2, '0')}`;
      return { value: v, label: `Bạt Đài Loan 0.38 ${v.toUpperCase()}` };
    }),
    sellPrice: 48000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Đài Loan 0.4 KN01, KN02, KN03, KN04, KN05',
    values: Array.from({ length: 5 }, (_, i) => {
      const v = `kn${String(i + 1).padStart(2, '0')}`;
      return { value: v, label: `Bạt Đài Loan 0.4 ${v.toUpperCase()}` };
    }),
    sellPrice: 60000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Đài Loan K04, K05, K06, K07',
    values: Array.from({ length: 4 }, (_, i) => {
      const v = `k${4 + i}`;
      return { value: v, label: `Bạt Đài Loan ${v.toUpperCase()}` };
    }),
    sellPrice: 60000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Đài Loan Nhựa trong K02',
    values: [{ value: 'k02', label: 'Bạt Đài Loan Nhựa trong K02' }],
    sellPrice: 41000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Hàn Quốc đục lỗ K08, K09, K10',
    values: [
      { value: 'k08', label: 'Bạt Hàn Quốc đục lỗ K08' },
      { value: 'k09', label: 'Bạt Hàn Quốc đục lỗ K09' },
      { value: 'k10', label: 'Bạt Hàn Quốc đục lỗ K10' },
    ],
    sellPrice: 60000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt lưới nhập khẩu K01, K01 (mới)',
    values: [
      { value: 'k01', label: 'Bạt lưới nhập khẩu K01' },
      { value: 'k01moi', label: 'Bạt lưới nhập khẩu K01 (mới)' },
    ],
    sellPrice: 120000,
  },
  {
    materialName: 'Vải bạt (bạt cuốn) - Bạt Nhật J01, J02',
    values: [
      { value: 'j01', label: 'Bạt Nhật J01' },
      { value: 'j02', label: 'Bạt Nhật J02' },
    ],
    sellPrice: 68000,
  },
];

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

async function resolveMaterialIdsByName(names: string[]): Promise<Record<string, string>> {
  const rows = await prisma.material.findMany({ where: { name: { in: names }, isActive: true }, select: { id: true, name: true } });
  const map: Record<string, string> = {};
  for (const name of names) {
    const m = rows.find((r) => r.name === name);
    if (!m) throw new Error(`Material "${name}" không tồn tại trên môi trường này.`);
    map[name] = m.id;
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

    const materialNames = [...GROUPS.map((g) => g.materialName), PHI_SX_MATERIAL_NAME];
    const M = await resolveMaterialIdsByName(materialNames);

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId, productionCenterId } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
    await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
    await svc.createProductParameter(product.id, {
      name: 'mabat',
      label: 'Mã bạt',
      type: 'ENUM',
      isRequired: true,
      usedInPricing: true,
      usedInMaterial: true,
      displayOrder: 3,
      options: GROUPS.flatMap((g) => g.values).map((v, i) => ({ value: v.value, label: v.label, displayOrder: i })),
    } as any);

    await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);

    console.log('  Tạo Pricing Rule Version...');
    const matrixRows = GROUPS.flatMap((g) => g.values).map((v, displayOrder) => ({
      dimensions: { mabat: v.value },
      unitPrice: GROUPS.find((g) => g.values.includes(v))!.sellPrice,
      displayOrder,
    }));
    const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'unitPrice * area', priceRoundType: 'NONE', vatRate: 10 } as any);
    await svc.updatePriceMatrix(prv.id, matrixRows);
    await svc.activatePricingRuleVersion(prv.id);
    console.log(`  Xong (${matrixRows.length} dòng giá)`);

    console.log('  Tạo Material Requirement Version (BOM)...');
    const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
    let order = 1;
    for (const g of GROUPS) {
      const condition = g.values.map((v) => `mabat=="${v.value}"`).join('||');
      await svc.createMaterialRequirementItem(mrv.id, { materialId: M[g.materialName], expression: 'area', wastePercent: 0, condition, note: undefined, displayOrder: order++ } as any);
    }
    await svc.createMaterialRequirementItem(mrv.id, { materialId: M[PHI_SX_MATERIAL_NAME], expression: '1', wastePercent: 0, condition: undefined, note: 'Phí sản xuất cố định/đơn (dùng chung NL000372)', displayOrder: order++ } as any);
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
