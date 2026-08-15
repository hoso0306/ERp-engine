/**
 * Thêm 2 permission mới cho tính năng "Nhân viên tự xuất Excel đơn hàng":
 *   - sales-order.export     — xuất đơn CỦA CHÍNH MÌNH.
 *   - sales-order.export-all — được chọn xuất theo người khác/tất cả.
 *
 * Gán role theo kiểu QUERY-DRIVEN (không hardcode tên role) để không phụ
 * thuộc prisma/seed.ts (đã xác nhận bị lệch với role live — role "kế toán
 * trưởng" tồn tại trên Local/VPS nhưng KHÔNG có trong DEFAULT_ROLES của
 * seed.ts, seed.ts cũng không phải nguồn đáng tin cho permission hiện tại
 * của "Kế toán"/MANAGER... — xem lịch sử phiên làm việc 15/08/2026):
 *   - sales-order.export     → mọi role hiện đang có sales-order.view.
 *   - sales-order.export-all → mọi role hiện đang có quotation.view-cost
 *     (đúng tiền lệ tách quyền tài chính nhạy cảm đã có sẵn trong hệ thống).
 *
 * Idempotent — chạy lại nhiều lần an toàn (upsert Permission theo key,
 * RolePermission theo cặp roleId+permissionId).
 *
 * Chạy: từ apps/api — TS_NODE_PROJECT=./tsconfig.json npx ts-node
 *   --transpile-only -r tsconfig-paths/register
 *   ../../scripts/seed/add-sales-order-export-permission.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const exportPerm = await prisma.permission.upsert({
    where: { key: 'sales-order.export' },
    update: {},
    create: { resource: 'sales-order', action: 'export', key: 'sales-order.export' },
  });
  const exportAllPerm = await prisma.permission.upsert({
    where: { key: 'sales-order.export-all' },
    update: {},
    create: {
      resource: 'sales-order',
      action: 'export-all',
      key: 'sales-order.export-all',
    },
  });

  const viewRoles = await prisma.role.findMany({
    where: { rolePermissions: { some: { permission: { key: 'sales-order.view' } } } },
    select: { id: true, name: true },
  });
  const viewCostRoles = await prisma.role.findMany({
    where: { rolePermissions: { some: { permission: { key: 'quotation.view-cost' } } } },
    select: { id: true, name: true },
  });

  for (const role of viewRoles) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: exportPerm.id } },
      update: {},
      create: { roleId: role.id, permissionId: exportPerm.id },
    });
  }
  for (const role of viewCostRoles) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: exportAllPerm.id } },
      update: {},
      create: { roleId: role.id, permissionId: exportAllPerm.id },
    });
  }

  console.log(
    `sales-order.export gán cho: ${viewRoles.map((r) => r.name).join(', ')}`,
  );
  console.log(
    `sales-order.export-all gán cho: ${viewCostRoles.map((r) => r.name).join(', ')}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
