/**
 * Bản dành cho PRODUCTION của create-manh-truc-phubong-materials.ts — resolve
 * sản phẩm/vật tư theo TÊN thay vì code, vì code SP có drift đã biết giữa
 * local/production ở dải SP000129-143 (xem memory product-sp-code-drift-local-prod).
 * Logic thay đổi giống hệt bản local, chỉ khác cách tìm product/material.
 *
 * Chạy trong container erp-api trên VPS (cwd /repo/apps/api), SAU KHI đã chạy
 * prod-update-manh-truc-phubong-matrix.ts:
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/prod-create-manh-truc-phubong-materials.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

let prisma: PrismaService;
let svc: ProductService;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  svc = app.get(ProductService);

  try {
    const product = await prisma.product.findFirst({
      where: { name: 'Mành Trúc', deletedAt: null },
      include: {
        parameters: true,
        materialRequirement: {
          include: {
            versions: {
              where: { status: 'ACTIVE' },
              include: { items: { orderBy: { displayOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (!product) throw new Error('Không tìm thấy sản phẩm "Mành Trúc".');
    const activeVersion = product.materialRequirement?.versions[0];
    if (!activeVersion) throw new Error(`${product.code} chưa có Material Requirement Version ACTIVE.`);

    const phubong = product.parameters.find((p) => p.name === 'phubong');
    if (!phubong) throw new Error('Không tìm thấy param phubong.');

    const manhTrucTron = await prisma.material.findFirst({ where: { name: 'Mành Trúc trơn' } });
    const manhTrucInTranh = await prisma.material.findFirst({ where: { name: 'Mành Trúc in tranh' } });
    if (!manhTrucTron || !manhTrucInTranh) throw new Error('Không tìm thấy material gốc "Mành Trúc trơn"/"Mành Trúc in tranh".');

    const priceTron = await prisma.materialPrice.findFirst({
      where: { materialId: manhTrucTron.id, isDefault: true },
    });
    const priceInTranh = await prisma.materialPrice.findFirst({
      where: { materialId: manhTrucInTranh.id, isDefault: true },
    });
    if (!priceTron || !priceInTranh) throw new Error('Material gốc chưa có giá nhập mặc định.');

    console.log(`Giá nhập gốc: ${manhTrucTron.code} Mành Trúc trơn=${priceTron.price}, ${manhTrucInTranh.code} Mành Trúc in tranh=${priceInTranh.price}`);

    if (!phubong.usedInMaterial) {
      await svc.updateProductParameter(phubong.id, { usedInMaterial: true } as any);
      console.log('Đã bật usedInMaterial=true cho param phubong');
    }

    const today = new Date().toISOString().slice(0, 10);

    const matTronPhuBong = await svc.createMaterial({
      name: 'Mành trúc trơn phủ bóng',
      unitId: manhTrucTron.unitId,
    } as any);
    await svc.createMaterialPrice(matTronPhuBong.id, {
      price: Number(priceTron.price) + 10000,
      effectiveFrom: today,
      isDefault: true,
    } as any);
    console.log(`Đã tạo material ${matTronPhuBong.code} "Mành trúc trơn phủ bóng", giá ${Number(priceTron.price) + 10000}`);

    const matInTranhPhuBong = await svc.createMaterial({
      name: 'Mành trúc in tranh phủ bóng',
      unitId: manhTrucInTranh.unitId,
    } as any);
    await svc.createMaterialPrice(matInTranhPhuBong.id, {
      price: Number(priceInTranh.price) + 10000,
      effectiveFrom: today,
      isDefault: true,
    } as any);
    console.log(`Đã tạo material ${matInTranhPhuBong.code} "Mành trúc in tranh phủ bóng", giá ${Number(priceInTranh.price) + 10000}`);

    const duplicated: any = await svc.duplicateMaterialRequirementVersion(activeVersion.id);
    console.log(`Đã tạo Material Requirement DRAFT mới: v${duplicated.versionNumber}`);

    for (const item of duplicated.items) {
      const newCondition = `(${item.condition}) && phubong == "khong"`;
      await svc.updateMaterialRequirementItem(item.id, { condition: newCondition } as any);
      console.log(`  Cập nhật item cũ (${item.materialId}) -> condition: ${newCondition}`);
    }

    const tronItem = duplicated.items.find((i: any) => i.materialId === manhTrucTron.id);
    const inTranhItem = duplicated.items.find((i: any) => i.materialId === manhTrucInTranh.id);

    await svc.createMaterialRequirementItem(duplicated.id, {
      materialId: matTronPhuBong.id,
      expression: 'area',
      condition: 'loaimanh == "tron" && phubong == "co"',
      wastePercent: 0,
      displayOrder: (tronItem?.displayOrder ?? 0) + 10,
    } as any);
    console.log(`  Thêm item mới: ${matTronPhuBong.code}, condition: loaimanh == "tron" && phubong == "co"`);

    await svc.createMaterialRequirementItem(duplicated.id, {
      materialId: matInTranhPhuBong.id,
      expression: 'area',
      condition: 'loaimanh == "in_tranh" && phubong == "co"',
      wastePercent: 0,
      displayOrder: (inTranhItem?.displayOrder ?? 0) + 10,
    } as any);
    console.log(`  Thêm item mới: ${matInTranhPhuBong.code}, condition: loaimanh == "in_tranh" && phubong == "co"`);

    await svc.activateMaterialRequirementVersion(duplicated.id);
    console.log(`Đã activate v${duplicated.versionNumber} (v${activeVersion.versionNumber} cũ chuyển ARCHIVED)`);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
