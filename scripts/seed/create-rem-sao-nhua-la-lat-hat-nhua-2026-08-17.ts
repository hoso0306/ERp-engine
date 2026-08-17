/**
 * Tạo 3 sản phẩm mới nhóm "Rèm sáo/lá/hạt" — tham khảo cấu trúc "Rèm Sáo
 * nhôm" (SP000157, xem scripts/seed/create-rem-sao-nhom-2026-08-17.ts) và
 * "Rèm sáo gỗ" (SP000150). Theo yêu cầu người dùng 2026-08-17:
 *
 * 1. Rèm Sáo nhựa — giống hệt Rèm Sáo nhôm (Rộng/Cao, Mã Rèm tự nhập, Kéo
 *    Trái/Phải, Giá nhập/Giá bán tự nhập theo m², MIN_AREA=1m²).
 * 2. Rèm lá lật — giống Sáo nhôm nhưng tham số "Kéo" khác: Kéo 1 bên/2 bên
 *    (không phải Trái/Phải).
 * 3. Rèm Hạt nhựa — Rộng/Cao, Loại hạt (TEXT tự nhập — xác nhận người dùng:
 *    không có danh sách cố định), Số sợi/m ngang (NUMBER, đơn vị "sợi/m
 *    ngang", chỉ lưu thông tin), Giá nhập/Giá xuất tự nhập theo m²,
 *    MIN_AREA=1m².
 *
 * Cả 3 sản phẩm: ProductType "Mành", Unit "m²", Production Center XW006
 * "Hàng phân phối" (xác nhận người dùng — dùng chung với Rèm Sáo nhôm/Sáo gỗ
 * vừa chuyển). "Mã Rèm"/"Loại hạt"/"Kéo"/"Số sợi/m ngang" đều chỉ lưu thông
 * tin (usedInPricing=false, usedInMaterial=false) — không ảnh hưởng giá bán
 * lẫn giá vốn, giống pattern đã dùng ở Rèm Sáo nhôm.
 *
 * ⚠️ Material "Giá vốn ... (nhập tay)" PHẢI dùng Unit "Khoản" + Material
 * Price mặc định = 1 (không phải Unit của sản phẩm) — bug đã gặp thật ở Rèm
 * Sáo nhôm (xem workbench/sessions/2707.md Việc 9), đã tự kiểm tra lại trong
 * script này trước khi kết thúc.
 *
 * Idempotent theo tên sản phẩm (bỏ qua sản phẩm đã tồn tại).
 *
 * Chạy (từ apps/api, trong container production):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-rem-sao-nhua-la-lat-hat-nhua-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Mành';
const UNIT_NAME = 'm²';
const PRODUCTION_CENTER_CODE = 'XW006';

type ParamDef = {
  name: string;
  label: string;
  type: 'NUMBER' | 'TEXT' | 'ENUM';
  unit?: string;
  options?: { value: string; label: string }[];
};

type ProductDef = {
  productName: string;
  materialName: string;
  parameters: ParamDef[];
};

const PRODUCTS: ProductDef[] = [
  {
    productName: 'Rèm Sáo nhựa',
    materialName: 'Giá vốn Rèm sáo nhựa (nhập tay)',
    parameters: [
      { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm' },
      { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm' },
      { name: 'marem', label: 'Mã rèm', type: 'TEXT' },
      { name: 'keo', label: 'Kéo', type: 'ENUM', options: [
        { value: 'trai', label: 'Kéo Trái' },
        { value: 'phai', label: 'Kéo Phải' },
      ] },
      { name: 'giavon', label: 'Giá vốn', type: 'NUMBER', unit: 'đ/m²' },
      { name: 'dongia', label: 'Giá bán', type: 'NUMBER', unit: 'đ/m²' },
    ],
  },
  {
    productName: 'Rèm lá lật',
    materialName: 'Giá vốn Rèm lá lật (nhập tay)',
    parameters: [
      { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm' },
      { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm' },
      { name: 'marem', label: 'Mã rèm', type: 'TEXT' },
      { name: 'keo', label: 'Kéo', type: 'ENUM', options: [
        { value: '1ben', label: 'Kéo 1 bên' },
        { value: '2ben', label: 'Kéo 2 bên' },
      ] },
      { name: 'giavon', label: 'Giá vốn', type: 'NUMBER', unit: 'đ/m²' },
      { name: 'dongia', label: 'Giá bán', type: 'NUMBER', unit: 'đ/m²' },
    ],
  },
  {
    productName: 'Rèm Hạt nhựa',
    materialName: 'Giá vốn Rèm hạt nhựa (nhập tay)',
    parameters: [
      { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm' },
      { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm' },
      { name: 'loaihat', label: 'Loại hạt', type: 'TEXT' },
      { name: 'sosoi', label: 'Số sợi/m ngang', type: 'NUMBER', unit: 'sợi/m ngang' },
      { name: 'giavon', label: 'Giá nhập', type: 'NUMBER', unit: 'đ/m²' },
      { name: 'dongia', label: 'Giá xuất', type: 'NUMBER', unit: 'đ/m²' },
    ],
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

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const productTypeId = await resolveByName('productType', PRODUCT_TYPE_NAME);
    const unitId = await resolveByName('unit', UNIT_NAME);
    const productionCenterId = await resolveByCode('productionCenter', PRODUCTION_CENTER_CODE);
    const khoanUnitId = await resolveByName('unit', 'Khoản');

    for (const def of PRODUCTS) {
      const existing = await prisma.product.findFirst({ where: { name: def.productName, deletedAt: null } });
      if (existing) {
        console.log(`[BỎ QUA] Product "${def.productName}" đã tồn tại (${existing.code}).`);
        continue;
      }

      console.log(`\n=== Tạo "${def.productName}" ===`);

      let material = await prisma.material.findFirst({ where: { name: def.materialName } });
      if (material) {
        console.log(`  [BỎ QUA] Material "${def.materialName}" đã tồn tại (${material.code}).`);
      } else {
        material = await svc.createMaterial({ name: def.materialName, unitId: khoanUnitId } as any);
        console.log(`  Tạo Material ${material.code} "${def.materialName}" (Unit: Khoản)`);
        await svc.createMaterialPrice(material.id, {
          price: 1,
          effectiveFrom: new Date().toISOString(),
          isDefault: true,
          note: 'Vật tư ảo — đại diện giá vốn nhập tay (tham số giavon), không phải vật tư tiêu hao thật.',
        } as any);
        console.log('  Tạo Material Price mặc định: 1đ/Khoản.');
      }

      const product = await svc.createProduct({ name: def.productName, productTypeId, unitId, productionCenterId } as any);
      console.log(`  Tạo Product ${product.code} "${def.productName}"`);

      let order = 1;
      for (const p of def.parameters) {
        await svc.createProductParameter(product.id, {
          name: p.name,
          label: p.label,
          type: p.type,
          unit: p.unit,
          isRequired: true,
          usedInPricing: p.name === 'dongia' || p.name === 'chieurong' || p.name === 'chieucao',
          usedInMaterial: p.name === 'chieurong' || p.name === 'chieucao' || p.name === 'giavon',
          displayOrder: order++,
          options: p.options?.map((o, idx) => ({ value: o.value, label: o.label, displayOrder: idx })),
        } as any);
      }
      console.log(`  Đã tạo ${def.parameters.length} tham số.`);

      await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);

      const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'dongia * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 8, note: 'Giá bán nhập tay theo m² (giavon/dongia), tham khảo Rèm sáo gỗ/Rèm Sáo nhôm.' } as any);
      await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 1, description: 'Diện tích < 1m² tính bằng 1m².', displayOrder: 1 } as any);
      await svc.activatePricingRuleVersion(prv.id);
      console.log('  Đã tạo + kích hoạt Pricing Rule Version.');

      const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
      await svc.createMaterialRequirementItem(mrv.id, { materialId: material.id, expression: 'giavon * area', wastePercent: 0, condition: undefined, note: undefined, displayOrder: 1 } as any);
      await svc.activateMaterialRequirementVersion(mrv.id);
      console.log('  Đã tạo + kích hoạt Material Requirement Version.');

      await svc.updateProductStatus(product.id, 'ACTIVE');
      console.log(`  Hoàn tất — ${product.code} "${def.productName}" đã ACTIVE.`);
    }

    console.log('\nXong toàn bộ.');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
