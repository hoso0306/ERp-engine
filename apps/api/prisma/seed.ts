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
    update: {},
    create: { type: 'SALES_ORDER', prefix: 'DH', lastNumber: 0, paddingLength: 6 },
  });

  await prisma.runningNumber.upsert({
    where: { type: 'PRODUCTION_ORDER' },
    update: {},
    create: { type: 'PRODUCTION_ORDER', prefix: 'SX', lastNumber: 0, paddingLength: 6 },
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

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
