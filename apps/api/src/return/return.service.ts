import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  SalesOrderStatus,
  ReturnReason,
  ReturnStatus,
  RecoveryInventoryStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActorName } from '../shared/resolve-actor-name';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnQueryDto } from './dto/return-query.dto';
import { RecoveryInventoryQueryDto } from './dto/recovery-inventory-query.dto';
import { MarkUsedDto } from './dto/mark-used.dto';
import { UpdateRecoveryInventoryDto } from './dto/update-recovery-inventory.dto';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const RETURN_INCLUDE = {
  items: {
    include: { recoveryInventory: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ReturnInclude;

@Injectable()
export class ReturnService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────
  // Read API (Task 01) — Return
  // ─────────────────────────────────────────────────────

  async findAll(query: ReturnQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ReturnWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { salesOrderCode: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.salesOrderId) {
      where.salesOrderId = query.salesOrderId;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }

    const validStatuses = Object.values(ReturnStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as ReturnStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { items: true } } },
      }),
      this.prisma.return.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: RETURN_INCLUDE,
    });
    if (!ret) {
      throw new NotFoundException('Phiếu trả hàng không tồn tại.');
    }
    return ret;
  }

  // ─────────────────────────────────────────────────────
  // Action: Complete (Sprint 02 — return.md "Trạng thái Return")
  // ─────────────────────────────────────────────────────

  // Workflow một chiều PROCESSING → COMPLETED: chốt xong vụ việc với khách.
  // Không ảnh hưởng RecoveryInventory (tài sản thu hồi theo dõi độc lập),
  // không ảnh hưởng tài chính. Không có Action quay lại PROCESSING.
  async complete(id: string, userId?: string | null) {
    const ret = await this.findOne(id);

    if (ret.status !== ReturnStatus.PROCESSING) {
      throw new ForbiddenException(
        'Phiếu trả hàng đã hoàn tất xử lý — không thể thực hiện lại.',
      );
    }

    const completedByName = await resolveActorName(this.prisma, userId);

    return this.prisma.return.update({
      where: { id },
      data: {
        status: ReturnStatus.COMPLETED,
        completedBy: userId ?? null,
        completedByName,
        completedAt: new Date(),
      },
      include: RETURN_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────
  // Return Creation (Task 02) — Action duy nhất tạo Return
  // ─────────────────────────────────────────────────────

  async create(dto: CreateReturnDto) {
    if (!dto.salesOrderId) {
      throw new BadRequestException('Đơn hàng là bắt buộc.');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Phải chọn ít nhất một sản phẩm để trả.');
    }

    const salesOrder = await this.prisma.salesOrder.findUnique({
      where: { id: dto.salesOrderId },
      include: {
        items: {
          include: { parameters: { orderBy: { displayOrder: 'asc' } } },
        },
      },
    });

    if (!salesOrder) {
      throw new NotFoundException('Đơn hàng không tồn tại.');
    }
    if (salesOrder.status !== SalesOrderStatus.DELIVERED) {
      throw new ForbiddenException(
        `Chỉ có thể tạo phiếu trả hàng khi đơn hàng đã giao (DELIVERED). Trạng thái hiện tại: ${salesOrder.status}.`,
      );
    }

    const salesOrderItemMap = new Map(salesOrder.items.map((i) => [i.id, i]));
    const validReasons = Object.values(ReturnReason) as string[];

    // Gộp số lượng trả trong CÙNG request theo salesOrderItemId, để không bị
    // "lách" validate cộng dồn bằng cách tách nhiều dòng cùng salesOrderItemId
    // trong một lần gửi.
    const requestedByItem = new Map<string, number>();
    for (const item of dto.items) {
      if (!item.salesOrderItemId) {
        throw new BadRequestException(
          'salesOrderItemId là bắt buộc cho từng dòng trả hàng.',
        );
      }
      if (!item.returnedQuantity || item.returnedQuantity <= 0) {
        throw new BadRequestException('Số lượng trả phải lớn hơn 0.');
      }
      if (!item.reason || !validReasons.includes(item.reason)) {
        throw new BadRequestException(
          `Lý do trả hàng "${item.reason}" không hợp lệ.`,
        );
      }
      if (!salesOrderItemMap.has(item.salesOrderItemId)) {
        throw new NotFoundException(
          `Dòng sản phẩm "${item.salesOrderItemId}" không thuộc đơn hàng này.`,
        );
      }

      requestedByItem.set(
        item.salesOrderItemId,
        (requestedByItem.get(item.salesOrderItemId) ?? 0) +
          item.returnedQuantity,
      );
    }

    // Task 03 — Validate cộng dồn: SUM(ReturnItem.returnedQuantity) qua TẤT CẢ
    // Return trước đó + số lượng đang xin trả lần này <= SalesOrderItem.quantity.
    for (const [salesOrderItemId, requestedQuantity] of requestedByItem) {
      const alreadyReturned = await this.prisma.returnItem.aggregate({
        where: { salesOrderItemId },
        _sum: { returnedQuantity: true },
      });
      const orderedQuantity = Number(
        salesOrderItemMap.get(salesOrderItemId)!.quantity,
      );
      const totalAfter =
        Number(alreadyReturned._sum.returnedQuantity ?? 0) + requestedQuantity;

      if (totalAfter > orderedQuantity) {
        throw new BadRequestException(
          `Sản phẩm "${salesOrderItemMap.get(salesOrderItemId)!.productName}" chỉ còn được trả tối đa ${
            orderedQuantity - Number(alreadyReturned._sum.returnedQuantity ?? 0)
          } (đã đặt ${orderedQuantity}, đã trả trước đó ${alreadyReturned._sum.returnedQuantity ?? 0}).`,
        );
      }
    }

    // Giá trị phiếu hoàn (đã gồm VAT) — snapshot 1 lần tại đây, xem comment
    // Return.totalValue trong schema. Chỉ tham khảo, không tự động trừ Công nợ.
    let totalValue = 0;
    for (const item of dto.items) {
      const soItem = salesOrderItemMap.get(item.salesOrderItemId)!;
      const lineSubtotal = Math.round(
        Number(soItem.finalPrice) * item.returnedQuantity,
      );
      const lineVat = Math.round(
        (lineSubtotal * Number(soItem.vatRate)) / 100,
      );
      totalValue += lineSubtotal + lineVat;
    }

    return this.prisma.$transaction(async (tx) => {
      const running = await tx.runningNumber.update({
        where: { type: 'RETURN' },
        data: { lastNumber: { increment: 1 } },
      });
      const returnCode = `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;

      const ret = await tx.return.create({
        data: {
          code: returnCode,
          salesOrderId: salesOrder.id,
          salesOrderCode: salesOrder.code,
          customerId: salesOrder.customerId,
          customerName: salesOrder.customerName,
          returnDate: dto.returnDate ? new Date(dto.returnDate) : new Date(),
          receivedBy: dto.receivedBy?.trim() || null,
          note: dto.note?.trim() || null,
          totalValue,
        },
      });

      let recoverySeq = 0;
      for (const item of dto.items) {
        const soItem = salesOrderItemMap.get(item.salesOrderItemId)!;
        const productParameters = soItem.parameters.map((p) => ({
          name: p.name,
          label: p.label,
          value: p.value,
          unit: p.unit,
          displayOrder: p.displayOrder,
        }));

        const returnItem = await tx.returnItem.create({
          data: {
            returnId: ret.id,
            salesOrderItemId: soItem.id,
            productCode: soItem.productCode,
            productName: soItem.productName,
            productParameters,
            orderedQuantity: soItem.quantity,
            returnedQuantity: item.returnedQuantity,
            unitPriceSnapshot: soItem.finalPrice,
            vatRate: soItem.vatRate,
            reason: item.reason as ReturnReason,
            note: item.note?.trim() || null,
          },
        });

        // RecoveryInventory sinh tự động, cùng transaction — không có Running
        // Number riêng cho Recovery Inventory trong tài liệu, dùng mã Return
        // + số thứ tự dòng để đảm bảo duy nhất và vẫn truy vết được nguồn gốc.
        recoverySeq += 1;
        await tx.recoveryInventory.create({
          data: {
            code: `${returnCode}-${recoverySeq}`,
            returnItemId: returnItem.id,
            createdFromReturnCode: returnCode,
            productCode: soItem.productCode,
            productName: soItem.productName,
            productParameters,
            quantity: item.returnedQuantity,
            status: RecoveryInventoryStatus.AVAILABLE,
          },
        });
      }

      return tx.return.findUniqueOrThrow({
        where: { id: ret.id },
        include: RETURN_INCLUDE,
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Recovery Inventory — Read API (Task 04)
  // ─────────────────────────────────────────────────────

  async findAllRecoveryInventory(query: RecoveryInventoryQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.RecoveryInventoryWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { productCode: { contains: query.search, mode: 'insensitive' } },
        { productName: { contains: query.search, mode: 'insensitive' } },
        {
          createdFromReturnCode: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const validStatuses = Object.values(RecoveryInventoryStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as RecoveryInventoryStatus;
    }

    // Sắp xếp (rà soát bộ lọc Hàng hoàn, chốt 18/07/2026): mặc định createdAt
    // desc — cho phép đổi chiều để tìm hàng tồn kho thu hồi lâu ngày
    // (createdAt asc, xem "Hàng tồn lâu" ở Dashboard).
    const orderBy: Prisma.RecoveryInventoryOrderByWithRelationInput =
      query.sortBy === 'created_asc' ? { createdAt: 'asc' } : { createdAt: 'desc' };
    // 'created_desc' và giá trị mặc định đều dùng chung nhánh else (cùng kết quả).

    const [data, total] = await Promise.all([
      this.prisma.recoveryInventory.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.recoveryInventory.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneRecoveryInventory(id: string) {
    const item = await this.prisma.recoveryInventory.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('Hàng thu hồi không tồn tại.');
    }
    return item;
  }

  // ─────────────────────────────────────────────────────
  // Recovery Inventory — Workflow (Task 05)
  // Action Driven — cả hai chỉ thực hiện được khi status = AVAILABLE.
  // ─────────────────────────────────────────────────────

  async markUsed(id: string, dto: MarkUsedDto) {
    const item = await this.findOneRecoveryInventory(id);

    if (item.status !== RecoveryInventoryStatus.AVAILABLE) {
      throw new ForbiddenException(
        `Chỉ có thể đánh dấu đã sử dụng khi hàng đang ở trạng thái AVAILABLE. Trạng thái hiện tại: ${item.status}.`,
      );
    }

    return this.prisma.recoveryInventory.update({
      where: { id },
      data: {
        status: RecoveryInventoryStatus.USED,
        usedForNote: dto.usedForNote?.trim() || null,
      },
    });
  }

  async dispose(id: string) {
    const item = await this.findOneRecoveryInventory(id);

    if (item.status !== RecoveryInventoryStatus.AVAILABLE) {
      throw new ForbiddenException(
        `Chỉ có thể thanh lý khi hàng đang ở trạng thái AVAILABLE. Trạng thái hiện tại: ${item.status}.`,
      );
    }

    return this.prisma.recoveryInventory.update({
      where: { id },
      data: { status: RecoveryInventoryStatus.DISPOSED },
    });
  }

  // ─────────────────────────────────────────────────────
  // Recovery Inventory — Management (Task 06)
  // Chỉ sửa location/status/imageUrl — không sửa Snapshot
  // (productCode/productName/productParameters/quantity).
  // ─────────────────────────────────────────────────────

  async updateRecoveryInventory(id: string, dto: UpdateRecoveryInventoryDto) {
    await this.findOneRecoveryInventory(id);

    const data: Prisma.RecoveryInventoryUpdateInput = {};

    if (dto.location !== undefined) {
      data.location = dto.location?.trim() || null;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl?.trim() || null;
    }
    if (dto.status !== undefined) {
      const validStatuses = Object.values(RecoveryInventoryStatus) as string[];
      if (!validStatuses.includes(dto.status)) {
        throw new BadRequestException(
          `Trạng thái "${dto.status}" không hợp lệ.`,
        );
      }
      data.status = dto.status as RecoveryInventoryStatus;
    }

    return this.prisma.recoveryInventory.update({ where: { id }, data });
  }

  // ─────────────────────────────────────────────────────
  // Dashboard Integration (Task 07) — Dashboard chỉ gọi qua Service này,
  // không tự viết Prisma query.
  // ─────────────────────────────────────────────────────

  async getDashboardSummary(monthStart: Date = this.startOfMonth()) {
    const [monthReturns, monthItems, valueAgg, availableCount, availableAgg] =
      await Promise.all([
        this.prisma.return.count({
          where: { returnDate: { gte: monthStart } },
        }),
        this.prisma.returnItem.findMany({
          where: { return: { returnDate: { gte: monthStart } } },
          select: { returnedQuantity: true },
        }),
        this.prisma.returnItem.findMany({
          where: { return: { returnDate: { gte: monthStart } } },
          select: { returnedQuantity: true, unitPriceSnapshot: true },
        }),
        this.prisma.recoveryInventory.count({
          where: { status: RecoveryInventoryStatus.AVAILABLE },
        }),
        this.prisma.recoveryInventory.aggregate({
          where: { status: RecoveryInventoryStatus.AVAILABLE },
          _sum: { quantity: true },
        }),
      ]);

    const totalProductsReturned = monthItems.reduce(
      (s, i) => s + Number(i.returnedQuantity),
      0,
    );
    const returnValue = valueAgg.reduce(
      (s, i) => s + Number(i.returnedQuantity) * Number(i.unitPriceSnapshot),
      0,
    );

    return {
      returnsThisMonth: monthReturns,
      totalProductsReturnedThisMonth: totalProductsReturned,
      returnValueThisMonth: returnValue,
      availableRecoveryCount: availableCount,
      availableRecoveryQuantity: Number(availableAgg._sum.quantity ?? 0),
    };
  }

  async getAgingRecoveryInventory() {
    const available = await this.prisma.recoveryInventory.findMany({
      where: { status: RecoveryInventoryStatus.AVAILABLE },
      select: { id: true, createdAt: true },
    });

    const now = Date.now();
    let over30 = 0;
    let over90 = 0;
    for (const item of available) {
      const daysInStock = Math.floor(
        (now - item.createdAt.getTime()) / MS_PER_DAY,
      );
      if (daysInStock > 90) over90 += 1;
      if (daysInStock > 30) over30 += 1;
    }

    return { over30Days: over30, over90Days: over90 };
  }

  async getTopReturnReasons() {
    const grouped = await this.prisma.returnItem.groupBy({
      by: ['reason'],
      _sum: { returnedQuantity: true },
      _count: { _all: true },
    });

    const totalCount = grouped.reduce((s, g) => s + g._count._all, 0);

    return grouped
      .map((g) => ({
        reason: g.reason,
        count: g._count._all,
        returnedQuantity: Number(g._sum.returnedQuantity ?? 0),
        percent:
          totalCount > 0 ? Math.round((g._count._all / totalCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getReturnsByCustomer(limit = 10) {
    const grouped = await this.prisma.return.groupBy({
      by: ['customerId', 'customerName'],
      _count: { _all: true },
      orderBy: { _count: { customerId: 'desc' } },
      take: limit,
    });

    return grouped.map((g) => ({
      customerId: g.customerId,
      customerName: g.customerName,
      returnCount: g._count._all,
    }));
  }

  private startOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
