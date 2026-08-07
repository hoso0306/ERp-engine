/**
 * Tạo 9 vật tư mới nhóm "Lưới An toàn ban công" + "Giàn phơi" theo ghi chú
 * chốt giá ngày 07/08/2026 (workbench). Chưa gán Production Center theo yêu
 * cầu người dùng. isRetailable = false (chỉ lưu retailPrice tham khảo, chưa
 * bật bán lẻ trong Báo giá).
 *
 * Idempotent theo `name`: nếu Material cùng tên đã tồn tại thì bỏ qua.
 *
 * Chạy (từ apps/api, cần tsconfig-paths/register):
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     ../../scripts/seed/create-vat-tu-luoi-an-toan-gian-phoi.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

type MaterialSeed = {
  name: string;
  unitName: string;
  importPrice: number;
  retailPrice: number;
  note?: string;
};

const MATERIALS: MaterialSeed[] = [
  { name: 'Lưới An toàn ban công', unitName: 'kg', importPrice: 75000, retailPrice: 150000 },
  {
    name: 'Nẹp + ốp lưới An toàn',
    unitName: 'Cây',
    importPrice: 123000,
    retailPrice: 150000,
    note: 'Quy cách: cây dài 3m',
  },
  {
    name: 'Lưới An toàn ban công (nguyên cuộn)',
    unitName: 'kg',
    importPrice: 70000,
    retailPrice: 110000,
  },
  { name: 'Giàn phơi gắn tường', unitName: 'Bộ', importPrice: 620000, retailPrice: 800000 },
  {
    name: 'Giàn phơi quay tay KS950',
    unitName: 'Bộ',
    importPrice: 440000,
    retailPrice: 550000,
  },
  {
    name: 'Cáp giàn phơi tay quay ngắn',
    unitName: 'Cuộn',
    importPrice: 30000,
    retailPrice: 50000,
  },
  {
    name: 'Cáp giàn phơi tay quay dài',
    unitName: 'Cuộn',
    importPrice: 45000,
    retailPrice: 70000,
  },
  { name: 'Củ quay KS950', unitName: 'Cái', importPrice: 190000, retailPrice: 250000 },
  {
    name: 'Bạt cuộn 1 màu (nguyên cây)',
    unitName: 'm²',
    importPrice: 33000,
    retailPrice: 40000,
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const productService = app.get(ProductService);
  const prisma = app.get(PrismaService);

  const units = await prisma.unit.findMany({
    where: { name: { in: [...new Set(MATERIALS.map((m) => m.unitName))] } },
  });
  const unitIdByName = new Map(units.map((u) => [u.name, u.id]));

  const today = new Date().toISOString();

  for (const seed of MATERIALS) {
    const existing = await prisma.material.findFirst({ where: { name: seed.name } });
    if (existing) {
      console.log(`[skip] "${seed.name}" đã tồn tại (${existing.code}).`);
      continue;
    }

    const unitId = unitIdByName.get(seed.unitName);
    if (!unitId) {
      console.error(`[error] Không tìm thấy Unit "${seed.unitName}" cho "${seed.name}".`);
      continue;
    }

    const material = await productService.createMaterial({
      name: seed.name,
      unitId,
      note: seed.note,
      retailPrice: seed.retailPrice,
      isRetailable: false,
    });

    await productService.createMaterialPrice(material.id, {
      price: seed.importPrice,
      effectiveFrom: today,
      isDefault: true,
    });

    console.log(`[created] ${material.code} - ${seed.name}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
