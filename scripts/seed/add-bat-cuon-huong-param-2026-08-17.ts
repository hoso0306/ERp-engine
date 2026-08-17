/**
 * Sản phẩm "Bạt Cuốn" — thêm tham số "Hướng" (huong), ENUM, BẮT BUỘC nhập,
 * chỉ để lưu thông tin (không ảnh hưởng giá bán/định mức vật liệu — chốt
 * 17/08/2026, workbench/sessions/2707.md). 3 lựa chọn: Hướng lắp trần,
 * Hướng trong nhìn ra, Hướng ngoài nhìn vào.
 *
 * usedInPricing=false, usedInMaterial=false — không hiện làm cột Bảng giá ma
 * trận hay điều kiện BOM. Không cần tạo version mới (không sửa Pricing
 * Rule/Material Requirement).
 *
 * QUAN TRỌNG — resolve theo TÊN sản phẩm ("Bạt Cuốn"), KHÔNG theo mã code
 * (mã auto-increment lệch giữa Local/Production).
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/add-bat-cuon-huong-param-2026-08-17.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_NAME = 'Bạt Cuốn';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    const product = await prisma.product.findFirst({
      where: { name: PRODUCT_NAME, deletedAt: null },
      include: { parameters: true },
    });
    if (!product) throw new Error(`Không tìm thấy Product tên="${PRODUCT_NAME}" trên môi trường này.`);
    console.log(`--- ${product.code} "${product.name}" (${product.id}) ---`);

    if (product.parameters.some((p) => p.name === 'huong')) {
      console.log('  [BỎ QUA] Tham số "huong" đã tồn tại từ trước.');
      return;
    }

    const maxDisplayOrder = product.parameters.reduce((m, p) => Math.max(m, p.displayOrder), -1);

    const created = await svc.createProductParameter(product.id, {
      name: 'huong',
      label: 'Hướng',
      type: 'ENUM',
      isRequired: true,
      usedInPricing: false,
      usedInMaterial: false,
      displayOrder: maxDisplayOrder + 1,
      options: [
        { value: 'lapran', label: 'Hướng lắp trần' },
        { value: 'trongnhinra', label: 'Hướng trong nhìn ra' },
        { value: 'ngoainhinvao', label: 'Hướng ngoài nhìn vào' },
      ],
    } as any);
    console.log(`  Đã tạo tham số "${created.label}" (id=${created.id}), ${created.options.length} lựa chọn.`);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
