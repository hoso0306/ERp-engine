/**
 * Tạo 3 sản phẩm mới hoàn toàn — "Cửa lưới cuốn", "Cửa lùa", "Cửa inox mở
 * quay" — chốt qua trao đổi trực tiếp với người dùng (19/08/2026, từ ảnh
 * chụp bảng giá viết tay "Thêm Sản phẩm").
 *
 * Theo đúng cơ chế "tự nhập giá" của "Rèm Sáo nhôm" (SP000157, đối chiếu
 * trực tiếp trên DB) — KHÔNG dùng BOM vật tư thật, KHÔNG dùng Price Matrix:
 * - ProductType + ProductionCenter: "Hàng phân phối" cho cả 3 (chốt theo
 *   người dùng — không tạo ProductType riêng theo tên sản phẩm).
 * - Tham số dongia/giavon (NUMBER, đ/m²) nhập tay mỗi dòng báo giá.
 * - Pricing: expression "dongia * area", KHÔNG làm tròn (priceRoundType
 *   NONE — khác Rèm Sáo nhôm dùng CEIL 100, đã chốt riêng với người dùng),
 *   VAT 8%, Rule MIN_AREA theo từng SP.
 * - Vật tư "ảo" 1 dòng "Giá vốn {tên SP} (nhập tay)", đơn vị "Khoản", giá
 *   1đ/đơn vị, MaterialRequirementItem expression "giavon * area" — hack để
 *   plannedCost = giavon × area mà không cần BOM thật.
 * - mausac/loại biến thể: usedInPricing=false, usedInMaterial=false (thuần
 *   mô tả, KHÔNG ảnh hưởng giá — vì giá bán/giá vốn đã tự nhập full, giống
 *   "keo" (Trái/Phải) ở Rèm Sáo nhôm không tham gia công thức nào).
 *
 * Idempotent theo tên sản phẩm — an toàn chạy lại nhiều lần. Sản phẩm tạo
 * ở trạng thái DRAFT — người dùng tự Activate sau khi review trên UI.
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-cua-luoi-cuon-cua-lua-cua-inox.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Hàng phân phối';
const PRODUCTION_CENTER_NAME = 'Hàng phân phối';
const UNIT_NAME = 'm²';
const MATERIAL_UNIT_NAME = 'Khoản';

const MAUSAC_OPTIONS = [
  { value: 'trang', label: 'Trắng', displayOrder: 0 },
  { value: 'ghi', label: 'Ghi', displayOrder: 1 },
  { value: 'cafe', label: 'Cafe', displayOrder: 2 },
  { value: 'vango', label: 'Vân Gỗ', displayOrder: 3 },
];

interface ProductSpec {
  name: string;
  minArea: number;
  extraParam?: { name: string; label: string; options: { value: string; label: string; displayOrder: number }[] };
}

const PRODUCTS: ProductSpec[] = [
  {
    name: 'Cửa lưới cuốn',
    minArea: 1,
    extraParam: {
      name: 'loaicuon',
      label: 'Loại cuốn',
      options: [
        { value: 'thuong', label: 'Cuốn Thường', displayOrder: 0 },
        { value: 'giamtoc', label: 'Cuốn giảm tốc', displayOrder: 1 },
        { value: 'chongbungmep', label: 'Cuốn chống bung mép', displayOrder: 2 },
      ],
    },
  },
  {
    name: 'Cửa lùa',
    minArea: 1,
    extraParam: {
      name: 'loai',
      label: 'Loại',
      options: [
        { value: 'luoi1canh', label: 'Lưới 1 cánh', displayOrder: 0 },
        { value: 'luoi2canh', label: 'Lưới 2 cánh', displayOrder: 1 },
        { value: 'tamcodinh', label: 'Tấm cố định', displayOrder: 2 },
      ],
    },
  },
  {
    name: 'Cửa inox mở quay',
    minArea: 1.5,
  },
];

let prisma: PrismaService;

function fmtArea(n: number) {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: n % 1 === 0 ? 0 : 1 });
}

async function createOne(svc: ProductService, spec: ProductSpec, ids: { productTypeId: string; productionCenterId: string; unitId: string; materialUnitId: string }) {
  const existing = await prisma.product.findFirst({ where: { name: spec.name, deletedAt: null } });
  if (existing) {
    console.log(`[BỎ QUA] Product "${spec.name}" đã tồn tại (${existing.code}).`);
    return;
  }

  console.log(`\n--- Tạo vật tư ảo cho "${spec.name}" ---`);
  const materialName = `Giá vốn ${spec.name} (nhập tay)`;
  const material = await svc.createMaterial({ name: materialName, unitId: ids.materialUnitId } as any);
  const today = new Date().toISOString().slice(0, 10);
  await svc.createMaterialPrice(material.id, {
    price: 1,
    effectiveFrom: today,
    isDefault: true,
    note: 'Vật tư ảo — đại diện giá vốn nhập tay (tham số giavon), không phải vật tư tiêu hao thật.',
  } as any);
  console.log(`  Tạo ${material.code} "${materialName}"`);

  console.log(`--- Tạo Product "${spec.name}" ---`);
  const product = await svc.createProduct({
    name: spec.name,
    productTypeId: ids.productTypeId,
    unitId: ids.unitId,
    productionCenterId: ids.productionCenterId,
  } as any);
  console.log(`  Tạo ${product.code} "${spec.name}"`);

  let order = 1;
  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: order++ } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: order++ } as any);
  await svc.createProductParameter(product.id, { name: 'mausac', label: 'Màu khung', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: order++, options: MAUSAC_OPTIONS } as any);
  if (spec.extraParam) {
    await svc.createProductParameter(product.id, {
      name: spec.extraParam.name,
      label: spec.extraParam.label,
      type: 'ENUM',
      isRequired: true,
      usedInPricing: false,
      usedInMaterial: false,
      displayOrder: order++,
      options: spec.extraParam.options,
    } as any);
  }
  await svc.createProductParameter(product.id, { name: 'giavon', label: 'Giá vốn', type: 'NUMBER', unit: 'đ/m²', isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: order++ } as any);
  await svc.createProductParameter(product.id, { name: 'dongia', label: 'Giá bán', type: 'NUMBER', unit: 'đ/m²', isRequired: true, usedInPricing: true, usedInMaterial: false, displayOrder: order++ } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm²', displayOrder: 1 } as any);

  await svc.createValidationRule(product.id, {
    expression: `area < ${spec.minArea}`,
    severity: 'WARN',
    message: `Diện tích < ${fmtArea(spec.minArea)}m² sẽ tính bằng ${fmtArea(spec.minArea)}m².`,
    displayOrder: 1,
  } as any);

  console.log('  Cấu hình giá bán...');
  const prv = await svc.createPricingRuleVersion(product.id, {
    name: 'v1',
    expression: 'dongia * area',
    priceRoundType: 'NONE',
    vatRate: 8,
  } as any);
  await svc.createPricingRuleItem(prv!.id, {
    ruleType: 'MIN_AREA',
    value: spec.minArea,
    description: `Diện tích dưới ${fmtArea(spec.minArea)}m² tính bằng ${fmtArea(spec.minArea)}m².`,
    displayOrder: 1,
  } as any);
  await svc.activatePricingRuleVersion(prv!.id);

  console.log('  Cấu hình giá vốn (vật tư ảo)...');
  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
  await svc.createMaterialRequirementItem(mrv!.id, {
    materialId: material.id,
    expression: 'giavon * area',
    wastePercent: 0,
    displayOrder: 1,
  } as any);
  await svc.activateMaterialRequirementVersion(mrv!.id);

  console.log(`=== XONG: ${product.code} "${spec.name}" (DRAFT) ===`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const productType = await prisma.productType.findUnique({ where: { name: PRODUCT_TYPE_NAME } });
    if (!productType) throw new Error(`Không tìm thấy ProductType "${PRODUCT_TYPE_NAME}".`);
    const productionCenter = await prisma.productionCenter.findFirst({ where: { name: PRODUCTION_CENTER_NAME } });
    if (!productionCenter) throw new Error(`Không tìm thấy ProductionCenter "${PRODUCTION_CENTER_NAME}".`);
    const unit = await prisma.unit.findFirst({ where: { name: UNIT_NAME } });
    if (!unit) throw new Error(`Không tìm thấy Unit "${UNIT_NAME}".`);
    const materialUnit = await prisma.unit.findFirst({ where: { name: MATERIAL_UNIT_NAME } });
    if (!materialUnit) throw new Error(`Không tìm thấy Unit "${MATERIAL_UNIT_NAME}".`);

    const ids = {
      productTypeId: productType.id,
      productionCenterId: productionCenter.id,
      unitId: unit.id,
      materialUnitId: materialUnit.id,
    };

    for (const spec of PRODUCTS) {
      await createOne(svc, spec, ids);
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
