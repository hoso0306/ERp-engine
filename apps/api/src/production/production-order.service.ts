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
  SalesOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { WarehouseService } from '../warehouse/warehouse.service';
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
    private readonly warehouseService: WarehouseService,
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
        {
          salesOrder: { code: { contains: query.search, mode: 'insensitive' } },
        },
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

    const items = await this.attachSpecsAndBom(productionOrder.items);

    return { ...productionOrder, items };
  }

  // Task 01 (005-fe-san-xuat-kho.md) — quản đốc xưởng cần xem thông số sản
  // phẩm + BOM vật tư của chính phiếu mình, nhưng role "Sản xuất" không có
  // quyền `sales-order.view` để gọi GET /sales-orders/:id. Đọc thẳng
  // SalesOrderItemParameter/OrderBOM theo salesOrderItemId (cùng cách
  // WarehouseService.issueForProductionOrder() đã làm) — không kèm giá vốn vì
  // Production không quan tâm chi phí (production.md).
  private async attachSpecsAndBom<T extends { salesOrderItemId: string }>(
    items: T[],
  ) {
    const salesOrderItemIds = items.map((item) => item.salesOrderItemId);
    if (salesOrderItemIds.length === 0) return items;

    const [parameters, boms] = await Promise.all([
      this.prisma.salesOrderItemParameter.findMany({
        where: { salesOrderItemId: { in: salesOrderItemIds } },
        orderBy: { displayOrder: 'asc' },
        select: {
          salesOrderItemId: true,
          name: true,
          label: true,
          value: true,
          unit: true,
        },
      }),
      this.prisma.orderBOM.findMany({
        where: { salesOrderItemId: { in: salesOrderItemIds } },
        select: {
          salesOrderItemId: true,
          items: {
            select: {
              materialCode: true,
              materialName: true,
              materialUnit: true,
              quantity: true,
            },
          },
        },
      }),
    ]);

    const parametersByItem = new Map<string, typeof parameters>();
    for (const p of parameters) {
      const list = parametersByItem.get(p.salesOrderItemId) ?? [];
      list.push(p);
      parametersByItem.set(p.salesOrderItemId, list);
    }

    const bomByItem = new Map(boms.map((b) => [b.salesOrderItemId, b.items]));

    return items.map((item) => ({
      ...item,
      parameters: parametersByItem.get(item.salesOrderItemId) ?? [],
      bomMaterials: bomByItem.get(item.salesOrderItemId) ?? [],
    }));
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

      // Task 03 (Warehouse module) — xuất kho nguyên liệu trước khi chuyển
      // trạng thái. Nếu thiếu tồn kho, ném lỗi và toàn bộ transaction rollback
      // — ProductionOrder giữ nguyên PENDING (xem warehouse.md "Transaction
      // Boundary khi Start Production").
      await this.warehouseService.issueForProductionOrder(id, tx);

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

  // ─────────────────────────────────────────────────────
  // Dashboard (Module Dashboard, Task 00) — chỉ đọc, không Business Logic mới.
  // ─────────────────────────────────────────────────────

  async getDashboardSummary() {
    const grouped = await this.prisma.productionOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const countByStatus = new Map(
      grouped.map((g) => [g.status, g._count._all]),
    );

    return {
      pending: countByStatus.get(ProductionOrderStatus.PENDING) ?? 0,
      inProduction: countByStatus.get(ProductionOrderStatus.IN_PRODUCTION) ?? 0,
      completed:
        countByStatus.get(ProductionOrderStatus.PRODUCTION_COMPLETED) ?? 0,
      cancelled: countByStatus.get(ProductionOrderStatus.CANCELLED) ?? 0,
    };
  }

  // Trả về toàn bộ xưởng đã sắp xếp theo số lượng Phiếu sản xuất (không huỷ) giảm dần
  // — Dashboard tự lấy đầu danh sách cho "nhiều việc nhất", cuối danh sách cho
  // "ít việc nhất" từ cùng một query, tránh N+1 (xem 009-dashboard.md Task 07).
  async getBusyCenters() {
    const grouped = await this.prisma.productionOrder.groupBy({
      by: ['productionCenterId', 'productionCenterName'],
      where: { status: { not: ProductionOrderStatus.CANCELLED } },
      _count: { _all: true },
      orderBy: { _count: { productionCenterId: 'desc' } },
    });

    return grouped.map((g) => ({
      productionCenterId: g.productionCenterId,
      productionCenterName: g.productionCenterName,
      orderCount: g._count._all,
    }));
  }

  // Tiến độ sản xuất theo từng Sales Order đang IN_PRODUCTION — đọc trực tiếp
  // completedProductionOrders/totalProductionOrders (Summary Field có sẵn trên
  // SalesOrder), không tính lại Workflow. Phép chia chỉ để hiển thị %.
  async getProgressSummary() {
    const orders = await this.prisma.salesOrder.findMany({
      where: { status: SalesOrderStatus.IN_PRODUCTION },
      select: {
        id: true,
        code: true,
        completedProductionOrders: true,
        totalProductionOrders: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCompleted = orders.reduce(
      (s, o) => s + o.completedProductionOrders,
      0,
    );
    const totalPlanned = orders.reduce(
      (s, o) => s + o.totalProductionOrders,
      0,
    );

    return {
      overallProgressPercent:
        totalPlanned > 0
          ? Math.round((totalCompleted / totalPlanned) * 100)
          : 0,
      orders: orders.map((o) => ({
        salesOrderId: o.id,
        salesOrderCode: o.code,
        completed: o.completedProductionOrders,
        total: o.totalProductionOrders,
        progressPercent:
          o.totalProductionOrders > 0
            ? Math.round(
                (o.completedProductionOrders / o.totalProductionOrders) * 100,
              )
            : 0,
      })),
    };
  }
}
