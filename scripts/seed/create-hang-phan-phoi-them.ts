/**
 * Tạo sản phẩm "Hàng phân phối thêm" — HPPT (SP000141) — workbench/sessions/
 * 2707.md mục 16. Dùng khi bán hàng hóa của nhà phân phối khác, không có
 * trong danh mục sản phẩm tự sản xuất: giá bán VÀ giá vốn đều nhập tay thay
 * vì tính từ công thức/BOM.
 *
 * Thiết kế (đã verify trên Local qua previewPrice/previewMaterial):
 * - Tham số `dongia` (NUMBER, usedInPricing) — Pricing Rule expression =
 *   `dongia` (giá bán = đúng số nhập, không nhân/cộng gì thêm).
 * - Tham số `giavon` (NUMBER, usedInMaterial, **isRequired=true nhưng có
 *   defaultValue="0"**) — KHÔNG được để `isRequired=false`: Expression
 *   Evaluator dùng chung toàn hệ thống không tự áp `defaultValue` khi tham
 *   số bị thiếu (biến không có trong context → lỗi, không trả 0 âm thầm —
 *   xem shared/expression/evaluator.ts). `isRequired=true` buộc form luôn
 *   gửi giá trị (mặc định "0" điền sẵn), tránh lỗi runtime khi để trống.
 *   Material Requirement cần ÍT NHẤT 1 dòng mới activate được nên dùng 1
 *   vật tư ảo giá 1đ/đơn vị, số lượng = đúng `giavon` nhập → giá vốn dòng =
 *   đúng số `giavon`, không trừ kho vật tư thật nào.
 * - `diengiai` (TEXT, bắt buộc) chỉ mô tả, không dùng cho giá/vật tư.
 * - VAT 10% (như hàng thường), không làm tròn giá.
 * - Xưởng: dùng lại XW006 "Hàng thuê gia công" (KHÔNG tạo xưởng mới) — DTO
 *   `CreateProductDto.productionCenterId` đánh dấu optional nhưng service
 *   thực tế bắt buộc, đã xác nhận với người dùng dùng XW006.
 *
 * Idempotent theo tên (Product/ProductType/Material) — an toàn chạy lại
 * nhiều lần, không tạo trùng. ProductType "Hàng phân phối" tự tạo nếu VPS
 * chưa có; Xưởng XW006 BẮT BUỘC đã tồn tại (không tự tạo — dùng lại đúng
 * xưởng hiện có, không phải tạo xưởng mới).
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-hang-phan-phoi-them.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Hàng phân phối';
const UNIT_NAME = 'Bộ';
const PRODUCTION_CENTER_CODE = 'XW006';
const PLACEHOLDER_MATERIAL_NAME = 'Giá vốn hàng phân phối thêm (nhập tay)';
const PRODUCT_NAME = 'Hàng phân phối thêm';

let prisma: PrismaService;

async function ensureProductType(svc: ProductService, name: string): Promise<string> {
  const existing = await prisma.productType.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await svc.createProductType({ name } as any);
  console.log(`  [TẠO MỚI] ProductType "${name}"`);
  return created.id;
}

async function resolveByName(model: 'unit', name: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { name } });
  if (!row) throw new Error(`Không tìm thấy ${model} với name="${name}" trên môi trường này — kiểm tra lại Master Data trước khi chạy script.`);
  return row.id;
}

async function resolveByCode(model: 'productionCenter', code: string): Promise<string> {
  const row = await (prisma[model] as any).findUnique({ where: { code } });
  if (!row) throw new Error(`Không tìm thấy ${model} với code="${code}" trên môi trường này — Xưởng "Hàng thuê gia công" phải đã tồn tại (dùng lại, không tự tạo).`);
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
    note: 'Vật tư ảo — đại diện giá vốn nhập tay (tham số giavon) cho dòng Hàng phân phối thêm, không phải vật tư tiêu hao thật.',
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
    const productTypeId = await ensureProductType(svc, PRODUCT_TYPE_NAME);
    const unitId = await resolveByName('unit', UNIT_NAME);
    const productionCenterId = await resolveByCode('productionCenter', PRODUCTION_CENTER_CODE);
    const placeholderMaterialId = await ensurePlaceholderMaterial(svc, PLACEHOLDER_MATERIAL_NAME, unitId);

    const existingProduct = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (existingProduct) {
      console.log(`\n[BỎ QUA] Product "${PRODUCT_NAME}" đã tồn tại (${existingProduct.code}).`);
      return;
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId, productionCenterId } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, {
      name: 'diengiai', label: 'Diễn giải', type: 'TEXT',
      isRequired: true, usedInPricing: false, usedInMaterial: false, displayOrder: 1,
    } as any);

    await svc.createProductParameter(product.id, {
      name: 'dongia', label: 'Đơn giá', type: 'NUMBER',
      isRequired: true, usedInPricing: true, usedInMaterial: false, displayOrder: 2,
    } as any);

    await svc.createProductParameter(product.id, {
      name: 'giavon', label: 'Giá vốn', type: 'NUMBER',
      isRequired: true, usedInPricing: false, usedInMaterial: true, defaultValue: '0', displayOrder: 3,
    } as any);

    const prv = await svc.createPricingRuleVersion(product.id, {
      name: 'v1',
      expression: 'dongia',
      priceRoundType: 'NONE',
      vatRate: 10,
      note: 'Giá bán nhập tay trực tiếp qua tham số "dongia" — không qua công thức/matrix.',
    } as any);
    await svc.activatePricingRuleVersion(prv.id);

    const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
    await svc.createMaterialRequirementItem(mrv.id, {
      materialId: placeholderMaterialId,
      expression: 'giavon',
      wastePercent: 0,
      displayOrder: 1,
      note: 'Vật tư ảo giá 1đ — số lượng = giavon nhập tay → giá vốn dòng = đúng giavon.',
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
