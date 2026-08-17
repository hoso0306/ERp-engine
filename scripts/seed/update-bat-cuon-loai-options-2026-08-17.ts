/**
 * Sản phẩm "Bạt Cuốn" — tách tham số "Loại" (loai) từ 6 lựa chọn (3 loại
 * đang suy ra "trung/dài" NGẦM theo chiều cao <3m/>=3m) thành 9 lựa chọn TƯỜNG
 * MINH, người dùng tự chọn đúng ngay từ dropdown (chốt 17/08/2026, theo yêu
 * cầu người dùng — workbench/sessions/2707.md).
 *
 * Trước: tayquay, loxothuong, loxoham, daukeo, daukeotichhop, motor (6).
 * Sau:   tayquay, loxothuong_trung, loxothuong_dai, loxoham_trung,
 *        loxoham_dai, daukeo, daukeotichhop_trung, daukeotichhop_dai, motor (9).
 *
 * Thay đổi kèm theo (đã xác nhận với người dùng):
 * 1. Giá bán (Pricing Rule surchargeExpression): "dài" = "trung" + 10.000đ.
 *    Tay quay/Đầu kéo/Motor không tách, phụ phí giữ nguyên như cũ.
 * 2. Giá vốn (Material Requirement):
 *    - 6 dòng "phụ tùng cơ cấu" (lò xo thường/hãm, đầu kéo tích hợp — trung/dài)
 *      hiện đang chọn bằng `loai=="X" && chieucao<3/>=3` → đổi thành chọn
 *      THẲNG theo giá trị enum mới (`loai=="X_trung"` / `loai=="X_dai"`),
 *      không còn phụ thuộc chiều cao nữa.
 *    - Công thức hao hụt vải bạt (13 dòng: 10 dòng vải theo mabat + 3 dòng
 *      ống mái hiên) GIỮ NGUYÊN mức trừ như loại gốc cho cả trung/dài (xác
 *      nhận riêng với người dùng — không tách hao hụt theo trung/dài, chỉ
 *      dòng phụ tùng cơ cấu vật lý mới khác nhau).
 * 3. Tạo Version MỚI cho cả Pricing Rule lẫn Material Requirement (nguyên tắc
 *    Versioning — không sửa đè version ACTIVE). Báo giá DRAFT/SENT cũ đang
 *    dùng giá trị enum cũ (loxothuong/loxoham/daukeotichhop) GIỮ NGUYÊN, không
 *    tự động chuyển đổi — theo đúng yêu cầu người dùng.
 *
 * QUAN TRỌNG — resolve theo TÊN sản phẩm ("Bạt Cuốn"), KHÔNG theo mã code:
 * mã sản phẩm auto-increment độc lập giữa Local/Production, không ổn định
 * giữa 2 môi trường (xem cảnh báo tương tự trong quotations/[id]/print/page.tsx
 * và fix-so-canh-rem-to-ong.ts).
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/update-bat-cuon-loai-options-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAME = 'Bạt Cuốn';

const NEW_OPTIONS = [
  { value: 'tayquay', label: 'Tay quay' },
  { value: 'loxothuong_trung', label: 'Lò xo thường (trung)' },
  { value: 'loxothuong_dai', label: 'Lò xo thường (dài)' },
  { value: 'loxoham_trung', label: 'Lò xo Hãm (trung)' },
  { value: 'loxoham_dai', label: 'Lò xo Hãm (dài)' },
  { value: 'daukeo', label: 'Đầu kéo' },
  { value: 'daukeotichhop_trung', label: 'Đầu kéo tích hợp (trung)' },
  { value: 'daukeotichhop_dai', label: 'Đầu kéo tích hợp (dài)' },
  { value: 'motor', label: 'Motor' },
];

// Phần "trừ vải theo loai" trong công thức hao hụt — GIỮ NGUYÊN mức trừ theo
// loại gốc cho cả trung/dài (chốt với người dùng 17/08/2026).
const OLD_TRIM_EXPR =
  'if(loai=="loxothuong",0.03,if(loai=="loxoham",0.04,if(loai=="tayquay",0.10,0.05)))';
const NEW_TRIM_EXPR =
  'if(loai=="loxothuong_trung"||loai=="loxothuong_dai",0.03,' +
  'if(loai=="loxoham_trung"||loai=="loxoham_dai",0.04,' +
  'if(loai=="tayquay",0.10,0.05)))';

// 13 dòng dùng công thức hao hụt vải (10 dòng vải theo mabat + 3 dòng ống mái
// hiên) — chỉ cần thay thế substring OLD_TRIM_EXPR -> NEW_TRIM_EXPR, giữ
// nguyên phần nhân/điều kiện riêng của từng dòng.
const FABRIC_TRIM_MATERIAL_CODES = [
  'VN01-13',
  'K11-21',
  'T01-07',
  'TW01-05',
  'K04-07',
  'J01-02',
  'KN01-05',
  'K01-M',
  'NL000260',
  'NL000261',
  'NL000254',
  'NL000255',
  'NL000256',
];

// 6 dòng phụ tùng cơ cấu — đổi condition từ (loai + chiều cao) sang thẳng
// enum mới, expression giữ nguyên "1" (không đổi).
const MECHANISM_CONDITION_UPDATES: Record<string, string> = {
  NL000263: 'loai=="loxothuong_trung"',
  NL000264: 'loai=="loxothuong_dai"',
  NL000265: 'loai=="loxoham_trung"',
  NL000266: 'loai=="loxoham_dai"',
  NL000267: 'loai=="daukeotichhop_trung"',
  NL000268: 'loai=="daukeotichhop_dai"',
};

const OLD_SURCHARGE_EXPR =
  'if(loai=="tayquay",80000,if(loai=="loxoham",100000,if(loai=="daukeo",80000,' +
  'if(loai=="daukeotichhop",130000,0)))) + if(ong=="ongnhomcung"||ong=="ongsat",area*15000,0)';
const NEW_SURCHARGE_EXPR =
  'if(loai=="tayquay",80000,' +
  'if(loai=="loxothuong_dai",10000,' +
  'if(loai=="loxoham_trung",100000,' +
  'if(loai=="loxoham_dai",110000,' +
  'if(loai=="daukeo",80000,' +
  'if(loai=="daukeotichhop_trung",130000,' +
  'if(loai=="daukeotichhop_dai",140000,' +
  '0)))))))' +
  ' + if(ong=="ongnhomcung"||ong=="ongsat",area*15000,0)';

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const product = await prisma.product.findFirst({
      where: { name: PRODUCT_NAME, deletedAt: null },
      include: { parameters: { include: { options: true } } },
    });
    if (!product) throw new Error(`Không tìm thấy Product tên="${PRODUCT_NAME}" trên môi trường này.`);
    console.log(`--- ${product.code} "${product.name}" (${product.id}) ---`);

    // 1. Pricing Rule — nhân bản version ACTIVE, sửa surchargeExpression, kích hoạt.
    const pricingRule = await prisma.pricingRule.findUnique({ where: { productId: product.id } });
    if (!pricingRule) throw new Error('Chưa có Pricing Rule.');
    const activePricing = await prisma.pricingRuleVersion.findFirst({
      where: { pricingRuleId: pricingRule.id, status: 'ACTIVE' },
    });
    if (!activePricing) throw new Error('Không tìm thấy Pricing Rule Version ACTIVE.');
    if (activePricing.surchargeExpression?.trim() !== OLD_SURCHARGE_EXPR) {
      throw new Error(
        `surchargeExpression hiện tại không khớp giả định của script.\n` +
          `Hiện tại: ${activePricing.surchargeExpression}\n` +
          `Giả định: ${OLD_SURCHARGE_EXPR}`,
      );
    }
    const dupPricing = await svc.duplicatePricingRuleVersion(activePricing.id);
    console.log(`  Pricing Rule: nhân bản v${activePricing.versionNumber} -> DRAFT v${dupPricing!.versionNumber} (${dupPricing!.id})`);
    await svc.updatePricingRuleVersion(dupPricing!.id, { surchargeExpression: NEW_SURCHARGE_EXPR } as any);
    await svc.activatePricingRuleVersion(dupPricing!.id);
    console.log(`  Pricing Rule: đã kích hoạt v${dupPricing!.versionNumber} với surchargeExpression mới.`);

    // 2. Material Requirement — nhân bản version ACTIVE, sửa từng item cần đổi, kích hoạt.
    const materialReq = await prisma.materialRequirement.findUnique({ where: { productId: product.id } });
    if (!materialReq) throw new Error('Chưa có Material Requirement.');
    const activeMaterial = await prisma.materialRequirementVersion.findFirst({
      where: { materialRequirementId: materialReq.id, status: 'ACTIVE' },
    });
    if (!activeMaterial) throw new Error('Không tìm thấy Material Requirement Version ACTIVE.');

    const dupMaterial = await svc.duplicateMaterialRequirementVersion(activeMaterial.id);
    console.log(`  Material Requirement: nhân bản v${activeMaterial.versionNumber} -> DRAFT v${dupMaterial!.versionNumber} (${dupMaterial!.id})`);

    const dupItems = await prisma.materialRequirementItem.findMany({
      where: { materialRequirementVersionId: dupMaterial!.id },
      include: { material: { select: { code: true } } },
    });

    let trimUpdated = 0;
    let mechanismUpdated = 0;
    for (const item of dupItems) {
      const code = item.material.code;
      if (FABRIC_TRIM_MATERIAL_CODES.includes(code)) {
        if (!item.expression.includes(OLD_TRIM_EXPR)) {
          throw new Error(
            `Vật tư ${code}: expression không chứa đúng OLD_TRIM_EXPR như giả định.\nHiện tại: ${item.expression}`,
          );
        }
        const newExpr = item.expression.split(OLD_TRIM_EXPR).join(NEW_TRIM_EXPR);
        await svc.updateMaterialRequirementItem(item.id, { expression: newExpr } as any);
        trimUpdated++;
      } else if (code in MECHANISM_CONDITION_UPDATES) {
        await svc.updateMaterialRequirementItem(item.id, {
          condition: MECHANISM_CONDITION_UPDATES[code],
        } as any);
        mechanismUpdated++;
      }
    }
    console.log(`  Material Requirement: đã sửa ${trimUpdated} dòng công thức hao hụt vải, ${mechanismUpdated} dòng điều kiện phụ tùng cơ cấu.`);
    if (trimUpdated !== FABRIC_TRIM_MATERIAL_CODES.length) {
      throw new Error(`Thiếu dòng hao hụt vải: cập nhật ${trimUpdated}/${FABRIC_TRIM_MATERIAL_CODES.length}.`);
    }
    if (mechanismUpdated !== Object.keys(MECHANISM_CONDITION_UPDATES).length) {
      throw new Error(`Thiếu dòng phụ tùng cơ cấu: cập nhật ${mechanismUpdated}/${Object.keys(MECHANISM_CONDITION_UPDATES).length}.`);
    }

    await svc.activateMaterialRequirementVersion(dupMaterial!.id);
    console.log(`  Material Requirement: đã kích hoạt v${dupMaterial!.versionNumber}.`);

    // 3. ENUM options của tham số "loai" — làm SAU CÙNG (chỉ mở khoá lựa chọn
    // mới sau khi công thức giá + BOM đã xử lý được chúng).
    const loaiParam = product.parameters.find((p) => p.name === 'loai');
    if (!loaiParam) throw new Error('Không tìm thấy tham số "loai".');
    await svc.updateProductParameter(loaiParam.id, { options: NEW_OPTIONS } as any);
    console.log(`  Tham số "loai": đã cập nhật ${NEW_OPTIONS.length} lựa chọn.`);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
