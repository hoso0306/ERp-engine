import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  SalesOrderStatus,
  ProductionOrderStatus,
  PaymentStatus,
  SalesOrderTimelineAction,
  SalesOrderTimelineActorType,
  ProductionOrderTimelineAction,
  ProductionOrderTimelineActorType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { OverrideSalesOrderDto } from './dto/override-sales-order.dto';
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';

const STARTED_PRODUCTION_STATUSES: ProductionOrderStatus[] = [
  ProductionOrderStatus.IN_PRODUCTION,
  ProductionOrderStatus.PRODUCTION_COMPLETED,
];

const SALES_ORDER_INCLUDE = {
  items: {
    include: {
      parameters: { orderBy: { displayOrder: 'asc' as const } },
      bom: { include: { items: true } },
    },
    orderBy: { displayOrder: 'asc' as const },
  },
  productionOrders: {
    include: { items: true },
    orderBy: { createdAt: 'asc' as const },
  },
  timeline: { orderBy: { createdAt: 'asc' as const } },
  receivable: true,
} satisfies Prisma.SalesOrderInclude;

@Injectable()
export class SalesOrderService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────
  // Read API (Task 03) — no Create / Update / Delete
  // ─────────────────────────────────────────────────────

  async findAll(query: SalesOrderQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerPhone: { contains: query.search } },
        { quotationCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    const validStatuses = Object.values(SalesOrderStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as SalesOrderStatus;
    }

    const validPaymentStatuses = Object.values(PaymentStatus) as string[];
    if (
      query.paymentStatus &&
      validPaymentStatuses.includes(query.paymentStatus)
    ) {
      where.paymentStatus = query.paymentStatus as PaymentStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true, productionOrders: true } },
        },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const salesOrder = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: SALES_ORDER_INCLUDE,
    });

    if (!salesOrder) {
      throw new NotFoundException('Đơn hàng không tồn tại.');
    }

    return salesOrder;
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Ship / Deliver (Task 04)
  // Action Driven — không cho phép sửa status trực tiếp.
  // ─────────────────────────────────────────────────────

  async ship(id: string) {
    const salesOrder = await this.findOne(id);

    if (salesOrder.status !== SalesOrderStatus.PRODUCTION_COMPLETED) {
      throw new ForbiddenException(
        `Chỉ có thể gửi xe khi đơn hàng đã hoàn thành sản xuất. Trạng thái hiện tại: ${salesOrder.status}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.SHIPPED },
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: id,
          action: SalesOrderTimelineAction.SHIPPED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            fromStatus: salesOrder.status,
            toStatus: SalesOrderStatus.SHIPPED,
          },
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  async deliver(id: string) {
    const salesOrder = await this.findOne(id);

    if (salesOrder.status !== SalesOrderStatus.SHIPPED) {
      throw new ForbiddenException(
        `Chỉ có thể xác nhận khách đã nhận hàng khi đơn hàng đã được gửi xe. Trạng thái hiện tại: ${salesOrder.status}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const actualDeliveryDate = new Date();

      await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.DELIVERED,
          actualDeliveryDate,
        },
      });

      // Task 08 (Debt module) — kích hoạt dueDate, dùng debtTermDaysSnapshot đã
      // snapshot tại thời điểm tạo Receivable, không đọc lại Customer.debtTermDays.
      if (salesOrder.receivable) {
        const dueDate = new Date(actualDeliveryDate);
        dueDate.setDate(
          dueDate.getDate() + salesOrder.receivable.debtTermDaysSnapshot,
        );
        await tx.receivable.update({
          where: { id: salesOrder.receivable.id },
          data: { dueDate },
        });
      }

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: id,
          action: SalesOrderTimelineAction.DELIVERED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            fromStatus: salesOrder.status,
            toStatus: SalesOrderStatus.DELIVERED,
          },
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // ERP tự động: Production Completed (Task 04 DoD)
  //
  // Nội bộ — chưa có HTTP endpoint vì Production module (nơi cập nhật
  // ProductionOrder.status) chưa được xây dựng. Method này được export sẵn
  // để Production module gọi khi một Production Order chuyển sang
  // PRODUCTION_COMPLETED. Cũng chính là cơ chế "ERP tự cập nhật" mà
  // Task 07 (Production Progress) sẽ tái sử dụng, không viết lại.
  // ─────────────────────────────────────────────────────

  async syncProductionProgress(
    salesOrderId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const salesOrder = await tx.salesOrder.findUnique({
      where: { id: salesOrderId },
    });
    if (!salesOrder) {
      throw new NotFoundException('Đơn hàng không tồn tại.');
    }

    const completedCount = await tx.productionOrder.count({
      where: {
        salesOrderId,
        status: ProductionOrderStatus.PRODUCTION_COMPLETED,
      },
    });

    const data: Prisma.SalesOrderUpdateInput = {};

    if (completedCount !== salesOrder.completedProductionOrders) {
      data.completedProductionOrders = completedCount;
    }

    const willComplete =
      salesOrder.status === SalesOrderStatus.IN_PRODUCTION &&
      completedCount >= salesOrder.totalProductionOrders;

    if (willComplete) {
      data.status = SalesOrderStatus.PRODUCTION_COMPLETED;
    }

    if (Object.keys(data).length === 0) {
      return salesOrder;
    }

    const updated = await tx.salesOrder.update({
      where: { id: salesOrderId },
      data,
    });

    if (willComplete) {
      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId,
          action: SalesOrderTimelineAction.PRODUCTION_COMPLETED,
          actorType: SalesOrderTimelineActorType.SYSTEM,
          payload: {
            completedProductionOrders: completedCount,
            totalProductionOrders: salesOrder.totalProductionOrders,
          },
        },
      });
    }

    return updated;
  }

  // ─────────────────────────────────────────────────────
  // Manual Override & Cancel (Task 05)
  // ─────────────────────────────────────────────────────

  async override(id: string, dto: OverrideSalesOrderDto) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do điều chỉnh là bắt buộc.');
    }

    const validStatuses = Object.values(SalesOrderStatus) as string[];
    if (!dto.newStatus || !validStatuses.includes(dto.newStatus)) {
      throw new BadRequestException(
        `Trạng thái "${dto.newStatus}" không hợp lệ.`,
      );
    }

    const salesOrder = await this.findOne(id);

    if (salesOrder.status === (dto.newStatus as SalesOrderStatus)) {
      throw new BadRequestException(
        'Trạng thái mới phải khác trạng thái hiện tại.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: { status: dto.newStatus as SalesOrderStatus },
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: id,
          action: SalesOrderTimelineAction.MANUAL_OVERRIDE,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            fromStatus: salesOrder.status,
            toStatus: dto.newStatus,
            reason: dto.reason.trim(),
          },
          createdBy: dto.overrideBy?.trim() || null,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  async cancel(id: string, dto: CancelSalesOrderDto) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do huỷ là bắt buộc.');
    }

    const salesOrder = await this.findOne(id);

    if (salesOrder.status === SalesOrderStatus.CANCELLED) {
      throw new ForbiddenException('Đơn hàng đã ở trạng thái Đã huỷ.');
    }

    if (salesOrder.status === SalesOrderStatus.DELIVERED) {
      throw new ForbiddenException('Không thể huỷ đơn hàng đã giao cho khách.');
    }

    // Task 06 (Debt module) — không cho Cancel nếu đã thu tiền. Refund không
    // thuộc phạm vi Sprint 01 (xem debt.md mục "Receivable không tự quyết
    // định hiệu lực công nợ").
    if (salesOrder.receivable && Number(salesOrder.receivable.paidAmount) > 0) {
      throw new ForbiddenException(
        'Không thể huỷ đơn hàng đã thu tiền. Vui lòng liên hệ kế toán để xử lý.',
      );
    }

    const startedProductionOrders = salesOrder.productionOrders.filter((po) =>
      STARTED_PRODUCTION_STATUSES.includes(po.status),
    );
    if (startedProductionOrders.length > 0) {
      throw new ForbiddenException(
        'Không thể huỷ đơn hàng vì đã có Phiếu sản xuất bắt đầu sản xuất.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CANCELLED },
      });

      // Task 07 (Production module) — cascade Production Order sang CANCELLED.
      // Đến đây đã xác nhận không có PO nào IN_PRODUCTION/PRODUCTION_COMPLETED
      // (chặn ở validation phía trên), nên toàn bộ PO còn lại đều đang PENDING.
      const pendingProductionOrders = salesOrder.productionOrders.filter(
        (po) => po.status === ProductionOrderStatus.PENDING,
      );

      if (pendingProductionOrders.length > 0) {
        await tx.productionOrder.updateMany({
          where: { id: { in: pendingProductionOrders.map((po) => po.id) } },
          data: { status: ProductionOrderStatus.CANCELLED },
        });

        await tx.productionOrderTimeline.createMany({
          data: pendingProductionOrders.map((po) => ({
            productionOrderId: po.id,
            action: ProductionOrderTimelineAction.CANCELLED,
            actorType: ProductionOrderTimelineActorType.SYSTEM,
            payload: { reason: dto.reason.trim() },
          })),
        });
      }

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: id,
          action: SalesOrderTimelineAction.CANCELLED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: { fromStatus: salesOrder.status, reason: dto.reason.trim() },
          createdBy: dto.cancelledBy?.trim() || null,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Dashboard (Module Dashboard, Task 00) — chỉ đọc, không Business Logic mới.
  // ─────────────────────────────────────────────────────

  async getDashboardSummary() {
    const notCancelled: Prisma.SalesOrderWhereInput = {
      status: { not: SalesOrderStatus.CANCELLED },
    };

    const [totals, statusCounts] = await Promise.all([
      this.prisma.salesOrder.aggregate({
        where: notCancelled,
        _sum: { totalAmount: true, plannedCost: true, plannedProfit: true },
      }),
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const countByStatus = new Map(statusCounts.map((s) => [s.status, s._count._all]));

    return {
      totalRevenue: Number(totals._sum.totalAmount ?? 0),
      totalPlannedCost: Number(totals._sum.plannedCost ?? 0),
      totalPlannedProfit: Number(totals._sum.plannedProfit ?? 0),
      inProduction: countByStatus.get(SalesOrderStatus.IN_PRODUCTION) ?? 0,
      productionCompleted: countByStatus.get(SalesOrderStatus.PRODUCTION_COMPLETED) ?? 0,
      delivered: countByStatus.get(SalesOrderStatus.DELIVERED) ?? 0,
    };
  }

  async getStatistics() {
    const [byStatus, byPaymentStatus] = await Promise.all([
      this.prisma.salesOrder.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.salesOrder.groupBy({ by: ['paymentStatus'], _count: { _all: true } }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byPaymentStatus: byPaymentStatus.map((s) => ({
        paymentStatus: s.paymentStatus,
        count: s._count._all,
      })),
    };
  }

  async getRecentOrders(limit = 10) {
    return this.prisma.salesOrder.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        customerName: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
      },
    });
  }

  // Đơn trễ tiến độ (Dashboard Alerts, 009-dashboard.md Task 06) — đọc trực
  // tiếp expectedDeliveryDate đã có sẵn trên SalesOrder, không thêm field/rule
  // mới: đã qua ngày giao dự kiến mà đơn chưa DELIVERED/CANCELLED.
  async getDelayedOrders() {
    return this.prisma.salesOrder.findMany({
      where: {
        expectedDeliveryDate: { not: null, lt: new Date() },
        status: { notIn: [SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED] },
      },
      select: {
        id: true,
        code: true,
        customerName: true,
        status: true,
        expectedDeliveryDate: true,
      },
      orderBy: { expectedDeliveryDate: 'asc' },
    });
  }
}
