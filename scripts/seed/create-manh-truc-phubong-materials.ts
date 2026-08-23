/**
 * Thêm vật tư "phủ bóng" cho SP000143 "Mành Trúc" theo yêu cầu 2026-08-12:
 *   - Mành trúc trơn phủ bóng      = giá nhập Mành Trúc trơn (125.000) + 10.000 = 135.000
 *   - Mành trúc in tranh phủ bóng  = giá nhập Mành Trúc in tranh (230.000) + 10.000 = 240.000
 *
 * Gắn vào BOM: bật usedInMaterial=true cho param `phubong` (để UI Condition
 * Builder liệt kê được biến này), rồi duplicate MaterialRequirementVersion
 * đang ACTIVE thành DRAFT mới, sửa 2 dòng cũ thêm điều kiện
 * `&& phubong == "khong"`, thêm 2 dòng mới với điều kiện `&& phubong == "co"`,
 * rồi activate. Version cũ giữ nguyên (ARCHIVED) theo nguyên tắc Versioning.
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-manh-truc-phubong-materials.ts
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
      where: { code: 'SP000143', deletedAt: null },
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
    if (!product) throw new Error('Không tìm thấy SP000143.');
    const activeVersion = product.materialRequirement?.versions[0];
    if (!activeVersion) throw new Error('SP000143 chưa có Material Requirement Version ACTIVE.');

    const phubong = product.parameters.find((p) => p.name === 'phubong');
    if (!phubong) throw new Error('Không tìm thấy param phubong.');

    const manhTrucTron = await prisma.material.findFirst({ where: { code: 'NL000348' } });
    const manhTrucInTranh = await prisma.material.findFirst({ where: { code: 'NL000349' } });
    if (!manhTrucTron || !manhTrucInTranh) throw new Error('Không tìm thấy material gốc NL000348/NL000349.');

    const priceTron = await prisma.materialPrice.findFirst({
      where: { materialId: manhTrucTron.id, isDefault: true },
    });
    const priceInTranh = await prisma.materialPrice.findFirst({
      where: { materialId: manhTrucInTranh.id, isDefault: true },
    });
    if (!priceTron || !priceInTranh) throw new Error('Material gốc chưa có giá nhập mặc định.');

    console.log(`Giá nhập gốc: Mành Trúc trơn=${priceTron.price}, Mành Trúc in tranh=${priceInTranh.price}`);

    // 1. Bật usedInMaterial cho phubong
    if (!phubong.usedInMaterial) {
      await svc.updateProductParameter(phubong.id, { usedInMaterial: true } as any);
      console.log('Đã bật usedInMaterial=true cho param phubong');
    }

    // 2. Tạo 2 material mới + giá nhập mặc định
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

    // 3. Duplicate BOM version -> DRAFT mới
    const duplicated: any = await svc.duplicateMaterialRequirementVersion(activeVersion.id);
    console.log(`Đã tạo Material Requirement DRAFT mới: v${duplicated.versionNumber}`);

    // 4. Sửa 2 dòng cũ thêm điều kiện phubong == "khong"
    for (const item of duplicated.items) {
      const newCondition = `(${item.condition}) && phubong == "khong"`;
      await svc.updateMaterialRequirementItem(item.id, { condition: newCondition } as any);
      console.log(`  Cập nhật item cũ (${item.materialId}) -> condition: ${newCondition}`);
    }

    // 5. Thêm 2 dòng mới cho trường hợp phủ bóng
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

    // 6. Activate
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
