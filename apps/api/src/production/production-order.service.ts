import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';
import { resolveActorName } from '../shared/resolve-actor-name';

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
      // In phiếu A5 (009-in-phieu-san-xuat.md) — đọc địa chỉ giao hàng đã
      // snapshot/có thể sửa trên SalesOrder, KHÔNG đọc lại Customer.
      deliveryName: true,
      deliveryPhone: true,
      deliveryAddress: true,
      deliveryProvince: true,
      deliveryDistrict: true,
      deliveryWard: true,
      expectedDeliveryDate: true,
      // Mẫu in riêng Xưởng Cầu Vồng (010-mau-in-xuong-cau-vong.md) — "Ngày đặt hàng".
      createdAt: true,
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

    const [items, productionCenter] = await Promise.all([
      this.attachSpecsAndBom(productionOrder.items),
      // Mẫu in riêng Xưởng Cầu Vồng (010-mau-in-xuong-cau-vong.md) — nhận diện
      // theo ProductionCenter.code (XL03), không so khớp fragile theo tên hiển
      // thị. ProductionOrder chỉ snapshot id/name, không có relation, nên tra
      // riêng ở đây.
      this.prisma.productionCenter.findUnique({
        where: { id: productionOrder.productionCenterId },
        select: { code: true },
      }),
    ]);

    return {
      ...productionOrder,
      items,
      productionCenterCode: productionCenter?.code ?? null,
    };
  }

  // Task 01 (005-fe-san-xuat-kho.md) — quản đốc xưởng cần xem thông số sản
  // phẩm + BOM vật tư của chính phiếu mình, nhưng role "Sản xuất" không có
  // quyền `sales-order.view` để gọi GET /sales-orders/:id. Đọc thẳng
  // SalesOrderItemParameter/OrderBOM theo salesOrderItemId — không kèm giá vốn
  // vì Production không quan tâm chi phí (production.md).
  private async attachSpecsAndBom<T extends { salesOrderItemId: string }>(
    items: T[],
  ) {
    const salesOrderItemIds = items.map((item) => item.salesOrderItemId);
    if (salesOrderItemIds.length === 0) return items;

    const [parameters, boms, notes] = await Promise.all([
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
      // Ghi chú dòng (In phiếu A5, 009-in-phieu-san-xuat.md) — snapshot sẵn
      // trên SalesOrderItem, chỉ đọc để hiển thị, không tính toán lại.
      this.prisma.salesOrderItem.findMany({
        where: { id: { in: salesOrderItemIds } },
        select: { id: true, note: true },
      }),
    ]);

    const parametersByItem = new Map<string, typeof parameters>();
    for (const p of parameters) {
      const list = parametersByItem.get(p.salesOrderItemId) ?? [];
      list.push(p);
      parametersByItem.set(p.salesOrderItemId, list);
    }

    const bomByItem = new Map(boms.map((b) => [b.salesOrderItemId, b.items]));
    const noteByItem = new Map(notes.map((n) => [n.id, n.note]));

    return items.map((item) => ({
      ...item,
      parameters: parametersByItem.get(item.salesOrderItemId) ?? [],
      bomMaterials: bomByItem.get(item.salesOrderItemId) ?? [],
      note: noteByItem.get(item.salesOrderItemId) ?? null,
    }));
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Start / Complete (Task 04)
  // Action Driven — không cho phép sửa status trực tiếp.
  // ─────────────────────────────────────────────────────

  async start(id: string, userId?: string | null) {
    const productionOrder = await this.findOne(id);

    if (productionOrder.status !== ProductionOrderStatus.PENDING) {
      throw new ForbiddenException(
        `Chỉ có thể bắt đầu sản xuất khi Phiếu sản xuất ở trạng thái Chờ sản xuất. Trạng thái hiện tại: ${productionOrder.status}.`,
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const startedAt = new Date();

      // Module Kho tạm gỡ khỏi triển khai (chốt 18/07/2026 — doanh nghiệp chưa
      // dùng Kho): KHÔNG xuất kho nguyên liệu, không kiểm tra tồn kho khi Start.
      // Khi bật lại Kho, khôi phục lời gọi
      // `warehouseService.issueForProductionOrder(id, tx)` tại đây và kiểm kê
      // đầu kỳ trước — xem warehouse.md mục "Trạng thái triển khai".
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
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return tx.productionOrder.findUniqueOrThrow({
        where: { id },
        include: PRODUCTION_ORDER_INCLUDE,
      });
    });
  }

  async complete(id: string, userId?: string | null) {
    const productionOrder = await this.findOne(id);

    if (productionOrder.status !== ProductionOrderStatus.IN_PRODUCTION) {
      throw new ForbiddenException(
        `Chỉ có thể hoàn thành sản xuất khi Phiếu sản xuất đang sản xuất. Trạng thái hiện tại: ${productionOrder.status}.`,
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

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
          createdBy: userId ?? null,
          createdByName,
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
  // In phiếu A5 (009-in-phieu-san-xuat.md) — không phải Action đổi Status,
  // chỉ ghi vết đã in (PRINTED) + trả dữ liệu đầy đủ để FE render. Dùng
  // chung cho in 1 phiếu (ids.length === 1) lẫn in hàng loạt.
  // ─────────────────────────────────────────────────────

  async print(ids: string[], userId?: string | null) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException(
        'Cần chọn ít nhất một phiếu sản xuất để in.',
      );
    }

    const existing = await this.prisma.productionOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw new NotFoundException(
        'Một hoặc nhiều phiếu sản xuất không tồn tại.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    await this.prisma.$transaction(
      ids.map((id) =>
        this.prisma.productionOrderTimeline.create({
          data: {
            productionOrderId: id,
            action: ProductionOrderTimelineAction.PRINTED,
            actorType: ProductionOrderTimelineActorType.USER,
            payload: {},
            createdBy: userId ?? null,
            createdByName,
          },
        }),
      ),
    );

    // Giữ đúng thứ tự ids đã chọn để FE render trang A5 theo đúng thứ tự.
    return Promise.all(ids.map((id) => this.findOne(id)));
  }

  // ─────────────────────────────────────────────────────
  // Dashboard (Module Dashboard, Task 00) — chỉ đọc, không Business Logic mới.
  // ─────────────────────────────────────────────────────

  // Rà soát bộ lọc thời gian Dashboard (chốt 18/07/2026,
  // 007-bo-loc-thoi-gian-dashboard.md): "pending"/"inProduction" luôn đếm
  // tức thời (không lọc theo khoảng ngày — đúng bản chất "đang chờ/đang làm
  // ngay bây giờ"). "completed"/"cancelled" đếm theo khoảng ngày do FE truyền
  // (bộ lọc đầu trang Dashboard) — completed dùng completedAt, cancelled dùng
  // updatedAt (không có cột cancelledAt riêng, action huỷ chỉ update status,
  // xem sales-order.service.ts). Không truyền range = toàn bộ thời gian.
  async getDashboardSummary(range?: { from?: Date; to?: Date }) {
    const dateFilter: Prisma.DateTimeFilter | undefined =
      range?.from || range?.to
        ? {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          }
        : undefined;

    const [pending, inProduction, completed, cancelled] = await Promise.all([
      this.prisma.productionOrder.count({
        where: { status: ProductionOrderStatus.PENDING },
      }),
      this.prisma.productionOrder.count({
        where: { status: ProductionOrderStatus.IN_PRODUCTION },
      }),
      this.prisma.productionOrder.count({
        where: {
          status: ProductionOrderStatus.PRODUCTION_COMPLETED,
          ...(dateFilter ? { completedAt: dateFilter } : {}),
        },
      }),
      this.prisma.productionOrder.count({
        where: {
          status: ProductionOrderStatus.CANCELLED,
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),
    ]);

    return { pending, inProduction, completed, cancelled };
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
