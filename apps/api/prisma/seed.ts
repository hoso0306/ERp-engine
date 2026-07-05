import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Running Numbers
  await prisma.runningNumber.upsert({
    where: { type: 'CUSTOMER' },
    update: {},
    create: { type: 'CUSTOMER', prefix: 'KH', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'PRODUCT' },
    update: {},
    create: { type: 'PRODUCT', prefix: 'SP', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'MATERIAL' },
    update: {},
    create: { type: 'MATERIAL', prefix: 'NL', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'PRODUCTION_CENTER' },
    update: {},
    create: { type: 'PRODUCTION_CENTER', prefix: 'XW', lastNumber: 0, paddingLength: 3 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'QUOTATION' },
    update: {},
    create: { type: 'QUOTATION', prefix: 'BG', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'SALES_ORDER' },
    update: { prefix: 'SO' },
    create: { type: 'SALES_ORDER', prefix: 'SO', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'PRODUCTION_ORDER' },
    update: { prefix: 'PO' },
    create: { type: 'PRODUCTION_ORDER', prefix: 'PO', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'MATERIAL_RECEIPT' },
    update: {},
    create: { type: 'MATERIAL_RECEIPT', prefix: 'PN', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'PAYMENT' },
    update: {},
    create: { type: 'PAYMENT', prefix: 'PT', lastNumber: 0, paddingLength: 6 },
  });

  // Customer Groups
  const groups = ['Khách lẻ', 'Đại lý', 'Doanh nghiệp'];
  for (const name of groups) {
    await prisma.customerGroup.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Delivery Routes
  const routes = ['Nội thành', 'Ngoại thành', 'Tỉnh lân cận', 'Liên tỉnh'];
  for (const name of routes) {
    await prisma.deliveryRoute.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Sample Customers
  const allGroups = await prisma.customerGroup.findMany();
  const allRoutes = await prisma.deliveryRoute.findMany();

  const customers = [
    { code: 'KH000001', name: 'Nguyễn Văn An', phone: '0901000001', email: 'an@email.com', province: 'Hà Nội', district: 'Cầu Giấy', priority: 'MEDIUM' as const, status: 'ACTIVE' as const },
    { code: 'KH000002', name: 'Trần Thị Bình', phone: '0901000002', email: 'binh@email.com', province: 'Hà Nội', district: 'Hoàng Mai', priority: 'HIGH' as const, status: 'ACTIVE' as const },
    { code: 'KH000003', name: 'Lê Văn Cường', phone: '0901000003', province: 'Hải Phòng', priority: 'LOW' as const, status: 'ACTIVE' as const },
    { code: 'KH000004', name: 'Phạm Thị Dung', phone: '0901000004', email: 'dung@email.com', province: 'Hà Nội', district: 'Long Biên', priority: 'MEDIUM' as const, status: 'INACTIVE' as const },
    { code: 'KH000005', name: 'Hoàng Minh Đức', phone: '0901000005', province: 'Bắc Ninh', priority: 'HIGH' as const, status: 'ACTIVE' as const },
    { code: 'KH000006', name: 'Vũ Thị Em', phone: '0901000006', province: 'Hà Nội', district: 'Thanh Xuân', priority: 'MEDIUM' as const, status: 'ACTIVE' as const },
    { code: 'KH000007', name: 'Đỗ Văn Phúc', phone: '0901000007', province: 'Hưng Yên', priority: 'MEDIUM' as const, status: 'ACTIVE' as const },
    { code: 'KH000008', name: 'Bùi Thị Giang', phone: '0901000008', email: 'giang@email.com', province: 'Hà Nội', district: 'Đống Đa', priority: 'LOW' as const, status: 'ACTIVE' as const },
  ];

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    await prisma.customer.upsert({
      where: { code: c.code },
      update: {},
      create: {
        ...c,
        customerGroupId: allGroups[i % allGroups.length].id,
        deliveryRouteId: allRoutes[i % allRoutes.length].id,
        defaultDiscount: i % 3 === 0 ? 5 : 0,
        debtLimit: i % 2 === 0 ? 50000000 : 0,
        debtTermDays: 30,
      },
    });
  }

  // Update running number counter
  await prisma.runningNumber.update({
    where: { type: 'CUSTOMER' },
    data: { lastNumber: customers.length },
  });

  // Company Settings — Singleton, seed sẵn 1 bản ghi (không để FE tự tạo lần đầu).
  const existingCompany = await prisma.company.findFirst();
  if (!existingCompany) {
    await prisma.company.create({
      data: {
        companyName: 'CÔNG TY TNHH ERP ENGINE',
        phone: '0900 000 000',
        address: 'Hà Nội, Việt Nam',
        currency: 'VND',
        currencySymbol: '₫',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
  }

  // Settings (key-value) — Dashboard / Notification / Document / Security / Backup
  const settings: {
    module: string;
    key: string;
    value: string;
    defaultValue: string;
    valueType: 'BOOLEAN' | 'NUMBER' | 'STRING' | 'TEXT';
    description: string;
  }[] = [
    // Dashboard Settings
    { module: 'Dashboard', key: 'topCustomers', value: '10', defaultValue: '10', valueType: 'NUMBER', description: 'Số lượng khách hàng hiển thị ở Top khách nợ nhiều nhất' },
    { module: 'Dashboard', key: 'topProducts', value: '10', defaultValue: '10', valueType: 'NUMBER', description: 'Số lượng sản phẩm hiển thị ở Top bán chạy' },
    { module: 'Dashboard', key: 'topMaterials', value: '10', defaultValue: '10', valueType: 'NUMBER', description: 'Số lượng vật tư hiển thị ở Top tiêu thụ' },
    { module: 'Dashboard', key: 'defaultDashboardPeriod', value: '30', defaultValue: '30', valueType: 'NUMBER', description: 'Khoảng thời gian mặc định (số ngày) khi mở Dashboard' },
    { module: 'Dashboard', key: 'upcomingDueDays', value: '7', defaultValue: '7', valueType: 'NUMBER', description: 'Số ngày sắp đến hạn công nợ — dùng chung cho Dashboard và DebtService' },

    // Notification Settings (V1 chỉ bật/tắt, chưa gửi thật)
    { module: 'Notification', key: 'notifyOverdueDebt', value: 'true', defaultValue: 'true', valueType: 'BOOLEAN', description: 'Cảnh báo công nợ quá hạn' },
    { module: 'Notification', key: 'notifyCreditLimitExceeded', value: 'true', defaultValue: 'true', valueType: 'BOOLEAN', description: 'Cảnh báo khách vượt hạn mức công nợ' },
    { module: 'Notification', key: 'notifyLowStock', value: 'true', defaultValue: 'true', valueType: 'BOOLEAN', description: 'Cảnh báo vật tư sắp hết/hết hàng' },
    { module: 'Notification', key: 'notifyProductionCompleted', value: 'true', defaultValue: 'true', valueType: 'BOOLEAN', description: 'Thông báo khi Production Order hoàn thành' },
    { module: 'Notification', key: 'notifyOrderDelivered', value: 'true', defaultValue: 'true', valueType: 'BOOLEAN', description: 'Thông báo khi đơn hàng đã giao cho khách' },

    // Document Settings (in ấn)
    { module: 'Document', key: 'quotationDefaultTerms', value: '', defaultValue: '', valueType: 'TEXT', description: 'Điều khoản mặc định in cuối Báo giá' },

    // Security Settings
    { module: 'Security', key: 'sessionTimeout', value: '60', defaultValue: '60', valueType: 'NUMBER', description: 'Thời gian hết phiên đăng nhập (phút)' },
    { module: 'Security', key: 'forceChangePasswordOnFirstLogin', value: 'true', defaultValue: 'true', valueType: 'BOOLEAN', description: 'Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên' },

    // Backup Settings (chuẩn bị cấu trúc cho V2)
    { module: 'Backup', key: 'autoBackup', value: 'false', defaultValue: 'false', valueType: 'BOOLEAN', description: 'Bật/tắt tự động sao lưu' },
    { module: 'Backup', key: 'backupSchedule', value: 'daily', defaultValue: 'daily', valueType: 'STRING', description: 'Lịch sao lưu (vd daily/weekly)' },
    { module: 'Backup', key: 'retentionDays', value: '30', defaultValue: '30', valueType: 'NUMBER', description: 'Số ngày giữ lại bản sao lưu' },
    { module: 'Backup', key: 'backupProvider', value: '', defaultValue: '', valueType: 'STRING', description: 'Nhà cung cấp lưu trữ sao lưu (Google Drive/NAS/S3)' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { module_key: { module: s.module, key: s.key } },
      update: {},
      create: s,
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
