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
import { retryOnCodeConflict } from '../shared/retry-on-code-conflict';
import { findMatchingIds, unaccentLike } from '../shared/unaccent-search';
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
  // Nút dự phòng "Điều chỉnh giảm công nợ" trên trang chi tiết Return (rà
  // soát nghiệp vụ Return, 27/08/2026) — cần receivableId để gọi
  // POST /receivables/:id/manual-adjustment, và remainingAmount để FE giới
  // hạn số tiền nhập trong dialog.
  salesOrder: {
    select: {
      receivable: { select: { id: true, remainingAmount: true } },
    },
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
      // Tìm không phân biệt dấu tiếng Việt — giữ nguyên đúng 3 field đang
      // tìm (mã hoàn/mã ĐH/tên KH), chỉ đổi cách so khớp.
      where.id = {
        in: await findMatchingIds(
          this.prisma,
          Prisma.sql`SELECT id FROM returns WHERE ${unaccentLike(Prisma.sql`code`, query.search)}
            OR ${unaccentLike(Prisma.sql`sales_order_code`, query.search)}
            OR ${unaccentLike(Prisma.sql`customer_name`, query.search)}`,
        ),
      };
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
    return this.attachDebtAdjustmentSummary(ret);
  }

  // Return không tự lưu debtAdjustedAt/Amount/ByName nữa (sửa 27/08/2026) —
  // SUM/query lại từ DebtAdjustment (nguồn gốc thật, xem comment model trong
  // schema.prisma), trả về 3 field cùng tên như trước để FE không phải đổi.
  // debtAdjustedAmount = tổng cộng dồn qua mọi lần, debtAdjustedAt/ByName =
  // của lần gần nhất. NULL cả 3 nếu chưa từng giảm trừ.
  private async attachDebtAdjustmentSummary<T extends { id: string }>(ret: T) {
    const adjustments = await this.prisma.debtAdjustment.findMany({
      where: { returnId: ret.id },
      orderBy: { createdAt: 'desc' },
    });
    const debtAdjustedAmount =
      adjustments.length > 0
        ? adjustments.reduce((sum, a) => sum + Number(a.amount), 0)
        : null;
    return {
      ...ret,
      debtAdjustedAt: adjustments[0]?.createdAt ?? null,
      debtAdjustedAmount,
      debtAdjustedByName: adjustments[0]?.createdByName ?? null,
    };
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

    const updated = await this.prisma.return.update({
      where: { id },
      data: {
        status: ReturnStatus.COMPLETED,
        completedBy: userId ?? null,
        completedByName,
        completedAt: new Date(),
      },
      include: RETURN_INCLUDE,
    });
    return this.attachDebtAdjustmentSummary(updated);
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
    // Nới điều kiện (rà soát nghiệp vụ Return, 27/08/2026) — trước đây chỉ
    // cho tạo khi đã DELIVERED, nay cho phép ở mọi trạng thái, chỉ chặn
    // CANCELLED (đơn đã huỷ không có gì để trả).
    if (salesOrder.status === SalesOrderStatus.CANCELLED) {
      throw new ForbiddenException(
        'Không thể tạo phiếu trả hàng cho đơn hàng đã huỷ.',
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
      const soItemForCheck = salesOrderItemMap.get(item.salesOrderItemId);
      if (!soItemForCheck) {
        throw new NotFoundException(
          `Dòng sản phẩm "${item.salesOrderItemId}" không thuộc đơn hàng này.`,
        );
      }
      // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — ngoài phạm vi module
      // Hàng hoàn ở milestone này, chỉ hỗ trợ trả dòng PRODUCT.
      if (soItemForCheck.itemType !== 'PRODUCT') {
        throw new BadRequestException(
          `Dòng "${soItemForCheck.materialName}" là vật tư bán lẻ, chưa hỗ trợ trả hàng.`,
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

    // Giá trị phiếu hoàn — finalPrice đã là giá VAT-inclusive kể từ "Tách
    // ngược VAT" (chốt 16/08/2026, xem calcVatAmount trong
    // quotation-workflow.service.ts), nên không cộng thêm VAT ở đây nữa.
    // Snapshot 1 lần tại đây, xem comment Return.totalValue trong schema.
    let totalValue = 0;
    for (const item of dto.items) {
      const soItem = salesOrderItemMap.get(item.salesOrderItemId)!;
      totalValue += Math.round(
        Number(soItem.finalPrice) * item.returnedQuantity,
      );
    }

    // Phân bổ khách/công ty chịu (rà soát nghiệp vụ Return, 27/08/2026).
    // Mặc định khách chịu 100% nếu FE không truyền — an toàn, không tự ý
    // giảm công nợ nếu kế toán không chủ động chỉnh.
    const customerBorneAmount = dto.customerBorneAmount ?? totalValue;
    if (customerBorneAmount < 0 || customerBorneAmount > totalValue) {
      throw new BadRequestException(
        `Số tiền khách chịu phải nằm trong khoảng 0 - ${totalValue}.`,
      );
    }
    const companyBorneAmount = totalValue - customerBorneAmount;
    const companyBorneReason = dto.companyBorneReason?.trim() || null;
    if (companyBorneAmount > 0 && !companyBorneReason) {
      throw new BadRequestException(
        'Lý do công ty chịu chi phí là bắt buộc khi có phần công ty chịu.',
      );
    }

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
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
            // Snapshot phục vụ Dashboard "Doanh số theo nhân viên" — cả 2
            // field, group theo ownerId (xem comment schema.prisma).
            ownerId: salesOrder.ownerId,
            ownerName: salesOrder.ownerName,
            returnDate: dto.returnDate ? new Date(dto.returnDate) : new Date(),
            receivedBy: dto.receivedBy?.trim() || null,
            note: dto.note?.trim() || null,
            totalValue,
            customerBorneAmount,
            companyBorneReason,
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
              // Đã chặn dòng MATERIAL ở validate phía trên — productCode/Name
              // luôn có giá trị ở đây (chỉ còn dòng PRODUCT).
              productCode: soItem.productCode!,
              productName: soItem.productName!,
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
              productCode: soItem.productCode!,
              productName: soItem.productName!,
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
      }),
    );
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
      // Tìm không phân biệt dấu tiếng Việt — giữ nguyên đúng 4 field đang
      // tìm (mã tồn/mã SP/tên SP/mã hoàn gốc), chỉ đổi cách so khớp.
      where.id = {
        in: await findMatchingIds(
          this.prisma,
          Prisma.sql`SELECT id FROM recovery_inventories WHERE ${unaccentLike(Prisma.sql`code`, query.search)}
            OR ${unaccentLike(Prisma.sql`product_code`, query.search)}
            OR ${unaccentLike(Prisma.sql`product_name`, query.search)}
            OR ${unaccentLike(Prisma.sql`created_from_return_code`, query.search)}`,
        ),
      };
    }

    const validStatuses = Object.values(RecoveryInventoryStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as RecoveryInventoryStatus;
    }

    // Sắp xếp (rà soát bộ lọc Hàng hoàn, chốt 18/07/2026): mặc định createdAt
    // desc — cho phép đổi chiều để tìm hàng tồn kho thu hồi lâu ngày
    // (createdAt asc, xem "Hàng tồn lâu" ở Dashboard).
    const orderBy: Prisma.RecoveryInventoryOrderByWithRelationInput =
      query.sortBy === 'created_asc'
        ? { createdAt: 'asc' }
        : { createdAt: 'desc' };
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
  // Rà soát bộ lọc thời gian Dashboard (chốt 18/07/2026, 007-bo-loc-thoi-gian-dashboard.md):
  // "...tháng này" hard-code trước đây đổi thành lọc theo khoảng ngày do FE
  // truyền (bộ lọc đầu trang Dashboard) — không truyền range = toàn bộ thời gian.
  // ─────────────────────────────────────────────────────

  private returnDateRangeFilter(
    from?: Date,
    to?: Date,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (from) filter.gte = from;
    if (to) filter.lte = to;
    return filter;
  }

  async getDashboardSummary(range?: { from?: Date; to?: Date }) {
    const returnDateFilter = this.returnDateRangeFilter(range?.from, range?.to);
    const returnWhere: Prisma.ReturnWhereInput = returnDateFilter
      ? { returnDate: returnDateFilter }
      : {};
    const itemWhere: Prisma.ReturnItemWhereInput = returnDateFilter
      ? { return: { returnDate: returnDateFilter } }
      : {};

    const [rangeReturns, rangeItems, valueAgg, availableCount, availableAgg] =
      await Promise.all([
        this.prisma.return.count({ where: returnWhere }),
        this.prisma.returnItem.findMany({
          where: itemWhere,
          select: { returnedQuantity: true },
        }),
        this.prisma.returnItem.findMany({
          where: itemWhere,
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

    const totalProductsReturned = rangeItems.reduce(
      (s, i) => s + Number(i.returnedQuantity),
      0,
    );
    const returnValue = valueAgg.reduce(
      (s, i) => s + Number(i.returnedQuantity) * Number(i.unitPriceSnapshot),
      0,
    );

    return {
      returnsInRange: rangeReturns,
      totalProductsReturnedInRange: totalProductsReturned,
      returnValueInRange: returnValue,
      // Số dư/tồn kho thu hồi hiện tại — không thuộc khoảng ngày, luôn tức thời.
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

  async getTopReturnReasons(range?: { from?: Date; to?: Date }) {
    const returnDateFilter = this.returnDateRangeFilter(range?.from, range?.to);
    const grouped = await this.prisma.returnItem.groupBy({
      by: ['reason'],
      where: returnDateFilter
        ? { return: { returnDate: returnDateFilter } }
        : {},
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

  // Phần "công ty chịu" của Return = totalValue - customerBorneAmount (rà
  // soát nghiệp vụ Return, 27/08/2026) — đây là số duy nhất Dashboard được
  // phép trừ vào doanh thu/doanh số, KHÔNG phải totalValue thô (phần khách
  // chịu công ty vẫn thu đủ tiền, không phải tổn thất).
  // "Tổng doanh số" ở tab "Đơn hàng" trang chi tiết khách hàng (rà soát
  // nghiệp vụ Return, 27/08/2026) — KHÁC getTotalCompanyBorneValue() ở trên:
  // lọc theo ngày TẠO của SalesOrder (không phải returnDate), vì mục đích là
  // khớp đúng SUM(netAmount) đã hiển thị trên bảng — 1 đơn tạo trong kỳ vẫn
  // bị trừ đủ phần Công ty hỗ trợ dù Return của nó phát sinh sau đó (ngoài
  // khoảng lọc), cùng công thức netAmount ở findAll()/getTotalAmountForCustomer().
  async getTotalCompanyBorneValueForCustomerOrders(
    customerId: string,
    from: Date,
    to: Date,
  ) {
    const agg = await this.prisma.return.aggregate({
      where: {
        customerId,
        salesOrder: {
          status: { not: SalesOrderStatus.CANCELLED },
          createdAt: { gte: from, lte: to },
        },
      },
      _sum: { totalValue: true, customerBorneAmount: true },
    });
    return (
      Number(agg._sum.totalValue ?? 0) -
      Number(agg._sum.customerBorneAmount ?? 0)
    );
  }

  async getTotalCompanyBorneValue(range?: { from?: Date; to?: Date }) {
    const returnDateFilter = this.returnDateRangeFilter(range?.from, range?.to);
    const agg = await this.prisma.return.aggregate({
      where: returnDateFilter ? { returnDate: returnDateFilter } : {},
      _sum: { totalValue: true, customerBorneAmount: true },
    });
    return (
      Number(agg._sum.totalValue ?? 0) -
      Number(agg._sum.customerBorneAmount ?? 0)
    );
  }

  // Dùng cho Dashboard "Doanh số theo nhân viên" — group theo ownerId (FK bất
  // biến, cùng convention report.md C1 — xem comment schema.prisma), cùng
  // công thức trừ phần công ty chịu ở trên. Chỉ trả về nhân viên có phát
  // sinh Return trong khoảng lọc (group tự loại trừ nhân viên không có dòng
  // nào khớp where). Return.ownerId là plain field (không @relation) nên
  // Dashboard tự map ownerId -> ownerName từ chính kết quả group, không JOIN
  // sang User.
  async getCompanyBorneValueByOwner(range?: { from?: Date; to?: Date }) {
    const returnDateFilter = this.returnDateRangeFilter(range?.from, range?.to);
    const where: Prisma.ReturnWhereInput = returnDateFilter
      ? { returnDate: returnDateFilter }
      : {};

    const [grouped, names] = await Promise.all([
      this.prisma.return.groupBy({
        by: ['ownerId'],
        where,
        _sum: { totalValue: true, customerBorneAmount: true },
      }),
      this.prisma.return.findMany({
        where,
        distinct: ['ownerId'],
        orderBy: { createdAt: 'desc' },
        select: { ownerId: true, ownerName: true },
      }),
    ]);

    const nameMap = new Map(names.map((n) => [n.ownerId, n.ownerName]));

    return grouped
      .filter((g) => g.ownerId)
      .map((g) => ({
        ownerId: g.ownerId as string,
        ownerName: nameMap.get(g.ownerId) ?? null,
        companyBorneValue:
          Number(g._sum.totalValue ?? 0) -
          Number(g._sum.customerBorneAmount ?? 0),
      }));
  }

  // Dùng cho Báo cáo "Doanh thu theo khách hàng" (report.md C2, rà soát
  // nghiệp vụ Return, 03/09/2026 — trước đó report.service.ts gọi thẳng
  // SalesOrderService, chưa trừ phần công ty chịu như Dashboard) — cùng công
  // thức/convention với getCompanyBorneValueByOwner() ở trên, chỉ đổi
  // groupBy sang customerId (Return.customerId cũng là plain field bất biến,
  // cùng lý do dùng ownerId).
  async getCompanyBorneValueByCustomer(range?: { from?: Date; to?: Date }) {
    const returnDateFilter = this.returnDateRangeFilter(range?.from, range?.to);
    const where: Prisma.ReturnWhereInput = returnDateFilter
      ? { returnDate: returnDateFilter }
      : {};

    const grouped = await this.prisma.return.groupBy({
      by: ['customerId'],
      where,
      _sum: { totalValue: true, customerBorneAmount: true },
    });

    return grouped.map((g) => ({
      customerId: g.customerId,
      companyBorneValue:
        Number(g._sum.totalValue ?? 0) -
        Number(g._sum.customerBorneAmount ?? 0),
    }));
  }

  // Dùng cho Báo cáo "Doanh thu" (report.md A1, rà soát nghiệp vụ Return,
  // 16/09/2026) — KHÁC quy ước getCompanyBorneValueByOwner/Customer() ở
  // trên: A1 là chuỗi thời gian nên phần công ty chịu phải quy về đúng
  // NGÀY TẠO ĐƠN HÀNG GỐC (SalesOrder.createdAt), không phải returnDate —
  // đơn hoàn chỉ là sự việc làm giảm số liệu của ngày tạo đơn, tự nó không
  // tạo doanh thu âm ở ngày hoàn. Vì vậy lọc theo range cũng phải theo
  // SalesOrder.createdAt (khác returnDateRangeFilter ở trên) — một Return
  // phát sinh ngoài range vẫn được tính nếu đơn gốc nằm trong range, và
  // ngược lại.
  async getCompanyBorneValueByOrderDate(range: { from: Date; to: Date }) {
    const rows = await this.prisma.return.findMany({
      where: {
        salesOrder: {
          status: { not: SalesOrderStatus.CANCELLED },
          createdAt: { gte: range.from, lte: range.to },
        },
      },
      select: {
        totalValue: true,
        customerBorneAmount: true,
        salesOrder: { select: { createdAt: true } },
      },
    });

    return rows.map((r) => ({
      date: r.salesOrder.createdAt,
      value: Number(r.totalValue) - Number(r.customerBorneAmount),
    }));
  }

  async getReturnsByCustomer(range?: { from?: Date; to?: Date }, limit = 10) {
    const returnDateFilter = this.returnDateRangeFilter(range?.from, range?.to);
    const grouped = await this.prisma.return.groupBy({
      by: ['customerId', 'customerName'],
      where: returnDateFilter ? { returnDate: returnDateFilter } : {},
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
}
