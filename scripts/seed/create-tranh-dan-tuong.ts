/**
 * Tạo sản phẩm "Tranh dán tường" — dòng sản phẩm mới hoàn toàn, chốt qua trao
 * đổi trực tiếp với người dùng (12/08/2026, từ ảnh chụp bảng giá viết tay):
 *
 * - Không có ProductType/sản phẩm tham chiếu nào phù hợp (toàn bộ Master Data
 *   hiện tại là Rèm/Bạt/Cửa/Mành/Dịch vụ) → tạo ProductType mới "Tranh dán
 *   tường", gắn ProductionCenter "Xưởng Cầu Vồng" (chốt theo người dùng).
 * - 2 tham số ENUM: "Kiểu in" (kieuin: thường/nổi 100/200/300%) và "Loại mực"
 *   (loaimuc: hàn/UV/UVPB) — cả 2 usedInPricing + usedInMaterial vì giá bán
 *   PHỤ THUỘC cả 2 chiều (chốt lại: ban đầu người dùng nói giá bán chỉ theo
 *   Kiểu in, sau đó đính chính giá bán phụ thuộc cả Loại mực — vd Nổi 100%
 *   mực UV = 170k, mực UVPB = 200k).
 * - 9 Material mới (mỗi tổ hợp Kiểu in × Loại mực có nghĩa nghiệp vụ là 1
 *   Material riêng, đơn giá tính thẳng theo m² — không có hệ số hao phí vì
 *   giá trong bảng gốc đã là chi phí vật tư/m² thành phẩm). "Thường" hợp lệ
 *   với cả 3 loại mực; "Nổi 100/200/300%" chỉ hợp lệ với UV/UVPB (không có
 *   mực Hàn) — do đó BOM chỉ có 9 dòng, không phải 12 (4×3).
 * - Price Matrix vẫn phải phủ đủ cartesian 4×3=12 dòng (ràng buộc kỹ thuật
 *   của hệ thống — không hỗ trợ ma trận thưa). 3 tổ hợp không hợp lệ (Nổi
 *   100/200/300% × Hàn) được lấp bằng giá của tổ hợp cùng mức với mực UV —
 *   không có ý nghĩa thực tế vì bị Validation Rule BLOCK bên dưới chặn không
 *   cho chọn.
 * - Validation Rule BLOCK: kieuin != "thuong" && loaimuc == "han" → "Mực in
 *   không phù hợp" (chốt theo yêu cầu người dùng, chặn cứng không cho lưu).
 *
 * Idempotent theo tên sản phẩm — an toàn chạy lại nhiều lần (bỏ qua nếu đã
 * tồn tại). Sản phẩm tạo ở trạng thái DRAFT — người dùng tự Activate sau khi
 * review trên UI.
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-tranh-dan-tuong.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAME = 'Tranh dán tường';
const PRODUCT_TYPE_NAME = 'Tranh dán tường';
const PRODUCTION_CENTER_NAME = 'Xưởng Cầu Vồng';
const UNIT_NAME = 'm²';

const MATERIALS = [
  { key: 'thuong_han', name: 'Vật tư Tranh dán Thường mực Hàn', price: 70000 },
  { key: 'thuong_uv', name: 'Vật tư Tranh dán Thường mực UV', price: 90000 },
  { key: 'thuong_uvpb', name: 'Vật tư Tranh dán Thường mực UVPB', price: 100000 },
  { key: 'noi100_uv', name: 'Vật tư Tranh dán Nổi 100% mực UV', price: 140000 },
  { key: 'noi100_uvpb', name: 'Vật tư Tranh dán Nổi 100% mực UVPB', price: 160000 },
  { key: 'noi200_uv', name: 'Vật tư Tranh dán Nổi 200% mực UV', price: 190000 },
  { key: 'noi200_uvpb', name: 'Vật tư Tranh dán Nổi 200% mực UVPB', price: 210000 },
  { key: 'noi300_uv', name: 'Vật tư Tranh dán Nổi 300% mực UV', price: 250000 },
  { key: 'noi300_uvpb', name: 'Vật tư Tranh dán Nổi 300% mực UVPB', price: 270000 },
] as const;

let prisma: PrismaService;

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

    console.log('--- Resolve ProductType / ProductionCenter / Unit ---');
    let productType = await prisma.productType.findUnique({ where: { name: PRODUCT_TYPE_NAME } });
    if (!productType) {
      productType = await svc.createProductType({ name: PRODUCT_TYPE_NAME } as any);
      console.log(`  Tạo ProductType mới "${PRODUCT_TYPE_NAME}"`);
    } else {
      console.log(`  [BỎ QUA] ProductType "${PRODUCT_TYPE_NAME}" đã tồn tại.`);
    }
    const productionCenter = await prisma.productionCenter.findFirst({ where: { name: PRODUCTION_CENTER_NAME } });
    if (!productionCenter) throw new Error(`Không tìm thấy ProductionCenter "${PRODUCTION_CENTER_NAME}".`);
    const unit = await prisma.unit.findFirst({ where: { name: UNIT_NAME } });
    if (!unit) throw new Error(`Không tìm thấy Unit "${UNIT_NAME}".`);
    console.log(`  productTypeId=${productType.id}, productionCenterId=${productionCenter.id}, unitId=${unit.id}`);

    console.log('\n--- Tạo 9 vật tư mực in ---');
    const today = new Date().toISOString().slice(0, 10);
    const materialIds: Record<string, string> = {};
    for (const m of MATERIALS) {
      let material = await prisma.material.findFirst({ where: { name: m.name } });
      if (!material) {
        material = await svc.createMaterial({ name: m.name, unitId: unit.id } as any);
        await svc.createMaterialPrice(material.id, { price: m.price, effectiveFrom: today, isDefault: true } as any);
        console.log(`  Tạo ${material.code} "${m.name}" - giá ${m.price.toLocaleString('vi-VN')}đ/m²`);
      } else {
        console.log(`  [BỎ QUA] "${m.name}" đã tồn tại (${material.code}).`);
      }
      materialIds[m.key] = material.id;
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({
      name: PRODUCT_NAME,
      productTypeId: productType.id,
      unitId: unit.id,
      productionCenterId: productionCenter.id,
    } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
    await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
    await svc.createProductParameter(product.id, {
      name: 'kieuin', label: 'Kiểu in', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3,
      options: [
        { value: 'thuong', label: 'Thường', displayOrder: 0 },
        { value: 'noi_100', label: 'Nổi 100%', displayOrder: 1 },
        { value: 'noi_200', label: 'Nổi 200%', displayOrder: 2 },
        { value: 'noi_300', label: 'Nổi 300%', displayOrder: 3 },
      ],
    } as any);
    await svc.createProductParameter(product.id, {
      name: 'loaimuc', label: 'Loại mực', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 4,
      options: [
        { value: 'han', label: 'Hàn', displayOrder: 0 },
        { value: 'uv', label: 'UV', displayOrder: 1 },
        { value: 'uvpb', label: 'UVPB', displayOrder: 2 },
      ],
    } as any);

    await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm²', displayOrder: 1 } as any);

    await svc.createValidationRule(product.id, {
      expression: 'kieuin != "thuong" && loaimuc == "han"',
      severity: 'BLOCK',
      message: 'Mực in không phù hợp',
      displayOrder: 1,
    } as any);

    console.log('\n--- Cấu hình giá bán ---');
    const prv = await svc.createPricingRuleVersion(product.id, {
      name: 'v1', expression: 'unitPrice * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 8,
      note: 'Giá bán phụ thuộc cả Kiểu in và Loại mực. Tổ hợp Nổi % × Hàn không có nghĩa nghiệp vụ (lấp giá = cùng mức ×UV), bị Validation Rule BLOCK chặn không cho chọn.',
    } as any);
    await svc.updatePriceMatrix(prv.id, [
      { dimensions: { kieuin: 'thuong', loaimuc: 'han' }, unitPrice: 130000, displayOrder: 0 },
      { dimensions: { kieuin: 'thuong', loaimuc: 'uv' }, unitPrice: 130000, displayOrder: 1 },
      { dimensions: { kieuin: 'thuong', loaimuc: 'uvpb' }, unitPrice: 130000, displayOrder: 2 },
      { dimensions: { kieuin: 'noi_100', loaimuc: 'han' }, unitPrice: 170000, displayOrder: 3 },
      { dimensions: { kieuin: 'noi_100', loaimuc: 'uv' }, unitPrice: 170000, displayOrder: 4 },
      { dimensions: { kieuin: 'noi_100', loaimuc: 'uvpb' }, unitPrice: 200000, displayOrder: 5 },
      { dimensions: { kieuin: 'noi_200', loaimuc: 'han' }, unitPrice: 220000, displayOrder: 6 },
      { dimensions: { kieuin: 'noi_200', loaimuc: 'uv' }, unitPrice: 220000, displayOrder: 7 },
      { dimensions: { kieuin: 'noi_200', loaimuc: 'uvpb' }, unitPrice: 240000, displayOrder: 8 },
      { dimensions: { kieuin: 'noi_300', loaimuc: 'han' }, unitPrice: 280000, displayOrder: 9 },
      { dimensions: { kieuin: 'noi_300', loaimuc: 'uv' }, unitPrice: 280000, displayOrder: 10 },
      { dimensions: { kieuin: 'noi_300', loaimuc: 'uvpb' }, unitPrice: 310000, displayOrder: 11 },
    ]);
    await svc.activatePricingRuleVersion(prv.id);
    console.log('  Đã tạo + activate v1 (12 dòng ma trận giá)');

    console.log('\n--- Cấu hình giá vốn (BOM) ---');
    const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
    const BOM_ITEMS: { materialId: string; expression: string; condition: string; wastePercent: number; displayOrder: number }[] = [
      { materialId: materialIds.thuong_han, expression: 'area', condition: 'kieuin == "thuong" && loaimuc == "han"', wastePercent: 0, displayOrder: 1 },
      { materialId: materialIds.thuong_uv, expression: 'area', condition: 'kieuin == "thuong" && loaimuc == "uv"', wastePercent: 0, displayOrder: 2 },
      { materialId: materialIds.thuong_uvpb, expression: 'area', condition: 'kieuin == "thuong" && loaimuc == "uvpb"', wastePercent: 0, displayOrder: 3 },
      { materialId: materialIds.noi100_uv, expression: 'area', condition: 'kieuin == "noi_100" && loaimuc == "uv"', wastePercent: 0, displayOrder: 4 },
      { materialId: materialIds.noi100_uvpb, expression: 'area', condition: 'kieuin == "noi_100" && loaimuc == "uvpb"', wastePercent: 0, displayOrder: 5 },
      { materialId: materialIds.noi200_uv, expression: 'area', condition: 'kieuin == "noi_200" && loaimuc == "uv"', wastePercent: 0, displayOrder: 6 },
      { materialId: materialIds.noi200_uvpb, expression: 'area', condition: 'kieuin == "noi_200" && loaimuc == "uvpb"', wastePercent: 0, displayOrder: 7 },
      { materialId: materialIds.noi300_uv, expression: 'area', condition: 'kieuin == "noi_300" && loaimuc == "uv"', wastePercent: 0, displayOrder: 8 },
      { materialId: materialIds.noi300_uvpb, expression: 'area', condition: 'kieuin == "noi_300" && loaimuc == "uvpb"', wastePercent: 0, displayOrder: 9 },
    ];
    for (const it of BOM_ITEMS) {
      await svc.createMaterialRequirementItem(mrv.id, it as any);
    }
    await svc.activateMaterialRequirementVersion(mrv.id);
    console.log(`  Đã tạo + activate v1 (${BOM_ITEMS.length} dòng BOM)`);

    console.log(`\n=== DONE: ${product.code} "${PRODUCT_NAME}" (DRAFT) ===`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
