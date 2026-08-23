/**
 * Sửa SP000148 "[RCV] - Rèm cầu vồng in tranh" theo yêu cầu người dùng
 * (workbench/sessions/2707.md phiên hiện tại, mục 18):
 *
 * 1+2. Giá bán VÀ giá vốn đều không nhân diện tích ×2 nữa — sửa Derived
 *    Parameter `area` (chieurong*chieucao*2 → chieurong*chieucao). Cả 2
 *    công thức (Pricing `unitPrice*area` và Material Requirement 2 dòng vải
 *    `area`) dùng chung biến này nên chỉ cần sửa 1 chỗ, không đổi gì ở
 *    Pricing Rule Version.
 * 2. Bỏ hao phí 30% ở 2 dòng vải (NL000357/358) — field này thuộc Material
 *    Requirement Item (versioned), nên nhân bản v1 (ACTIVE) → v2 (DRAFT),
 *    sửa 2 dòng, kích hoạt v2 (đúng nguyên tắc Versioning, dù sản phẩm chưa
 *    có báo giá nào).
 * 3. Tạo ProductType mới "Rèm In Tranh", chuyển SP000148 và "Rèm cuốn tranh"
 *    (SP000149) sang loại này — để 2 sản phẩm này không hưởng chiết khấu
 *    Khách hàng × Loại sản phẩm đang cấu hình cho "Rèm cầu vồng" (26 khách)
 *    / "Rèm cuốn" (0 khách).
 *
 * Cả SP000148 và SP000149 đều 0 QuotationItem tại thời điểm sửa — không có
 * chứng từ cũ bị ảnh hưởng.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/update-rem-cau-vong-in-tranh.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const RCV_IN_TRANH_NAME = '[RCV] - Rèm cầu vồng in tranh';
const REM_CUON_TRANH_NAME = 'Rèm cuốn tranh';
const NEW_PRODUCT_TYPE_NAME = 'Rèm In Tranh';
const VAI_MATERIAL_NAMES = ['Vải in tranh cản sáng 85%', 'Vải in tranh cản sáng 95%'];

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const product = await prisma.product.findFirst({ where: { name: RCV_IN_TRANH_NAME, deletedAt: null } });
    if (!product) throw new Error(`Không tìm thấy Product "${RCV_IN_TRANH_NAME}".`);
    console.log(`Product: ${product.code} "${product.name}"`);

    // 1+2. Sửa Derived Parameter area
    const areaParam = await prisma.derivedParameter.findFirst({ where: { productId: product.id, name: 'area' } });
    if (!areaParam) throw new Error('Không tìm thấy Derived Parameter "area".');
    if (areaParam.expression !== 'chieurong * chieucao * 2') {
      throw new Error(`Expression hiện tại của "area" khác dự kiến: "${areaParam.expression}" — dừng lại, kiểm tra tay trước khi sửa.`);
    }
    await svc.updateDerivedParameter(areaParam.id, { expression: 'chieurong * chieucao' } as any);
    console.log('  [OK] area: chieurong*chieucao*2 -> chieurong*chieucao');

    // 2. Bỏ hao phí 30% ở 2 dòng vải — nhân bản Material Requirement Version
    const materialRequirement = await prisma.materialRequirement.findFirst({ where: { productId: product.id } });
    const activeMrv = await prisma.materialRequirementVersion.findFirst({ where: { materialRequirementId: materialRequirement?.id, status: 'ACTIVE' } as any });
    if (!activeMrv) throw new Error('Không tìm thấy Material Requirement Version ACTIVE.');

    const newMrv = await svc.duplicateMaterialRequirementVersion(activeMrv.id);
    console.log(`  [OK] Nhân bản Material Requirement Version -> ${newMrv.name ?? newMrv.id} (DRAFT)`);

    const newItems = await prisma.materialRequirementItem.findMany({
      where: { materialRequirementVersionId: newMrv.id },
      include: { material: true },
    });
    for (const vaiName of VAI_MATERIAL_NAMES) {
      const item = newItems.find((it) => it.material.name === vaiName);
      if (!item) throw new Error(`Không tìm thấy dòng vật tư "${vaiName}" trong version mới.`);
      await svc.updateMaterialRequirementItem(item.id, { wastePercent: 0 } as any);
      console.log(`  [OK] ${item.material.code} "${vaiName}": wastePercent 30 -> 0`);
    }
    await svc.activateMaterialRequirementVersion(newMrv.id);
    console.log('  [OK] Kích hoạt Material Requirement Version mới.');

    // 3. ProductType mới "Rèm In Tranh"
    let newType = await prisma.productType.findUnique({ where: { name: NEW_PRODUCT_TYPE_NAME } });
    if (!newType) {
      newType = await svc.createProductType({ name: NEW_PRODUCT_TYPE_NAME } as any);
      console.log(`  [TẠO MỚI] ProductType "${NEW_PRODUCT_TYPE_NAME}"`);
    } else {
      console.log(`  [BỎ QUA] ProductType "${NEW_PRODUCT_TYPE_NAME}" đã tồn tại.`);
    }

    await svc.updateProduct(product.id, { productTypeId: newType.id } as any);
    console.log(`  [OK] ${product.code} chuyển sang ProductType "${NEW_PRODUCT_TYPE_NAME}"`);

    const remCuonTranh = await prisma.product.findFirst({ where: { name: REM_CUON_TRANH_NAME, deletedAt: null } });
    if (!remCuonTranh) throw new Error(`Không tìm thấy Product "${REM_CUON_TRANH_NAME}".`);
    await svc.updateProduct(remCuonTranh.id, { productTypeId: newType.id } as any);
    console.log(`  [OK] ${remCuonTranh.code} "${REM_CUON_TRANH_NAME}" chuyển sang ProductType "${NEW_PRODUCT_TYPE_NAME}"`);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
