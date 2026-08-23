/**
 * Tạo sản phẩm "Rèm sáo gỗ" — mục (5) phiếu tay khách hàng
 * (workbench/sessions/2707.md phiên hiện tại). Toàn bộ giá bán VÀ giá vốn
 * đều nhập tay theo m² (không có mức giá cố định nào) — dùng đúng pattern
 * `dongia`/`giavon` × `area` đã áp dụng cho nhánh "Vẽ thủ công" của Mành Tăm
 * (SP000146, xem scripts/seed/create-manh-truc-manh-tam.ts), nhưng áp dụng
 * cho toàn bộ sản phẩm nên không cần Price Matrix / rẽ nhánh if().
 *
 * Quy cách "Bản 35/Bản 50" và "Hệ 1 dây/Hệ 2 dây" chỉ mô tả (production
 * info), không ảnh hưởng giá/vật tư — usedInPricing=usedInMaterial=false,
 * giống pattern `loaichiphi` ở create-chi-phi-sua-chua-lap-dat.ts.
 *
 * Đặt tên tham số đúng `dongia`/`giavon` (không đặt tên riêng) để tự động
 * ẩn khỏi bản in Báo giá/Phiếu sản xuất nhờ `HIDDEN_PARAM_NAMES` có sẵn.
 *
 * Dùng lại Master Data có sẵn: ProductType "Mành" (cùng nhóm Mành Trúc/Mành
 * Tăm), Unit "m²"/"Khoản", ProductionCenter "Xưởng Cầu Vồng" — không tự tạo
 * nếu thiếu (báo lỗi rõ ràng, tránh tạo nhầm bản sao).
 *
 * Idempotent theo tên Product/Material — an toàn chạy lại nhiều lần.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-rem-sao-go.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const UNIT_M2 = 'm²';
const UNIT_KHOAN = 'Khoản';
const PRODUCTION_CENTER_NAME = 'Xưởng Cầu Vồng';
const PRODUCT_TYPE_NAME = 'Mành';
const PRODUCT_NAME = 'Rèm sáo gỗ';
const PLACEHOLDER_MATERIAL_NAME = 'Giá vốn Rèm sáo gỗ (nhập tay)';

let prisma: PrismaService;

async function requireByName(model: 'unit' | 'productionCenter', name: string): Promise<string> {
  const row = await (prisma[model] as any).findFirst({ where: { name } });
  if (!row) throw new Error(`Không tìm thấy ${model} với name="${name}" — kiểm tra lại Master Data trước khi chạy script.`);
  return row.id;
}

async function requireProductType(name: string): Promise<string> {
  const row = await prisma.productType.findUnique({ where: { name } });
  if (!row) throw new Error(`Không tìm thấy ProductType với name="${name}".`);
  return row.id;
}

async function ensurePlaceholderMaterial(svc: ProductService, name: string, unitId: string): Promise<string> {
  const existing = await prisma.material.findFirst({ where: { name } });
  if (existing) return existing.id;
  const material = await svc.createMaterial({ name, unitId } as any);
  await svc.createMaterialPrice(material.id, {
    price: 1,
    effectiveFrom: new Date().toISOString(),
    isDefault: true,
    note: 'Vật tư ảo — đại diện giá vốn nhập tay (tham số giavon), không phải vật tư tiêu hao thật.',
  } as any);
  console.log(`  [TẠO MỚI] Material "${name}" (${material.code}), giá mặc định 1đ`);
  return material.id;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    console.log('Chuẩn bị Master Data...');
    const productTypeId = await requireProductType(PRODUCT_TYPE_NAME);
    const unitM2Id = await requireByName('unit', UNIT_M2);
    const unitKhoanId = await requireByName('unit', UNIT_KHOAN);
    const productionCenterId = await requireByName('productionCenter', PRODUCTION_CENTER_NAME);
    const placeholderMaterialId = await ensurePlaceholderMaterial(svc, PLACEHOLDER_MATERIAL_NAME, unitKhoanId);

    const existing = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (existing) {
      console.log(`\n[BỎ QUA] Product "${PRODUCT_NAME}" đã tồn tại (${existing.code}).`);
      return;
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId: unitM2Id, productionCenterId } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
    await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
    await svc.createProductParameter(product.id, {
      name: 'banrem', label: 'Bản', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 3,
      options: [
        { value: 'ban35', label: 'Bản 35', displayOrder: 0 },
        { value: 'ban50', label: 'Bản 50', displayOrder: 1 },
      ],
    } as any);
    await svc.createProductParameter(product.id, {
      name: 'herem', label: 'Hệ dây', type: 'ENUM', isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 4,
      options: [
        { value: 'he1day', label: 'Hệ 1 dây', displayOrder: 0 },
        { value: 'he2day', label: 'Hệ 2 dây', displayOrder: 1 },
      ],
    } as any);
    await svc.createProductParameter(product.id, {
      name: 'dongia', label: 'Giá bán', type: 'NUMBER', unit: 'đ/m²', isRequired: true, defaultValue: '0', usedInPricing: true, usedInMaterial: false, minValue: 0, displayOrder: 5,
    } as any);
    await svc.createProductParameter(product.id, {
      name: 'giavon', label: 'Giá vốn', type: 'NUMBER', unit: 'đ/m²', isRequired: true, defaultValue: '0', usedInPricing: false, usedInMaterial: true, minValue: 0, displayOrder: 6,
    } as any);

    await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);

    console.log('  Tạo Pricing Rule Version...');
    const prv = await svc.createPricingRuleVersion(product.id, {
      name: 'v1',
      expression: 'dongia * area',
      priceRoundType: 'CEIL',
      priceRoundValue: 100,
      vatRate: 10,
      note: 'Giá bán 100% nhập tay theo m² (không có mức giá cố định) — xem workbench/sessions/2707.md mục (5).',
    } as any);
    await svc.activatePricingRuleVersion(prv.id);

    console.log('  Tạo Material Requirement Version (BOM)...');
    const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
    await svc.createMaterialRequirementItem(mrv.id, {
      materialId: placeholderMaterialId,
      expression: 'giavon * area',
      wastePercent: 0,
      note: 'Vật tư ảo giá 1đ — giá vốn dòng = giavon (đ/m²) × area, độc lập với dongia.',
      displayOrder: 1,
    } as any);
    await svc.activateMaterialRequirementVersion(mrv.id);

    await svc.updateProductStatus(product.id, 'ACTIVE');
    console.log(`\n=== DONE — ${product.code} "${PRODUCT_NAME}" đã ACTIVE ===`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
