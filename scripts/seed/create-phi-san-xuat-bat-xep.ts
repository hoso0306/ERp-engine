/**
 * Tạo vật tư "PHÍ SẢN XUẤT BẠT XẾP" (đơn vị m², giá mặc định 8.000đ) và thêm
 * vào định mức vật liệu (Material Requirement) của sản phẩm
 * "[Bạt xếp] - Vải bạt" (SP000110), expression = "area" (đã có sẵn derived
 * param area = f(chieurong, chieudai, song)).
 *
 * Resolve sản phẩm theo TÊN (không theo mã) — xem memory
 * product_sp_code_drift_local_prod.
 *
 * Không thể thêm Item thẳng vào version ACTIVE (chỉ sửa được DRAFT) — theo
 * đúng nguyên tắc Versioning: nhân bản version ACTIVE hiện tại thành DRAFT
 * mới (duplicateMaterialRequirementVersion), thêm Item vào bản DRAFT đó, rồi
 * activate (archive bản cũ, promote bản mới).
 *
 * Idempotent: nếu Material đã tồn tại (theo tên) thì dùng lại, không tạo
 * trùng. Nếu sản phẩm đã có sẵn item trỏ tới vật tư này ở version ACTIVE thì
 * bỏ qua (không tạo version DRAFT/activate thừa).
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-phi-san-xuat-bat-xep.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const MATERIAL_NAME = 'PHÍ SẢN XUẤT BẠT XẾP';
const UNIT_NAME = 'm²';
const DEFAULT_PRICE = 8000;

const PRODUCT_NAME = '[Bạt xếp] - Vải bạt';

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    // 1) Material — idempotent theo tên.
    let material = await prisma.material.findFirst({ where: { name: MATERIAL_NAME } });
    if (material) {
      console.log(`[BỎ QUA] Vật tư "${MATERIAL_NAME}" đã tồn tại (${material.code}).`);
    } else {
      const unit = await prisma.unit.findUnique({ where: { name: UNIT_NAME } });
      if (!unit) throw new Error(`Không tìm thấy Unit tên="${UNIT_NAME}" trên môi trường này.`);
      material = await svc.createMaterial({ name: MATERIAL_NAME, unitId: unit.id } as any);
      console.log(`Tạo vật tư ${material.code} "${material.name}" (unit=${UNIT_NAME}).`);

      await svc.createMaterialPrice(material.id, {
        price: DEFAULT_PRICE,
        effectiveFrom: new Date().toISOString(),
        isDefault: true,
      } as any);
      console.log(`  -> Tạo giá mặc định ${DEFAULT_PRICE}đ.`);
    }

    // 2) Thêm vào Material Requirement của sản phẩm.
    const product = await prisma.product.findFirst({ where: { name: PRODUCT_NAME, deletedAt: null } });
    if (!product) throw new Error(`Không tìm thấy Product tên="${PRODUCT_NAME}" trên môi trường này.`);

    const req = await svc.findMaterialRequirement(product.id);
    const activeVersion = req.versions.find((v: any) => v.status === 'ACTIVE');
    if (!activeVersion) throw new Error(`Sản phẩm "${PRODUCT_NAME}" chưa có version ACTIVE nào.`);

    const alreadyHas = await prisma.materialRequirementItem.findFirst({
      where: { materialRequirementVersionId: activeVersion.id, materialId: material.id },
    });
    if (alreadyHas) {
      console.log(`[BỎ QUA] "${PRODUCT_NAME}" đã có dòng "${MATERIAL_NAME}" trong version ACTIVE.`);
    } else {
      const draft = await svc.duplicateMaterialRequirementVersion(activeVersion.id);
      await svc.createMaterialRequirementItem(draft!.id, {
        materialId: material.id,
        expression: 'area',
        wastePercent: 0,
      } as any);
      await svc.activateMaterialRequirementVersion(draft!.id);
      console.log(`Đã thêm "${MATERIAL_NAME}" (expr=area) vào định mức của "${PRODUCT_NAME}" (${product.code}), version mới đã ACTIVE.`);
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
