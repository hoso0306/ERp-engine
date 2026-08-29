/**
 * Test end-to-end các tính năng mới ở workbench/sessions/2707.md (phiên
 * 27/08/2026) — tự tạo Khách hàng -> Báo giá -> Duyệt thành Đơn hàng (KHÔNG
 * đợi Đã giao) -> Hàng hoàn (có Công ty hỗ trợ, tự động giảm công nợ) ->
 * Giảm trừ công nợ ĐỘC LẬP -> kiểm tra netAmount/Tổng doanh số/lịch sử.
 *
 * Dùng lại sản phẩm có sẵn SP000122 (đã có PricingRuleVersion/
 * MaterialRequirementVersion ACTIVE) — không tạo Product mới.
 *
 * Không qua HTTP/auth — gọi thẳng Service qua NestFactory.createApplicationContext,
 * cùng pattern các script khác trong thư mục này.
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/2707-test-return-debt-features.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { CustomerService } from '../../apps/api/src/customer/customer.service';
import { QuotationWorkflowService } from '../../apps/api/src/quotation/quotation-workflow.service';
import { ReturnService } from '../../apps/api/src/return/return.service';
import { DebtService } from '../../apps/api/src/debt/debt.service';
import { SalesOrderService } from '../../apps/api/src/sales-order/sales-order.service';
import { DashboardService } from '../../apps/api/src/dashboard/dashboard.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';

const PRODUCT_ID = 'cmsefhn6c003y01p2y00kub4u'; // SP000122
const ACTOR_USER_ID = 'cmrs8c0wy007761rs6na7ooy8'; // Admin

function log(title: string, data: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);
  const customerService = app.get(CustomerService);
  const quotationService = app.get(QuotationWorkflowService);
  const returnService = app.get(ReturnService);
  const debtService = app.get(DebtService);
  const salesOrderService = app.get(SalesOrderService);
  const dashboardService = app.get(DashboardService);

  // 1. Khách hàng test mới
  const phone = '09' + Date.now().toString().slice(-8);
  const customer = await customerService.create({
    name: 'TEST 2707 - Đối chiếu tính năng',
    phone,
  } as never);
  log('1. Tạo Khách hàng', {
    id: customer.id,
    code: customer.code,
    name: customer.name,
    phone: customer.phone,
  });

  // 2. Báo giá -> thêm sản phẩm -> Gửi -> Duyệt
  const quotation = await quotationService.create(
    { customerId: customer.id },
    ACTOR_USER_ID,
  );
  await quotationService.addItem(quotation.id, {
    productId: PRODUCT_ID,
    quantity: 3,
    parameters: [
      { name: 'chieurong', value: '1.2' },
      { name: 'chieucao', value: '1.5' },
      { name: 'sosoi', value: '50' },
    ],
  } as never);
  await quotationService.send(quotation.id, ACTOR_USER_ID);
  const approved = await quotationService.approve(quotation.id, ACTOR_USER_ID);
  const salesOrderId = (approved as { salesOrderId: string }).salesOrderId;

  const order = await salesOrderService.findOne(salesOrderId);
  log('2. Tạo + Duyệt Báo giá -> Đơn hàng', {
    quotationCode: quotation.code,
    salesOrderId: order.id,
    salesOrderCode: order.code,
    status: order.status, // kỳ vọng IN_PRODUCTION — KHÔNG phải DELIVERED
    ownerId: order.ownerId,
    ownerName: order.ownerName,
    totalAmount: Number(order.totalAmount),
    itemCount: order.items.length,
  });

  const orderItem = order.items[0];

  // 3. Tạo Return NGAY TRÊN ĐƠN CHƯA GIAO (mục 1 — nới điều kiện tạo),
  // trả 1/3 số lượng, có phần Công ty hỗ trợ (60% giá trị dòng hoàn).
  const returnedQuantity = 1;
  const lineTotalValue = Math.round(Number(orderItem.finalPrice) * returnedQuantity);
  const customerBorneAmount = Math.round(lineTotalValue * 0.4);
  const expectedCompanyBorne = lineTotalValue - customerBorneAmount;

  const ret = await returnService.create({
    salesOrderId: order.id,
    items: [
      {
        salesOrderItemId: orderItem.id,
        returnedQuantity,
        reason: 'PRODUCTION_DEFECT',
      },
    ],
    customerBorneAmount,
    companyBorneReason: 'Test 2707 — lỗi sản xuất, công ty hỗ trợ 60% giá trị hoàn',
    receivedBy: 'Admin (test script)',
  } as never);

  log('3. Tạo Return (đơn chưa Đã giao, có Công ty hỗ trợ)', {
    returnCode: ret.code,
    returnId: ret.id,
    orderStatusAtReturnTime: order.status,
    totalValue: Number(ret.totalValue),
    customerBorneAmount: Number(ret.customerBorneAmount),
    companyBorneReason: ret.companyBorneReason,
    ownerId: ret.ownerId, // kỳ vọng = order.ownerId (snapshot)
    ownerName: ret.ownerName,
    computedCompanyBorne: expectedCompanyBorne,
  });

  // 4. FE tự động gọi Manual Adjustment ngay sau khi tạo Return (mục 2)
  const receivable = await prisma.receivable.findFirstOrThrow({
    where: { salesOrderId: order.id },
  });
  const afterReturnAdjustment = await debtService.manualAdjustment(
    receivable.id,
    {
      amount: expectedCompanyBorne,
      reason: ret.companyBorneReason!,
      returnId: ret.id,
      returnCode: ret.code,
    },
    ACTOR_USER_ID,
  );
  log('4. Manual Adjustment tự động theo Return (mục 2)', {
    receivableId: receivable.id,
    totalAmountBefore: Number(receivable.totalAmount),
    remainingAmountBefore: Number(receivable.remainingAmount),
    totalAmountAfter: Number(afterReturnAdjustment.totalAmount),
    remainingAmountAfter: Number(afterReturnAdjustment.remainingAmount),
    amountAdjusted: expectedCompanyBorne,
  });

  // 5. Return.findOne() tự tính lại debtAdjustedAt/Amount/ByName từ
  // DebtAdjustment (mục 6 — không còn lưu cộng dồn trên Return nữa)
  const retDetail = await returnService.findOne(ret.id);
  log('5. Return chi tiết — debtAdjustedAmount tự tính từ DebtAdjustment (mục 6)', {
    debtAdjustedAt: (retDetail as { debtAdjustedAt: Date | null }).debtAdjustedAt,
    debtAdjustedAmount: (retDetail as { debtAdjustedAmount: number | null }).debtAdjustedAmount,
    debtAdjustedByName: (retDetail as { debtAdjustedByName: string | null }).debtAdjustedByName,
    khopVoiExpected: (retDetail as { debtAdjustedAmount: number | null }).debtAdjustedAmount === expectedCompanyBorne,
  });

  // 6. Giảm trừ công nợ ĐỘC LẬP — không gắn Return (mục 6, nút mới ở
  // trang chi tiết Receivable). ownerId phải tự lấy từ SalesOrder.ownerId.
  const standaloneAmount = 15000;
  await debtService.manualAdjustment(
    receivable.id,
    { amount: standaloneAmount, reason: 'Test 2707 — giảm giá thiện chí, không liên quan hoàn hàng' },
    ACTOR_USER_ID,
  );
  const standaloneDebtAdjustment = await prisma.debtAdjustment.findFirst({
    where: { receivableId: receivable.id, returnId: null },
  });
  log('6. Giảm trừ công nợ ĐỘC LẬP (mục 6)', {
    amount: standaloneDebtAdjustment ? Number(standaloneDebtAdjustment.amount) : null,
    reason: standaloneDebtAdjustment?.reason,
    ownerId: standaloneDebtAdjustment?.ownerId,
    ownerName: standaloneDebtAdjustment?.ownerName,
    khopVoiOrderOwnerId: standaloneDebtAdjustment?.ownerId === order.ownerId,
  });

  // 7. Tab "Lịch sử giảm trừ/công nợ đầu kỳ" (mục 6)
  const history = await debtService.getDebtAdjustmentHistoryByCustomer(customer.id, {});
  log('7. Lịch sử giảm trừ/công nợ đầu kỳ (mục 6)', history);

  // 8. GET /sales-orders — hasReturn + netAmount (mục 1 badge + mục 7)
  const listResult = await salesOrderService.findAll({ customerId: customer.id } as never);
  const listedOrder = listResult.data.find((o) => o.id === order.id) as unknown as {
    hasReturn: boolean;
    netAmount: number;
    totalAmount: number;
  };
  log('8. Danh sách đơn hàng — hasReturn + netAmount (mục 1, 7)', {
    totalAmount: Number(listedOrder.totalAmount),
    netAmount: listedOrder.netAmount,
    hasReturn: listedOrder.hasReturn,
    expectedNetAmount: Number(order.totalAmount) - expectedCompanyBorne,
    khopVoiExpected: listedOrder.netAmount === Number(order.totalAmount) - expectedCompanyBorne,
  });

  // 9. "Tổng doanh số" khách hàng — endpoint aggregate (mục 8)
  const from = new Date(0);
  const to = new Date(8640000000000000);
  const [rawTotal, companyBorneTotal] = await Promise.all([
    salesOrderService.getTotalAmountForCustomer(customer.id, from, to),
    returnService.getTotalCompanyBorneValueForCustomerOrders(customer.id, from, to),
  ]);
  log('9. Tổng doanh số khách hàng (mục 8)', {
    rawTotal,
    companyBorneTotal,
    totalRevenue: rawTotal - companyBorneTotal,
    expectedTotalRevenue: Number(order.totalAmount) - expectedCompanyBorne,
    khopVoiExpected: rawTotal - companyBorneTotal === Number(order.totalAmount) - expectedCompanyBorne,
  });

  // 10. Dashboard — trừ đúng phần Công ty hỗ trợ + độc lập (mục 5, 6)
  const salesDashboard = await dashboardService.getSalesDashboard();
  const employeeDashboard = await dashboardService.getEmployeeRevenueDashboard(from, to);
  const employeeRow = employeeDashboard.find((e) => e.ownerId === order.ownerId);
  log('10. Dashboard (mục 5, 6) — chạy không lỗi, có dữ liệu nhân viên test', {
    salesDashboardOk: !!salesDashboard.summary,
    totalRevenueDashboard: salesDashboard.summary.totalRevenue,
    employeeRowFound: !!employeeRow,
    employeeRow,
  });

  console.log('\n=== XONG — không rollback, giữ nguyên dữ liệu test để anh xem trực tiếp trên web ===');
  console.log(`Customer: ${customer.code} — ${customer.name} (id=${customer.id})`);
  console.log(`SalesOrder: ${order.code} (id=${order.id})`);
  console.log(`Return: ${ret.code} (id=${ret.id})`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
