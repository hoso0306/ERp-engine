import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  SalesOrderStatus,
  SalesOrderTimelineAction,
  SalesOrderTimelineActorType,
  OpeningBalanceTimelineAction,
  OpeningBalanceTimelineActorType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from '../setting/setting.service';
import { retryOnCodeConflict } from '../shared/retry-on-code-conflict';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import { ReceivableQueryDto } from './dto/receivable-query.dto';
import { ReceivableByCustomerQueryDto } from './dto/receivable-by-customer-query.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { OpeningBalanceService } from './opening-balance.service';
import { resolveActorName } from '../shared/resolve-actor-name';
import { buildSeries, type ReportGroupBy } from '../shared/report-range';
import {
  BeforeVatFirstPolicy,
  type AllocationPolicy,
} from './allocation-policy';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// 023-cong-no-payment-allocation-fifo: 1 dòng cấn trừ đã resolve xong (biết
// đúng receivableId + số tiền), kèm dữ liệu đọc SẴN từ trước khi vào
// transaction (remainingAmountBeforeVat để tính Policy split, currentPaymentStatus
// để ghi Timeline fromStatus) — executeAllocatedPayment() không đọc lại.
//
// Rà soát tab Công nợ (11/08/2026): cấn cho ĐÚNG 1 trong 2 đối tượng — Receivable
// (đơn hàng, có salesOrderId/currentPaymentStatus để ghi SalesOrderTimeline) hoặc
// OpeningBalance (Công nợ đầu kỳ, không có SalesOrder nên không có 2 field đó).
type ResolvedAllocation =
  | {
      target: 'RECEIVABLE';
      receivableId: string;
      salesOrderId: string;
      amount: number;
      remainingAmountBeforeVat: number;
      currentPaymentStatus: PaymentStatus;
    }
  | {
      target: 'OPENING_BALANCE';
      openingBalanceId: string;
      amount: number;
      remainingAmountBeforeVat: number;
    };

const RECEIVABLE_LIST_INCLUDE = {
  salesOrder: {
    select: {
      id: true,
      code: true,
      customerName: true,
      customerPhone: true,
      status: true,
      paymentStatus: true,
    },
  },
} satisfies Prisma.ReceivableInclude;

