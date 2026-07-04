import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  ProductionOrderStatus,
  ProductionOrderTimelineAction,
  ProductionOrderTimelineActorType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';

const PRODUCTION_ORDER_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' as const } },
  timeline: { orderBy: { createdAt: 'asc' as const } },
  salesOrder: {
    select: {
      id: true,
      code: true,
      customerName: true,
      customerPhone: true,
      status: true,
    },
  },
} satisfies Prisma.ProductionOrderInclude;

@Injectable()
export class ProductionOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesOrderService: SalesOrderService,
  ) {}

  // ─────────────────────────────────────────────────────
  // Read API (Task 03) — không có Create / Update / Delete
  // ─────────────────────────────────────────────────────

  async findAll(query: ProductionOrderQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductionOrderWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { salesOrder: { code: { contains: query.search, mode: 'insensitive' } } },
        {
          salesOrder: {
            customerName: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (query.productionCenterId) {
      where.productionCenterId = query.productionCenterId;
    }

    const validStatuses = Object.values(ProductionOrderStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as ProductionOrderStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true } },
          salesOrder: {
            select: { id: true, code: true, customerName: true },
          },
        },
      }),
      this.prisma.productionOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const productionOrder = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: PRODUCTION_ORDER_INCLUDE,
    });

    if (!productionOrder) {
      throw new NotFoundException('Phiếu sản xuất không tồn tại.');
    }

    return productionOrder;
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Start / Complete (Task 04)
  // Action Driven — không cho phép sửa status trực tiếp.
  // ─────────────────────────────────────────────────────

  async start(id: string) {
    const productionOrder = await this.findOne(id);

    if (productionOrder.status !== ProductionOrderStatus.PENDING) {
      throw new ForbiddenException(
        `Chỉ có thể bắt đầu sản xuất khi Phiếu sản xuất ở trạng thái Chờ sản xuất. Trạng thái hiện tại: ${productionOrder.status}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const startedAt = new Date();

      await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionOrderStatus.IN_PRODUCTION,
          startedAt,
        },
      });

      await tx.productionOrderTimeline.create({
        data: {
          productionOrderId: id,
          action: ProductionOrderTimelineAction.STARTED,
          actorType: ProductionOrderTimelineActorType.USER,
          payload: {},
        },
      });

      return tx.productionOrder.findUniqueOrThrow({
        where: { id },
        include: PRODUCTION_ORDER_INCLUDE,
      });
    });
  }

  async complete(id: string) {
    const productionOrder = await this.findOne(id);

    if (productionOrder.status !== ProductionOrderStatus.IN_PRODUCTION) {
      throw new ForbiddenException(
        `Chỉ có thể hoàn thành sản xuất khi Phiếu sản xuất đang sản xuất. Trạng thái hiện tại: ${productionOrder.status}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const completedAt = new Date();

      await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionOrderStatus.PRODUCTION_COMPLETED,
          completedAt,
        },
      });

      await tx.productionOrderTimeline.create({
        data: {
          productionOrderId: id,
          action: ProductionOrderTimelineAction.COMPLETED,
          actorType: ProductionOrderTimelineActorType.USER,
          payload: {
            startedAt: productionOrder.startedAt,
            completedAt,
          },
        },
      });

      // ERP tự động: đồng bộ tiến độ về Sales Order (Task 05) — trong cùng transaction.
      await this.salesOrderService.syncProductionProgress(
        productionOrder.salesOrderId,
        tx,
      );

      return tx.productionOrder.findUniqueOrThrow({
        where: { id },
        include: PRODUCTION_ORDER_INCLUDE,
      });
    });
  }
}
