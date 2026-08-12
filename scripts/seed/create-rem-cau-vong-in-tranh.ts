/**
 * Tạo sản phẩm "[RCV] - Rèm cầu vồng in tranh" — nhân bản cấu trúc SP000075
 * ([RCV] APOLO - AP), chốt qua trao đổi trực tiếp với người dùng (12/08/2026):
 *
 * - marem: chỉ 2 lựa chọn "Cản sáng 85%" / "Cản sáng 95%" (khác 5 mã AP901-905
 *   của SP75 — đây là sản phẩm vải in tranh, không phải các mã màu AP).
 * - mangremcuon: chỉ 1 lựa chọn "Máng cầu vồng" — dùng vật tư NL000200 (khác
 *   NL000091/139 của SP75), kèm Thanh đáy nhôm (NL000095) + Thanh ty nhôm
 *   (NL000096) y hệt SP75 (chốt: "dùng kiểu rcv" cho công thức NL000200 —
 *   (chieurong-0.004)*0.45, waste 5% — KHÔNG dùng công thức NL000200 đang có
 *   sẵn ở dòng Rèm cuốn SP96/97 vốn là chieurong*0.45, waste 0%).
 * - Không có surchargeExpression (chỉ 1 loại máng, không cần phụ phí lắp đặt
 *   nhôm như SP75).
 * - Giá bán: 470k (Cản sáng 85%), 570k (Cản sáng 95%) — đơn giá nhân với
 *   biến "area", và area = chieurong*chieucao*2 (KHÔNG phải chieurong*chieucao
 *   như SP75) vì rèm cầu vồng in tranh cần 2 lớp vải chồng nhau — chốt sau khi
 *   phát hiện area*2 chỉ áp cho công thức vải mà KHÔNG áp cho giá bán khiến
 *   giá vốn > giá bán (lỗ ~284k/bộ). "area" phải dùng CHUNG 1 định nghĩa cho
 *   cả giá bán lẫn định mức vật liệu, không tách riêng.
 * - Vải in tranh: 2 Material MỚI, đơn vị m² (giá nhập theo m², KHÁC đơn vị "m
 *   dài" của vải SP75), công thức vải = area (area đã gồm sẵn hệ số 2 ở trên,
 *   KHÔNG nhân thêm *2 nữa) — KHÁC area/3.1*2 của SP75, chốt theo yêu cầu
 *   người dùng vì giá nhập 180k/208k đã là giá/m² vải.
 *
 * Idempotent theo tên sản phẩm — an toàn chạy lại nhiều lần (bỏ qua nếu đã
 * tồn tại). Sản phẩm tạo ở trạng thái DRAFT — người dùng tự Activate sau khi
 * review trên UI.
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-rem-cau-vong-in-tranh.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAME = '[RCV] - Rèm cầu vồng in tranh';
const REFERENCE_PRODUCT_CODE = 'SP000075';

const VAI_85_NAME = 'Vải in tranh cản sáng 85%';
const VAI_95_NAME = 'Vải in tranh cản sáng 95%';

let prisma: PrismaService;

async function resolveExistingMaterialIds(codes: string[]): Promise<Record<string, string>> {
  const rows = await prisma.material.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const map: Record<string, string> = {};
  for (const c of codes) {
    const m = rows.find((r) => r.code === c);
    if (!m) throw new Error(`Material ${c} không tồn tại trên môi trường này.`);
    map[c] = m.id;
  }
  return map;
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

    const reference = await prisma.product.findUnique({ where: { code: REFERENCE_PRODUCT_CODE } });
    if (!reference) throw new Error(`Không tìm thấy sản phẩm tham chiếu ${REFERENCE_PRODUCT_CODE}.`);
    const { productTypeId, unitId, productionCenterId } = reference;
    console.log(`Tham chiếu ${REFERENCE_PRODUCT_CODE}: productTypeId=${productTypeId}, unitId=${unitId}, productionCenterId=${productionCenterId}`);

    console.log('\n--- Tạo 2 vật tư vải in tranh mới ---');
    const today = new Date().toISOString().slice(0, 10);

    let vai85 = await prisma.material.findFirst({ where: { name: VAI_85_NAME } });
    if (!vai85) {
      vai85 = await svc.createMaterial({ name: VAI_85_NAME, unitId } as any);
      await svc.createMaterialPrice(vai85.id, { price: 180000, effectiveFrom: today, isDefault: true } as any);
      console.log(`  Tạo ${vai85.code} "${VAI_85_NAME}" - giá nhập 180.000đ/m²`);
    } else {
      console.log(`  [BỎ QUA] "${VAI_85_NAME}" đã tồn tại (${vai85.code}).`);
    }

    let vai95 = await prisma.material.findFirst({ where: { name: VAI_95_NAME } });
    if (!vai95) {
      vai95 = await svc.createMaterial({ name: VAI_95_NAME, unitId } as any);
      await svc.createMaterialPrice(vai95.id, { price: 208000, effectiveFrom: today, isDefault: true } as any);
      console.log(`  Tạo ${vai95.code} "${VAI_95_NAME}" - giá nhập 208.000đ/m²`);
    } else {
      console.log(`  [BỎ QUA] "${VAI_95_NAME}" đã tồn tại (${vai95.code}).`);
    }

    console.log(`\n--- Tạo Product "${PRODUCT_NAME}" ---`);
    const product = await svc.createProduct({ name: PRODUCT_NAME, productTypeId, unitId, productionCenterId } as any);
    console.log(`  Tạo ${product.code} "${PRODUCT_NAME}"`);

    await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
    await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
    await svc.createProductParameter(product.id, {
      name: 'marem', label: 'Mã rèm', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3,
      options: [
        { value: 'cansang85', label: 'Cản sáng 85%', displayOrder: 0 },
        { value: 'cansang95', label: 'Cản sáng 95%', displayOrder: 1 },
      ],
    } as any);
    await svc.createProductParameter(product.id, {
      name: 'mangremcuon', label: 'Loại máng', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 4,
      options: [{ value: 'mangcauvong', label: 'Máng cầu vồng', displayOrder: 0 }],
    } as any);

    await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao * 2', unit: 'm²', displayOrder: 1 } as any);

    await svc.createValidationRule(product.id, { expression: 'chieucao < 1', severity: 'WARN', message: 'Chiều cao < 1m sẽ tính bằng 1m', displayOrder: 1 } as any);
    await svc.createValidationRule(product.id, { expression: 'area < 1', severity: 'WARN', message: 'Diện tích < 1m² sẽ tính bằng 1m²', displayOrder: 2 } as any);

    console.log('\n--- Cấu hình giá bán ---');
    const prv = await svc.createPricingRuleVersion(product.id, {
      name: 'v1', expression: 'unitPrice * area', priceRoundType: 'CEIL', priceRoundValue: 100, vatRate: 8,
      note: 'Nhân bản cấu trúc SP000075, không có surcharge vì chỉ 1 loại máng.',
    } as any);
    await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_AREA', value: 1, displayOrder: 1, description: 'Bộ rèm có diện tích nhỏ hơn 1m² tính bằng 1m².' } as any);
    await svc.createPricingRuleItem(prv.id, { ruleType: 'MIN_DIMENSION', targetParameter: 'chieucao', value: 1, displayOrder: 2, description: 'Bộ rèm trên 1m² có chiều cao thấp hơn 1m tính bằng 1m.' } as any);
    await svc.updatePriceMatrix(prv.id, [
      { dimensions: { marem: 'cansang85', mangremcuon: 'mangcauvong' }, unitPrice: 470000, displayOrder: 0 },
      { dimensions: { marem: 'cansang95', mangremcuon: 'mangcauvong' }, unitPrice: 570000, displayOrder: 1 },
    ]);
    await svc.activatePricingRuleVersion(prv.id);
    console.log('  Đã tạo + activate v1 (2 dòng ma trận giá)');

    console.log('\n--- Cấu hình giá vốn (BOM) ---');
    const existingMaterialIds = await resolveExistingMaterialIds(['NL000093', 'NL000094', 'NL000095', 'NL000096', 'NL000097', 'NL000098', 'NL000099', 'NL000200']);

    const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
    const BOM_ITEMS: { materialId: string; expression: string; condition?: string; wastePercent: number; roundStep?: number; displayOrder: number }[] = [
      { materialId: vai85.id, expression: 'area', condition: 'marem == "cansang85"', wastePercent: 30, roundStep: 0.0001, displayOrder: 1 },
      { materialId: vai95.id, expression: 'area', condition: 'marem == "cansang95"', wastePercent: 30, roundStep: 0.0001, displayOrder: 2 },
      { materialId: existingMaterialIds.NL000093, expression: '(chieurong - 0.017) * 0.26', condition: 'chieurong >= 1.6', wastePercent: 5, roundStep: 0.0001, displayOrder: 3 },
      { materialId: existingMaterialIds.NL000094, expression: '(chieurong - 0.017) * 0.194', condition: 'chieurong < 1.6', wastePercent: 5, roundStep: 0.0001, displayOrder: 4 },
      { materialId: existingMaterialIds.NL000095, expression: '(chieurong - 0.018) * 0.3', wastePercent: 5, roundStep: 0.0001, displayOrder: 5 },
      { materialId: existingMaterialIds.NL000096, expression: '(chieurong - 0.02) * 0.129', wastePercent: 5, roundStep: 0.0001, displayOrder: 6 },
      { materialId: existingMaterialIds.NL000097, expression: '1', condition: 'chieurong < 1.6', wastePercent: 0, displayOrder: 7 },
      { materialId: existingMaterialIds.NL000098, expression: '1', condition: 'chieurong >= 1.6', wastePercent: 0, displayOrder: 8 },
      { materialId: existingMaterialIds.NL000099, expression: '1', wastePercent: 0, displayOrder: 9 },
      { materialId: existingMaterialIds.NL000200, expression: '(chieurong - 0.004) * 0.45', wastePercent: 5, roundStep: 0.0001, displayOrder: 10 },
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
