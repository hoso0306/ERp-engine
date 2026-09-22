/**
 * Tạo dữ liệu test cho thay đổi "cap giảm trừ công nợ về remainingAmount
 * thay vì chặn cứng" (22/09/2026 — điều tra case RT000041 thật trên VPS:
 * Return có phần Công ty hỗ trợ > remainingAmount vì đơn đã thanh toán đủ).
 *
 * Tạo 1 Khách hàng test + 3 Đơn hàng (dùng lại SP000122 có sẵn), mỗi đơn có
 * 1 Return với phần Công ty hỗ trợ, nhưng KHÔNG tự gọi manualAdjustment —
 * cố tình để trống, để người dùng tự bấm nút "Giảm trừ công nợ" trên UI và
 * xem kết quả thật:
 *   A. Đơn đã thanh toán ĐỦ trước khi hoàn -> remainingAmount = 0 -> bấm sẽ
 *      thấy lỗi mới "Công nợ đơn hàng đã về 0, không còn gì để giảm trừ."
 *   B. Đơn thanh toán MỘT PHẦN, remainingAmount còn lại < phần công ty hỗ
 *      trợ -> bấm sẽ thấy cap một phần + cảnh báo phần dư.
 *   C. Đơn bình thường, công ty hỗ trợ <= remainingAmount -> bấm vẫn thành
 *      công như cũ, không cảnh báo (baseline so sánh).
 *
 * Không qua HTTP/auth — gọi thẳng Service qua NestFactory.createApplicationContext,
 * cùng pattern scripts/seed/2707-test-return-debt-features.ts.
 *
 * Chạy (từ apps/api):
 *   TS_NODE_PROJECT=./tsconfig.json npx ts-node --transpile-only \
 *     -r tsconfig-paths/register \
 *     ../../scripts/seed/2209-test-debt-adjustment-cap.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../apps/api/src/app.module';
import { CustomerService } from '../../apps/api/src/customer/customer.service';
import { QuotationWorkflowService } from '../../apps/api/src/quotation/quotation-workflow.service';
import { ReturnService } from '../../apps/api/src/return/return.service';
import { DebtService } from '../../apps/api/src/debt/debt.service';
import { SalesOrderService } from '../../apps/api/src/sales-order/sales-order.service';
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

  const phone = '09' + Date.now().toString().slice(-8);
  const customer = await customerService.create({
    name: 'TEST 2209 - Cap giảm trừ công nợ',
    phone,
  } as never);
  log('Tạo Khách hàng', { id: customer.id, code: customer.code, phone: customer.phone });

  async function createOrder(label: string) {
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
    console.log(`\n[${label}] SalesOrder ${order.code} — totalAmount=${Number(order.totalAmount)}`);
    return order;
  }

  async function pay(salesOrderId: string, amount: number) {
    if (amount <= 0) return;
    await debtService.createPayment(
      {
        salesOrderId,
        amount,
        paymentMethod: 'CASH',
      },
      ACTOR_USER_ID,
    );
  }

  async function createReturn(order: Awaited<ReturnType<typeof createOrder>>, returnedQuantity: number) {
    const orderItem = order.items[0];
    const ret = await returnService.create({
      salesOrderId: order.id,
      items: [
        {
          salesOrderItemId: orderItem.id,
          returnedQuantity,
          reason: 'PRODUCTION_DEFECT',
        },
      ],
      customerBorneAmount: 0, // 100% công ty chịu — dễ tái hiện tình huống vượt remainingAmount
      companyBorneReason: 'Test 2209 — lỗi sản xuất, công ty hỗ trợ 100%',
      receivedBy: 'Admin (test script)',
    } as never);
    return ret;
  }

  // ── Đơn A: thanh toán ĐỦ trước khi hoàn -> remainingAmount = 0 ──────────
  const orderA = await createOrder('A');
  await pay(orderA.id, Number(orderA.totalAmount));
  const retA = await createReturn(orderA, 1);
  const receivableA = await prisma.receivable.findFirstOrThrow({ where: { salesOrderId: orderA.id } });
  log('Đơn A — đã thanh toán đủ, Return chưa giảm công nợ', {
    salesOrderCode: orderA.code,
    returnCode: retA.code,
    returnCompanyBorne: Number(retA.totalValue) - Number(retA.customerBorneAmount),
    remainingAmountHienTai: Number(receivableA.remainingAmount),
    kyVong: 'Bấm "Giảm trừ công nợ" -> báo lỗi "Công nợ đơn hàng đã về 0..."',
  });

  // ── Đơn B: thanh toán MỘT PHẦN -> remainingAmount còn lại < công ty hỗ trợ ──
  const orderB = await createOrder('B');
  const orderItemB = orderB.items[0];
  const companyBorneB = Math.round(Number(orderItemB.finalPrice) * 2); // hoàn 2/3, 100% công ty chịu
  const remainingTargetB = Math.round(companyBorneB * 0.3); // để lại remainingAmount < companyBorne
  await pay(orderB.id, Number(orderB.totalAmount) - remainingTargetB);
  const retB = await createReturn(orderB, 2);
  const receivableB = await prisma.receivable.findFirstOrThrow({ where: { salesOrderId: orderB.id } });
  log('Đơn B — thanh toán một phần, Return chưa giảm công nợ', {
    salesOrderCode: orderB.code,
    returnCode: retB.code,
    returnCompanyBorne: Number(retB.totalValue) - Number(retB.customerBorneAmount),
    remainingAmountHienTai: Number(receivableB.remainingAmount),
    kyVong: 'Bấm "Giảm trừ công nợ" -> chỉ giảm được đúng remainingAmount + cảnh báo phần dư',
  });

  // ── Đơn C: bình thường, công ty hỗ trợ <= remainingAmount ───────────────
  const orderC = await createOrder('C');
  await pay(orderC.id, Math.round(Number(orderC.totalAmount) * 0.3)); // trả một ít, còn dư nhiều
  const retC = await createReturn(orderC, 1);
  const receivableC = await prisma.receivable.findFirstOrThrow({ where: { salesOrderId: orderC.id } });
  log('Đơn C — baseline, không bị cap', {
    salesOrderCode: orderC.code,
    returnCode: retC.code,
    returnCompanyBorne: Number(retC.totalValue) - Number(retC.customerBorneAmount),
    remainingAmountHienTai: Number(receivableC.remainingAmount),
    kyVong: 'Bấm "Giảm trừ công nợ" -> thành công bình thường, không cảnh báo',
  });

  console.log('\n=== XONG — không rollback, giữ nguyên dữ liệu test để bạn tự bấm nút trên web local ===');
  console.log(`Khách hàng: ${customer.code} (id=${customer.id})`);
  console.log(`A: SalesOrder ${orderA.code} / Return ${retA.code}`);
  console.log(`B: SalesOrder ${orderB.code} / Return ${retB.code}`);
  console.log(`C: SalesOrder ${orderC.code} / Return ${retC.code}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