// Tab "Tiến trình thanh toán" trong trang khách hàng (rà soát tab Công nợ,
// 11/08/2026) — cần thêm cột "Ngày thanh toán"/"Phiếu thu tương ứng" nên phải
// biết các Payment đã cấn cho đúng đơn này. Tách riêng khỏi RECEIVABLE_LIST_INCLUDE
// (dùng chung cho open-by-customer, dashboard, export backup) để KHÔNG kéo
// thêm join này vào những nơi không cần tới.
const RECEIVABLE_LIST_WITH_PAYMENTS_INCLUDE = {
  salesOrder: RECEIVABLE_LIST_INCLUDE.salesOrder,
  allocations: {
    select: {
      payment: { select: { code: true, paymentDate: true, type: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ReceivableInclude;

const RECEIVABLE_DETAIL_INCLUDE = {
  salesOrder: {
    select: {
      id: true,
      code: true,
      customerName: true,
      customerPhone: true,
      status: true,
      paymentStatus: true,
    },
  },
  // 023-cong-no-payment-allocation-fifo: lịch sử thu tiền của 1 đơn giờ đọc
  // qua allocations (1 Payment có thể chỉ cấn 1 phần cho đơn này), không còn
  // quan hệ Payment 1-1 receivableId trực tiếp.
  // payment.reversedBy (chỉ lấy id) — FE dùng để biết Payment này đã bị hoàn
  // tác chưa, quyết định có hiện nút "Hoàn tác" hay không (nút UI, task sau
  // 023-cong-no-payment-allocation-fifo).
  allocations: {
    include: {
      payment: { include: { reversedBy: { select: { id: true } } } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ReceivableInclude;

@Injectable()
export class DebtService {
  // Allocation Policy (023-cong-no-payment-allocation-fifo) — tách rời khỏi
  // Allocation Engine bên dưới. Đổi chính sách sau này chỉ cần đổi giá trị
  // gán ở đây, không sửa Engine. Chưa có nhu cầu chọn runtime qua UI.
  private readonly allocationPolicy: AllocationPolicy =
    new BeforeVatFirstPolicy();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingService: SettingService,
    private readonly openingBalanceService: OpeningBalanceService,
  ) {}

  // ─────────────────────────────────────────────────────
  // Payment (Task 03, mở rộng 023-cong-no-payment-allocation-fifo)
  // ─────────────────────────────────────────────────────

  async createPayment(dto: CreatePaymentDto, userId?: string | null) {
    if (!dto.salesOrderId) {
      throw new BadRequestException('Đơn hàng là bắt buộc.');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0.');
    }

    const paymentMethod = this.validatePaymentMethod(
      dto.paymentMethod,
      dto.referenceNumber,
    );

    const salesOrder = await this.prisma.salesOrder.findUnique({
      where: { id: dto.salesOrderId },
      include: { receivable: true },
    });

    if (!salesOrder) {
      throw new NotFoundException('Đơn hàng không tồn tại.');
    }
    if (salesOrder.status === SalesOrderStatus.CANCELLED) {
      throw new ForbiddenException('Không thể thu tiền cho đơn hàng đã huỷ.');
    }
    if (!salesOrder.receivable) {
      throw new NotFoundException('Công nợ của đơn hàng không tồn tại.');
    }

    const receivable = salesOrder.receivable;
    if (dto.amount > Number(receivable.remainingAmount)) {
      throw new BadRequestException(
        `Số tiền thanh toán không được vượt quá số còn phải thu (${receivable.remainingAmount}).`,
      );
    }

    return this.executeAllocatedPayment(
      {
        paymentDate: dto.paymentDate,
        paymentMethod,
        referenceNumber: dto.referenceNumber,
        note: dto.note,
        allocations: [
          {
            target: 'RECEIVABLE',
            receivableId: receivable.id,
            salesOrderId: salesOrder.id,
            amount: dto.amount,
            remainingAmountBeforeVat: Number(
              receivable.remainingAmountBeforeVat,
            ),
            currentPaymentStatus: salesOrder.paymentStatus,
          },
        ],
      },
      userId,
    );
  }

  // Luồng theo khách hàng — mặc định FIFO (đơn cũ nhất trước), cho phép kế
  // toán truyền `allocations` để cấn tay. Không được thanh toán vượt tổng
  // công nợ (Quyết định kỹ thuật #7, 023-cong-no-payment-allocation-fifo).
  async createAllocatedPayment(
    dto: AllocatePaymentDto,
    userId?: string | null,
  ) {
    if (!dto.customerId) {
      throw new BadRequestException('Khách hàng là bắt buộc.');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0.');
    }

    const paymentMethod = this.validatePaymentMethod(
      dto.paymentMethod,
      dto.referenceNumber,
    );

    const allocations = await this.resolveFifoAllocations(
      this.prisma,
      dto.customerId,
      dto.amount,
      dto.allocations,
    );

    return this.executeAllocatedPayment(
      {
        paymentDate: dto.paymentDate,
        paymentMethod,
        referenceNumber: dto.referenceNumber,
        note: dto.note,
        allocations,
      },
      userId,
    );
  }

  // Reverse Payment (Quyết định #4) — bút toán đảo chiều, KHÔNG sửa/xoá
  // Payment gốc (append-only). Cộng lại đúng những gì Payment gốc đã trừ,
  // dựa theo từng PaymentAllocation của nó.
  async reversePayment(paymentId: string, userId?: string | null) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { allocations: true, reversedBy: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment không tồn tại.');
    }
    if (payment.type === PaymentType.REVERSAL) {
      throw new BadRequestException(
        'Không thể hoàn tác một Payment đảo chiều.',
      );
    }
    if (payment.reversedBy) {
      throw new BadRequestException('Payment này đã được hoàn tác trước đó.');
    }
    if (payment.allocations.length === 0) {
      throw new BadRequestException(
        'Payment không có khoản cấn trừ nào để hoàn tác.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const code = await this.nextPaymentCode(tx);

        const reversal = await tx.payment.create({
          data: {
            code,
            type: PaymentType.REVERSAL,
            reversalOfPaymentId: payment.id,
            paymentDate: new Date(),
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            note: `Hoàn tác ${payment.code}`,
          },
        });

        for (const alloc of payment.allocations) {
          // Công nợ đầu kỳ (rà soát tab Công nợ, 11/08/2026) — không có
          // SalesOrder nên không cập nhật paymentStatus/SalesOrderTimeline,
          // cộng lại qua OpeningBalance + OpeningBalanceTimeline riêng.
          if (alloc.openingBalanceId) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: reversal.id,
                openingBalanceId: alloc.openingBalanceId,
                allocatedSubtotal: alloc.allocatedSubtotal,
                allocatedVat: alloc.allocatedVat,
                allocatedTotal: alloc.allocatedTotal,
              },
            });

            await tx.openingBalance.update({
              where: { id: alloc.openingBalanceId },
              data: {
                remainingAmount: { increment: alloc.allocatedTotal },
                remainingAmountBeforeVat: {
                  increment: alloc.allocatedSubtotal,
                },
              },
            });

            await tx.openingBalanceTimeline.create({
              data: {
                openingBalanceId: alloc.openingBalanceId,
                action: OpeningBalanceTimelineAction.OPENING_BALANCE_PAID,
                actorType: OpeningBalanceTimelineActorType.USER,
                payload: {
                  paymentCode: code,
                  amount: -Number(alloc.allocatedTotal),
                  reversalOf: payment.code,
                },
                createdBy: userId ?? null,
                createdByName,
              },
            });
            continue;
          }

          const receivableBefore = await tx.receivable.findUniqueOrThrow({
            where: { id: alloc.receivableId! },
            include: { salesOrder: { select: { paymentStatus: true } } },
          });

          await tx.paymentAllocation.create({
            data: {
              paymentId: reversal.id,
              receivableId: alloc.receivableId,
              salesOrderId: alloc.salesOrderId,
              allocatedSubtotal: alloc.allocatedSubtotal,
              allocatedVat: alloc.allocatedVat,
              allocatedTotal: alloc.allocatedTotal,
            },
          });

          const updatedReceivable = await tx.receivable.update({
            where: { id: alloc.receivableId! },
            data: {
              paidAmount: { decrement: alloc.allocatedTotal },
              remainingAmount: { increment: alloc.allocatedTotal },
              remainingAmountBeforeVat: { increment: alloc.allocatedSubtotal },
            },
          });

          const newPaymentStatus = this.computePaymentStatus(
            Number(updatedReceivable.paidAmount),
            Number(updatedReceivable.totalAmount),
          );

          await tx.salesOrder.update({
            where: { id: alloc.salesOrderId! },
            data: { paymentStatus: newPaymentStatus },
          });

          await tx.salesOrderTimeline.create({
            data: {
              salesOrderId: alloc.salesOrderId!,
              action: SalesOrderTimelineAction.PAYMENT_STATUS_CHANGED,
              actorType: SalesOrderTimelineActorType.USER,
              payload: {
                paymentCode: code,
                amount: -Number(alloc.allocatedTotal),
                reversalOf: payment.code,
                fromStatus: receivableBefore.salesOrder.paymentStatus,
                toStatus: newPaymentStatus,
              },
              createdBy: userId ?? null,
              createdByName,
            },
          });
        }

        return tx.payment.findUniqueOrThrow({
          where: { id: reversal.id },
          include: { allocations: true },
        });
      }),
    );
  }

  // Action "Đóng công nợ (không xuất hóa đơn)" (024-cong-no-vat-settlement.md,
  // Quyết định #3; đổi tên từ "Thu tiền mặt..." chốt 27/07/2026 — action này
  // không còn thu tiền tại thời điểm bấm nữa, xem validate bên dưới) — khách
  // đã trả xong phần trước-VAT, kế toán chủ động coi
  // nghiệp vụ đã kết thúc, không theo dõi phần VAT còn lại như công nợ bình
  // thường nữa. Set remainingAmount = 0 NGAY LẬP TỨC (dù paidAmount có thể
  // mới bằng totalAmountBeforeVat, chưa bằng totalAmount có VAT) —
  // remainingAmountBeforeVat GIỮ NGUYÊN (không reset, dùng để tính
  // VatSettlementItem.amount sau này nếu khách quay lại xin hóa đơn). Không
  // cần nhập lý do — đây là 1 nhánh workflow hợp lệ đã định nghĩa sẵn, không
  // phải Manual Override.
  async closeReceivableWithoutVat(
    receivableId: string,
    userId?: string | null,
  ) {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id: receivableId },
      include: {
        salesOrder: { select: { id: true, status: true, paymentStatus: true } },
      },
    });
    if (!receivable) {
      throw new NotFoundException('Công nợ không tồn tại.');
    }
    if (receivable.salesOrder.status === SalesOrderStatus.CANCELLED) {
      throw new ForbiddenException('Không thể áp dụng cho đơn hàng đã huỷ.');
    }
    if (receivable.closedWithoutVat) {
      throw new BadRequestException(
        'Công nợ này đã được đóng theo chế độ tiền mặt không xuất hóa đơn.',
      );
    }
    // Rà soát mô hình công nợ (chốt 27/07/2026) — action này chỉ dành cho lúc
    // khách đã trả ĐỦ phần gốc trước-VAT, kế toán chỉ "bỏ qua" phần VAT còn
    // thiếu. Nếu còn nợ gốc dở dang (remainingAmountBeforeVat > 0) mà vẫn cho
    // đóng, remainingAmount (sau VAT) sẽ bị set về 0 dù khách còn nợ tiền
    // thật — biến mất khỏi mọi nơi tính công nợ (Dashboard, danh sách, theo
    // khách hàng). Phải thu hết phần gốc qua Payment bình thường trước.
    if (Number(receivable.remainingAmountBeforeVat) > 0) {
      throw new BadRequestException(
        `Chưa thu đủ phần trước VAT (còn ${receivable.remainingAmountBeforeVat}) — chỉ được đóng khi đã thu đủ phần gốc, dùng Ghi nhận thanh toán trước.`,
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);
    const fromStatus = receivable.salesOrder.paymentStatus;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.receivable.update({
        where: { id: receivableId },
        data: { remainingAmount: 0, closedWithoutVat: true },
      });

      await tx.salesOrder.update({
        where: { id: receivable.salesOrderId },
        data: { paymentStatus: PaymentStatus.PAID },
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: receivable.salesOrderId,
          action: SalesOrderTimelineAction.PAYMENT_STATUS_CHANGED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            event: 'CLOSED_WITHOUT_VAT',
            fromStatus,
            toStatus: PaymentStatus.PAID,
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return this.withDerivedFields(updated);
    });
  }

  // Hoàn tác action "Đóng công nợ (không xuất hóa đơn)" (bổ sung 26/07/2026,
  // theo rà soát mô hình công nợ) — đối xứng với action đóng ở trên, KHÔNG
  // cần lý do (giống Reverse Payment: đây là undo của 1 action bình thường,
  // không phải Manual Override). Action đóng không đụng `paidAmount`, nên chỉ
  // cần tính lại đúng công thức Derived Data gốc để khôi phục — không cần lưu
  // snapshot riêng.
  async reopenReceivableClosedWithoutVat(
    receivableId: string,
    userId?: string | null,
  ) {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id: receivableId },
      include: {
        salesOrder: { select: { id: true, status: true, paymentStatus: true } },
        vatSettlementItems: {
          include: { vatSettlement: { select: { status: true } } },
        },
      },
    });
    if (!receivable) {
      throw new NotFoundException('Công nợ không tồn tại.');
    }
    if (!receivable.closedWithoutVat) {
      throw new BadRequestException(
        'Công nợ này chưa được đóng theo chế độ tiền mặt không xuất hóa đơn.',
      );
    }
    // Chặn nếu đã có VatSettlement nào KHÔNG phải CANCELLED tham chiếu tới —
    // lúc đó đã có chứng từ tài chính khác phụ thuộc vào trạng thái "đã đóng"
    // này (đã gửi khách/đã thu/đã xuất hóa đơn), mở lại sẽ phá Snapshot của
    // VatSettlementItem.amount. Một VatSettlement từng tạo rồi CANCELLED (chưa
    // gửi khách, chưa đụng gì) thì không chặn.
    const hasLiveVatSettlement = receivable.vatSettlementItems.some(
      (item) => item.vatSettlement.status !== 'CANCELLED',
    );
    if (hasLiveVatSettlement) {
      throw new BadRequestException(
        'Công nợ này đã thuộc một VAT Settlement (chưa huỷ) — không thể hoàn tác.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);
    const fromStatus = receivable.salesOrder.paymentStatus;
    const restoredRemainingAmount =
      Number(receivable.totalAmount) - Number(receivable.paidAmount);
    const restoredPaymentStatus = this.computePaymentStatus(
      Number(receivable.paidAmount),
      Number(receivable.totalAmount),
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.receivable.update({
        where: { id: receivableId },
        data: {
          remainingAmount: restoredRemainingAmount,
          closedWithoutVat: false,
        },
      });

      await tx.salesOrder.update({
        where: { id: receivable.salesOrderId },
        data: { paymentStatus: restoredPaymentStatus },
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: receivable.salesOrderId,
          action: SalesOrderTimelineAction.PAYMENT_STATUS_CHANGED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            event: 'REOPENED_AFTER_CLOSE_WITHOUT_VAT',
            fromStatus,
            toStatus: restoredPaymentStatus,
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return this.withDerivedFields(updated);
    });
  }

  // Danh sách Receivable còn nợ của 1 khách hàng, sort FIFO (createdAt asc) —
  // phục vụ preview trước khi xác nhận `createAllocatedPayment()`.
  async getOpenReceivablesForCustomer(customerId: string) {
    return this.prisma.receivable.findMany({
      where: {
        customerId,
        remainingAmount: { gt: 0 },
        salesOrder: { status: { not: SalesOrderStatus.CANCELLED } },
      },
      orderBy: { createdAt: 'asc' },
      include: RECEIVABLE_LIST_INCLUDE,
    });
  }

  // Preview trước khi xác nhận POST /payments/allocate (rà soát tab Công nợ,
  // 11/08/2026) — khác getOpenReceivablesForCustomer() ở trên (chỉ Receivable,
  // dùng cho phần "xổ ra" ở bảng /debts/by-customer): đây gộp CẢ Công nợ đầu
  // kỳ, đúng thứ tự Allocation Engine sẽ cấn (Công nợ đầu kỳ trước, rồi
  // Receivable theo createdAt asc — xem resolveFifoAllocations()).
  async getFifoPreviewForCustomer(customerId: string) {
    const [openingBalances, receivables] = await Promise.all([
      this.prisma.openingBalance.findMany({
        where: { customerId, remainingAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.receivable.findMany({
        where: {
          customerId,
          remainingAmount: { gt: 0 },
          salesOrder: { status: { not: SalesOrderStatus.CANCELLED } },
        },
        orderBy: { createdAt: 'asc' },
        include: { salesOrder: { select: { code: true } } },
      }),
    ]);

    return [
      ...openingBalances.map((b) => ({
        target: 'OPENING_BALANCE' as const,
        id: b.id,
        code: b.code,
        remainingAmount: Number(b.remainingAmount),
        remainingAmountBeforeVat: Number(b.remainingAmountBeforeVat),
      })),
      ...receivables.map((r) => ({
        target: 'RECEIVABLE' as const,
        id: r.id,
        code: r.salesOrder.code,
        remainingAmount: Number(r.remainingAmount),
        remainingAmountBeforeVat: Number(r.remainingAmountBeforeVat),
      })),
    ];
  }

  // ─────────────────────────────────────────────────────
  // Allocation Engine (023-cong-no-payment-allocation-fifo) — logic dùng
  // chung cho cả 2 luồng thanh toán (theo 1 đơn / theo khách hàng FIFO) và
  // Reverse Payment ở trên. Không đổi theo Allocation Policy — Policy chỉ
  // quyết định cách chia subtotal/VAT của TỪNG dòng cấn trừ.
  // ─────────────────────────────────────────────────────

  private validatePaymentMethod(
    paymentMethod: string | undefined,
    referenceNumber: string | undefined,
  ): PaymentMethod {
    const validMethods = Object.values(PaymentMethod) as string[];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      throw new BadRequestException(
        `Phương thức thanh toán "${paymentMethod}" không hợp lệ.`,
      );
    }
    if (
      paymentMethod === PaymentMethod.BANK_TRANSFER &&
      !referenceNumber?.trim()
    ) {
      throw new BadRequestException(
        'Số tham chiếu là bắt buộc khi thanh toán bằng chuyển khoản.',
      );
    }
    return paymentMethod as PaymentMethod;
  }

  private async nextPaymentCode(tx: Prisma.TransactionClient): Promise<string> {
    const running = await tx.runningNumber.update({
      where: { type: 'PAYMENT' },
      data: { lastNumber: { increment: 1 } },
    });
    return `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;
  }

  // Không cho thanh toán vượt tổng công nợ (Quyết định #7). Nếu `overrides`
  // được truyền (kế toán tự sửa tay), validate tổng phải khớp `amount` và
  // từng dòng không vượt remainingAmount của đúng đơn/khoản đó, thuộc đúng
  // khách hàng. Nếu không, tự tính FIFO. Trả kèm `remainingAmountBeforeVat`/
  // `currentPaymentStatus` đã đọc sẵn ở đây — executeAllocatedPayment() dùng
  // thẳng, không đọc lại trong transaction.
  //
  // Rà soát tab Công nợ (11/08/2026): Công nợ đầu kỳ tham gia CHUNG Allocation
  // Engine này, LUÔN đứng đầu thứ tự cấn trừ (trước mọi Receivable, bất kể
  // ngày kế toán nhập vào hệ thống) — đúng bản chất "nợ cũ nhất" (phát sinh
  // trước khi dùng phần mềm).
  private async resolveFifoAllocations(
    tx: Prisma.TransactionClient | PrismaService,
    customerId: string,
    amount: number,
    overrides?: {
      receivableId?: string;
      openingBalanceId?: string;
      amount: number;
    }[],
  ): Promise<ResolvedAllocation[]> {
    if (overrides && overrides.length > 0) {
      const sum = overrides.reduce((s, o) => s + o.amount, 0);
      if (sum !== amount) {
        throw new BadRequestException(
          'Tổng số tiền cấn từng đơn phải bằng đúng số tiền thanh toán.',
        );
      }

      const receivableIds = overrides
        .filter((o) => o.receivableId)
        .map((o) => o.receivableId!);
      const openingBalanceIds = overrides
        .filter((o) => o.openingBalanceId)
        .map((o) => o.openingBalanceId!);

      const [receivables, openingBalances] = await Promise.all([
        tx.receivable.findMany({
          where: { id: { in: receivableIds } },
          include: {
            salesOrder: { select: { status: true, paymentStatus: true } },
          },
        }),
        tx.openingBalance.findMany({
          where: { id: { in: openingBalanceIds } },
        }),
      ]);
      const receivableMap = new Map(receivables.map((r) => [r.id, r]));
      const openingBalanceMap = new Map(openingBalances.map((b) => [b.id, b]));

      const resolved: ResolvedAllocation[] = [];
      for (const o of overrides) {
        if (o.amount <= 0) {
          throw new BadRequestException(
            'Số tiền cấn cho mỗi đơn phải lớn hơn 0.',
          );
        }
        if (!o.receivableId === !o.openingBalanceId) {
          throw new BadRequestException(
            'Mỗi dòng cấn trừ phải chọn đúng 1 trong 2: đơn hàng hoặc công nợ đầu kỳ.',
          );
        }

        if (o.receivableId) {
          const r = receivableMap.get(o.receivableId);
          if (!r) {
            throw new NotFoundException(
              `Công nợ ${o.receivableId} không tồn tại.`,
            );
          }
          if (r.customerId !== customerId) {
            throw new BadRequestException(
              `Công nợ ${o.receivableId} không thuộc khách hàng đang chọn.`,
            );
          }
          if (r.salesOrder.status === SalesOrderStatus.CANCELLED) {
            throw new BadRequestException(
              `Đơn hàng của công nợ ${o.receivableId} đã huỷ, không thể cấn trừ.`,
            );
          }
          if (o.amount > Number(r.remainingAmount)) {
            throw new BadRequestException(
              `Số tiền cấn cho công nợ ${o.receivableId} vượt quá số còn phải thu (${r.remainingAmount}).`,
            );
          }
          resolved.push({
            target: 'RECEIVABLE',
            receivableId: r.id,
            salesOrderId: r.salesOrderId,
            amount: o.amount,
            remainingAmountBeforeVat: Number(r.remainingAmountBeforeVat),
            currentPaymentStatus: r.salesOrder.paymentStatus,
          });
        } else {
          const b = openingBalanceMap.get(o.openingBalanceId!);
          if (!b) {
            throw new NotFoundException(
              `Công nợ đầu kỳ ${o.openingBalanceId} không tồn tại.`,
            );
          }
          if (b.customerId !== customerId) {
            throw new BadRequestException(
              `Công nợ đầu kỳ ${o.openingBalanceId} không thuộc khách hàng đang chọn.`,
            );
          }
          if (o.amount > Number(b.remainingAmount)) {
            throw new BadRequestException(
              `Số tiền cấn cho công nợ đầu kỳ ${o.openingBalanceId} vượt quá số còn lại (${b.remainingAmount}).`,
            );
          }
          resolved.push({
            target: 'OPENING_BALANCE',
            openingBalanceId: b.id,
            amount: o.amount,
            remainingAmountBeforeVat: Number(b.remainingAmountBeforeVat),
          });
        }
      }

      return resolved;
    }

    const [openingBalances, receivables] = await Promise.all([
      tx.openingBalance.findMany({
        where: { customerId, remainingAmount: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      }),
      tx.receivable.findMany({
        where: {
          customerId,
          remainingAmount: { gt: 0 },
          salesOrder: { status: { not: SalesOrderStatus.CANCELLED } },
        },
        orderBy: { createdAt: 'asc' },
        include: { salesOrder: { select: { paymentStatus: true } } },
      }),
    ]);

    const totalOpen =
      openingBalances.reduce((s, b) => s + Number(b.remainingAmount), 0) +
      receivables.reduce((s, r) => s + Number(r.remainingAmount), 0);
    if (amount > totalOpen) {
      throw new BadRequestException(
        `Số tiền thanh toán (${amount}) vượt quá tổng công nợ hiện tại của khách hàng (${totalOpen}).`,
      );
    }

    const allocations: ResolvedAllocation[] = [];
    let remaining = amount;
    // Công nợ đầu kỳ luôn cấn trước (nợ cũ nhất), rồi mới tới Receivable theo
    // FIFO createdAt asc.
    for (const b of openingBalances) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(b.remainingAmount));
      allocations.push({
        target: 'OPENING_BALANCE',
        openingBalanceId: b.id,
        amount: take,
        remainingAmountBeforeVat: Number(b.remainingAmountBeforeVat),
      });
      remaining -= take;
    }
    for (const r of receivables) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(r.remainingAmount));
      allocations.push({
        target: 'RECEIVABLE',
        receivableId: r.id,
        salesOrderId: r.salesOrderId,
        amount: take,
        remainingAmountBeforeVat: Number(r.remainingAmountBeforeVat),
        currentPaymentStatus: r.salesOrder.paymentStatus,
      });
      remaining -= take;
    }
    return allocations;
  }

  // Nhận danh sách allocation ĐÃ resolve (biết đúng receivableId + amount +
  // remainingAmountBeforeVat + currentPaymentStatus từng dòng, đọc từ trước
  // khi vào transaction) — tạo 1 Payment, N PaymentAllocation, update atomic
  // từng Receivable + SalesOrder.paymentStatus + SalesOrderTimeline, trong 1
  // transaction. Concurrency Rule (debt.md) không đổi: CHECK
  // (remaining_amount >= 0) + atomic increment/decrement — nếu 2 giao dịch
  // đồng thời tính allocation từ dữ liệu cũ (hiếm), decrement sẽ vi phạm
  // CHECK ở đúng dòng lệch, cả transaction rollback, không cần khoá tường
  // minh (Quyết định #10).
  private async executeAllocatedPayment(
    input: {
      paymentDate?: string;
      paymentMethod: PaymentMethod;
      referenceNumber?: string;
      note?: string;
      allocations: ResolvedAllocation[];
    },
    userId?: string | null,
  ) {
    const createdByName = await resolveActorName(this.prisma, userId);
    const totalAmount = input.allocations.reduce((s, a) => s + a.amount, 0);

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const code = await this.nextPaymentCode(tx);

        // "Người thu" = tài khoản đang đăng nhập thao tác — trước đây đọc
        // input.createdBy (free-text FE không hề gửi lên nên luôn null), nay
        // lấy từ JWT userId, cùng nguồn với createdByName ghi vào Timeline.
        const payment = await tx.payment.create({
          data: {
            code,
            paymentDate: input.paymentDate
              ? new Date(input.paymentDate)
              : new Date(),
            amount: totalAmount,
            paymentMethod: input.paymentMethod,
            referenceNumber: input.referenceNumber?.trim() || null,
            note: input.note?.trim() || null,
            createdBy: createdByName,
          },
        });

        for (const alloc of input.allocations) {
          // BeforeVatFirstPolicy: trừ hết phần trước-VAT trước, dư mới trừ VAT
          // — floor tại 0, không cho remainingAmountBeforeVat âm qua đường này
          // (khác hành vi cũ trừ đều cả 2 field, xem allocation-policy.ts).
          const { allocatedSubtotal, allocatedVat } =
            this.allocationPolicy.split(
              { remainingAmountBeforeVat: alloc.remainingAmountBeforeVat },
              alloc.amount,
            );

          // Công nợ đầu kỳ (rà soát tab Công nợ, 11/08/2026) — không có
          // SalesOrder nên không cập nhật paymentStatus/SalesOrderTimeline,
          // ghi OpeningBalanceTimeline riêng thay thế.
          if (alloc.target === 'OPENING_BALANCE') {
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                openingBalanceId: alloc.openingBalanceId,
                allocatedSubtotal,
                allocatedVat,
                allocatedTotal: alloc.amount,
              },
            });

            // Concurrency Rule (debt.md): atomic increment/decrement, cùng
            // pattern Receivable bên dưới — CHECK (remaining_amount >= 0) ở
            // DB chặn thu vượt công nợ, kể cả concurrent request.
            await tx.openingBalance.update({
              where: { id: alloc.openingBalanceId },
              data: {
                remainingAmount: { decrement: alloc.amount },
                remainingAmountBeforeVat: { decrement: allocatedSubtotal },
              },
            });

            await tx.openingBalanceTimeline.create({
              data: {
                openingBalanceId: alloc.openingBalanceId,
                action: OpeningBalanceTimelineAction.OPENING_BALANCE_PAID,
                actorType: OpeningBalanceTimelineActorType.USER,
                payload: { paymentCode: code, amount: alloc.amount },
                createdBy: userId ?? null,
                createdByName,
              },
            });
            continue;
          }

          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              receivableId: alloc.receivableId,
              salesOrderId: alloc.salesOrderId,
              allocatedSubtotal,
              allocatedVat,
              allocatedTotal: alloc.amount,
            },
          });

          // Concurrency Rule (debt.md): atomic increment/decrement — không đọc
          // remainingAmount ra tính rồi ghi đè. CHECK (remaining_amount >= 0) ở
          // DB chặn mọi trường hợp thu vượt công nợ, kể cả concurrent request.
          const updatedReceivable = await tx.receivable.update({
            where: { id: alloc.receivableId },
            data: {
              paidAmount: { increment: alloc.amount },
              remainingAmount: { decrement: alloc.amount },
              remainingAmountBeforeVat: { decrement: allocatedSubtotal },
            },
          });

          const newPaymentStatus = this.computePaymentStatus(
            Number(updatedReceivable.paidAmount),
            Number(updatedReceivable.totalAmount),
          );

          await tx.salesOrder.update({
            where: { id: alloc.salesOrderId },
            data: { paymentStatus: newPaymentStatus },
          });

          // Timeline — ghi mỗi lần tạo Payment cho từng đơn bị ảnh hưởng, không
          // phụ thuộc paymentStatus có đổi hay không. amount = allocatedTotal
          // của đúng đơn này, không phải tổng Payment (Quyết định #11).
          await tx.salesOrderTimeline.create({
            data: {
              salesOrderId: alloc.salesOrderId,
              action: SalesOrderTimelineAction.PAYMENT_STATUS_CHANGED,
              actorType: SalesOrderTimelineActorType.USER,
              payload: {
                paymentCode: code,
                amount: alloc.amount,
                fromStatus: alloc.currentPaymentStatus,
                toStatus: newPaymentStatus,
              },
              createdBy: userId ?? null,
              createdByName,
            },
          });
        }

        return tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
          include: { allocations: true },
        });
      }),
    );
  }

  // ─────────────────────────────────────────────────────
  // Read API (Task 07)
  // ─────────────────────────────────────────────────────

  async findAllReceivables(query: ReceivableQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ReceivableWhereInput = {};
    // Danh sách Công nợ chỉ hiển thị công nợ "đang mở" — cùng rule đã áp dụng
    // ở mọi method đọc khác (notCancelledFilter()). Trước đây thiếu điều kiện
    // này khiến Receivable của đơn đã CANCELLED vẫn lọt vào danh sách/đếm số,
    // lệch với tổng trên Dashboard (đã lọc đúng).
    const salesOrderWhere: Prisma.SalesOrderWhereInput = {
      status: { not: SalesOrderStatus.CANCELLED },
    };

    if (query.search) {
      salesOrderWhere.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerPhone: { contains: query.search } },
      ];
    }

    const validPaymentStatuses = Object.values(PaymentStatus) as string[];
    if (
      query.paymentStatus &&
      validPaymentStatuses.includes(query.paymentStatus)
    ) {
      salesOrderWhere.paymentStatus = query.paymentStatus as PaymentStatus;
    }

    where.salesOrder = salesOrderWhere;

    const now = new Date();
    const validRisks: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
    if (query.risk && validRisks.includes(query.risk as RiskLevel)) {
      const risk = query.risk as RiskLevel;
      if (risk === 'LOW') {
        where.dueDate = {
          not: null,
          lt: now,
          gte: new Date(now.getTime() - 7 * MS_PER_DAY),
        };
      } else if (risk === 'MEDIUM') {
        where.dueDate = {
          not: null,
          lt: new Date(now.getTime() - 7 * MS_PER_DAY),
          gte: new Date(now.getTime() - 30 * MS_PER_DAY),
        };
      } else {
        where.dueDate = {
          not: null,
          lt: new Date(now.getTime() - 30 * MS_PER_DAY),
        };
      }
    } else if (query.overdue === 'true') {
      where.dueDate = this.overdueWhere(now);
    }

    if (query.creditExceeded === 'true') {
      const exceededMap = await this.getCreditExceededByCustomer();
      where.customerId = { in: Array.from(exceededMap.keys()) };
    }

    // Tab "Công nợ" trong trang chi tiết khách hàng — lọc đúng 1 khách hàng
    // + khoảng ngày theo mốc do FE chọn (ngày tạo hoặc ngày đến hạn).
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.from || query.to) {
      const range: Prisma.DateTimeFilter = {};
      if (query.from) range.gte = new Date(`${query.from}T00:00:00.000`);
      if (query.to) range.lte = new Date(`${query.to}T23:59:59.999`);
      if (query.dateField === 'dueDate') {
        where.dueDate = { ...(where.dueDate as object), ...range };
      } else {
        where.createdAt = range;
      }
    }

    // Sắp xếp (rà soát bộ lọc Công nợ, chốt 18/07/2026): mặc định createdAt
    // desc — 'remaining_desc' (số nợ giảm dần) và 'due_asc' (sắp đến hạn
    // trước; Postgres tự đưa dueDate NULL — đơn chưa giao — xuống cuối).
    const orderBy: Prisma.ReceivableOrderByWithRelationInput =
      query.sortBy === 'remaining_desc'
        ? { remainingAmount: 'desc' }
        : query.sortBy === 'due_asc'
          ? { dueDate: 'asc' }
          : { createdAt: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.receivable.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: RECEIVABLE_LIST_WITH_PAYMENTS_INCLUDE,
      }),
      this.prisma.receivable.count({ where }),
    ]);

    return {
      data: data.map(({ allocations, ...r }) => ({
        ...this.withDerivedFields(r),
        // "Ngày thanh toán"/"Phiếu thu tương ứng" (rà soát tab Công nợ,
        // 11/08/2026) — 1 đơn có thể được thu nhiều lần (thanh toán một
        // phần), nên trả về danh sách, không phải 1 giá trị.
        payments: allocations.map((a) => a.payment),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Trang "Theo khách hàng" (rà soát tab Công nợ, chốt 26/07/2026) — gộp
  // Receivable theo customerId, cùng công thức SUM(remainingAmount) GROUP BY
  // customerId đã dùng cho getCreditExceededByCustomer()/getTopDebtors(),
  // không phát minh cách tính mới. Chỉ tính đơn còn nợ (remainingAmount > 0)
  // — khớp định nghĩa "Đơn còn nợ" hiển thị trên UI, khác findAllReceivables()
  // (liệt kê cả đơn đã PAID).
  async findReceivablesByCustomer(query: ReceivableByCustomerQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));

    let customerIdFilter: string[] | undefined;
    if (query.search) {
      const matched = await this.prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
          ],
        },
        select: { id: true },
      });
      customerIdFilter = matched.map((c) => c.id);
      if (customerIdFilter.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
    }

    // _min(dueDate) = hạn thanh toán sớm nhất còn mở của khách này → dùng để
    // tính daysOverdue/riskLevel "tệ nhất" mà không cần query riêng thứ 2.
    const [grouped, openingBalanceMap] = await Promise.all([
      this.prisma.receivable.groupBy({
        by: ['customerId'],
        where: {
          ...this.notCancelledFilter(),
          remainingAmount: { gt: 0 },
          ...(customerIdFilter ? { customerId: { in: customerIdFilter } } : {}),
        },
        _sum: { remainingAmount: true, remainingAmountBeforeVat: true },
        _count: { _all: true },
        _min: { dueDate: true },
      }),
      // opening-balance.md — union thêm khách chỉ có Công nợ đầu kỳ, chưa
      // từng có Receivable nào (không thể merge vào tập customerId từ groupBy
      // Receivable vì tập đó không chứa các khách này).
      this.openingBalanceService.sumOpenByCustomerIds(customerIdFilter),
    ]);

    const groupedMap = new Map(grouped.map((g) => [g.customerId, g]));
    const allCustomerIds = new Set([
      ...grouped.map((g) => g.customerId),
      ...openingBalanceMap.keys(),
    ]);

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: Array.from(allCustomerIds) } },
      select: { id: true, name: true, phone: true, debtLimit: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    let rows = Array.from(allCustomerIds).map((customerId) => {
      const g = groupedMap.get(customerId);
      const openingBalance = openingBalanceMap.get(customerId);
      const customer = customerMap.get(customerId);
      const debtLimit = Number(customer?.debtLimit ?? 0);
      const totalRemaining =
        Number(g?._sum.remainingAmount ?? 0) + (openingBalance?.remaining ?? 0);
      const daysOverdue = this.computeDaysOverdue(g?._min.dueDate ?? null);
      return {
        customerId,
        customerName: customer?.name ?? '',
        customerPhone: customer?.phone ?? '',
        receivableCount: g?._count._all ?? 0,
        totalRemaining,
        totalRemainingBeforeVat:
          Number(g?._sum.remainingAmountBeforeVat ?? 0) +
          (openingBalance?.remainingBeforeVat ?? 0),
        daysOverdue,
        riskLevel: this.computeRiskLevel(daysOverdue),
        debtLimit,
        creditExceeded: totalRemaining > debtLimit,
      };
    });

    if (query.overdue === 'true') {
      rows = rows.filter((r) => r.riskLevel !== null);
    }

    if (query.creditExceeded === 'true') {
      rows = rows.filter((r) => r.creditExceeded);
    }

    rows.sort((a, b) =>
      query.sortBy === 'name_asc'
        ? a.customerName.localeCompare(b.customerName, 'vi')
        : b.totalRemaining - a.totalRemaining,
    );

    const total = rows.length;
    const start = (page - 1) * limit;

    return {
      data: rows.slice(start, start + limit),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneReceivable(id: string) {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id },
      include: RECEIVABLE_DETAIL_INCLUDE,
    });

    if (!receivable) {
      throw new NotFoundException('Công nợ không tồn tại.');
    }

    return this.withDerivedFields(receivable);
  }

  // ─────────────────────────────────────────────────────
  // Debt Monitoring (Task 08) — Derived, không lưu DB
  // ─────────────────────────────────────────────────────

  private computePaymentStatus(
    paidAmount: number,
    totalAmount: number,
  ): PaymentStatus {
    if (paidAmount <= 0) return PaymentStatus.UNPAID;
    if (paidAmount >= totalAmount) return PaymentStatus.PAID;
    return PaymentStatus.PARTIALLY_PAID;
  }

  private computeDaysOverdue(dueDate: Date | null): number | null {
    if (!dueDate) return null;
    return Math.floor((Date.now() - dueDate.getTime()) / MS_PER_DAY);
  }

  private computeRiskLevel(daysOverdue: number | null): RiskLevel | null {
    if (daysOverdue === null || daysOverdue <= 0) return null;
    if (daysOverdue <= 7) return 'LOW';
    if (daysOverdue <= 30) return 'MEDIUM';
    return 'HIGH';
  }

  private withDerivedFields<T extends { dueDate: Date | null }>(receivable: T) {
    const daysOverdue = this.computeDaysOverdue(receivable.dueDate);
    return {
      ...receivable,
      daysOverdue,
      riskLevel: this.computeRiskLevel(daysOverdue),
    };
  }

  // Định nghĩa DUY NHẤT cho "chưa huỷ" và "quá hạn" — dùng chung ở findAllReceivables(),
  // Dashboard methods bên dưới, tránh hai nơi định nghĩa lệch nhau (009-dashboard.md Task 00).
  private notCancelledFilter(): Prisma.ReceivableWhereInput {
    return { salesOrder: { status: { not: SalesOrderStatus.CANCELLED } } };
  }

  private overdueWhere(
    now: Date = new Date(),
  ): Prisma.ReceivableWhereInput['dueDate'] {
    return { not: null, lt: now };
  }

  private async attachCustomerInfo(
    grouped: {
      customerId: string;
      _sum: { remainingAmount: Prisma.Decimal | null };
      _count?: { _all: number };
    }[],
  ) {
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
      select: { id: true, name: true, phone: true, debtLimit: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    return grouped.map((g) => ({
      customerId: g.customerId,
      customerName: customerMap.get(g.customerId)?.name ?? '',
      customerPhone: customerMap.get(g.customerId)?.phone ?? '',
      totalRemaining: Number(g._sum.remainingAmount ?? 0),
      ...(g._count ? { receivableCount: g._count._all } : {}),
    }));
  }

  // Credit Limit Monitoring: SUM(remainingAmount) GROUP BY customerId — chỉ
  // Receivable thuộc SalesOrder chưa CANCELLED — so với Customer.debtLimit
  // hiện tại (không phải snapshot).
  private async getCreditExceededByCustomer() {
    const [grouped, openingBalanceMap] = await Promise.all([
      this.prisma.receivable.groupBy({
        by: ['customerId'],
        where: this.notCancelledFilter(),
        _sum: { remainingAmount: true },
      }),
      // opening-balance.md — union thêm khách chỉ có Công nợ đầu kỳ.
      this.openingBalanceService.sumOpenByCustomerIds(),
    ]);

    const groupedMap = new Map(grouped.map((g) => [g.customerId, g]));
    const allCustomerIds = new Set([
      ...grouped.map((g) => g.customerId),
      ...openingBalanceMap.keys(),
    ]);

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: Array.from(allCustomerIds) } },
      select: { id: true, name: true, debtLimit: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const exceeded = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        totalRemaining: number;
        debtLimit: number;
      }
    >();

    for (const customerId of allCustomerIds) {
      const totalRemaining =
        Number(groupedMap.get(customerId)?._sum.remainingAmount ?? 0) +
        (openingBalanceMap.get(customerId)?.remaining ?? 0);
      const customer = customerMap.get(customerId);
      const debtLimit = Number(customer?.debtLimit ?? 0);
      if (totalRemaining > debtLimit) {
        exceeded.set(customerId, {
          customerId,
          customerName: customer?.name ?? '',
          totalRemaining,
          debtLimit,
        });
      }
    }

    return exceeded;
  }

  // ─────────────────────────────────────────────────────
  // Dashboard (Module Dashboard, Task 00) — chỉ đọc, không Business Logic mới.
  // ─────────────────────────────────────────────────────

  async getDashboardSummary() {
    const notCancelled = this.notCancelledFilter();

    const [totals, overdueAgg, openingBalance] = await Promise.all([
      this.prisma.receivable.aggregate({
        where: notCancelled,
        _sum: {
          totalAmount: true,
          paidAmount: true,
          remainingAmount: true,
          // Track song song trước-VAT (023-cong-no-truoc-sau-vat) — kế toán
          // cần theo dõi công nợ ở cả 2 mức, không chỉ dùng cho bản in.
          totalAmountBeforeVat: true,
          remainingAmountBeforeVat: true,
        },
      }),
      this.prisma.receivable.aggregate({
        where: { ...notCancelled, dueDate: this.overdueWhere() },
        _sum: { remainingAmount: true },
        _count: { _all: true },
      }),
      // opening-balance.md — cộng vào "còn nợ" (không phải totalReceivable/
      // totalPaid, vì Công nợ đầu kỳ không phát sinh từ Receivable/Sales
      // Order nên không tính vào tổng đã lập hoá đơn qua hệ thống). Không có
      // dueDate nên không tính vào overdueAmount/overdueCount.
      this.openingBalanceService.sumAllOpen(),
    ]);

    return {
      totalReceivable: Number(totals._sum.totalAmount ?? 0),
      totalPaid: Number(totals._sum.paidAmount ?? 0),
      totalRemaining:
        Number(totals._sum.remainingAmount ?? 0) + openingBalance.remaining,
      totalReceivableBeforeVat: Number(totals._sum.totalAmountBeforeVat ?? 0),
      totalRemainingBeforeVat:
        Number(totals._sum.remainingAmountBeforeVat ?? 0) +
        openingBalance.remainingBeforeVat,
      overdueAmount: Number(overdueAgg._sum.remainingAmount ?? 0),
      overdueCount: overdueAgg._count._all,
    };
  }

  // limit mặc định đọc Settings.Dashboard.topCustomers (Task 04, 010-cai-dat.md)
  // nếu caller không truyền — không hard-code.
  async getOverdueCustomers(limit?: number) {
    const take =
      limit ??
      (await this.settingService.getNumberValue('Dashboard', 'topCustomers'));
    const grouped = await this.prisma.receivable.groupBy({
      by: ['customerId'],
      where: { ...this.notCancelledFilter(), dueDate: this.overdueWhere() },
      _sum: { remainingAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { remainingAmount: 'desc' } },
      take,
    });

    return this.attachCustomerInfo(grouped);
  }

  // Task 04 (Settings module) — không dùng tham số mặc định cứng nữa; nếu
  // caller không truyền `days`, đọc Settings.Dashboard.upcomingDueDays qua
  // SettingService (dùng chung một nơi khai báo duy nhất — xem setting.md).
  async getUpcomingDueReceivables(days?: number) {
    const windowDays =
      days ??
      (await this.settingService.getNumberValue(
        'Dashboard',
        'upcomingDueDays',
      ));
    const now = new Date();
    const until = new Date(now.getTime() + windowDays * MS_PER_DAY);

    return this.prisma.receivable.findMany({
      where: {
        ...this.notCancelledFilter(),
        dueDate: { not: null, gte: now, lte: until },
      },
      include: RECEIVABLE_LIST_INCLUDE,
      orderBy: { dueDate: 'asc' },
    });
  }

  async getCreditLimitExceededCustomers() {
    const exceededMap = await this.getCreditExceededByCustomer();
    return Array.from(exceededMap.values());
  }

  // limit mặc định đọc Settings.Dashboard.topCustomers nếu không truyền.
  // Không thể groupBy + take trực tiếp trên Receivable như trước — phải lấy
  // toàn bộ, union với Công nợ đầu kỳ rồi mới sort + cắt top N, nếu không sẽ
  // bỏ sót khách đứng đầu chỉ nhờ cộng thêm Công nợ đầu kỳ.
  async getTopDebtors(limit?: number) {
    const take =
      limit ??
      (await this.settingService.getNumberValue('Dashboard', 'topCustomers'));

    const [grouped, openingBalanceMap] = await Promise.all([
      this.prisma.receivable.groupBy({
        by: ['customerId'],
        where: this.notCancelledFilter(),
        _sum: { remainingAmount: true },
      }),
      this.openingBalanceService.sumOpenByCustomerIds(),
    ]);

    const groupedMap = new Map(
      grouped.map((g) => [g.customerId, Number(g._sum.remainingAmount ?? 0)]),
    );
    const allCustomerIds = new Set([
      ...groupedMap.keys(),
      ...openingBalanceMap.keys(),
    ]);

    const combined = Array.from(allCustomerIds)
      .map((customerId) => ({
        customerId,
        totalRemaining:
          (groupedMap.get(customerId) ?? 0) +
          (openingBalanceMap.get(customerId)?.remaining ?? 0),
      }))
      .sort((a, b) => b.totalRemaining - a.totalRemaining)
      .slice(0, take);

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: combined.map((c) => c.customerId) } },
      select: { id: true, name: true, phone: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    return combined.map((c) => ({
      customerId: c.customerId,
      customerName: customerMap.get(c.customerId)?.name ?? '',
      customerPhone: customerMap.get(c.customerId)?.phone ?? '',
      totalRemaining: c.totalRemaining,
    }));
  }

  // ─────────────────────────────────────────────────────
  // GET /receivables/dashboard (Task 09 — module Công nợ) — tổng hợp từ
  // chính các method ở trên, không định nghĩa lại logic.
  // ─────────────────────────────────────────────────────

  async getOwnerDashboard() {
    const overdue30Cutoff = new Date(Date.now() - 30 * MS_PER_DAY);

    const [summary, overdueGrouped, overdue30Grouped, exceeded, topDebtors] =
      await Promise.all([
        this.getDashboardSummary(),
        this.prisma.receivable.groupBy({
          by: ['customerId'],
          where: { ...this.notCancelledFilter(), dueDate: this.overdueWhere() },
        }),
        this.prisma.receivable.groupBy({
          by: ['customerId'],
          where: {
            ...this.notCancelledFilter(),
            dueDate: this.overdueWhere(overdue30Cutoff),
          },
          _sum: { remainingAmount: true },
        }),
        this.getCreditLimitExceededCustomers(),
        this.getTopDebtors(),
      ]);

    return {
      totalReceivable: summary.totalRemaining,
      totalReceivableBeforeVat: summary.totalRemainingBeforeVat,
      overdue: {
        customerCount: overdueGrouped.length,
        totalAmount: summary.overdueAmount,
      },
      overdue30: {
        customerCount: overdue30Grouped.length,
        totalAmount: overdue30Grouped.reduce(
          (s, r) => s + Number(r._sum.remainingAmount ?? 0),
          0,
        ),
      },
      creditExceeded: {
        customerCount: exceeded.length,
        totalAmount: exceeded.reduce((s, v) => s + v.totalRemaining, 0),
      },
      topDebtors,
    };
  }

  // ─────────────────────────────────────────────────────
  // Report (Module Báo cáo, 014-bao-cao.md Task 00) — chỉ đọc theo kỳ.
  // ─────────────────────────────────────────────────────

  private async getCompanyTimezone(): Promise<string> {
    try {
      const company = await this.settingService.getCompany();
      return company.timezone;
    } catch {
      return 'Asia/Ho_Chi_Minh';
    }
  }

  // A2 — tiền mặt về (Actual): tổng Payment.amount theo Payment.paymentDate,
  // phân theo paymentMethod, chuỗi theo groupBy. Payment không cần lọc
  // CANCELLED — đơn đã thu tiền không huỷ được (rule debt.md).
  // KHÔNG cộng lẫn với doanh thu Planned (A1/A3).
  async getCashInReport(from: Date, to: Date, groupBy: ReportGroupBy = 'day') {
    const timezone = await this.getCompanyTimezone();
    const where: Prisma.PaymentWhereInput = {
      paymentDate: { gte: from, lte: to },
    };

    const [rows, byMethod] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: { paymentDate: true, amount: true },
      }),
      this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      totalCashIn: rows.reduce((s, r) => s + Number(r.amount), 0),
      paymentCount: rows.length,
      byMethod: byMethod.map((m) => ({
        paymentMethod: m.paymentMethod,
        count: m._count._all,
        amount: Number(m._sum.amount ?? 0),
      })),
      series: buildSeries(
        rows.map((r) => ({
          date: r.paymentDate,
          values: { cashIn: Number(r.amount), paymentCount: 1 },
        })),
        from,
        to,
        timezone,
        groupBy,
        ['cashIn', 'paymentCount'],
      ),
    };
  }

  // A4 — tách rõ 2 phần (report.md): `balance` là số dư hiện tại (KHÔNG theo
  // kỳ), `inRange` là phát sinh trong kỳ (công nợ mới của SO tạo trong kỳ +
  // tiền thu trong kỳ = A2). Tái dùng các method Dashboard đã có, không định
  // nghĩa lại logic Overdue/Risk/Credit-limit.
  async getDebtReport(from: Date, to: Date) {
    const now = new Date();
    const notCancelled = this.notCancelledFilter();
    const riskAggregate = (dueDate: Prisma.ReceivableWhereInput['dueDate']) =>
      this.prisma.receivable.aggregate({
        where: { ...notCancelled, dueDate },
        _sum: { remainingAmount: true },
        _count: { _all: true },
      });

    const [
      summary,
      lowRisk,
      mediumRisk,
      highRisk,
      creditExceeded,
      topDebtors,
      inRangeSummary,
    ] = await Promise.all([
      this.getDashboardSummary(),
      // Bậc rủi ro — cùng ngưỡng 7/30 ngày như findAllReceivables()/computeRiskLevel().
      riskAggregate({
        not: null,
        lt: now,
        gte: new Date(now.getTime() - 7 * MS_PER_DAY),
      }),
      riskAggregate({
        not: null,
        lt: new Date(now.getTime() - 7 * MS_PER_DAY),
        gte: new Date(now.getTime() - 30 * MS_PER_DAY),
      }),
      riskAggregate({
        not: null,
        lt: new Date(now.getTime() - 30 * MS_PER_DAY),
      }),
      this.getCreditLimitExceededCustomers(),
      this.getTopDebtors(),
      this.getReceivablesInRangeSummary(from, to),
    ]);

    const riskBucket = (agg: {
      _sum: { remainingAmount: Prisma.Decimal | null };
      _count: { _all: number };
    }) => ({
      count: agg._count._all,
      amount: Number(agg._sum.remainingAmount ?? 0),
    });

    return {
      balance: {
        totalRemaining: summary.totalRemaining,
        overdueAmount: summary.overdueAmount,
        overdueCount: summary.overdueCount,
        byRiskLevel: {
          LOW: riskBucket(lowRisk),
          MEDIUM: riskBucket(mediumRisk),
          HIGH: riskBucket(highRisk),
        },
        creditExceeded,
        topDebtors,
      },
      inRange: inRangeSummary,
    };
  }

  // Công nợ "phát sinh" trong kỳ (report.md A4 — 1 định nghĩa duy nhất, dùng
  // chung cho cả Report (qua getDebtReport() ở trên) lẫn Dashboard (khối Tổng
  // công nợ, 027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 4): nợ mới phát
  // sinh (Receivable của SalesOrder tạo trong kỳ, loại đơn huỷ) + tiền đã thu
  // trong kỳ (tái dùng getCashInReport() đã có cho Report A2).
  async getReceivablesInRangeSummary(from: Date, to: Date) {
    const [newReceivables, cashIn] = await Promise.all([
      this.prisma.receivable.aggregate({
        where: {
          salesOrder: {
            status: { not: SalesOrderStatus.CANCELLED },
            createdAt: { gte: from, lte: to },
          },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.getCashInReport(from, to),
    ]);

    return {
      newReceivableCount: newReceivables._count._all,
      newReceivableAmount: Number(newReceivables._sum.totalAmount ?? 0),
      cashIn,
    };
  }

  // C2 — công nợ hiện tại theo khách (đọc realtime, không lưu vào customers —
  // cam kết customer.md). Report gọi qua đây thay vì tự query Receivable
  // (Module Ownership).
  async getRemainingByCustomers(customerIds: string[]) {
    if (customerIds.length === 0) return new Map<string, number>();

    const grouped = await this.prisma.receivable.groupBy({
      by: ['customerId'],
      where: {
        ...this.notCancelledFilter(),
        customerId: { in: customerIds },
      },
      _sum: { remainingAmount: true },
    });

    return new Map(
      grouped.map((g) => [g.customerId, Number(g._sum.remainingAmount ?? 0)]),
    );
  }

  // ─────────────────────────────────────────────────────
  // Xuất dữ liệu backup (report.md mục "Xuất dữ liệu backup") — liệt kê
  // TOÀN BỘ Receivable/Payment trong kỳ, KHÔNG loại CANCELLED (khác Quy tắc
  // loại trừ áp dụng cho 14 báo cáo phân tích) — mục đích là bản sao đầy đủ
  // dữ liệu, thiếu công nợ của đơn đã huỷ là backup không đầy đủ.
  // ─────────────────────────────────────────────────────

  async getAllReceivablesRaw(from: Date, to: Date) {
    return this.prisma.receivable.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      include: RECEIVABLE_LIST_INCLUDE,
    });
  }

  async getAllPaymentsRaw(from: Date, to: Date) {
    return this.prisma.payment.findMany({
      where: { paymentDate: { gte: from, lte: to } },
      orderBy: { paymentDate: 'asc' },
    });
  }

  // Tab "Phiếu thu" (rà soát tab Công nợ, 11/08/2026) — danh sách Payment có
  // xem trước trên UI (khác getAllPaymentsRaw() ở trên, vốn chỉ phục vụ export
  // report). Chỉ lấy Payment thuộc luồng Receivable/OpeningBalance (có
  // allocations) — Payment luồng VatSettlement (vatSettlementId) đã có màn
  // hình riêng ở /vat-settlements/[id] (schema.prisma: "Payment thuộc ĐÚNG 1
  // trong 2 luồng").
  async findAllPayments(query: PaymentQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const allocationFilter: Prisma.PaymentAllocationWhereInput = {};
    if (query.customerId) {
      // Rà soát tab Công nợ (11/08/2026) — allocation giờ có thể trỏ tới
      // Receivable HOẶC OpeningBalance, cả 2 đều có customerId.
      allocationFilter.OR = [
        { receivable: { customerId: query.customerId } },
        { openingBalance: { customerId: query.customerId } },
      ];
    }

    const where: Prisma.PaymentWhereInput = {
      allocations: { some: allocationFilter },
    };

    if (query.from || query.to) {
      where.paymentDate = {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999`) } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          reversedBy: { select: { id: true } },
          allocations: {
            include: {
              receivable: {
                select: {
                  customerId: true,
                  salesOrder: { select: { code: true } },
                },
              },
              openingBalance: { select: { customerId: true, code: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    // Receivable đã denormalize customerName/Phone qua SalesOrder, OpeningBalance
    // thì chưa (chỉ có customerId) — tra chung 1 lần qua Customer cho cả 2 nguồn,
    // đơn giản hơn giữ 2 cách lấy tên khách hàng khác nhau.
    const customerIds = new Set<string>();
    for (const p of rows) {
      for (const a of p.allocations) {
        const cid = a.receivable?.customerId ?? a.openingBalance?.customerId;
        if (cid) customerIds.add(cid);
      }
    }
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: Array.from(customerIds) } },
      select: { id: true, name: true, phone: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const data = rows.map((p) => {
      const firstAlloc = p.allocations[0];
      const customerId =
        firstAlloc?.receivable?.customerId ??
        firstAlloc?.openingBalance?.customerId ??
        null;
      const customer = customerId ? customerMap.get(customerId) : undefined;
      return {
        id: p.id,
        code: p.code,
        type: p.type,
        paymentDate: p.paymentDate,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber,
        note: p.note,
        createdBy: p.createdBy,
        reversedBy: p.reversedBy,
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
        orderCodes: p.allocations.map(
          (a) => a.receivable?.salesOrder.code ?? a.openingBalance?.code ?? '—',
        ),
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
