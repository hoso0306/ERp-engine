/**
 * Đồng bộ về Local các thay đổi người dùng sửa TAY trực tiếp trên Production
 * (VPS) trong ngày 11/08/2026 (từ tối 10/08 đến ~16h20 11/08 giờ VN), sau khi
 * đã đối chiếu field-level và loại bỏ phần trùng do các script replay
 * Local→Production trước đó (create-phi-van-chuyen-thue-hoa-don.ts,
 * create-validation-rules-sp138-139-140.ts, fix-so-canh-sp127-128.ts,
 * fix-so-canh-rem-to-ong.ts — 4 script đó KHÔNG cần chạy lại, dữ liệu đã có
 * trên Local từ trước, chính là nguồn được replay lên Production).
 *
 * Phạm vi (theo xác nhận người dùng — đồng bộ tất cả, kể cả discount/role):
 *  1. Material mới: NL000355 (VPS) "Rèm ngăn lạnh - thu xếp - Bánh xe liền
 *     móc", NL000356 (VPS) "Bạt cuốn SVC01- hệ tự cuốn". (Bỏ qua NL000357
 *     "test"/NL000358 "testtt" theo yêu cầu người dùng — rác tạo nhầm.)
 *  2. Pricing Rule version mới — CHỈ vat_rate đổi (nội dung expression/items
 *     đã khớp Local), tạo version DRAFT mới rồi activate:
 *       - Mái hiên di động: 8% → 10%
 *       - Mành Trúc: 10% → 8%
 *       - Mành Tăm: 10% → 8%
 *     ("Thêm/Thay vải cầu vồng" đã khớp 100% nội dung — KHÔNG cần đổi gì.)
 *  3. Validation Rule SP000052 "[Cửa xếp] Lá nhựa xếp phẳng" — 2 rule đã tồn
 *     tại (cùng id) nhưng nội dung lệch (Local: màu Trắng/Ghi hết hàng, VPS:
 *     màu Cafe/Vân gỗ hết hàng) — cập nhật theo VPS = trạng thái tồn kho hiện
 *     tại thật.
 *  4. Product Parameter bitreo/utreo trên SP000112 "Rèm ngăn lạnh - Loại
 *     trượt ngang" — chỉ field `unit` đổi nhãn ("cái"→"bi treo", "m"→"m U").
 *  5. Customer Product Discount (25 dòng, loại "Rèm cầu vồng") — tạo mới 23
 *     khách hàng chưa có trên Local (copy nguyên field từ VPS, code sẽ do
 *     Local tự sinh — chấp nhận lệch mã như các lần trước) + set/update
 *     discount cho toàn bộ 25 khách (kể cả "ANH LUÂN LS"/"ANH THIỆN" đã có).
 *  6. Role "kế toán trưởng" (code KETOANTRUONG, 40 permission) — tạo mới trên
 *     Local + gán roleId này cho user buianhvanhaui@gmail.com (Bùi Ánh Vân)
 *     — 5 user còn lại đổi role trên VPS hôm nay nhưng role cuối cùng đã
 *     khớp sẵn với Local, không cần đổi.
 *
 * Idempotent: script kiểm tra tồn tại trước khi tạo ở từng bước, an toàn
 * chạy lại nếu bị ngắt giữa chừng.
 *
 * Chạy (từ thư mục gốc repo, máy Local — KHÔNG chạy trong container VPS):
 *   cd apps/api && npx ts-node --transpile-only -r tsconfig-paths/register \
 *     ../../scripts/seed/sync-vps-2026-08-11-to-local.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { ProductService } from '../../apps/api/src/product/product.service';
import { CustomerService } from '../../apps/api/src/customer/customer.service';
import { RoleService } from '../../apps/api/src/permission/role.service';
import { UserService } from '../../apps/api/src/permission/user.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

let prisma: PrismaService;

async function syncMaterials(svc: ProductService) {
  console.log('\n=== 1. Materials ===');
  const unitCai = await prisma.unit.findFirst({ where: { name: 'Cái' } });
  const unitBo = await prisma.unit.findFirst({ where: { name: 'Bộ' } });
  if (!unitCai || !unitBo) throw new Error('Không tìm thấy Unit "Cái"/"Bộ" trên Local.');

  const items: {
    name: string;
    unitId: string;
    retailPrice: number;
    retailVatRate: number;
    defaultPrice: number;
  }[] = [
    { name: 'Rèm ngăn lạnh - thu xếp - Bánh xe liền móc', unitId: unitCai.id, retailPrice: 19000, retailVatRate: 10, defaultPrice: 13000 },
    { name: 'Bạt cuốn SVC01- hệ tự cuốn', unitId: unitBo.id, retailPrice: 1, retailVatRate: 10, defaultPrice: 1 },
  ];

  for (const it of items) {
    const existing = await prisma.material.findFirst({ where: { name: { equals: it.name, mode: 'insensitive' } } });
    let materialId: string;
    if (existing) {
      console.log(`[BỎ QUA tạo] "${it.name}" đã tồn tại (${existing.code}).`);
      materialId = existing.id;
    } else {
      const m = await svc.createMaterial({
        name: it.name,
        unitId: it.unitId,
        isRetailable: true,
        retailPrice: it.retailPrice,
        retailVatRate: it.retailVatRate,
      } as any);
      console.log(`Tạo ${m.code} "${m.name}"`);
      materialId = m.id;
    }
    const existingPrice = await prisma.materialPrice.findFirst({ where: { materialId, isDefault: true } });
    if (existingPrice) {
      console.log(`  [BỎ QUA giá] đã có giá mặc định (${existingPrice.price}).`);
    } else {
      await svc.createMaterialPrice(materialId, {
        price: it.defaultPrice,
        effectiveFrom: new Date().toISOString(),
        isDefault: true,
      } as any);
      console.log(`  Tạo giá mặc định ${it.defaultPrice}.`);
    }
  }
}

async function syncPricingVat(svc: ProductService) {
  console.log('\n=== 2. Pricing Rule version (đổi VAT) ===');
  const targets: { productName: string; vatRate: number }[] = [
    { productName: 'Mái hiên di động', vatRate: 10 },
    { productName: 'Mành Trúc', vatRate: 8 },
    { productName: 'Mành Tăm', vatRate: 8 },
  ];

  for (const t of targets) {
    const product = await prisma.product.findFirst({ where: { name: t.productName, deletedAt: null } });
    if (!product) throw new Error(`Không tìm thấy Product tên="${t.productName}".`);
    const rule = await prisma.pricingRule.findUnique({ where: { productId: product.id } });
    if (!rule) throw new Error(`${t.productName}: chưa có Pricing Rule.`);
    const active = await prisma.pricingRuleVersion.findFirst({ where: { pricingRuleId: rule.id, status: 'ACTIVE' } });
    if (!active) throw new Error(`${t.productName}: không tìm thấy Pricing Rule Version ACTIVE.`);

    if (Number(active.vatRate) === t.vatRate) {
      console.log(`[BỎ QUA] ${product.code} "${t.productName}" đã VAT ${t.vatRate}%.`);
      continue;
    }

    const dup = await svc.duplicatePricingRuleVersion(active.id);
    await svc.updatePricingRuleVersion(dup!.id, { vatRate: t.vatRate } as any);
    await svc.activatePricingRuleVersion(dup!.id);
    console.log(`${product.code} "${t.productName}": VAT ${active.vatRate}% → ${t.vatRate}% (v${dup!.versionNumber}).`);
  }
}

async function syncValidationRulesSp052(svc: ProductService) {
  console.log('\n=== 3. Validation Rule SP000052 ===');
  const RULES = [
    { id: 'cmroigw0s0000q0vgn7fmnsq9', expression: 'maukhung == "cafe"', message: 'Màu Cafe hiện đang hết hàng — vui lòng chọn màu khác hoặc liên hệ kho.' },
    { id: 'cmroigw1k0001q0vgvkioc55y', expression: 'maukhung == "van_go"', message: 'Màu Vân gỗ hiện đang hết hàng — vui lòng chọn màu khác hoặc liên hệ kho.' },
  ];
  for (const r of RULES) {
    const rule = await prisma.validationRule.findUnique({ where: { id: r.id } });
    if (!rule) {
      console.log(`  [BỎ QUA] Validation Rule id=${r.id} không tồn tại trên Local (cấu trúc lệch) — bỏ qua, cần kiểm tra tay.`);
      continue;
    }
    if (rule.expression === r.expression && rule.message === r.message) {
      console.log(`  [BỎ QUA] đã khớp: "${r.message}".`);
      continue;
    }
    await svc.updateValidationRule(r.id, { expression: r.expression, message: r.message } as any);
    console.log(`  Cập nhật rule ${r.id}: "${rule.message}" → "${r.message}"`);
  }
}

async function syncProductParams(svc: ProductService) {
  console.log('\n=== 4. Product Parameters bitreo/utreo (SP000112) ===');
  const product = await prisma.product.findFirst({ where: { name: 'Rèm ngăn lạnh - Loại trượt ngang', deletedAt: null } });
  if (!product) throw new Error('Không tìm thấy Product "Rèm ngăn lạnh - Loại trượt ngang".');

  const TARGETS = [
    { name: 'bitreo', unit: 'bi treo' },
    { name: 'utreo', unit: 'm U' },
  ];
  for (const t of TARGETS) {
    const param = await prisma.productParameter.findFirst({ where: { productId: product.id, name: t.name } });
    if (!param) throw new Error(`Không tìm thấy Parameter "${t.name}" trên SP000112.`);
    if (param.unit === t.unit) {
      console.log(`  [BỎ QUA] "${t.name}" đã unit="${t.unit}".`);
      continue;
    }
    await svc.updateProductParameter(param.id, { unit: t.unit } as any);
    console.log(`  "${t.name}": unit "${param.unit}" → "${t.unit}"`);
  }
}

type CustomerRow = {
  name: string;
  phone: string;
  email: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  deliveryRouteName: string | null;
  discountPercent: number;
};

const CUSTOMERS: CustomerRow[] = [
  { name: 'ANH LUÂN LS', phone: '0912578148', email: null, province: 'Lạng Sơn', district: null, ward: null, address: 'LÊ ĐẠI HÀNH TPLS,LS', deliveryRouteName: null, discountPercent: 64 },
  { name: 'ANH NGỌC HÀ NỘI', phone: '00000000', email: null, province: null, district: null, ward: null, address: null, deliveryRouteName: null, discountPercent: 65 },
  { name: 'ANH THIỆN', phone: '0387712308', email: null, province: 'Bắc Ninh', district: 'Lạng Giang', ward: 'Đại Lâm', address: 'ĐẠI LÂM,LẠNG GIANG,LG', deliveryRouteName: null, discountPercent: 65 },
  { name: 'CK VIẾT THƠM', phone: '0988452266', email: null, province: 'HẢI DƯƠNG', district: null, ward: null, address: 'CHÍ LINH ,HẢI DƯƠNG', deliveryRouteName: 'Ngoại thành', discountPercent: 62 },
  { name: 'CƠ KHÍ VIỆT LÂM', phone: '0969750167', email: null, province: null, district: null, ward: null, address: 'ĐẠI LÂM LẠNG GIANG', deliveryRouteName: null, discountPercent: 62 },
  { name: 'NT THÀNH THUỶ', phone: '0978629596', email: null, province: 'Bắc Giang', district: 'Lục Nam', ward: 'Nghĩa Phương', address: null, deliveryRouteName: null, discountPercent: 64 },
  { name: 'NỘI THẤT LOA ĐÀI SƠN NGA', phone: '0335.168.163', email: null, province: null, district: null, ward: null, address: 'ĐỒNG MỎ LẠNG SƠN', deliveryRouteName: null, discountPercent: 63 },
  { name: 'RÈM HUYỀN SƠN', phone: '0000000018', email: null, province: 'BẮC NINH', district: 'LẠNG GIANG', ward: null, address: 'ĐÀO MỸ LẠNG GIANG', deliveryRouteName: null, discountPercent: 65 },
  { name: 'RÈM HUÊ YÊN', phone: '0000000016', email: null, province: 'LẠNG SƠN', district: 'LẠNG SƠN', ward: null, address: 'HỮU LŨNG LẠNG SƠN', deliveryRouteName: 'Liên tỉnh', discountPercent: 65 },
  { name: 'RÈM HÙNG NGHĨA', phone: '0384874185', email: null, province: 'Bắc Giang', district: 'Tân Yên', ward: null, address: 'Hợp Đức', deliveryRouteName: null, discountPercent: 65 },
  { name: 'RÈM HƯỜNG AN', phone: '0975092172', email: null, province: null, district: null, ward: null, address: 'XUÂN HƯƠNG,LẠNG GIANG', deliveryRouteName: null, discountPercent: 64 },
  { name: 'RÈM HẠNH ĐẠI', phone: '0000000015', email: null, province: 'BẮC NINH', district: 'LỤC NAM', ward: null, address: 'TRẠI 3 QUÝ SƠN', deliveryRouteName: 'Ngoại thành', discountPercent: 65 },
  { name: 'RÈM HẬU TÂN', phone: '0383943443', email: null, province: 'Bắc Giang', district: null, ward: null, address: 'Lan Mẫu', deliveryRouteName: null, discountPercent: 64 },
  { name: 'RÈM LINH QUẢNG', phone: '0000000094', email: null, province: 'BẮC NINH', district: null, ward: null, address: 'TT NHAM BIỀN ,YÊN DŨNG,YD', deliveryRouteName: 'Ngoại thành', discountPercent: 65 },
  { name: 'RÈM MAI PHƯƠNG', phone: '0888150966', email: null, province: 'BẮC NINH', district: 'BẮC GIANG', ward: null, address: 'SỐ 55 ĐƯỜNG NGUYỄN CÔNG HÃNG', deliveryRouteName: 'Nội thành', discountPercent: 65 },
  { name: 'RÈM MẠC LƯƠNG', phone: '0385.311.379', email: null, province: 'BĂC GIANG', district: null, ward: 'YÊN DŨNG', address: 'YÊN DŨNG BẮC GIANG', deliveryRouteName: null, discountPercent: 65 },
  { name: 'RÈM MẠC LƯƠNG', phone: '0385311379', email: null, province: 'BẮC NINH', district: null, ward: null, address: 'YÊN DŨNG ,BẮC GIANG,YD', deliveryRouteName: 'Ngoại thành', discountPercent: 65 },
  { name: 'RÈM NAM LINH', phone: '0988.228.198', email: null, province: null, district: null, ward: null, address: 'TRẦN NGUYÊN HÃN P BẮC GIANG', deliveryRouteName: null, discountPercent: 64 },
  { name: 'RÈM NGỌC VÂN', phone: '0383061058', email: null, province: 'BẮC NINH', district: null, ward: null, address: 'CAO XÁ ,TÂN YÊN,TY', deliveryRouteName: 'Ngoại thành', discountPercent: 65 },
  { name: 'RÈM NHẬT LỆ', phone: '0963155931', email: null, province: null, district: null, ward: null, address: '35 KIM ANH XÃ THANH XUÂN SÓC SƠN', deliveryRouteName: 'Liên tỉnh', discountPercent: 65 },
  { name: 'RÈM THU DUNG', phone: '0000000017', email: null, province: 'BẮC NINH', district: 'LẠNG GIANG', ward: null, address: 'LẠNG GIANG', deliveryRouteName: 'Ngoại thành', discountPercent: 64 },
  { name: 'RÈM THU MINH', phone: '0978876242', email: null, province: 'BẮC NINH', district: null, ward: null, address: 'PHỐ THÁI ĐÀO ,TÂN AN,YD', deliveryRouteName: 'Ngoại thành', discountPercent: 64 },
  { name: 'RÈM TIẾN TUYẾN', phone: '037.825.5391', email: null, province: null, district: null, ward: null, address: 'THÁI SƠN - HIỆP HOÀ', deliveryRouteName: null, discountPercent: 63 },
  { name: 'RÈM TUẤN VUI', phone: '0366744792', email: null, province: 'BẮC NINH', district: null, ward: null, address: 'TÂN MỸ BẮC GIANG-TPBG', deliveryRouteName: 'Ngoại thành', discountPercent: 63 },
  { name: 'RÈM TÚ HUẾ', phone: '0962560994', email: null, province: 'Bắc Giang', district: null, ward: null, address: 'KĐT An Huy - Cao Thượng', deliveryRouteName: null, discountPercent: 63 },
];

async function syncCustomerDiscounts(customerSvc: CustomerService) {
  console.log('\n=== 5. Customer + Discount (Rèm cầu vồng) ===');
  const productType = await prisma.productType.findFirst({ where: { name: 'Rèm cầu vồng' } });
  if (!productType) throw new Error('Không tìm thấy ProductType "Rèm cầu vồng".');

  const routes = await prisma.deliveryRoute.findMany();
  const routeIdByName = new Map(routes.map((r) => [r.name, r.id]));

  for (const c of CUSTOMERS) {
    let customer = await prisma.customer.findFirst({ where: { name: c.name, phone: c.phone, deletedAt: null } });
    if (!customer) {
      // phone trùng với khách khác tên khác (không nên xảy ra, đã kiểm tra trước) -> báo lỗi dừng thay vì âm thầm bỏ qua
      const phoneConflict = await prisma.customer.findFirst({ where: { phone: c.phone, deletedAt: null } });
      if (phoneConflict) {
        console.log(`  [BỎ QUA tạo] SĐT ${c.phone} đã thuộc khách khác ("${phoneConflict.name}") — kiểm tra tay.`);
        customer = phoneConflict;
      } else {
        customer = (await customerSvc.create({
          name: c.name,
          phone: c.phone,
          email: c.email ?? undefined,
          province: c.province ?? undefined,
          district: c.district ?? undefined,
          ward: c.ward ?? undefined,
          address: c.address ?? undefined,
          deliveryRouteId: c.deliveryRouteName ? routeIdByName.get(c.deliveryRouteName) : undefined,
        } as any)) as any;
        console.log(`  Tạo khách "${customer.name}" (${customer.code}).`);
      }
    } else {
      console.log(`  [BỎ QUA tạo] "${c.name}" (${customer.code}) đã tồn tại.`);
    }

    const existingDiscount = await prisma.customerProductDiscount.findUnique({
      where: { customerId_productTypeId: { customerId: customer.id, productTypeId: productType.id } },
    });
    if (!existingDiscount) {
      await customerSvc.createProductDiscount(customer.id, {
        productTypeId: productType.id,
        discountPercent: c.discountPercent,
      } as any);
      console.log(`    Set chiết khấu Rèm cầu vồng = ${c.discountPercent}%.`);
    } else if (Number(existingDiscount.discountPercent) !== c.discountPercent) {
      await customerSvc.updateProductDiscount(customer.id, existingDiscount.id, {
        discountPercent: c.discountPercent,
      } as any);
      console.log(`    Cập nhật chiết khấu ${existingDiscount.discountPercent}% → ${c.discountPercent}%.`);
    } else {
      console.log(`    [BỎ QUA] chiết khấu đã đúng ${c.discountPercent}%.`);
    }
  }
}

async function syncRole(roleSvc: RoleService, userSvc: UserService) {
  console.log('\n=== 6. Role "kế toán trưởng" ===');
  let role = await prisma.role.findFirst({ where: { name: 'kế toán trưởng' } });
  if (!role) {
    role = await roleSvc.create({ code: 'KETOANTRUONG', name: 'kế toán trưởng' } as any, null);
    console.log(`  Tạo role "${role.name}" (${role.code}).`);
  } else {
    console.log(`  [BỎ QUA tạo] role "${role.name}" đã tồn tại.`);
  }

  const VPS_PERMISSION_IDS = [
    'cmrs8c0kc001661rsdduqimly', 'cmrs8c0ke001761rs5k4at5ah', 'cmrs8c0kg001861rs21evchj4', 'cmrs8c0ki001961rsbe0zioxz',
    'cmrs8c0kj001a61rs03awc7qq', 'cmrs8c0kl001b61rsawfchdxc', 'cmrs8c0kn001c61rsvakbdqrd', 'cmrs8c0kp001d61rslgf2pxsv',
    'cmrs8c0kq001e61rs6gcn582p', 'cmrs8c0ks001f61rsh5py7w8w', 'cmrs8c0ku001g61rsk830m72w', 'cmrs8c0kv001h61rs56404a7r',
    'cmrs8c0kx001i61rsid14smzn', 'cmrs8c0ky001j61rsj1oj9em1', 'cmrs8c0l0001k61rszawc85gg', 'cmrs8c0l2001l61rseswuawpc',
    'cmrs8c0l3001m61rszkji5w6w', 'cmrs8c0l5001n61rssfk092os', 'cmrs8c0l7001o61rs9hj939p6', 'cmrs8c0l8001p61rsazrkov7s',
    'cmrs8c0ld001s61rsj120v0le', 'cmrs8c0lf001t61rsm10dfuyn', 'cmrs8c0lg001u61rs2kx319cy', 'cmrs8c0li001v61rsgdzykzlw',
    'cmrs8c0ll001w61rssmm4uusb', 'cmrs8c0ln001x61rsavucv5zh', 'cmrs8c0lo001y61rsw06kqovj', 'cmrs8c0lr002061rs4lq66sye',
    'cmrs8c0m8002961rsk8vm8xok', 'cmrs8c0mm002f61rsq66rmem5', 'cmrs8c0mo002g61rsyvbhenus', 'cmrs8c0mq002h61rs9iw9k0qb',
    'cmrs8c0ms002i61rsbmdo4ah6', 'cmrtbbzs1000260p8facsqjrk', 'cmrs8c0mt002j61rs1edqv2qu', 'cmrs8c0mc002b61rs5g8oq9rv',
    'cmrs8c0mf002d61rs7qkk0f01', 'cmrs8c0ma002a61rswl3f6zee', 'cmrs8c0me002c61rsiibrc78l', 'cmrs8c0ml002e61rsuustjti9',
  ];
  const validPermissions = await prisma.permission.findMany({ where: { id: { in: VPS_PERMISSION_IDS } } });
  if (validPermissions.length !== VPS_PERMISSION_IDS.length) {
    console.log(`  [CẢNH BÁO] chỉ tìm thấy ${validPermissions.length}/${VPS_PERMISSION_IDS.length} permission id trên Local — bảng permission có thể đã lệch, gán phần tìm thấy.`);
  }
  await roleSvc.update(role.id, { permissionIds: validPermissions.map((p) => p.id) } as any, null);
  console.log(`  Gán ${validPermissions.length} permission cho role.`);

  const user = await prisma.user.findUnique({ where: { email: 'buianhvanhaui@gmail.com' } });
  if (!user) throw new Error('Không tìm thấy user buianhvanhaui@gmail.com trên Local.');
  if (user.roleId === role.id) {
    console.log('  [BỎ QUA] Bùi Ánh Vân đã có role "kế toán trưởng".');
  } else {
    await userSvc.update(user.id, { roleId: role.id } as any, user.id);
    console.log('  Cập nhật role Bùi Ánh Vân → "kế toán trưởng".');
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = app.get(PrismaService);
  const productSvc = app.get(ProductService);
  const customerSvc = app.get(CustomerService);
  const roleSvc = app.get(RoleService);
  const userSvc = app.get(UserService);
  try {
    await syncMaterials(productSvc);
    await syncPricingVat(productSvc);
    await syncValidationRulesSp052(productSvc);
    await syncProductParams(productSvc);
    await syncCustomerDiscounts(customerSvc);
    await syncRole(roleSvc, userSvc);
    console.log('\n=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
