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
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { OverrideSalesOrderDto } from './dto/override-sales-order.dto';
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

const STARTED_PRODUCTION_STATUSES: ProductionOrderStatus[] = [
  ProductionOrderStatus.IN_PRODUCTION,
  ProductionOrderStatus.PRODUCTION_COMPLETED,
];

const PAYMENT_STATUS_ORDER: PaymentStatus[] = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIALLY_PAID,
  PaymentStatus.PAID,
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
      await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.DELIVERED,
          actualDeliveryDate: new Date(),
        },
      });

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
  // Payment (Task 08)
  // ─────────────────────────────────────────────────────

  async recordPayment(id: string, dto: RecordPaymentDto) {
    const validStatuses = Object.values(PaymentStatus) as string[];
    if (!dto.paymentStatus || !validStatuses.includes(dto.paymentStatus)) {
      throw new BadRequestException(
        `Trạng thái thanh toán "${dto.paymentStatus}" không hợp lệ.`,
      );
    }

    const salesOrder = await this.findOne(id);
    const newPaymentStatus = dto.paymentStatus as PaymentStatus;

    const currentIndex = PAYMENT_STATUS_ORDER.indexOf(salesOrder.paymentStatus);
    const newIndex = PAYMENT_STATUS_ORDER.indexOf(newPaymentStatus);

    if (newIndex <= currentIndex) {
      throw new ForbiddenException(
        `Không thể chuyển trạng thái thanh toán từ ${salesOrder.paymentStatus} sang ${newPaymentStatus}. Chỉ được đi một chiều: UNPAID → PARTIALLY_PAID → PAID.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: { paymentStatus: newPaymentStatus },
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: id,
          action: SalesOrderTimelineAction.PAYMENT_STATUS_CHANGED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            fromStatus: salesOrder.paymentStatus,
            toStatus: newPaymentStatus,
          },
          createdBy: dto.recordedBy?.trim() || null,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }
}
