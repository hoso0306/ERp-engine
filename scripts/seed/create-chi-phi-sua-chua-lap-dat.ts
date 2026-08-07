/**
 * Tạo sản phẩm "Chi phí Sửa chữa / Lắp đặt" — mục 12 phiếu tay khách hàng
 * (workbench/sessions/2707.md phiên hiện tại). Dòng "dịch vụ" tự do trong
 * Báo giá: chọn loại (Sửa chữa/Công lắp đặt), gõ diễn giải tự do, nhập tay
 * giá bán VÀ giá vốn — không qua công thức kỹ thuật, không tiêu hao vật tư
 * thật. Dùng cơ chế Product/Pricing Engine có sẵn (không tạo QuotationItemType
 * mới) theo quyết định đã chốt với người dùng trong phiên.
 *
 * Thiết kế:
 * - Tham số `dongia` (NUMBER, usedInPricing) — Pricing Rule expression =
 *   `dongia` (giá bán = đúng số nhập, không nhân/cộng gì thêm). Đặt tên
 *   `dongia` thay vì `giatien` (khác thiết kế gốc trên Local, đã sửa lại
 *   tương tự SP000141/SP000146) để tự động được ẩn khỏi bản in nhờ
 *   `HIDDEN_PARAM_NAMES` (mục 18) — không cần bước đổi tên riêng như mục 19
 *   đã phải làm cho Local.
 * - Tham số `giavon` (NUMBER, usedInMaterial) — Material Requirement cần
 *   ÍT NHẤT 1 dòng mới activate được (activateMaterialRequirementVersion
 *   chặn version rỗng), nên dùng 1 vật tư ảo giá 1đ/đơn vị, số lượng =
 *   đúng `giavon` nhập → giá vốn dòng = đúng số `giavon`, độc lập với
 *   `dongia`. Vật tư ảo dùng chung ý tưởng với PHI_SAN_XUAT đã có ở các
 *   sản phẩm khác (NL000020 — xem workbench/sessions/2707.md mục 4/9).
 * - `loaichiphi` (ENUM Sửa chữa/Công lắp đặt) + `diengiai` (TEXT, bắt buộc)
 *   chỉ mô tả, không dùng cho giá/vật tư.
 * - VAT = 0% (chốt với người dùng), không làm tròn giá.
 * - Duyệt báo giá vẫn sinh Phiếu sản xuất (theo dõi hoàn thành như công
 *   việc thật) ở Xưởng mới "Đội thi công/Lắp đặt".
 *
 * Idempotent theo tên (Product/ProductType/Unit/ProductionCenter/Material) —
 * an toàn chạy lại nhiều lần, không tạo trùng.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-chi-phi-sua-chua-lap-dat.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_TYPE_NAME = 'Dịch vụ';
const UNIT_NAME = 'Khoản';
const PRODUCTION_CENTER_NAME = 'Đội thi công/Lắp đặt';
const PLACEHOLDER_MATERIAL_NAME = 'PHI_SAN_XUAT Dịch vụ Sửa chữa/Lắp đặt';
const PRODUCT_NAME = 'Chi phí Sửa chữa / Lắp đặt';

let prisma: PrismaService;

async function ensureProductType(svc: ProductService, name: string): Promise<string> {
  const existing = await prisma.productType.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await svc.createProductType({ name } as any);
  console.log(`  [TẠO MỚI] ProductType "${name}"`);
  return created.id;
}

async function ensureUnit(svc: ProductService, name: string): Promise<string> {
  const existing = await prisma.unit.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await svc.createUnit({ name } as any);
  console.log(`  [TẠO MỚI] Unit "${name}"`);
  return created.id;
}

async function ensureProductionCenter(svc: ProductService, name: string): Promise<string> {
  const existing = await prisma.productionCenter.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await svc.createProductionCenter({ name } as any);
  console.log(`  [TẠO MỚI] ProductionCenter "${name}" (${created.code})`);
  return created.id;
}

async function ensurePlaceholderMaterial(svc: ProductService, name: string, unitId: string): Promise<string> {
  const existing = await prisma.material.findFirst({ where: { name } });
  if (existing) return existing.id;
  const material = await svc.createMaterial({ name, unitId } as any);
  await svc.createMaterialPrice(material.id, {
    price: 1,
    effectiveFrom: new Date().toISOString(),
    isDefault: true,
    note: 'Vật tư ảo — đại diện giá vốn nhập tay (tham số giavon) cho dòng dịch vụ, không phải vật tư tiêu hao thật.',
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
    const unitId = await ensureUnit(svc, UNIT_NAME);
    const productionCenterId = await ensureProductionCenter(svc, PRODUCTION_CENTER_NAME);
    const placeholderMaterialId = await ensurePlaceholderMaterial(svc, PLACEHOLDER_MATERIAL_NAME, unitId);

    const existingProduct = await prisma.product.findFirst({
      where: { name: PRODUCT_NAME, deletedAt: null },
    });
    if (existingProduct) {
      console.log(`\n[BỎ QUA] Product "${PRODUCT_NAME}" đã tồn tại (${existingProduct.code}).`);
      return;
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({
      name: PRODUCT_NAME,
      productTypeId,
      unitId,
      productionCenterId,
    } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, {
      name: 'loaichiphi',
      label: 'Loại chi phí',
      type: 'ENUM',
      isRequired: true,
      usedInPricing: false,
      usedInMaterial: false,
      displayOrder: 1,
      options: [
        { value: 'sua_chua', label: 'Sửa chữa', displayOrder: 0 },
        { value: 'cong_lap_dat', label: 'Công lắp đặt', displayOrder: 1 },
      ],
    } as any);

    await svc.createProductParameter(product.id, {
      name: 'diengiai',
      label: 'Diễn giải',
      type: 'TEXT',
      isRequired: true,
      usedInPricing: false,
      usedInMaterial: false,
      displayOrder: 2,
    } as any);

    await svc.createProductParameter(product.id, {
      name: 'dongia',
      label: 'Giá tiền',
      type: 'NUMBER',
      unit: 'đ',
      isRequired: true,
      usedInPricing: true,
      usedInMaterial: false,
      minValue: 0,
      displayOrder: 3,
    } as any);

    await svc.createProductParameter(product.id, {
      name: 'giavon',
      label: 'Giá vốn',
      type: 'NUMBER',
      unit: 'đ',
      isRequired: true,
      usedInPricing: false,
      usedInMaterial: true,
      minValue: 0,
      displayOrder: 4,
    } as any);

    const prv = await svc.createPricingRuleVersion(product.id, {
      name: 'v1',
      expression: 'dongia',
      priceRoundType: 'NONE',
      vatRate: 0,
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
