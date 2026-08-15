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
import { SettingService } from '../setting/setting.service';
import { PermissionService } from '../permission/permission.service';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { OverrideSalesOrderDto } from './dto/override-sales-order.dto';
import { CancelSalesOrderDto } from './dto/cancel-sales-order.dto';
import { UpdateDeliveryAddressDto } from './dto/update-delivery-address.dto';
import { UpdateCarrierInfoDto } from './dto/update-carrier-info.dto';
import { ExportSalesOrderQueryDto } from './dto/export-sales-order-query.dto';
import { resolveActorName } from '../shared/resolve-actor-name';
import type {
  GroupedExcelColumn,
  ExcelExportGroup,
} from '../shared/excel/excel.service';
import {
  bucketDate,
  buildSeries,
  previousRange,
  type ReportGroupBy,
} from '../shared/report-range';

// Nhãn tiếng Việt cho export Excel — trùng nội dung với report.service.ts
// (SALES_ORDER_STATUS_LABELS/PAYMENT_STATUS_LABELS), nhưng KHÔNG import
// chéo được vì report.service.ts đã import ngược lại SalesOrderService
// (import từ đó sẽ tạo circular dependency).
const EXPORT_STATUS_LABELS: Record<string, string> = {
  IN_PRODUCTION: 'Đang sản xuất',
  PRODUCTION_COMPLETED: 'Hoàn thành sản xuất',
  SHIPPED: 'Đã gửi xe',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
};

const EXPORT_PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
};

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
  // Task 01 (004-fe-don-hang.md) — expose id báo giá gốc để FE link chéo
  // Order → Quotation. Chỉ đọc thêm, không đổi Business Rule/Snapshot.
  quotation: { select: { id: true } },
} satisfies Prisma.SalesOrderInclude;

@Injectable()
export class SalesOrderService {
  constructor(
    private readonly prisma: PrismaService,
    // Report methods cần Settings.Company.timezone để cắt kỳ (report.md mục
    // "Nguyên tắc mốc ngày") — cùng pattern DebtService đã inject SettingService.
    private readonly settingService: SettingService,
    private readonly permissionService: PermissionService,
  ) {}

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

