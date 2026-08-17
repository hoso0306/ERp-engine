/**
 * Tạo sản phẩm "Rèm Sáo nhôm" — tham khảo cấu trúc "Rèm sáo gỗ" (SP000150),
 * thay Bản/Hệ dây bằng tham số "Kéo" (Trái/Phải), giá nhập/giá bán vẫn nhập
 * tay theo m² như sáo gỗ. Theo yêu cầu người dùng 2026-08-17:
 *
 *   Quy cách: Rộng, cao, Mã Rèm (tự nhập), Kéo: kéo Trái, kéo Phải
 *   Đơn giá: Giá nhập (tự nhập) giá bán (tự nhập)
 *   Quy định <1m² tính bù = 1m²
 *
 * Idempotent theo tên sản phẩm. Yêu cầu local đã có ProductType "Mành", Unit
 * "m²", Production Center XW004 (Xưởng Cầu Vồng) — dùng chung với Rèm sáo gỗ.
 *
 * Chạy (từ apps/api, trong container production):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-rem-sao-nhom-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Mành';
const UNIT_NAME = 'm²';
const PRODUCTION_CENTER_CODE = 'XW004';
const PRODUCT_NAME = 'Rèm Sáo nhôm';
const NEW_MATERIAL_NAME = 'Giá vốn Rèm sáo nhôm (nhập tay)';

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
    const existing = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (existing) {
      console.log(`[BỎ QUA] Product "${PRODUCT_NAME}" đã tồn tại (${existing.code}).`);
      return;
    }

    console.log('Tra cứu Master Data tham chiếu...');
    const productTypeId = await resolveByName('productType', PRODUCT_TYPE_NAME);
    const unitId = await resolveByName('unit', UNIT_NAME);
    const productionCenterId = await resolveByCode('productionCenter', PRODUCTION_CENTER_CODE);

    // Vật tư ảo đại diện giá vốn nhập tay — PHẢI dùng Unit "Khoản" (không phải
    // Unit của sản phẩm) và có Material Price mặc định = 1, đúng pattern
    // "Giá vốn Rèm sáo gỗ (nhập tay)" (NL000360). Nếu không, BOM Engine không
    // tìm thấy giá mặc định -> unitPrice fallback về 0 -> giá vốn tính = 0 ->
    // Lãi lỗ báo giá bị đội sai (đã gặp bug thật trên Local, xem 2707.md Việc 9).
    const khoanUnitId = await resolveByName('unit', 'Khoản');
    console.log(`\n--- Tạo Material "${NEW_MATERIAL_NAME}" ---`);
    let material = await prisma.material.findFirst({ where: { name: NEW_MATERIAL_NAME } });
    if (material) {
      console.log(`  [BỎ QUA] Material đã tồn tại (${material.code}).`);
    } else {
      material = await svc.createMaterial({ name: NEW_MATERIAL_NAME, unitId: khoanUnitId } as any);
      console.log(`  Tạo ${material.code} "${NEW_MATERIAL_NAME}" (Unit: Khoản)`);
      await svc.createMaterialPrice(material.id, {
        price: 1,
        effectiveFrom: new Date().toISOString(),
        isDefault: true,
        note: 'Vật tư ảo — đại diện giá vốn nhập tay (tham số giavon), không phải vật tư tiêu hao thật.',
      } as any);
      console.log('  Tạo Material Price mặc định: 1đ/Khoản.');
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId, productionCenterId } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
    await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
    await svc.createProductParameter(product.id, { name: 'marem', label: 'Mã rèm', type: 'TEXT', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 3 } as any);
    await svc.createProductParameter(product.id, { name: 'keo', label: 'Kéo', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 4, options: [
      { value: 'trai', label: 'Kéo Trái', displayOrder: 0 },
      { value: 'phai', label: 'Kéo Phải', displayOrder: 1 },
    ] } as any);
    await svc.createProductParameter(product.id, { name: 'giavon', label: 'Giá vốn', type: 'NUMBER', unit: 'đ/m²', isRequired: true, usedInPricing: false, usedInMaterial: true, displayOrder: 5 } as any);
    await svc.createProductParameter(product.id, { name: 'dongia', label: 'Giá bán', type: 'NUMBER', unit: 'đ/m²', isRequired: true, usedInPricing: true, usedInMaterial: false, displayOrder: 6 } as any);

    await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);

    console.log('  Tạo Pricing Rule Version...');
    const prv = await svc.createPricingRuleVersion(product.id, { name: 'v1', expression: 'dongia * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 8, note: 'Giá bán nhập tay theo m² (giavon/dongia), tham khảo Rèm sáo gỗ.' } as any);
    await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 1, description: 'Diện tích < 1m² tính bằng 1m².', displayOrder: 1 } as any);
    await svc.activatePricingRuleVersion(prv.id);
    console.log('  Xong.');

    console.log('  Tạo Material Requirement Version (BOM)...');
    const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
    await svc.createMaterialRequirementItem(mrv.id, { materialId: material.id, expression: 'giavon * area', wastePercent: 0, condition: undefined, note: undefined, displayOrder: 1 } as any);
    await svc.activateMaterialRequirementVersion(mrv.id);
    console.log('  Xong.');

    console.log('  Chuyển Product sang ACTIVE...');
    await svc.updateProductStatus(product.id, 'ACTIVE');
    console.log(`\nHoàn tất. Sản phẩm ${product.code} "${PRODUCT_NAME}" đã ACTIVE, sẵn sàng dùng trong báo giá.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
