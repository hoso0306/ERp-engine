/**
 * Tạo 2 sản phẩm mới "[Vòm tổ ong kéo ngang] Hệ 27" và "... Hệ 30" —
 * dựa trên SP000108/109 "[Vòm tổ ong] - Hệ xếp TL27/TL30" nhưng:
 *   - Diện tích đơn giản area = chieurong * chieucao (KHÔNG dùng công thức
 *     vòm của SP108/109).
 *   - Thêm param `maukhung` (Trắng/Ghi/Café/Vân gỗ) để nhân giá theo 4 mức
 *     (màu thường / màu thường DX / vân gỗ / vân gỗ DX) — pattern lấy từ
 *     SP000040/041 "[Rèm tổ ong - kéo ngang]".
 *   - Vật tư "Thanh đứng trong/ngoài 27/30" của SP108/109 được thay bằng
 *     NL000012 "Máng sâu" (chieurong*0.278, maukhung!=van_go) / NL000047
 *     "Máng sâu - Vân gỗ" (cùng công thức, maukhung==van_go) — tách vật tư
 *     theo màu khung giống pattern SP000040/041 (chốt 14/08/2026).
 *   - Còn lại (Nẹp vòm, Rèm G001-G008/DX0202/0206/0502 theo marem) giữ
 *     nguyên như SP108/109.
 *
 * Idempotent theo TÊN sản phẩm — bỏ qua nếu đã tồn tại.
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-vom-to-ong-keo-ngang.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Rèm tổ ong';
const UNIT_NAME = 'm²';
const PRODUCTION_CENTER_NAME = 'Xưởng Cửa Lưới';

const MAREM_OPTIONS = [
  { value: 'G001', label: 'G001', group: 'G' },
  { value: 'G002', label: 'G002', group: 'G' },
  { value: 'G003', label: 'G003', group: 'G' },
  { value: 'G004', label: 'G004', group: 'G' },
  { value: 'G005', label: 'G005', group: 'G' },
  { value: 'G006', label: 'G006', group: 'G' },
  { value: 'G007', label: 'G007', group: 'G' },
  { value: 'G008', label: 'G008', group: 'G' },
  { value: 'DX0202', label: 'DX0202', group: 'DX' },
  { value: 'DX0206', label: 'DX0206', group: 'DX' },
  { value: 'DX0502', label: 'DX0502', group: 'DX' },
] as const;

const MAUKHUNG_OPTIONS = [
  { value: 'trang', label: 'Trắng', group: 'normal' },
  { value: 'ghi', label: 'Ghi', group: 'normal' },
  { value: 'cafe', label: 'Café', group: 'normal' },
  { value: 'van_go', label: 'Vân gỗ', group: 'wood' },
] as const;

// Rèm G001-G008/DX0202/0206/0502 — mã vật tư trùng tên option marem.
const REM_MATERIAL_CODES: Record<string, string> = {
  G001: 'NL000030', G002: 'NL000031', G003: 'NL000032', G004: 'NL000033',
  G005: 'NL000034', G006: 'NL000035', G007: 'NL000036', G008: 'NL000037',
  DX0202: 'NL000038', DX0206: 'NL000039', DX0502: 'NL000040',
};

type ProductSpec = {
  name: string;
  prices: { G_normal: number; G_wood: number; DX_normal: number; DX_wood: number };
};

const PRODUCTS: ProductSpec[] = [
  { name: '[Vòm tổ ong kéo ngang] Hệ 27', prices: { G_normal: 350000, G_wood: 380000, DX_normal: 380000, DX_wood: 410000 } },
  { name: '[Vòm tổ ong kéo ngang] Hệ 30', prices: { G_normal: 360000, G_wood: 390000, DX_normal: 390000, DX_wood: 420000 } },
];

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    const productType = await prisma.productType.findFirst({ where: { name: PRODUCT_TYPE_NAME } });
    if (!productType) throw new Error(`Không tìm thấy ProductType "${PRODUCT_TYPE_NAME}".`);
    const unit = await prisma.unit.findUnique({ where: { name: UNIT_NAME } });
    if (!unit) throw new Error(`Không tìm thấy Unit "${UNIT_NAME}".`);
    const productionCenter = await prisma.productionCenter.findFirst({ where: { name: PRODUCTION_CENTER_NAME } });
    if (!productionCenter) throw new Error(`Không tìm thấy ProductionCenter "${PRODUCTION_CENTER_NAME}".`);

    const napVom = await prisma.material.findUnique({ where: { code: 'NL000182' } });
    if (!napVom) throw new Error('Không tìm thấy vật tư NL000182 (Nẹp vòm - Rèm tổ ong).');
    const mangSau = await prisma.material.findUnique({ where: { code: 'NL000012' } });
    if (!mangSau) throw new Error('Không tìm thấy vật tư NL000012 (Máng sâu).');
    const mangSauVanGo = await prisma.material.findUnique({ where: { code: 'NL000047' } });
    if (!mangSauVanGo) throw new Error('Không tìm thấy vật tư NL000047 (Máng sâu - Vân gỗ).');
    const remMaterials: Record<string, { id: string; code: string }> = {};
    for (const [marem, code] of Object.entries(REM_MATERIAL_CODES)) {
      const m = await prisma.material.findUnique({ where: { code } });
      if (!m) throw new Error(`Không tìm thấy vật tư ${code} (Rèm ${marem}).`);
      remMaterials[marem] = { id: m.id, code: m.code };
    }

    for (const spec of PRODUCTS) {
      const existing = await prisma.product.findFirst({ where: { name: spec.name, deletedAt: null } });
      if (existing) {
        console.log(`[BỎ QUA] Sản phẩm "${spec.name}" đã tồn tại (${existing.code}).`);
        continue;
      }

      const product = await svc.createProduct({
        name: spec.name,
        productTypeId: productType.id,
        unitId: unit.id,
        productionCenterId: productionCenter.id,
      } as any);
      console.log(`\nTạo sản phẩm ${product.code} "${product.name}".`);

      await svc.createProductParameter(product.id, {
        name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm',
        isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 0,
      } as any);
      await svc.createProductParameter(product.id, {
        name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm',
        isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1,
      } as any);
      await svc.createProductParameter(product.id, {
        name: 'marem', label: 'Mã rèm', type: 'ENUM',
        isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2,
        options: MAREM_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      } as any);
      await svc.createProductParameter(product.id, {
        name: 'maukhung', label: 'Màu khung', type: 'ENUM',
        isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3,
        options: MAUKHUNG_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      } as any);
      console.log('  Đã tạo 4 params: chieurong, chieucao, marem, maukhung.');

      await svc.createDerivedParameter(product.id, {
        name: 'area', expression: 'chieurong * chieucao',
      } as any);
      console.log('  Đã tạo derived param area = chieurong * chieucao.');

      await svc.createValidationRule(product.id, {
        expression: 'area < 0.7', severity: 'WARN',
        message: 'Diện tích < 0,7m² sẽ tính bằng 0,7m²', displayOrder: 0,
      } as any);
      await svc.createValidationRule(product.id, {
        expression: 'area >= 0.7 && area < 1', severity: 'WARN',
        message: 'Diện tích từ 0,7 đến dưới 1m² sẽ tính bằng 1m²', displayOrder: 1,
      } as any);
      console.log('  Đã tạo 2 Validation Rule.');

      // Pricing Rule
      const prv = await svc.createPricingRuleVersion(product.id, {
        expression: 'unitPrice * area',
        priceRoundType: 'CEIL',
        priceRoundValue: 100,
        vatRate: 8,
      } as any);
      const matrixRows = MAREM_OPTIONS.flatMap((marem) =>
        MAUKHUNG_OPTIONS.map((mk) => {
          const priceKey = `${marem.group}_${mk.group}` as keyof ProductSpec['prices'];
          return {
            dimensions: { marem: marem.value, maukhung: mk.value },
            unitPrice: spec.prices[priceKey],
          };
        }),
      );
      await svc.updatePriceMatrix(prv.id, matrixRows as any);
      await svc.createPricingRuleItem(prv.id, {
        ruleType: 'MIN_AREA', value: 0.7,
      } as any);
      await svc.createPricingRuleItem(prv.id, {
        ruleType: 'MIN_AREA', value: 1, condition: 'area >= 0.7 && area < 1',
      } as any);
      await svc.activatePricingRuleVersion(prv.id);
      console.log(`  Đã tạo Pricing Rule: ${matrixRows.length} dòng ma trận + 2 MIN_AREA rule, đã ACTIVE.`);

      // Material Requirement
      const mrv = await svc.createMaterialRequirementVersion(product.id, {} as any);
      await svc.createMaterialRequirementItem(mrv!.id, {
        materialId: napVom.id, expression: 'chieurong*chieucao*2',
      } as any);
      await svc.createMaterialRequirementItem(mrv!.id, {
        materialId: mangSau.id, expression: 'chieurong*0.278', condition: 'maukhung != "van_go"',
      } as any);
      await svc.createMaterialRequirementItem(mrv!.id, {
        materialId: mangSauVanGo.id, expression: 'chieurong*0.278', condition: 'maukhung == "van_go"',
      } as any);
      for (const marem of MAREM_OPTIONS) {
        await svc.createMaterialRequirementItem(mrv!.id, {
          materialId: remMaterials[marem.value].id, expression: 'area*1.5', condition: `marem == "${marem.value}"`,
        } as any);
      }
      await svc.activateMaterialRequirementVersion(mrv!.id);
      console.log('  Đã tạo Material Requirement: 14 dòng (Nẹp vòm + Máng sâu/Vân gỗ + 11 Rèm), đã ACTIVE.');

      await svc.updateProductStatus(product.id, 'ACTIVE');
      console.log(`  Sản phẩm ${product.code} đã chuyển ACTIVE.`);
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
