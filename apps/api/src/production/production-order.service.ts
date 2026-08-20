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
import { SettingService } from '../setting/setting.service';
import { PermissionService } from '../permission/permission.service';
import { findMatchingIds, unaccentLike } from '../shared/unaccent-search';

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
      // Thông tin nhà xe (009-in-phieu-san-xuat.md) — khối "Thông tin giao
      // hàng" trên mẫu in riêng xưởng, sửa được qua CarrierInfoDialog.
      carrierName: true,
      carrierPhone: true,
      carrierNote: true,
      expectedDeliveryDate: true,
      // Mẫu in riêng Xưởng Cầu Vồng (009-in-phieu-san-xuat.md) — "Ngày đặt hàng".
      createdAt: true,
    },
  },
} satisfies Prisma.ProductionOrderInclude;

@Injectable()
export class ProductionOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesOrderService: SalesOrderService,
    private readonly settingService: SettingService,
    private readonly permissionService: PermissionService,
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
      // Tìm không phân biệt dấu tiếng Việt — giữ nguyên đúng 3 field đang
      // tìm (mã PSX/mã ĐH/tên KH, ĐH qua JOIN), chỉ đổi cách so khớp.
      where.id = {
        in: await findMatchingIds(
          this.prisma,
          Prisma.sql`SELECT po.id FROM production_orders po
            LEFT JOIN sales_orders so ON so.id = po.sales_order_id
            WHERE ${unaccentLike(Prisma.sql`po.code`, query.search)}
              OR ${unaccentLike(Prisma.sql`so.code`, query.search)}
              OR ${unaccentLike(Prisma.sql`so.customer_name`, query.search)}`,
        ),
      };
    }

    if (query.productionCenterId) {
      where.productionCenterId = query.productionCenterId;
    }

    const validStatuses = Object.values(ProductionOrderStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as ProductionOrderStatus;
    }

    // "Người phụ trách" / "Hạn hoàn thành" (chốt 20/08/2026) — cả 2 field đều
    // nằm trên SalesOrder (ownerId, expectedDeliveryDate — không có bản riêng
    // cho ProductionOrder), lọc qua relation salesOrder.
    if (query.ownerId || query.deliveryFrom || query.deliveryTo) {
      where.salesOrder = {
        ...(query.ownerId && { ownerId: query.ownerId }),
        ...((query.deliveryFrom || query.deliveryTo) && {
          expectedDeliveryDate: {
            ...(query.deliveryFrom && {
              gte: new Date(`${query.deliveryFrom}T00:00:00`),
            }),
            ...(query.deliveryTo && {
              lte: new Date(`${query.deliveryTo}T23:59:59.999`),
            }),
          },
        }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              items: true,
              // Cột "Đã in" ở tab Sản xuất (fix 19/07/2026) — Derived Data hợp
              // lệ theo Section 13 (tính trực tiếp từ Timeline, chi phí thấp),
              // không lưu field riêng. Đã in ⇔ có ít nhất 1 dòng Timeline PRINTED.
              timeline: {
                where: { action: ProductionOrderTimelineAction.PRINTED },
              },
            },
          },
          salesOrder: {
            // ownerName (tab Sản xuất, chốt 20/08/2026) — snapshot người tạo
            // Báo giá tại Approve (xem SalesOrder.ownerId), hiện cột "Người
            // phụ trách". Nullable với đơn tạo trước 05/07/2026.
            select: { id: true, code: true, customerName: true, ownerName: true },
          },
        },
      }),
      this.prisma.productionOrder.count({ where }),
    ]);

    return {
      data: data.map(({ _count, ...po }) => ({
        ...po,
        _count: { items: _count.items },
        isPrinted: _count.timeline > 0,
      })),
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
      // Mẫu in riêng Xưởng Cầu Vồng (009-in-phieu-san-xuat.md) — nhận diện
      // theo ProductionCenter.code (XW004/XW001), không so khớp fragile theo
      // tên hiển thị. ProductionOrder chỉ snapshot id/name, không có relation,
      // nên tra riêng ở đây.
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
          // 009-in-phieu-san-xuat.md — nhãn hiển thị của option ENUM đã
          // chọn, dùng để in đúng "Cửa sổ" thay vì mã "cuaso".
          valueLabel: true,
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
  // In phiếu A5 (009-in-phieu-san-xuat.md) — ghi vết đã in (PRINTED) + trả dữ
  // liệu đầy đủ để FE render. Dùng chung cho in 1 phiếu (ids.length === 1)
  // lẫn in hàng loạt.
  //
  // "In và bắt đầu SX" (chốt 10/08/2026): in cũng tự động Start các phiếu
  // đang PENDING trong cùng transaction (không phải action đổi Status độc
  // lập nữa — Action "In" giờ bao luôn "Bắt đầu SX"). Phiếu không còn PENDING
  // (in lại phiếu đã chạy/hoàn thành) chỉ ghi PRINTED, không đụng status.
  // Vì Start là hành động có kiểm soát quyền riêng (`production.start`), in
  // giờ đòi thêm quyền đó ngoài `production.view` — nếu không có, chặn in
  // luôn (không cho in "một nửa" rồi âm thầm không Start). Endpoint
  // `:id/start` (nút "Bắt đầu sản xuất" thủ công) giữ nguyên, không đổi.
  // ─────────────────────────────────────────────────────

  async print(ids: string[], userId?: string | null, roleId?: string | null) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException(
        'Cần chọn ít nhất một phiếu sản xuất để in.',
      );
    }

    const existing = await this.prisma.productionOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
    if (existing.length !== ids.length) {
      throw new NotFoundException(
        'Một hoặc nhiều phiếu sản xuất không tồn tại.',
      );
    }

    const canStart =
      !!roleId &&
      (await this.permissionService.hasPermission(roleId, 'production.start'));
    if (!canStart) {
      throw new ForbiddenException(
        'Không có quyền "production.start" — In phiếu sẽ tự động bắt đầu sản xuất nên cần thêm quyền này.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);
    const startedAt = new Date();

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const order of existing) {
      ops.push(
        this.prisma.productionOrderTimeline.create({
          data: {
            productionOrderId: order.id,
            action: ProductionOrderTimelineAction.PRINTED,
            actorType: ProductionOrderTimelineActorType.USER,
            payload: {},
            createdBy: userId ?? null,
            createdByName,
          },
        }),
      );

      // Chỉ tự Start phiếu đang Chờ sản xuất — in lại phiếu đã chạy/hoàn
      // thành/huỷ thì chỉ ghi vết in, không đụng status (giống hệt điều kiện
      // trong start()).
      if (order.status === ProductionOrderStatus.PENDING) {
        ops.push(
          this.prisma.productionOrder.update({
            where: { id: order.id },
            data: { status: ProductionOrderStatus.IN_PRODUCTION, startedAt },
          }),
        );
        ops.push(
          this.prisma.productionOrderTimeline.create({
            data: {
              productionOrderId: order.id,
              action: ProductionOrderTimelineAction.STARTED,
              actorType: ProductionOrderTimelineActorType.USER,
              payload: {},
              createdBy: userId ?? null,
              createdByName,
            },
          }),
        );
      }
    }

    await this.prisma.$transaction(ops);

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

  // Trả về TOÀN BỘ xưởng đang hoạt động (kể cả xưởng chưa có phiếu nào —
  // hiện 0, dashboard rà soát mục "Xưởng sản xuất hiện tại"), sắp theo số
  // lượng Phiếu sản xuất (không huỷ) giảm dần — Dashboard tự lấy đầu danh
  // sách cho "nhiều việc nhất", cuối danh sách cho "ít việc nhất". Xưởng
  // isActive=false không hiện (đã ngưng hoạt động, không còn vai trò vận
  // hành để theo dõi trên Dashboard).
  async getBusyCenters() {
    const [centers, grouped] = await Promise.all([
      this.prisma.productionCenter.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.productionOrder.groupBy({
        by: ['productionCenterId'],
        where: { status: { not: ProductionOrderStatus.CANCELLED } },
        _count: { _all: true },
      }),
    ]);

    const countByCenterId = new Map(
      grouped.map((g) => [g.productionCenterId, g._count._all]),
    );

    return centers
      .map((c) => ({
        productionCenterId: c.id,
        productionCenterName: c.name,
        orderCount: countByCenterId.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.orderCount - a.orderCount);
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
        customerName: true,
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
        customerName: o.customerName,
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

  // Cảnh báo Phiếu SX trễ SLA (Dashboard Alerts, 026-cai-tien-dashboard.md
  // mục 3b) — hạn SX là Derived Data tính runtime = createdAt + N ngày
  // (Nguyên tắc 13 — không lưu field mới trên ProductionOrder). Không
  // hard-code số ngày — đọc Settings.Dashboard.productionOrderSlaDays nếu
  // caller không truyền.
  async getOverdueProductionOrders(slaDays?: number) {
    const days =
      slaDays ??
      (await this.settingService.getNumberValue(
        'Dashboard',
        'productionOrderSlaDays',
      ));
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    return this.prisma.productionOrder.findMany({
      where: {
        status: {
          in: [
            ProductionOrderStatus.PENDING,
            ProductionOrderStatus.IN_PRODUCTION,
          ],
        },
        createdAt: { lte: threshold },
      },
      select: {
        id: true,
        code: true,
        status: true,
        productionCenterName: true,
        createdAt: true,
        salesOrder: { select: { id: true, code: true, customerName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
