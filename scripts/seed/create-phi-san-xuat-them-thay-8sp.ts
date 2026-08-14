/**
 * Tạo 8 vật tư "PHÍ SẢN XUẤT THÊM/THAY ..." (đơn vị Bộ) và thêm vào định mức
 * vật liệu (Material Requirement) của 8 sản phẩm "Thêm/Thay ..." tương ứng,
 * expression = "1" (phí cố định/bộ, không nhân theo diện tích — dù bản thân
 * các sản phẩm này bán theo m², giống pattern "PHÍ SẢN XUẤT RÈM CUỐN").
 *
 * Resolve sản phẩm theo TÊN (không theo mã) — 3/8 sản phẩm (SP138/139/140 ở
 * Local) nằm trong dải mã đã biết bị lệch Local/Production (xem memory
 * product_sp_code_drift_local_prod), nên áp dụng resolve-theo-tên cho TẤT
 * CẢ 8 sản phẩm để nhất quán.
 *
 * Không thể thêm Item thẳng vào version ACTIVE (chỉ sửa được DRAFT) — nhân
 * bản đúng version ACTIVE hiện tại (không đụng tới bất kỳ DRAFT nào khác
 * đang treo sẵn ở sản phẩm đó), thêm Item vào bản DRAFT mới, rồi activate.
 *
 * Idempotent: nếu Material đã tồn tại (theo tên) thì dùng lại, không tạo
 * trùng. Nếu sản phẩm đã có sẵn item trỏ tới vật tư đó ở version ACTIVE thì
 * bỏ qua (không tạo version DRAFT/activate thừa).
 *
 * Chạy: (từ apps/api trong container)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-phi-san-xuat-them-thay-8sp.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const UNIT_NAME_FEE = 'Bộ';

const ENTRIES: { materialName: string; price: number; productName: string }[] = [
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY VẢI CUỐN LƯỚI', price: 40000, productName: '[RCV] - Thêm/Thay vải Cuốn Lưới' },
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY VẢI CUỐN TRƠN', price: 40000, productName: '[RCV] - Thêm/Thay vải Cuốn Trơn' },
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY VẢI CẦU VỒNG', price: 40000, productName: '[RCV]-Thêm/Thay vải cầu vồng' },
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY VẢI CẦU VỒNG IN TRANH', price: 40000, productName: 'Thêm/Thay vải cầu vồng in tranh' },
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY VẢI CUỐN TRANH', price: 40000, productName: 'Thêm/Thay vải cuốn tranh' },
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY LƯỚI CHỐNG MUỖI', price: 50000, productName: 'Thay/Thêm lưới chống muỗi' },
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY RÈM TỔ ONG', price: 50000, productName: 'Thay/Thêm Rèm tổ ong' },
  { materialName: 'PHÍ SẢN XUẤT THÊM/THAY RÈM KẾT HỢP', price: 50000, productName: 'Thay/Thêm rèm kết hợp' },
];

let prisma: PrismaService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);
  try {
    const unit = await prisma.unit.findUnique({ where: { name: UNIT_NAME_FEE } });
    if (!unit) throw new Error(`Không tìm thấy Unit tên="${UNIT_NAME_FEE}" trên môi trường này.`);

    for (const entry of ENTRIES) {
      // 1) Material — idempotent theo tên.
      let material = await prisma.material.findFirst({ where: { name: entry.materialName } });
      if (material) {
        console.log(`[BỎ QUA] Vật tư "${entry.materialName}" đã tồn tại (${material.code}).`);
      } else {
        material = await svc.createMaterial({ name: entry.materialName, unitId: unit.id } as any);
        console.log(`Tạo vật tư ${material.code} "${material.name}" (unit=${UNIT_NAME_FEE}).`);

        await svc.createMaterialPrice(material.id, {
          price: entry.price,
          effectiveFrom: new Date().toISOString(),
          isDefault: true,
        } as any);
        console.log(`  -> Tạo giá mặc định ${entry.price}đ.`);
      }

      // 2) Thêm vào Material Requirement của sản phẩm.
      const product = await prisma.product.findFirst({ where: { name: entry.productName, deletedAt: null } });
      if (!product) {
        console.log(`  [LỖI] Không tìm thấy Product tên="${entry.productName}" trên môi trường này — BỎ QUA sản phẩm này.`);
        continue;
      }

      const req = await svc.findMaterialRequirement(product.id);
      const activeVersion = req.versions.find((v: any) => v.status === 'ACTIVE');
      if (!activeVersion) {
        console.log(`  [LỖI] Sản phẩm "${entry.productName}" chưa có version ACTIVE nào — BỎ QUA.`);
        continue;
      }

      const alreadyHas = await prisma.materialRequirementItem.findFirst({
        where: { materialRequirementVersionId: activeVersion.id, materialId: material.id },
      });
      if (alreadyHas) {
        console.log(`  [BỎ QUA] "${entry.productName}" đã có dòng "${entry.materialName}" trong version ACTIVE.`);
        continue;
      }

      const draft = await svc.duplicateMaterialRequirementVersion(activeVersion.id);
      await svc.createMaterialRequirementItem(draft!.id, {
        materialId: material.id,
        expression: '1',
        wastePercent: 0,
      } as any);
      await svc.activateMaterialRequirementVersion(draft!.id);
      console.log(`  Đã thêm "${entry.materialName}" (expr=1) vào định mức của "${entry.productName}" (${product.code}), version mới đã ACTIVE.`);
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
