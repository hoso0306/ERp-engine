/**
 * Tạo sản phẩm "Mành Trúc" (mục 14) và "Mành Tăm" (mục 15) — phiếu tay
 * khách hàng, workbench/sessions/2707.md phiên hiện tại. Thiết kế đã chốt
 * với người dùng.
 *
 * Mành Trúc: 2 loại (Trơn/In tranh) giá cố định qua Price Matrix, cộng
 * thêm tuỳ chọn "Phủ bóng" (+10.000đ/m², KHÔNG bị chiết khấu ăn vào — dùng
 * `surchargeExpression`, đúng cơ chế đã dùng cho máng nhôm Rèm cầu vồng).
 *
 * Mành Tăm: 3 loại — Trơn/In tranh giá cố định qua Matrix, riêng "Vẽ thủ
 * công" giá bán VÀ giá vốn đều nhập tay (không cố định, tuỳ thợ vẽ) — dùng
 * `if(loaimanh == "ve_thu_cong", dongia * area, unitPrice * area)` để rẽ
 * nhánh ngay trong Pricing Rule (loại Trơn/In tranh vẫn tính qua Matrix
 * bình thường). Tham số nhập tay đặt tên `dongia`/`giavon` (label vẫn ghi
 * "Giá bán (Vẽ thủ công)"/"Giá vốn (Vẽ thủ công)") — dùng đúng chuẩn tên đã
 * có ở mục 16/17 (Hàng phân phối thêm/Chi phí Sửa chữa-Lắp đặt) thay vì tên
 * riêng, để tự động được ẩn khỏi bản in Báo giá/Phiếu sản xuất nhờ
 * `HIDDEN_PARAM_NAMES` (mục 18) — không cần sửa thêm code. Xem mục 21 (đổi
 * tên trên Local sau khi phát hiện thiếu sót này).
 *
 * Lưu ý kỹ thuật đã xác minh trước khi viết:
 * - `lookupMatrix()` chỉ so khớp theo đúng các key có trong `dimensions`
 *   của từng dòng Matrix — dòng Matrix ở đây CHỈ dùng `loaimanh` làm
 *   dimension, KHÔNG cần đưa `phubong` vào (dù `phubong` vẫn cần
 *   `usedInPricing=true` để có mặt trong context lúc tính
 *   `surchargeExpression`) — tránh nhân đôi số dòng Matrix một cách không
 *   cần thiết.
 * - Tham số kiểu BOOLEAN hiện KHÔNG được `coerceParameters()` convert
 *   thành JS boolean thật (chỉ ENUM được giữ string cố ý) — dùng `if()`
 *   với tham số BOOLEAN sẽ lỗi runtime. Vì vậy `phubong` dùng ENUM
 *   (`co`/`khong`) thay vì BOOLEAN, so sánh bằng `phubong == "co"` — đúng
 *   pattern ENUM đã dùng ổn định ở mọi nơi khác trong hệ thống.
 * - Mành Tăm vẫn cần 1 dòng Matrix cho `loaimanh=ve_thu_cong` (unitPrice
 *   đặt 0, không dùng tới) vì `lookupMatrix()` chạy trước khi Expression
 *   rẽ nhánh — thiếu dòng này sẽ throw "chưa có đơn giá cho tổ hợp" trước
 *   khi kịp vào nhánh `if()`.
 * - `dongia`/`giavon` (2 tham số nhập tay của Mành Tăm) tạo `isRequired=true`
 *   + `defaultValue="0"` ngay từ đầu (không phải optional) — rút kinh
 *   nghiệm "Sự cố kỹ thuật 2" ở mục 16 (Hàng phân phối thêm): tham số
 *   NUMBER không bắt buộc, khi bỏ trống sẽ làm Pricing/BOM Engine báo lỗi
 *   "biến không tồn tại trong ngữ cảnh" thay vì tự hiểu là 0.
 *
 * Idempotent theo tên (Product/ProductType/Material) — an toàn chạy lại
 * nhiều lần. Unit "m²"/"Khoản" và ProductionCenter "Xưởng Cầu Vồng" dùng
 * lại Master Data có sẵn (không tự tạo nếu thiếu — báo lỗi rõ ràng).
 *
 * Chạy: (từ apps/api)
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/create-manh-truc-manh-tam.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const UNIT_M2 = 'm²';
const UNIT_KHOAN = 'Khoản';
const PRODUCTION_CENTER_NAME = 'Xưởng Cầu Vồng';
const PRODUCT_TYPE_NAME = 'Mành';

let prisma: PrismaService;

async function requireByName(model: 'unit' | 'productionCenter', name: string): Promise<string> {
  const row = await (prisma[model] as any).findFirst({ where: { name } });
  if (!row) throw new Error(`Không tìm thấy ${model} với name="${name}" — kiểm tra lại Master Data trước khi chạy script.`);
  return row.id;
}

async function ensureProductType(svc: ProductService, name: string): Promise<string> {
  const existing = await prisma.productType.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await svc.createProductType({ name } as any);
  console.log(`  [TẠO MỚI] ProductType "${name}"`);
  return created.id;
}

async function ensureMaterial(svc: ProductService, name: string, unitId: string, price: number, note?: string): Promise<string> {
  const existing = await prisma.material.findFirst({ where: { name } });
  if (existing) return existing.id;
  const material = await svc.createMaterial({ name, unitId } as any);
  await svc.createMaterialPrice(material.id, {
    price,
    effectiveFrom: new Date().toISOString(),
    isDefault: true,
    note,
  } as any);
  console.log(`  [TẠO MỚI] Material "${name}" (${material.code}), giá mặc định ${price.toLocaleString('vi-VN')}đ`);
  return material.id;
}

async function productExists(name: string): Promise<boolean> {
  const existing = await prisma.product.findFirst({ where: { name, deletedAt: null } });
  return !!existing;
}

async function createManhTruc(svc: ProductService, productTypeId: string, unitId: string, productionCenterId: string, manhTrucTronId: string, manhTrucInTranhId: string) {
  const name = 'Mành Trúc';
  if (await productExists(name)) {
    console.log(`  [BỎ QUA] "${name}" đã tồn tại.`);
    return;
  }

  const product = await svc.createProduct({ name, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${name}"`);

  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, {
    name: 'loaimanh', label: 'Loại mành', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3,
    options: [
      { value: 'tron', label: 'Trơn', displayOrder: 0 },
      { value: 'in_tranh', label: 'In tranh', displayOrder: 1 },
    ],
  } as any);
  await svc.createProductParameter(product.id, {
    name: 'phubong', label: 'Phủ bóng', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: false, displayOrder: 4, defaultValue: 'khong',
    options: [
      { value: 'co', label: 'Có', displayOrder: 0 },
      { value: 'khong', label: 'Không', displayOrder: 1 },
    ],
  } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, {
    name: 'v1',
    expression: 'unitPrice * area',
    surchargeExpression: 'if(phubong == "co", 10000 * area, 0)',
    priceRoundType: 'CEIL',
    priceRoundValue: 100,
    vatRate: 10,
  } as any);
  await svc.updatePriceMatrix(prv.id, [
    { dimensions: { loaimanh: 'tron' }, unitPrice: 165000, displayOrder: 0 },
    { dimensions: { loaimanh: 'in_tranh' }, unitPrice: 295000, displayOrder: 1 },
  ]);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
  await svc.createMaterialRequirementItem(mrv.id, { materialId: manhTrucTronId, expression: 'area', wastePercent: 0, condition: 'loaimanh == "tron"', displayOrder: 1 } as any);
  await svc.createMaterialRequirementItem(mrv.id, { materialId: manhTrucInTranhId, expression: 'area', wastePercent: 0, condition: 'loaimanh == "in_tranh"', displayOrder: 2 } as any);
  await svc.activateMaterialRequirementVersion(mrv.id);

  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}.`);
}

async function createManhTam(svc: ProductService, productTypeId: string, unitId: string, productionCenterId: string, manhTamTronId: string, manhTamInTranhId: string, giaVonThuCongMaterialId: string) {
  const name = 'Mành Tăm';
  if (await productExists(name)) {
    console.log(`  [BỎ QUA] "${name}" đã tồn tại.`);
    return;
  }

  const product = await svc.createProduct({ name, productTypeId, unitId, productionCenterId } as any);
  console.log(`  Tạo ${product.code} "${name}"`);

  await svc.createProductParameter(product.id, { name: 'chieurong', label: 'Chiều rộng', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 1 } as any);
  await svc.createProductParameter(product.id, { name: 'chieucao', label: 'Chiều cao', type: 'NUMBER', unit: 'm', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 2 } as any);
  await svc.createProductParameter(product.id, {
    name: 'loaimanh', label: 'Loại mành', type: 'ENUM', isRequired: true, usedInPricing: true, usedInMaterial: true, displayOrder: 3,
    options: [
      { value: 'tron', label: 'Trơn', displayOrder: 0 },
      { value: 'in_tranh', label: 'In tranh', displayOrder: 1 },
      { value: 've_thu_cong', label: 'Vẽ thủ công', displayOrder: 2 },
    ],
  } as any);
  await svc.createProductParameter(product.id, {
    name: 'dongia', label: 'Giá bán (Vẽ thủ công)', type: 'NUMBER', unit: 'đ/m²', isRequired: true, defaultValue: '0', usedInPricing: true, usedInMaterial: false, minValue: 0, displayOrder: 4,
  } as any);
  await svc.createProductParameter(product.id, {
    name: 'giavon', label: 'Giá vốn (Vẽ thủ công)', type: 'NUMBER', unit: 'đ/m²', isRequired: true, defaultValue: '0', usedInPricing: false, usedInMaterial: true, minValue: 0, displayOrder: 5,
  } as any);

  await svc.createDerivedParameter(product.id, { name: 'area', expression: 'chieurong * chieucao', unit: 'm2', displayOrder: 1 } as any);

  const prv = await svc.createPricingRuleVersion(product.id, {
    name: 'v1',
    expression: 'if(loaimanh == "ve_thu_cong", dongia * area, unitPrice * area)',
    priceRoundType: 'CEIL',
    priceRoundValue: 100,
    vatRate: 10,
  } as any);
  await svc.updatePriceMatrix(prv.id, [
    { dimensions: { loaimanh: 'tron' }, unitPrice: 150000, displayOrder: 0 },
    { dimensions: { loaimanh: 'in_tranh' }, unitPrice: 240000, displayOrder: 1 },
    // unitPrice=1 chỉ là placeholder hợp lệ (>0, bắt buộc bởi updatePriceMatrix)
    // — không thực sự dùng tới vì expression rẽ nhánh sang dongia.
    { dimensions: { loaimanh: 've_thu_cong' }, unitPrice: 1, displayOrder: 2 },
  ]);
  await svc.activatePricingRuleVersion(prv.id);

  const mrv = await svc.createMaterialRequirementVersion(product.id, { name: 'v1' } as any);
  await svc.createMaterialRequirementItem(mrv.id, { materialId: manhTamTronId, expression: 'area', wastePercent: 0, condition: 'loaimanh == "tron"', displayOrder: 1 } as any);
  await svc.createMaterialRequirementItem(mrv.id, { materialId: manhTamInTranhId, expression: 'area', wastePercent: 0, condition: 'loaimanh == "in_tranh"', displayOrder: 2 } as any);
  // giavon là đơn giá đ/m² (nhất quán với dongia và 2 loại Trơn/In tranh
  // còn lại đều tính theo m²) — nhân với area để ra tổng giá vốn, KHÔNG
  // dùng thẳng như mục 12 (ở đó giavon là tổng tiền trọn gói, không có
  // khái niệm diện tích).
  await svc.createMaterialRequirementItem(mrv.id, { materialId: giaVonThuCongMaterialId, expression: 'giavon * area', wastePercent: 0, condition: 'loaimanh == "ve_thu_cong"', displayOrder: 3 } as any);
  await svc.activateMaterialRequirementVersion(mrv.id);

  await svc.updateProductStatus(product.id, 'ACTIVE');
  console.log(`  Xong ${product.code}.`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const svc = app.get(ProductService);

  try {
    console.log('Chuẩn bị Master Data...');
    const productTypeId = await ensureProductType(svc, PRODUCT_TYPE_NAME);
    const unitM2Id = await requireByName('unit', UNIT_M2);
    const unitKhoanId = await requireByName('unit', UNIT_KHOAN);
    const productionCenterId = await requireByName('productionCenter', PRODUCTION_CENTER_NAME);

    const manhTrucTronId = await ensureMaterial(svc, 'Mành Trúc trơn', unitM2Id, 125000);
    const manhTrucInTranhId = await ensureMaterial(svc, 'Mành Trúc in tranh', unitM2Id, 230000);
    const manhTamTronId = await ensureMaterial(svc, 'Mành Tăm trơn', unitM2Id, 110000);
    const manhTamInTranhId = await ensureMaterial(svc, 'Mành Tăm in tranh', unitM2Id, 150000);
    const giaVonThuCongMaterialId = await ensureMaterial(
      svc,
      'Giá vốn Mành Tăm vẽ thủ công (nhập tay)',
      unitKhoanId,
      1,
      'Vật tư ảo — đại diện giá vốn nhập tay (tham số giavon), không phải vật tư tiêu hao thật.',
    );

    console.log('\n--- Mành Trúc ---');
    await createManhTruc(svc, productTypeId, unitM2Id, productionCenterId, manhTrucTronId, manhTrucInTranhId);

    console.log('\n--- Mành Tăm ---');
    await createManhTam(svc, productTypeId, unitM2Id, productionCenterId, manhTamTronId, manhTamInTranhId, giaVonThuCongMaterialId);

    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
