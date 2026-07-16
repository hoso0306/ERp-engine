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
  SalesOrderStatus,
  SalesOrderTimelineAction,
  SalesOrderTimelineActorType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from '../setting/setting.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ReceivableQueryDto } from './dto/receivable-query.dto';
import { resolveActorName } from '../shared/resolve-actor-name';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

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
  payments: { orderBy: { paymentDate: 'asc' as const } },
} satisfies Prisma.ReceivableInclude;

@Injectable()
export class DebtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingService: SettingService,
  ) {}

  // ─────────────────────────────────────────────────────
  // Payment (Task 03) — document Create API duy nhất của module này
  // ─────────────────────────────────────────────────────

  async createPayment(dto: CreatePaymentDto, userId?: string | null) {
    if (!dto.salesOrderId) {
      throw new BadRequestException('Đơn hàng là bắt buộc.');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0.');
    }

    const validMethods = Object.values(PaymentMethod) as string[];
    if (!dto.paymentMethod || !validMethods.includes(dto.paymentMethod)) {
      throw new BadRequestException(
        `Phương thức thanh toán "${dto.paymentMethod}" không hợp lệ.`,
      );
    }
    const paymentMethod = dto.paymentMethod as PaymentMethod;

    if (
      paymentMethod === PaymentMethod.BANK_TRANSFER &&
      !dto.referenceNumber?.trim()
    ) {
      throw new BadRequestException(
        'Số tham chiếu là bắt buộc khi thanh toán bằng chuyển khoản.',
      );
    }

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

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const running = await tx.runningNumber.update({
        where: { type: 'PAYMENT' },
        data: { lastNumber: { increment: 1 } },
      });
      const code = `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;

      const payment = await tx.payment.create({
        data: {
          code,
          salesOrderId: salesOrder.id,
          receivableId: receivable.id,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          paymentMethod,
          referenceNumber: dto.referenceNumber?.trim() || null,
          note: dto.note?.trim() || null,
          createdBy: dto.createdBy?.trim() || null,
        },
      });

      // Concurrency Rule (debt.md): atomic increment/decrement — không đọc
      // remainingAmount ra tính rồi ghi đè. CHECK (remaining_amount >= 0) ở DB
      // chặn mọi trường hợp thu vượt công nợ, kể cả concurrent request.
      const updatedReceivable = await tx.receivable.update({
        where: { id: receivable.id },
        data: {
          paidAmount: { increment: dto.amount },
          remainingAmount: { decrement: dto.amount },
        },
      });

      const newPaymentStatus = this.computePaymentStatus(
        Number(updatedReceivable.paidAmount),
        Number(updatedReceivable.totalAmount),
      );

      await tx.salesOrder.update({
        where: { id: salesOrder.id },
        data: { paymentStatus: newPaymentStatus },
      });

      // Timeline (Task 05) — ghi mỗi lần tạo Payment, không phụ thuộc
      // paymentStatus có đổi hay không.
      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: salesOrder.id,
          action: SalesOrderTimelineAction.PAYMENT_STATUS_CHANGED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            paymentCode: code,
            amount: dto.amount,
            fromStatus: salesOrder.paymentStatus,
            toStatus: newPaymentStatus,
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { receivable: true },
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Read API (Task 07)
  // ─────────────────────────────────────────────────────

  async findAllReceivables(query: ReceivableQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ReceivableWhereInput = {};
    const salesOrderWhere: Prisma.SalesOrderWhereInput = {};

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

    if (Object.keys(salesOrderWhere).length > 0) {
      where.salesOrder = salesOrderWhere;
    }

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

    const [data, total] = await Promise.all([
      this.prisma.receivable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: RECEIVABLE_LIST_INCLUDE,
      }),
      this.prisma.receivable.count({ where }),
    ]);

    return {
      data: data.map((r) => this.withDerivedFields(r)),
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
    const grouped = await this.prisma.receivable.groupBy({
      by: ['customerId'],
      where: this.notCancelledFilter(),
      _sum: { remainingAmount: true },
    });

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
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

    for (const g of grouped) {
      const totalRemaining = Number(g._sum.remainingAmount ?? 0);
      const customer = customerMap.get(g.customerId);
      const debtLimit = Number(customer?.debtLimit ?? 0);
      if (totalRemaining > debtLimit) {
        exceeded.set(g.customerId, {
          customerId: g.customerId,
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

    const [totals, overdueAgg] = await Promise.all([
      this.prisma.receivable.aggregate({
        where: notCancelled,
        _sum: { totalAmount: true, paidAmount: true, remainingAmount: true },
      }),
      this.prisma.receivable.aggregate({
        where: { ...notCancelled, dueDate: this.overdueWhere() },
        _sum: { remainingAmount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      totalReceivable: Number(totals._sum.totalAmount ?? 0),
      totalPaid: Number(totals._sum.paidAmount ?? 0),
      totalRemaining: Number(totals._sum.remainingAmount ?? 0),
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
  async getTopDebtors(limit?: number) {
    const take =
      limit ??
      (await this.settingService.getNumberValue('Dashboard', 'topCustomers'));
    const grouped = await this.prisma.receivable.groupBy({
      by: ['customerId'],
      where: this.notCancelledFilter(),
      _sum: { remainingAmount: true },
      orderBy: { _sum: { remainingAmount: 'desc' } },
      take,
    });

    return this.attachCustomerInfo(grouped);
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
}