    if (query.ownerId) {
      where.ownerId = query.ownerId;
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

  // Nhân viên tự xuất Excel đơn hàng của mình — ownerId bỏ trống = chính
  // actorUserId. Vai trò có sales-order.export-all mới được xem theo người
  // khác/'all' (check ở đây vì @RequirePermission chỉ nhận 1 key tĩnh, không
  // tự phân biệt được theo query param).
  private async resolveExportOwnerId(
    actorUserId: string,
    actorRoleId: string | undefined,
    requestedOwnerId: string | undefined,
  ): Promise<string> {
    if (!requestedOwnerId || requestedOwnerId === actorUserId) {
      return actorUserId;
    }
    if (!actorRoleId) {
      throw new ForbiddenException('Không xác định được quyền của người dùng.');
    }
    const canExportAll = await this.permissionService.hasPermission(
      actorRoleId,
      'sales-order.export-all',
    );
    if (!canExportAll) {
      throw new ForbiddenException(
        'Không có quyền xem/xuất đơn hàng của người khác.',
      );
    }
    return requestedOwnerId;
  }

  // Danh sách nhân viên để FE dựng dropdown "Người phụ trách" (bộ lọc trang
  // Đơn hàng + xuất Excel) — chỉ trả id/name (không phải GET /users, vốn yêu
  // cầu permission user.view mà kế toán trưởng hiện KHÔNG có).
  async listExportOwners() {
    const users = await this.prisma.user.findMany({
      where: { role: { rolePermissions: { some: { permission: { key: 'sales-order.export' } } } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return users;
  }

  async exportOrders(
    actorUserId: string,
    actorRoleId: string | undefined,
    query: ExportSalesOrderQueryDto,
  ): Promise<{
    groupColumns: GroupedExcelColumn[];
    itemColumns: GroupedExcelColumn[];
    groups: ExcelExportGroup[];
    from: Date;
    to: Date;
  }> {
    const targetOwnerId = await this.resolveExportOwnerId(
      actorUserId,
      actorRoleId,
      query.ownerId,
    );

    const to = query.to ? new Date(`${query.to}T23:59:59.999`) : new Date();
    const from = query.from
      ? new Date(`${query.from}T00:00:00`)
      : new Date(to.getFullYear(), to.getMonth() - 12, to.getDate());

    const where: Prisma.SalesOrderWhereInput = {
      createdAt: { gte: from, lte: to },
    };
    if (targetOwnerId !== 'all') {
      where.ownerId = targetOwnerId;
    }

    // Cùng field/logic search với findAll() — Excel xuất đúng bộ lọc đang
    // xem trên trang, không phải 1 query độc lập.
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { customerPhone: { contains: query.search } },
        { quotationCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.deliveryFrom || query.deliveryTo) {
      where.expectedDeliveryDate = {
        ...(query.deliveryFrom && { gte: new Date(`${query.deliveryFrom}T00:00:00`) }),
        ...(query.deliveryTo && { lte: new Date(`${query.deliveryTo}T23:59:59.999`) }),
      };
    }

    const validStatuses = Object.values(SalesOrderStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as SalesOrderStatus;
    } else {
      // Mặc định loại CANCELLED — cùng convention reportRangeWhere() bên dưới.
      where.status = { not: SalesOrderStatus.CANCELLED };
    }

    const orders = await this.prisma.salesOrder.findMany({
      where,
      include: {
        items: {
          include: { parameters: { orderBy: { displayOrder: 'asc' } } },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const groupColumns: GroupedExcelColumn[] = [
      { header: 'Mã đơn', key: 'code', width: 14 },
      { header: 'Mã báo giá', key: 'quotationCode', width: 14 },
      { header: 'Khách hàng', key: 'customerName', width: 24 },
      { header: 'SĐT', key: 'customerPhone', width: 14, numFmt: '@' },
      { header: 'Ngày tạo', key: 'createdAt', width: 14 },
      { header: 'Trạng thái đơn', key: 'statusLabel', width: 18 },
      { header: 'Trạng thái thanh toán', key: 'paymentStatusLabel', width: 20 },
      { header: 'Người phụ trách', key: 'ownerName', width: 20 },
      { header: 'Tổng tiền đơn', key: 'grandTotal', width: 16 },
    ];
    const itemColumns: GroupedExcelColumn[] = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Sản phẩm / Vật tư', key: 'itemName', width: 30 },
      { header: 'Mã', key: 'itemCode', width: 14 },
      { header: 'Thông số', key: 'params', width: 40 },
      { header: 'Số lượng', key: 'quantity', width: 10 },
      { header: 'Đơn giá', key: 'finalPrice', width: 14 },
      { header: 'Thành tiền', key: 'subtotal', width: 14 },
      { header: 'VAT', key: 'vatAmount', width: 12 },
    ];

    const groups: ExcelExportGroup[] = orders.map((order) => ({
      data: {
        code: order.code,
        quotationCode: order.quotationCode,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        createdAt: order.createdAt.toLocaleDateString('vi-VN'),
        statusLabel: EXPORT_STATUS_LABELS[order.status] ?? order.status,
        paymentStatusLabel:
          EXPORT_PAYMENT_STATUS_LABELS[order.paymentStatus] ??
          order.paymentStatus,
        ownerName: order.ownerName ?? 'Không xác định',
        grandTotal: Number(order.grandTotal),
      },
      items: order.items.map((item, idx) => ({
        stt: idx + 1,
        itemName: item.productName ?? item.materialName ?? '',
        itemCode: item.productCode ?? item.materialCode ?? '',
        params: item.parameters
          .map(
            (p) =>
              `${p.label}: ${p.valueLabel ?? p.value}${p.unit ? ' ' + p.unit : ''}`,
          )
          .join('\n'),
        quantity: Number(item.quantity),
        finalPrice: Number(item.finalPrice),
        subtotal: Number(item.subtotal),
        vatAmount: Number(item.vatAmount),
      })),
    }));

    return { groupColumns, itemColumns, groups, from, to };
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Ship / Deliver (Task 04)
  // Action Driven — không cho phép sửa status trực tiếp.
  // ─────────────────────────────────────────────────────

  async ship(id: string, userId?: string | null) {
    const salesOrder = await this.findOne(id);

    if (salesOrder.status !== SalesOrderStatus.PRODUCTION_COMPLETED) {
      throw new ForbiddenException(
        `Chỉ có thể gửi xe khi đơn hàng đã hoàn thành sản xuất. Trạng thái hiện tại: ${salesOrder.status}.`,
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

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
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  async deliver(id: string, userId?: string | null) {
    const salesOrder = await this.findOne(id);

    if (salesOrder.status !== SalesOrderStatus.SHIPPED) {
      throw new ForbiddenException(
        `Chỉ có thể xác nhận khách đã nhận hàng khi đơn hàng đã được gửi xe. Trạng thái hiện tại: ${salesOrder.status}.`,
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

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
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Địa chỉ giao hàng (009-in-phieu-san-xuat.md) — không phải Manual
  // Override: không đổi Status, không bắt buộc lý do, sửa được ở mọi Status.
  // Ghi Timeline (cũ → mới) để không sửa dữ liệu âm thầm.
  // ─────────────────────────────────────────────────────

  async updateDeliveryAddress(
    id: string,
    dto: UpdateDeliveryAddressDto,
    userId?: string | null,
  ) {
    if (!dto.deliveryName?.trim()) {
      throw new BadRequestException('Tên người nhận hàng là bắt buộc.');
    }

    const salesOrder = await this.findOne(id);

    const oldValue = {
      deliveryName: salesOrder.deliveryName,
      deliveryPhone: salesOrder.deliveryPhone,
      deliveryAddress: salesOrder.deliveryAddress,
      deliveryProvince: salesOrder.deliveryProvince,
      deliveryDistrict: salesOrder.deliveryDistrict,
      deliveryWard: salesOrder.deliveryWard,
    };
    const newValue = {
      deliveryName: dto.deliveryName.trim(),
      deliveryPhone: dto.deliveryPhone.trim(),
      deliveryAddress: dto.deliveryAddress?.trim() || null,
      deliveryProvince: dto.deliveryProvince?.trim() || null,
      deliveryDistrict: dto.deliveryDistrict?.trim() || null,
      deliveryWard: dto.deliveryWard?.trim() || null,
    };

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: newValue,
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: id,
          action: SalesOrderTimelineAction.DELIVERY_ADDRESS_UPDATED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: { old: oldValue, new: newValue },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Thông tin nhà xe (009-in-phieu-san-xuat.md) — cùng cơ chế với
  // updateDeliveryAddress(): không phải Manual Override, không đổi Status,
  // không bắt buộc lý do, sửa được ở mọi Status. Khác nhóm dữ liệu: nhà xe
  // chở hàng, không phải người/nơi nhận hàng — không có field nào bắt buộc
  // (không có nguồn Master Data để auto-copy, nhập tay khi đã sắp xe).
  // ─────────────────────────────────────────────────────

  async updateCarrierInfo(
    id: string,
    dto: UpdateCarrierInfoDto,
    userId?: string | null,
  ) {
    const salesOrder = await this.findOne(id);

    const oldValue = {
      carrierName: salesOrder.carrierName,
      carrierPhone: salesOrder.carrierPhone,
      carrierNote: salesOrder.carrierNote,
    };
    const newValue = {
      carrierName: dto.carrierName?.trim() || null,
      carrierPhone: dto.carrierPhone?.trim() || null,
      carrierNote: dto.carrierNote?.trim() || null,
    };

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id },
        data: newValue,
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: id,
          action: SalesOrderTimelineAction.CARRIER_INFO_UPDATED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: { old: oldValue, new: newValue },
          createdBy: userId ?? null,
          createdByName,
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

  async override(
    id: string,
    dto: OverrideSalesOrderDto,
    userId?: string | null,
  ) {
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

    const createdByName = await resolveActorName(this.prisma, userId);

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
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: SALES_ORDER_INCLUDE,
      });
    });
  }

  async cancel(id: string, dto: CancelSalesOrderDto, userId?: string | null) {
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

    // Quyết định 05/07/2026 (order.md "Huỷ đơn đã thu cọc" + debt.md): cho
    // phép Cancel kể cả khi đã thu cọc — rule cũ chặn paidAmount > 0 tạo
    // deadlock vì V1 không có Refund. Receivable/Payment giữ nguyên; công nợ
    // mở tự loại đơn CANCELLED theo rule lọc status sẵn có. Hoàn tiền thực
    // hiện ngoài hệ thống, ghi dấu vết ở Timeline payload bên dưới.
    const paidAmount = Number(salesOrder.receivable?.paidAmount ?? 0);

    const startedProductionOrders = salesOrder.productionOrders.filter((po) =>
      STARTED_PRODUCTION_STATUSES.includes(po.status),
    );
    if (startedProductionOrders.length > 0) {
      throw new ForbiddenException(
        'Không thể huỷ đơn hàng vì đã có Phiếu sản xuất bắt đầu sản xuất.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

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
          // paidAmount/refundNote chỉ thêm khi đơn đã có tiền cọc (order.md
          // "Huỷ đơn đã thu cọc") — dấu vết đối chiếu hoàn tiền ngoài ERP.
          payload: {
            fromStatus: salesOrder.status,
            reason: dto.reason.trim(),
            ...(paidAmount > 0
              ? { paidAmount, refundNote: 'Refund handled outside ERP' }
              : {}),
          },
          createdBy: userId ?? null,
          createdByName,
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

  // range (026/027-cai-tien-dashboard.md — khối Kinh doanh giờ có bộ lọc
  // riêng, mặc định "Hôm nay") — khi truyền, tính lại theo đúng createdAt
  // trong khoảng đã chọn thay vì all-time. Không truyền = all-time (giữ
  // tương thích ngược cho nơi khác đang gọi không range).
  async getDashboardSummary(range?: { from?: Date; to?: Date }) {
    const dateFilter: Prisma.DateTimeFilter | undefined =
      range?.from || range?.to
        ? {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          }
        : undefined;
    const notCancelled: Prisma.SalesOrderWhereInput = {
      status: { not: SalesOrderStatus.CANCELLED },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    const [totals, statusCounts] = await Promise.all([
      this.prisma.salesOrder.aggregate({
        where: notCancelled,
        _sum: { totalAmount: true, plannedCost: true, plannedProfit: true },
      }),
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        _count: { _all: true },
      }),
    ]);

    const countByStatus = new Map(
      statusCounts.map((s) => [s.status, s._count._all]),
    );

    return {
      totalRevenue: Number(totals._sum.totalAmount ?? 0),
      totalPlannedCost: Number(totals._sum.plannedCost ?? 0),
      totalPlannedProfit: Number(totals._sum.plannedProfit ?? 0),
      inProduction: countByStatus.get(SalesOrderStatus.IN_PRODUCTION) ?? 0,
      productionCompleted:
        countByStatus.get(SalesOrderStatus.PRODUCTION_COMPLETED) ?? 0,
      delivered: countByStatus.get(SalesOrderStatus.DELIVERED) ?? 0,
    };
  }

  async getStatistics() {
    const [byStatus, byPaymentStatus] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.salesOrder.groupBy({
        by: ['paymentStatus'],
        _count: { _all: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
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
        status: {
          notIn: [SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED],
        },
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

  // Dải tổng hợp "Hôm nay" (Dashboard, 026-cai-tien-dashboard.md mục 5) —
  // luôn tính đúng khoảng "hôm nay" do DashboardService truyền vào, KHÔNG
  // theo bộ lọc đầu trang Dashboard (khác getDashboardSummary() vốn all-time,
  // và khác các khối Sản xuất/Hàng hoàn có range riêng theo bộ lọc). "Đơn đã
  // giao xe" đọc qua SalesOrderTimeline action SHIPPED — SalesOrder không có
  // cột shippedAt riêng.
  async getTodaySummary(range: { from: Date; to: Date }) {
    const [newOrders, shippedTimelines] = await Promise.all([
      this.prisma.salesOrder.count({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          status: { not: SalesOrderStatus.CANCELLED },
        },
      }),
      this.prisma.salesOrderTimeline.findMany({
        where: {
          action: SalesOrderTimelineAction.SHIPPED,
          createdAt: { gte: range.from, lte: range.to },
        },
        select: { salesOrderId: true },
        distinct: ['salesOrderId'],
      }),
    ]);

    return { newOrders, shippedOrders: shippedTimelines.length };
  }

  // ─────────────────────────────────────────────────────
  // Report (Module Báo cáo, 014-bao-cao.md Task 00) — chỉ đọc theo kỳ, không
  // Business Logic mới. Mốc ngày: SalesOrder.createdAt (report.md "Nguyên tắc
  // mốc ngày"). Mọi method loại SalesOrder.status = CANCELLED.
  // ─────────────────────────────────────────────────────

  // Helper loại trừ CANCELLED + lọc kỳ — dùng chung cho toàn bộ report method
  // (đặt tại SalesOrderService theo đúng Task 00, không đặt ở Report).
  private reportRangeWhere(from: Date, to: Date): Prisma.SalesOrderWhereInput {
    return {
      status: { not: SalesOrderStatus.CANCELLED },
      createdAt: { gte: from, lte: to },
    };
  }

  private async getCompanyTimezone(): Promise<string> {
    try {
      const company = await this.settingService.getCompany();
      return company.timezone;
    } catch {
      return 'Asia/Ho_Chi_Minh';
    }
  }

  // A1 + B3 — tổng doanh thu kỳ này, so sánh kỳ trước, chuỗi theo groupBy.
  async getRevenueReport(from: Date, to: Date, groupBy: ReportGroupBy = 'day') {
    const timezone = await this.getCompanyTimezone();
    const prev = previousRange(from, to);

    const [rows, previousAgg] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: this.reportRangeWhere(from, to),
        select: { createdAt: true, totalAmount: true },
      }),
      this.prisma.salesOrder.aggregate({
        where: this.reportRangeWhere(prev.from, prev.to),
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    const totalRevenue = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
    const previousRevenue = Number(previousAgg._sum.totalAmount ?? 0);

    return {
      totalRevenue,
      orderCount: rows.length,
      previousPeriod: {
        from: prev.from,
        to: prev.to,
        totalRevenue: previousRevenue,
        orderCount: previousAgg._count._all,
      },
      // Derived, tính runtime — null khi kỳ trước không có doanh thu.
      growthPercent:
        previousRevenue > 0
          ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
          : null,
      series: buildSeries(
        rows.map((r) => ({
          date: r.createdAt,
          values: { revenue: Number(r.totalAmount), orderCount: 1 },
        })),
        from,
        to,
        timezone,
        groupBy,
        ['revenue', 'orderCount'],
      ),
    };
  }

  // A3 + B3 — lợi nhuận KẾ HOẠCH (plannedProfit đã chốt tại Approve, không
  // tính lại Pricing/BOM). Tỷ suất là Derived, tính runtime, không lưu.
  async getProfitReport(from: Date, to: Date, groupBy: ReportGroupBy = 'day') {
    const timezone = await this.getCompanyTimezone();
    const prev = previousRange(from, to);

    const [rows, previousAgg] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: this.reportRangeWhere(from, to),
        select: {
          createdAt: true,
          totalAmount: true,
          plannedCost: true,
          plannedProfit: true,
        },
      }),
      this.prisma.salesOrder.aggregate({
        where: this.reportRangeWhere(prev.from, prev.to),
        _sum: { plannedProfit: true },
      }),
    ]);

    const totalRevenue = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
    const totalPlannedCost = rows.reduce(
      (s, r) => s + Number(r.plannedCost),
      0,
    );
    const totalPlannedProfit = rows.reduce(
      (s, r) => s + Number(r.plannedProfit),
      0,
    );
    const previousPlannedProfit = Number(previousAgg._sum.plannedProfit ?? 0);

    return {
      // Nhãn hiển thị bắt buộc "Lợi nhuận kế hoạch" (report.md) — field đặt
      // tên planned* để FE không thể hiểu nhầm là lãi thực tế.
      totalRevenue,
      totalPlannedCost,
      totalPlannedProfit,
      plannedProfitMarginPercent:
        totalRevenue > 0 ? (totalPlannedProfit / totalRevenue) * 100 : null,
      previousPeriod: {
        from: prev.from,
        to: prev.to,
        totalPlannedProfit: previousPlannedProfit,
      },
      growthPercent:
        previousPlannedProfit > 0
          ? ((totalPlannedProfit - previousPlannedProfit) /
              previousPlannedProfit) *
            100
          : null,
      series: buildSeries(
        rows.map((r) => ({
          date: r.createdAt,
          values: {
            revenue: Number(r.totalAmount),
            plannedCost: Number(r.plannedCost),
            plannedProfit: Number(r.plannedProfit),
          },
        })),
        from,
        to,
        timezone,
        groupBy,
        ['revenue', 'plannedCost', 'plannedProfit'],
      ),
    };
  }

  // B1 — số đơn theo status/paymentStatus, giá trị trung bình, đúng hạn/trễ hạn.
  async getOrdersReport(from: Date, to: Date) {
    const where = this.reportRangeWhere(from, to);

    const [totals, byStatus, byPaymentStatus, deliveryRows] = await Promise.all(
      [
        this.prisma.salesOrder.aggregate({
          where,
          _sum: { totalAmount: true },
          _avg: { totalAmount: true },
          _count: { _all: true },
        }),
        this.prisma.salesOrder.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.salesOrder.groupBy({
          by: ['paymentStatus'],
          where,
          _count: { _all: true },
        }),
        // Đúng hạn/trễ hạn: chỉ tính đơn đã có đủ 2 ngày (Derived, runtime —
        // report.md B1), không lưu.
        this.prisma.salesOrder.findMany({
          where: {
            ...where,
            expectedDeliveryDate: { not: null },
            actualDeliveryDate: { not: null },
          },
          select: { expectedDeliveryDate: true, actualDeliveryDate: true },
        }),
      ],
    );

    const onTime = deliveryRows.filter(
      (r) => r.actualDeliveryDate! <= r.expectedDeliveryDate!,
    ).length;

    return {
      totalOrders: totals._count._all,
      totalValue: Number(totals._sum.totalAmount ?? 0),
      averageOrderValue: Number(totals._avg.totalAmount ?? 0),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      byPaymentStatus: byPaymentStatus.map((s) => ({
        paymentStatus: s.paymentStatus,
        count: s._count._all,
      })),
      delivery: {
        evaluated: deliveryRows.length,
        onTime,
        late: deliveryRows.length - onTime,
        onTimePercent:
          deliveryRows.length > 0 ? (onTime / deliveryRows.length) * 100 : null,
      },
    };
  }

  // B2 — group theo SalesOrderItem.productId (Redundant Reference bất biến),
  // hiển thị productName snapshot — không join ngược Product (Snapshot Rule).
  // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — loại dòng MATERIAL khỏi
  // báo cáo doanh thu theo sản phẩm (productId luôn null ở dòng MATERIAL).
  async getRevenueByProduct(from: Date, to: Date) {
    const itemWhere: Prisma.SalesOrderItemWhereInput = {
      itemType: 'PRODUCT',
      salesOrder: this.reportRangeWhere(from, to),
    };

    const [grouped, names] = await Promise.all([
      this.prisma.salesOrderItem.groupBy({
        by: ['productId'],
        where: itemWhere,
        _sum: { subtotal: true, quantity: true },
        _count: { _all: true },
      }),
      // Tên hiển thị: snapshot mới nhất trên chính SalesOrderItem trong kỳ
      // (distinct + orderBy desc) — không đọc lại Master Data.
      this.prisma.salesOrderItem.findMany({
        where: itemWhere,
        distinct: ['productId'],
        orderBy: { createdAt: 'desc' },
        select: { productId: true, productCode: true, productName: true },
      }),
    ]);

    const nameMap = new Map(names.map((n) => [n.productId, n]));
    const totalRevenue = grouped.reduce(
      (s, g) => s + Number(g._sum.subtotal ?? 0),
      0,
    );

    return {
      totalRevenue,
      products: grouped
        .map((g) => ({
          productId: g.productId,
          productCode: nameMap.get(g.productId)?.productCode ?? '',
          productName: nameMap.get(g.productId)?.productName ?? '',
          quantity: Number(g._sum.quantity ?? 0),
          lineCount: g._count._all,
          revenue: Number(g._sum.subtotal ?? 0),
          revenuePercent:
            totalRevenue > 0
              ? (Number(g._sum.subtotal ?? 0) / totalRevenue) * 100
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  // B4 — group theo productTypeId/productTypeName snapshot + theo kỳ
  // (tuần/tháng/năm — page 026-tang-truong-nhom-sp cho chọn, mặc định tháng).
  async getGrowthByProductType(
    from: Date,
    to: Date,
    groupBy: ReportGroupBy = 'month',
  ) {
    const timezone = await this.getCompanyTimezone();

    // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — báo cáo B4 nhóm theo
    // Loại sản phẩm, không áp dụng cho dòng MATERIAL (không có productTypeId).
    const rows = await this.prisma.salesOrderItem.findMany({
      where: {
        itemType: 'PRODUCT',
        salesOrder: this.reportRangeWhere(from, to),
      },
      select: {
        productTypeId: true,
        productTypeName: true,
        subtotal: true,
        salesOrder: { select: { createdAt: true } },
      },
    });

    type TypeAcc = {
      productTypeId: string;
      productTypeName: string;
      revenue: number;
      byPeriod: Map<string, number>;
    };
    const byType = new Map<string, TypeAcc>();
    const periods = new Set<string>();

    for (const row of rows) {
      const productTypeId = row.productTypeId!;
      const period = bucketDate(row.salesOrder.createdAt, timezone, groupBy);
      periods.add(period);
      let acc = byType.get(productTypeId);
      if (!acc) {
        acc = {
          productTypeId,
          productTypeName: row.productTypeName!,
          revenue: 0,
          byPeriod: new Map(),
        };
        byType.set(productTypeId, acc);
      }
      // Nhãn hiển thị: snapshot gặp sau cùng — vẫn là snapshot, không đọc
      // lại ProductType.
      acc.productTypeName = row.productTypeName!;
      acc.revenue += Number(row.subtotal);
      acc.byPeriod.set(
        period,
        (acc.byPeriod.get(period) ?? 0) + Number(row.subtotal),
      );
    }

    const sortedPeriods = Array.from(periods).sort();

    return {
      groupBy,
      periods: sortedPeriods,
      productTypes: Array.from(byType.values())
        .map((t) => ({
          productTypeId: t.productTypeId,
          productTypeName: t.productTypeName,
          revenue: t.revenue,
          byPeriod: sortedPeriods.map((p) => ({
            period: p,
            revenue: t.byPeriod.get(p) ?? 0,
          })),
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  // C1 — group theo ownerId (FK bất biến), hiển thị ownerName snapshot —
  // không group theo chuỗi tên tự do (report.md C1).
  async getRevenueByEmployee(from: Date, to: Date) {
    const where = this.reportRangeWhere(from, to);

    const [grouped, names] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['ownerId'],
        where,
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.salesOrder.findMany({
        where,
        distinct: ['ownerId'],
        orderBy: { createdAt: 'desc' },
        select: { ownerId: true, ownerName: true },
      }),
    ]);

    const nameMap = new Map(names.map((n) => [n.ownerId, n.ownerName]));
    const totalRevenue = grouped.reduce(
      (s, g) => s + Number(g._sum.totalAmount ?? 0),
      0,
    );

    return {
      totalRevenue,
      employees: grouped
        .map((g) => ({
          ownerId: g.ownerId,
          // null = đơn trước Architecture Review 05/07/2026, không xác định
          // được người phụ trách.
          ownerName: g.ownerId ? (nameMap.get(g.ownerId) ?? null) : null,
          orderCount: g._count._all,
          revenue: Number(g._sum.totalAmount ?? 0),
          revenuePercent:
            totalRevenue > 0
              ? (Number(g._sum.totalAmount ?? 0) / totalRevenue) * 100
              : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  // C2 (phần Sales Order) — group theo customerId: tổng đơn, tổng doanh thu,
  // lần mua đầu/gần nhất. Khách mới trong kỳ do CustomerService cung cấp,
  // công nợ hiện tại do DebtService cung cấp — ReportService tự gộp.
  async getRevenueByCustomer(from: Date, to: Date) {
    const where = this.reportRangeWhere(from, to);

    const [grouped, names] = await Promise.all([
      this.prisma.salesOrder.groupBy({
        by: ['customerId'],
        where,
        _sum: { totalAmount: true },
        _count: { _all: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      this.prisma.salesOrder.findMany({
        where,
        distinct: ['customerId'],
        orderBy: { createdAt: 'desc' },
        select: { customerId: true, customerName: true, customerPhone: true },
      }),
    ]);

    const nameMap = new Map(names.map((n) => [n.customerId, n]));
    const totalRevenue = grouped.reduce(
      (s, g) => s + Number(g._sum.totalAmount ?? 0),
      0,
    );

    return {
      totalRevenue,
      customers: grouped
        .map((g) => ({
          customerId: g.customerId,
          customerName: nameMap.get(g.customerId)?.customerName ?? '',
          customerPhone: nameMap.get(g.customerId)?.customerPhone ?? '',
          orderCount: g._count._all,
          revenue: Number(g._sum.totalAmount ?? 0),
          firstOrderAt: g._min.createdAt,
          lastOrderAt: g._max.createdAt,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  // ─────────────────────────────────────────────────────
  // Xuất dữ liệu backup (report.md mục "Xuất dữ liệu backup") — liệt kê
  // TOÀN BỘ SalesOrder trong kỳ, KHÔNG loại CANCELLED (khác Quy tắc loại trừ
  // áp dụng cho 14 báo cáo phân tích) — mục đích là bản sao đầy đủ dữ liệu,
  // thiếu đơn đã huỷ là backup không đầy đủ.
  // ─────────────────────────────────────────────────────

  async getAllOrdersRaw(from: Date, to: Date) {
    return this.prisma.salesOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      select: {
        code: true,
        quotationCode: true,
        customerName: true,
        customerPhone: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        totalVatAmount: true,
        discountAmount: true,
        shippingFee: true,
        grandTotal: true,
        plannedCost: true,
        plannedProfit: true,
        ownerName: true,
        expectedDeliveryDate: true,
        actualDeliveryDate: true,
        createdAt: true,
      },
    });
  }
}
