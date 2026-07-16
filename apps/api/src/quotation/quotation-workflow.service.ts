import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  QuotationStatus,
  QuotationTimelineAction,
  SalesOrderStatus,
  ProductionOrderStatus,
  VersionStatus,
  RoundType,
  SalesOrderTimelineAction,
  SalesOrderTimelineActorType,
  ProductionOrderTimelineAction,
  ProductionOrderTimelineActorType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { coerceParameters } from '../shared/derived-params';
import { resolveActorName } from '../shared/resolve-actor-name';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import {
  BomEngineService,
  BomConfig,
  BomLine,
} from '../bom-engine/bom-engine.service';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { CancelQuotationDto } from './dto/cancel-quotation.dto';
import { OverrideQuotationDto } from './dto/override-quotation.dto';

const EDITABLE_STATUSES: QuotationStatus[] = [
  QuotationStatus.DRAFT,
  QuotationStatus.SENT,
];

const QUOTATION_INCLUDE = {
  customer: {
    include: {
      customerGroup: {
        select: { id: true, name: true, discountPercent: true },
      },
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          parameters: {
            select: { name: true, label: true, unit: true, displayOrder: true },
            orderBy: { displayOrder: 'asc' as const },
          },
        },
      },
      parameters: { orderBy: { displayOrder: 'asc' as const } },
    },
    orderBy: { displayOrder: 'asc' as const },
  },
  timeline: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.QuotationInclude;

@Injectable()
export class QuotationWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService,
    private readonly bomEngine: BomEngineService,
  ) {}

  // ─────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────

  async findAll(query: QuotationQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.QuotationWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: query.search } } },
      ];
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    // Hỗ trợ nhiều trạng thái phân tách dấu phẩy (tab "Chờ xử lý" = DRAFT,SENT).
    const validStatuses: QuotationStatus[] = [
      'DRAFT',
      'SENT',
      'APPROVED',
      'CANCELLED',
    ];
    if (query.status) {
      const statuses = query.status
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is QuotationStatus =>
          validStatuses.includes(s as QuotationStatus),
        );
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    // Lọc theo khoảng ngày tạo (createdTo lấy hết ngày đó).
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.createdFrom) {
      const from = new Date(query.createdFrom);
      if (!isNaN(from.getTime())) createdAtFilter.gte = from;
    }
    if (query.createdTo) {
      const to = new Date(query.createdTo);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        createdAtFilter.lte = to;
      }
    }
    if (Object.keys(createdAtFilter).length > 0) {
      where.createdAt = createdAtFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, code: true, name: true, phone: true },
          },
          items: { select: { id: true, subtotal: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: QUOTATION_INCLUDE,
    });

    if (!quotation) {
      throw new NotFoundException('Báo giá không tồn tại.');
    }

    return quotation;
  }

  // ─────────────────────────────────────────────────────
  // Quotation CRUD
  // ─────────────────────────────────────────────────────

  async create(dto: CreateQuotationDto, userId?: string | null) {
    if (!dto.customerId) {
      throw new BadRequestException('Khách hàng là bắt buộc.');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Khách hàng không tồn tại.');
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const running = await tx.runningNumber.update({
        where: { type: 'QUOTATION' },
        data: { lastNumber: { increment: 1 } },
      });
      const code = `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;

      const quotation = await tx.quotation.create({
        data: {
          code,
          customerId: dto.customerId,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          note: dto.note?.trim() || null,
          status: QuotationStatus.DRAFT,
          // Người tạo báo giá (từ JWT) — nguồn cho SalesOrder.ownerId khi Approve.
          createdBy: userId ?? null,
        },
        include: QUOTATION_INCLUDE,
      });

      await tx.quotationTimeline.create({
        data: {
          quotationId: quotation.id,
          action: QuotationTimelineAction.QUOTATION_CREATED,
          payload: { code: quotation.code },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return quotation;
    });
  }

  async update(id: string, dto: UpdateQuotationDto) {
    const quotation = await this.findOne(id);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Không thể chỉnh sửa báo giá ở trạng thái ${quotation.status}.`,
      );
    }

    const data: Prisma.QuotationUpdateInput = {};
    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }
    if (dto.note !== undefined) {
      data.note = dto.note?.trim() ?? null;
    }

    return this.prisma.quotation.update({
      where: { id },
      data,
      include: QUOTATION_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────
  // QuotationItem CRUD
  // ─────────────────────────────────────────────────────

  async addItem(
    quotationId: string,
    dto: CreateQuotationItemDto,
    userId?: string | null,
  ) {
    const quotation = await this.findOne(quotationId);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Không thể thêm sản phẩm vào báo giá ở trạng thái ${quotation.status}.`,
      );
    }

    if (!dto.productId) {
      throw new BadRequestException('Sản phẩm là bắt buộc.');
    }

    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0.');
    }

    this.validateDiscountFields(
      dto.additionalDiscountPercent,
      dto.additionalDiscountAmount,
      dto.discountReason,
    );

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { parameters: { orderBy: { displayOrder: 'asc' } } },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }

    const priceResult = await this.pricingEngine.calculate({
      productId: dto.productId,
      parameters: dto.parameters,
    });

    const customerWithGroup = await this.prisma.customer.findUnique({
      where: { id: quotation.customerId },
      include: { customerGroup: { select: { discountPercent: true } } },
    });
    const groupDiscount = Number(
      customerWithGroup?.customerGroup?.discountPercent ?? 0,
    );

    const additionalDiscountPercent = dto.additionalDiscountPercent ?? 0;
    const additionalDiscountAmount = dto.additionalDiscountAmount ?? 0;
    const systemPrice = priceResult.systemPrice;

    const finalPrice = this.calcFinalPrice(
      systemPrice,
      groupDiscount,
      additionalDiscountPercent,
      additionalDiscountAmount,
    );
    const subtotal = this.calcSubtotal(finalPrice, dto.quantity);
    const vatRate = priceResult.vatRate;
    const vatAmount = this.calcVatAmount(subtotal, vatRate);

    const paramMap = new Map(product.parameters.map((p) => [p.name, p]));
    const displayOrder = dto.displayOrder ?? quotation.items.length;

    // "Người duyệt" (discountBy/discountByName) chỉ ghi khi dòng có chiết
    // khấu bổ sung — cùng điều kiện bắt buộc discountReason (validateDiscountFields).
    const hasAdditionalDiscount =
      additionalDiscountPercent > 0 || additionalDiscountAmount > 0;
    const discountByName = hasAdditionalDiscount
      ? await resolveActorName(this.prisma, userId)
      : null;

    return this.prisma.quotationItem.create({
      data: {
        quotationId,
        productId: dto.productId,
        // Snapshot tại thời điểm thêm dòng (quotation.md) — hiển thị/in đọc
        // từ đây, không đọc lại Product.
        productCode: product.code,
        productName: product.name,
        quantity: dto.quantity,
        pricingRuleVersionId: priceResult.pricingRuleVersionId,
        systemPrice,
        groupDiscount,
        additionalDiscountPercent,
        additionalDiscountAmount,
        discountReason: dto.discountReason?.trim() || null,
        discountBy: hasAdditionalDiscount ? (userId ?? null) : null,
        discountByName,
        finalPrice,
        subtotal,
        vatRate,
        vatAmount,
        // Snapshot cảnh báo Validation Rule tại thời điểm tính giá (Task 06)
        warnings: priceResult.warnings,
        displayOrder,
        parameters: {
          create: dto.parameters.map((p, idx) => {
            const productParam = paramMap.get(p.name);
            return {
              name: p.name,
              label: productParam?.label ?? p.name,
              value: p.value,
              unit: productParam?.unit ?? null,
              displayOrder: productParam?.displayOrder ?? idx,
            };
          }),
        },
      },
      include: {
        product: { select: { id: true, code: true, name: true } },
        parameters: { orderBy: { displayOrder: 'asc' } },
      },
    });
  }

  async updateItem(
    quotationId: string,
    itemId: string,
    dto: UpdateQuotationItemDto,
    userId?: string | null,
  ) {
    const quotation = await this.findOne(quotationId);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Không thể chỉnh sửa sản phẩm trong báo giá ở trạng thái ${quotation.status}.`,
      );
    }

    const item = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId },
      include: { parameters: true },
    });

    if (!item) {
      throw new NotFoundException('Dòng sản phẩm không tồn tại.');
    }

    if (dto.quantity !== undefined && dto.quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0.');
    }

    const additionalDiscountPercent =
      dto.additionalDiscountPercent ?? Number(item.additionalDiscountPercent);
    const additionalDiscountAmount =
      dto.additionalDiscountAmount ?? Number(item.additionalDiscountAmount);
    const discountReason =
      dto.discountReason !== undefined
        ? dto.discountReason?.trim() || null
        : item.discountReason;

    this.validateDiscountFields(
      additionalDiscountPercent,
      additionalDiscountAmount,
      discountReason,
    );

    // "Người duyệt" (discountBy/discountByName) chỉ ghi khi dòng có chiết
    // khấu bổ sung — cùng điều kiện bắt buộc discountReason (validateDiscountFields).
    const hasAdditionalDiscount =
      additionalDiscountPercent > 0 || additionalDiscountAmount > 0;
    const discountBy = hasAdditionalDiscount ? (userId ?? null) : null;
    const discountByName = hasAdditionalDiscount
      ? await resolveActorName(this.prisma, userId)
      : null;

    const quantity = dto.quantity ?? Number(item.quantity);
    let systemPrice = Number(item.systemPrice);
    let pricingRuleVersionId = item.pricingRuleVersionId;
    let warnings = item.warnings as string[] | null;
    let vatRate = Number(item.vatRate);
    const newParameters = dto.parameters;

    if (dto.parameters !== undefined) {
      const priceResult = await this.pricingEngine.calculate({
        productId: item.productId,
        parameters: dto.parameters,
      });
      systemPrice = priceResult.systemPrice;
      pricingRuleVersionId = priceResult.pricingRuleVersionId;
      warnings = priceResult.warnings;
      vatRate = priceResult.vatRate;
    }

    const groupDiscount = Number(item.groupDiscount);
    const finalPrice = this.calcFinalPrice(
      systemPrice,
      groupDiscount,
      additionalDiscountPercent,
      additionalDiscountAmount,
    );
    // subtotal (và do đó vatAmount) luôn tính lại dù tham số không đổi —
    // số lượng/chiết khấu có thể đổi độc lập với tham số sản phẩm.
    const subtotal = this.calcSubtotal(finalPrice, quantity);
    const vatAmount = this.calcVatAmount(subtotal, vatRate);

    // Snapshot Rule (quotation.md): snapshot productCode/productName tại thời
    // điểm thêm/SỬA dòng — refresh lại mỗi lần sửa khi còn Draft/Sent.
    const snapshotProduct = await this.prisma.product.findUnique({
      where: { id: item.productId },
      select: { code: true, name: true },
    });
    if (!snapshotProduct) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (newParameters !== undefined) {
        await tx.quotationItemParameter.deleteMany({
          where: { quotationItemId: itemId },
        });

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { parameters: { orderBy: { displayOrder: 'asc' } } },
        });
        const paramMap = new Map(
          (product?.parameters ?? []).map((p) => [p.name, p]),
        );

        await tx.quotationItemParameter.createMany({
          data: newParameters.map((p, idx) => {
            const productParam = paramMap.get(p.name);
            return {
              quotationItemId: itemId,
              name: p.name,
              label: productParam?.label ?? p.name,
              value: p.value,
              unit: productParam?.unit ?? null,
              displayOrder: productParam?.displayOrder ?? idx,
            };
          }),
        });
      }

      return tx.quotationItem.update({
        where: { id: itemId },
        data: {
          productCode: snapshotProduct.code,
          productName: snapshotProduct.name,
          quantity,
          systemPrice,
          pricingRuleVersionId,
          additionalDiscountPercent,
          additionalDiscountAmount,
          discountReason,
          discountBy,
          discountByName,
          finalPrice,
          subtotal,
          vatRate,
          vatAmount,
          warnings: warnings ?? [],
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
        },
        include: {
          product: { select: { id: true, code: true, name: true } },
          parameters: { orderBy: { displayOrder: 'asc' } },
        },
      });
    });
  }

  async removeItem(quotationId: string, itemId: string) {
    const quotation = await this.findOne(quotationId);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Không thể xoá sản phẩm khỏi báo giá ở trạng thái ${quotation.status}.`,
      );
    }

    const item = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId },
    });

    if (!item) {
      throw new NotFoundException('Dòng sản phẩm không tồn tại.');
    }

    await this.prisma.quotationItem.delete({ where: { id: itemId } });
    return { message: 'Đã xoá sản phẩm khỏi báo giá.' };
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Send (Task 05)
  // ─────────────────────────────────────────────────────

  async send(id: string, userId?: string | null) {
    const quotation = await this.findOne(id);

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new ForbiddenException(
        `Chỉ có thể gửi báo giá từ trạng thái Nháp. Trạng thái hiện tại: ${quotation.status}.`,
      );
    }

    if (quotation.items.length === 0) {
      throw new BadRequestException(
        'Báo giá phải có ít nhất một sản phẩm trước khi gửi.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: { status: QuotationStatus.SENT },
        include: QUOTATION_INCLUDE,
      });

      await tx.quotationTimeline.create({
        data: {
          quotationId: id,
          action: QuotationTimelineAction.QUOTATION_SENT,
          payload: { code: quotation.code },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Recalculate Prices (Sprint 02 — Architecture Review)
  // ─────────────────────────────────────────────────────

  // Action "Tính lại giá" (quotation.md "Khi Pricing Rule đổi version giữa
  // chừng"): tính lại systemPrice toàn bộ dòng bằng version ACTIVE hiện tại.
  // Người dùng chủ động chạy khi Approve bị chặn PRICING_VERSION_STALE —
  // hệ thống không bao giờ recalc âm thầm.
  async recalculatePrices(id: string, userId?: string | null) {
    const quotation = await this.findOne(id);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Chỉ có thể tính lại giá khi báo giá ở trạng thái Nháp hoặc Đã gửi. Trạng thái hiện tại: ${quotation.status}.`,
      );
    }

    if (quotation.items.length === 0) {
      throw new BadRequestException(
        'Báo giá chưa có sản phẩm nào để tính lại giá.',
      );
    }

    // Tính giá mới cho từng dòng bằng Pricing Engine (đọc version ACTIVE hiện tại).
    const changes: Array<{
      itemId: string;
      productCode: string;
      productName: string;
      oldSystemPrice: number;
      newSystemPrice: number;
      oldFinalPrice: number;
      newFinalPrice: number;
      oldPricingRuleVersionId: string | null;
      newPricingRuleVersionId: string;
    }> = [];

    const itemUpdates: Array<{
      id: string;
      systemPrice: number;
      pricingRuleVersionId: string;
      finalPrice: number;
      subtotal: number;
      vatRate: number;
      vatAmount: number;
      warnings: string[];
    }> = [];

    for (const item of quotation.items) {
      const priceResult = await this.pricingEngine.calculate({
        productId: item.productId,
        parameters: item.parameters.map((p) => ({
          name: p.name,
          value: p.value,
        })),
      });

      const newSystemPrice = priceResult.systemPrice;
      const newFinalPrice = this.calcFinalPrice(
        newSystemPrice,
        Number(item.groupDiscount),
        Number(item.additionalDiscountPercent),
        Number(item.additionalDiscountAmount),
      );
      const newSubtotal = this.calcSubtotal(
        newFinalPrice,
        Number(item.quantity),
      );
      const newVatAmount = this.calcVatAmount(newSubtotal, priceResult.vatRate);

      changes.push({
        itemId: item.id,
        productCode: item.productCode,
        productName: item.productName,
        oldSystemPrice: Number(item.systemPrice),
        newSystemPrice,
        oldFinalPrice: Number(item.finalPrice),
        newFinalPrice,
        oldPricingRuleVersionId: item.pricingRuleVersionId,
        newPricingRuleVersionId: priceResult.pricingRuleVersionId,
      });

      itemUpdates.push({
        id: item.id,
        systemPrice: newSystemPrice,
        pricingRuleVersionId: priceResult.pricingRuleVersionId,
        finalPrice: newFinalPrice,
        subtotal: newSubtotal,
        vatRate: priceResult.vatRate,
        vatAmount: newVatAmount,
        warnings: priceResult.warnings,
      });
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const u of itemUpdates) {
        await tx.quotationItem.update({
          where: { id: u.id },
          data: {
            systemPrice: u.systemPrice,
            pricingRuleVersionId: u.pricingRuleVersionId,
            finalPrice: u.finalPrice,
            subtotal: u.subtotal,
            vatRate: u.vatRate,
            vatAmount: u.vatAmount,
            warnings: u.warnings,
          },
        });
      }

      // Ghi Timeline bằng action MANUAL_OVERRIDE sẵn có (đã chốt với người
      // dùng 06/07/2026 — không thêm enum mới); payload.action phân biệt
      // đây là Action "Tính lại giá".
      await tx.quotationTimeline.create({
        data: {
          quotationId: id,
          action: QuotationTimelineAction.QUOTATION_MANUAL_OVERRIDE,
          payload: {
            code: quotation.code,
            action: 'RECALCULATE_PRICES',
            reason: 'Tính lại giá theo Pricing Rule Version đang hoạt động',
            changes: changes.map((c) => ({
              productCode: c.productCode,
              productName: c.productName,
              oldSystemPrice: c.oldSystemPrice,
              newSystemPrice: c.newSystemPrice,
              oldPricingRuleVersionId: c.oldPricingRuleVersionId,
              newPricingRuleVersionId: c.newPricingRuleVersionId,
            })),
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return tx.quotation.findUnique({
        where: { id },
        include: QUOTATION_INCLUDE,
      });
    });

    // changes trả kèm để FE hiển thị chênh lệch giá cũ/mới cho người dùng
    // quyết định gửi lại khách.
    return { quotation: updated, changes };
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Cancel (Task 05)
  // ─────────────────────────────────────────────────────

  async cancel(id: string, dto: CancelQuotationDto, userId?: string | null) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do huỷ là bắt buộc.');
    }

    const quotation = await this.findOne(id);

    if (quotation.status === QuotationStatus.CANCELLED) {
      throw new ForbiddenException('Báo giá đã ở trạng thái Đã huỷ.');
    }

    // Business Rule (quotation.md): không Cancel báo giá đã có salesOrderId
    // (mọi báo giá Approved). Muốn dừng thương vụ → huỷ Sales Order; báo giá
    // giữ Approved phục vụ lịch sử.
    if (quotation.salesOrderId) {
      throw new ForbiddenException(
        'Không thể huỷ báo giá đã chuyển thành Đơn hàng. Muốn dừng thương vụ, hãy huỷ Đơn hàng — báo giá giữ nguyên để phục vụ lịch sử.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: { status: QuotationStatus.CANCELLED },
        include: QUOTATION_INCLUDE,
      });

      await tx.quotationTimeline.create({
        data: {
          quotationId: id,
          action: QuotationTimelineAction.QUOTATION_CANCELLED,
          payload: {
            code: quotation.code,
            reason: dto.reason.trim(),
            previousStatus: quotation.status,
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Manual Override (Task 08)
  // ─────────────────────────────────────────────────────

  async override(
    id: string,
    dto: OverrideQuotationDto,
    userId?: string | null,
  ) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do điều chỉnh là bắt buộc.');
    }

    const validStatuses = Object.values(QuotationStatus) as string[];
    if (!dto.newStatus || !validStatuses.includes(dto.newStatus)) {
      throw new BadRequestException(
        `Trạng thái "${dto.newStatus}" không hợp lệ.`,
      );
    }

    const quotation = await this.findOne(id);

    if (quotation.status === (dto.newStatus as QuotationStatus)) {
      throw new BadRequestException(
        'Trạng thái mới phải khác trạng thái hiện tại.',
      );
    }

    // Giới hạn Manual Override (quotation.md): không được dùng Override để
    // Cancel báo giá đã có salesOrderId — xử lý ở Sales Order.
    if (dto.newStatus === QuotationStatus.CANCELLED && quotation.salesOrderId) {
      throw new ForbiddenException(
        'Manual Override không được dùng để huỷ báo giá đã chuyển thành Đơn hàng. Muốn dừng thương vụ, hãy huỷ Đơn hàng.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: { status: dto.newStatus as QuotationStatus },
        include: QUOTATION_INCLUDE,
      });

      await tx.quotationTimeline.create({
        data: {
          quotationId: id,
          action: QuotationTimelineAction.QUOTATION_MANUAL_OVERRIDE,
          payload: {
            code: quotation.code,
            oldStatus: quotation.status,
            newStatus: dto.newStatus,
            reason: dto.reason.trim(),
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Approve (Task 06)
  // ─────────────────────────────────────────────────────

  async approve(id: string, approverUserId?: string | null) {
    // Load full data for validation + snapshot
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                productType: true,
                productionCenter: true,
                pricingRule: {
                  include: {
                    versions: {
                      where: { status: VersionStatus.ACTIVE },
                      take: 1,
                    },
                  },
                },
                materialRequirement: {
                  include: {
                    versions: {
                      where: { status: VersionStatus.ACTIVE },
                      include: {
                        items: {
                          include: {
                            material: {
                              include: {
                                unit: { select: { name: true } },
                                prices: {
                                  where: { isDefault: true },
                                  orderBy: { effectiveFrom: 'desc' },
                                  take: 1,
                                },
                              },
                            },
                          },
                          orderBy: { displayOrder: 'asc' },
                        },
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
            parameters: { orderBy: { displayOrder: 'asc' } },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!quotation) throw new NotFoundException('Báo giá không tồn tại.');

    if (quotation.status !== QuotationStatus.SENT) {
      throw new ForbiddenException(
        `Chỉ có thể duyệt báo giá ở trạng thái Đã gửi. Trạng thái hiện tại: ${quotation.status}.`,
      );
    }

    if (quotation.salesOrderId) {
      throw new ForbiddenException(
        'Báo giá đã được chuyển thành đơn hàng trước đó.',
      );
    }

    if (quotation.items.length === 0) {
      throw new BadRequestException(
        'Báo giá phải có ít nhất một sản phẩm trước khi duyệt.',
      );
    }

    // Validate each item
    const stalePricingItems: Array<{
      itemId: string;
      productCode: string;
      productName: string;
    }> = [];

    for (const item of quotation.items) {
      if (item.product.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Sản phẩm "${item.product.name}" không còn hoạt động. Vui lòng cập nhật báo giá.`,
        );
      }

      const activePricingVersion = item.product.pricingRule?.versions[0];
      if (!activePricingVersion) {
        throw new BadRequestException(
          `Sản phẩm "${item.product.name}" không có Phiên bản Quy tắc báo giá đang hoạt động.`,
        );
      }

      // Pricing Version check (quotation.md "Khi Pricing Rule đổi version giữa
      // chừng"): giá từng dòng phải được tính bằng đúng version đang ACTIVE.
      // Lệch → chặn, KHÔNG tính lại âm thầm — người dùng chủ động "Tính lại giá".
      if (item.pricingRuleVersionId !== activePricingVersion.id) {
        stalePricingItems.push({
          itemId: item.id,
          productCode: item.productCode,
          productName: item.productName,
        });
      }

      const activeMaterialVersion =
        item.product.materialRequirement?.versions[0];
      if (!activeMaterialVersion) {
        throw new BadRequestException(
          `Sản phẩm "${item.product.name}" không có Phiên bản Định mức vật tư đang hoạt động.`,
        );
      }

      if (Number(item.finalPrice) < 0) {
        throw new BadRequestException(
          `Giá bán cuối của sản phẩm "${item.product.name}" không được âm.`,
        );
      }
    }

    if (stalePricingItems.length > 0) {
      throw new BadRequestException({
        // errorCode để FE nhận diện và hiển thị nút "Tính lại giá".
        errorCode: 'PRICING_VERSION_STALE',
        message:
          `Không thể duyệt: giá của ${stalePricingItems.length} dòng được tính bằng phiên bản quy tắc giá đã cũ ` +
          `(${stalePricingItems.map((i) => i.productName).join(', ')}). ` +
          'Vui lòng dùng chức năng "Tính lại giá" rồi duyệt lại.',
        staleItems: stalePricingItems,
      });
    }

    // Owner (Sprint 02 Task 03 — quyết định 05/07/2026): đơn hàng tính doanh
    // số cho NGƯỜI TẠO báo giá (Quotation.createdBy), không phải người bấm
    // Approve. Fallback: createdBy NULL (báo giá trước khi có Auth) → dùng
    // người bấm Approve. ownerName snapshot tên hiển thị tại thời điểm này.
    const ownerCandidateIds = [quotation.createdBy, approverUserId].filter(
      (v): v is string => !!v,
    );
    let owner: { id: string; name: string | null; email: string } | null = null;
    for (const candidateId of ownerCandidateIds) {
      owner = await this.prisma.user.findUnique({
        where: { id: candidateId },
        select: { id: true, name: true, email: true },
      });
      if (owner) break;
    }

    // Snapshot Rule (knowledge/modules/order.md): OrderBOM tính từ đúng
    // QuotationItem.materialRequirementVersionId đã snapshot khi báo giá —
    // KHÔNG phải version đang ACTIVE trên sản phẩm. Version đã kích hoạt là
    // bất biến nên load được trước transaction; toàn bộ tính toán là hàm thuần
    // của BOM Engine (Filter theo condition → Formula → Waste → Round).
    const bomConfigCache = new Map<string, BomConfig>();
    const itemComputations: Array<{
      item: (typeof quotation.items)[number];
      bomLines: BomLine[];
      itemPlannedCost: number;
    }> = [];

    for (const item of quotation.items) {
      let bomLines: BomLine[] = [];
      let itemPlannedCost = 0;

      if (item.materialRequirementVersionId) {
        let config = bomConfigCache.get(item.materialRequirementVersionId);
        if (!config) {
          config = await this.bomEngine.loadConfigForVersion(
            item.materialRequirementVersionId,
          );
          bomConfigCache.set(item.materialRequirementVersionId, config);
        }

        // BOM nhận KÍCH THƯỚC GỐC khách đặt — không bao giờ nhận billable
        // params của Pricing Engine (nguyên tắc billable ≠ actual).
        const rawParams = coerceParameters(item.parameters);
        const bomResult = this.bomEngine.calculateBom(
          config,
          rawParams,
          Number(item.quantity),
        );
        bomLines = bomResult.lines;
        itemPlannedCost = bomResult.plannedCost;
      }

      itemComputations.push({ item, bomLines, itemPlannedCost });
    }

    // All validations pass — execute in a single transaction
    return this.prisma.$transaction(async (tx) => {
      // Planned Financials (order.md): computed once at creation, never re-derived later.
      const totalAmount = quotation.items.reduce(
        (s, i) => s + Number(i.subtotal),
        0,
      );
      const plannedCost = itemComputations.reduce(
        (s, c) => s + c.itemPlannedCost,
        0,
      );
      const plannedProfit = totalAmount - plannedCost;
      const totalProductionOrders = new Set(
        quotation.items.map((i) => i.product.productionCenterId),
      ).size;

      // Generate SalesOrder running number
      const salesRunning = await tx.runningNumber.update({
        where: { type: 'SALES_ORDER' },
        data: { lastNumber: { increment: 1 } },
      });
      const salesOrderCode = `${salesRunning.prefix}${String(salesRunning.lastNumber).padStart(salesRunning.paddingLength, '0')}`;

      // Create SalesOrder — Snapshot Customer + Planned Financials known upfront
      const salesOrder = await tx.salesOrder.create({
        data: {
          code: salesOrderCode,
          quotationCode: quotation.code,
          customerId: quotation.customerId,
          customerName: quotation.customer.name,
          customerPhone: quotation.customer.phone,
          status: SalesOrderStatus.IN_PRODUCTION,
          totalAmount,
          plannedCost,
          plannedProfit,
          totalProductionOrders,
          note: quotation.note,
          // Snapshot người phụ trách (report.md C1) — copy trong transaction
          // Approve, không đọc lại Master Data sau khi tạo.
          ownerId: owner?.id ?? null,
          ownerName: owner ? (owner.name ?? owner.email) : null,
        },
      });

      // Task 02 (Debt module) — Receivable sinh đồng thời với SalesOrder, cùng
      // transaction — snapshot Credit Policy (debtLimitSnapshot/debtTermDaysSnapshot)
      // từ Customer tại thời điểm này. dueDate = NULL cho tới khi Delivered.
      await tx.receivable.create({
        data: {
          salesOrderId: salesOrder.id,
          customerId: quotation.customerId,
          totalAmount,
          remainingAmount: totalAmount,
          debtLimitSnapshot: Number(quotation.customer.debtLimit),
          debtTermDaysSnapshot: quotation.customer.debtTermDays,
        },
      });

      // Group items by productionCenterId for ProductionOrder creation
      const centerMap = new Map<
        string,
        {
          centerName: string;
          items: Array<{
            salesOrderItemId: string;
            productId: string;
            productCode: string;
            productName: string;
            quantity: number;
          }>;
        }
      >();

      // Create SalesOrderItems + OrderBOMs
      for (const { item, bomLines, itemPlannedCost } of itemComputations) {
        const soItem = await tx.salesOrderItem.create({
          data: {
            salesOrderId: salesOrder.id,
            productId: item.productId,
            productCode: item.product.code,
            productName: item.product.name,
            // Redundant Reference + snapshot phục vụ Báo cáo B2/B4 (report.md)
            // — copy trong transaction Approve, không đọc lại Master Data sau đó.
            productTypeId: item.product.productTypeId,
            productTypeName: item.product.productType.name,
            productionCenterId: item.product.productionCenterId,
            productionCenterName: item.product.productionCenter.name,
            pricingRuleVersionId: item.pricingRuleVersionId,
            systemPrice: Number(item.systemPrice),
            groupDiscount: Number(item.groupDiscount),
            additionalDiscountPercent: Number(item.additionalDiscountPercent),
            additionalDiscountAmount: Number(item.additionalDiscountAmount),
            finalPrice: Number(item.finalPrice),
            quantity: Number(item.quantity),
            subtotal: Number(item.subtotal),
            materialRequirementVersionId: item.materialRequirementVersionId,
            plannedCost: itemPlannedCost,
            displayOrder: item.displayOrder,
            parameters: {
              create: item.parameters.map((p) => ({
                name: p.name,
                label: p.label,
                value: p.value,
                unit: p.unit,
                displayOrder: p.displayOrder,
              })),
            },
          },
        });

        // Create OrderBOM if the quotation item had a material requirement version snapshotted.
        // Chỉ chứa các dòng đã qua Filter condition — vật tư không thuộc config
        // khách chọn (vd màu khác) không xuất hiện trong OrderBOM.
        if (item.materialRequirementVersionId && bomLines.length > 0) {
          await tx.orderBOM.create({
            data: {
              salesOrderId: salesOrder.id,
              salesOrderItemId: soItem.id,
              materialRequirementVersionId: item.materialRequirementVersionId,
              plannedCost: itemPlannedCost,
              items: {
                create: bomLines.map((line) => ({
                  materialId: line.materialId,
                  materialCode: line.materialCode,
                  materialName: line.materialName,
                  materialUnit: line.materialUnit,
                  expression: line.expression,
                  wastePercent: line.wastePercent,
                  roundType: line.roundType,
                  roundValue: line.roundValue,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  lineTotal: line.lineTotal,
                })),
              },
            },
          });
        }

        // Group by production center
        const centerId = item.product.productionCenterId;
        const centerName = item.product.productionCenter.name;
        if (!centerMap.has(centerId)) {
          centerMap.set(centerId, { centerName, items: [] });
        }
        centerMap.get(centerId)!.items.push({
          salesOrderItemId: soItem.id,
          productId: item.productId,
          productCode: item.product.code,
          productName: item.product.name,
          quantity: Number(item.quantity),
        });
      }

      // Create Production Orders (one per production center)
      const productionOrderCodes: string[] = [];

      for (const [centerId, centerData] of centerMap) {
        const poRunning = await tx.runningNumber.update({
          where: { type: 'PRODUCTION_ORDER' },
          data: { lastNumber: { increment: 1 } },
        });
        const poCode = `${poRunning.prefix}${String(poRunning.lastNumber).padStart(poRunning.paddingLength, '0')}`;
        productionOrderCodes.push(poCode);

        const productionOrder = await tx.productionOrder.create({
          data: {
            code: poCode,
            salesOrderId: salesOrder.id,
            productionCenterId: centerId,
            productionCenterName: centerData.centerName,
            status: ProductionOrderStatus.PENDING,
            items: {
              create: centerData.items.map((i) => ({
                salesOrderItemId: i.salesOrderItemId,
                productId: i.productId,
                productCode: i.productCode,
                productName: i.productName,
                quantity: i.quantity,
              })),
            },
          },
        });

        // Task 02 (Production module) — ghi Timeline cho từng Production Order
        // vừa tạo, trong cùng transaction approve() này.
        await tx.productionOrderTimeline.create({
          data: {
            productionOrderId: productionOrder.id,
            action: ProductionOrderTimelineAction.PRODUCTION_ORDER_CREATED,
            actorType: ProductionOrderTimelineActorType.SYSTEM,
            payload: { salesOrderCode },
          },
        });
      }

      // Update Quotation: set APPROVED + salesOrderId
      const updated = await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.APPROVED,
          salesOrderId: salesOrder.id,
        },
        include: QUOTATION_INCLUDE,
      });

      // Write Timeline (Quotation) — createdBy/createdByName dùng chính
      // approverUserId đã có sẵn (người bấm Approve), không phải owner.
      await tx.quotationTimeline.create({
        data: {
          quotationId: id,
          action: QuotationTimelineAction.QUOTATION_APPROVED,
          payload: {
            code: quotation.code,
            salesOrderId: salesOrder.id,
            salesOrderCode,
            productionOrders: productionOrderCodes,
          },
          createdBy: approverUserId ?? null,
          createdByName: await resolveActorName(tx, approverUserId),
        },
      });

      // Write Timeline (SalesOrder) — Task 05
      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: salesOrder.id,
          action: SalesOrderTimelineAction.SALES_ORDER_CREATED,
          actorType: SalesOrderTimelineActorType.SYSTEM,
          // Task 02 (Debt module) — không tạo action Timeline riêng cho việc
          // sinh Receivable, gộp vào payload có sẵn của SALES_ORDER_CREATED.
          payload: { quotationCode: quotation.code, receivableCreated: true },
        },
      });

      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: salesOrder.id,
          action: SalesOrderTimelineAction.PRODUCTION_ORDERS_GENERATED,
          actorType: SalesOrderTimelineActorType.SYSTEM,
          payload: { productionOrderCodes },
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────

  private validateDiscountFields(
    additionalDiscountPercent: number | undefined,
    additionalDiscountAmount: number | undefined,
    discountReason: string | null | undefined,
  ) {
    const pct = additionalDiscountPercent ?? 0;
    const amt = additionalDiscountAmount ?? 0;

    if (pct < 0 || pct > 100) {
      throw new BadRequestException('Giảm thêm theo % phải từ 0 đến 100.');
    }
    if (amt < 0) {
      throw new BadRequestException('Giảm thêm theo số tiền không được âm.');
    }
    if ((pct > 0 || amt > 0) && !discountReason?.trim()) {
      throw new BadRequestException(
        'Lý do giảm giá là bắt buộc khi áp dụng chiết khấu thêm.',
      );
    }
  }

  private calcFinalPrice(
    systemPrice: number,
    groupDiscount: number,
    additionalDiscountPercent: number,
    additionalDiscountAmount: number,
  ): number {
    const after1 = systemPrice * (1 - groupDiscount / 100);
    const after2 = after1 * (1 - additionalDiscountPercent / 100);
    const final = after2 - additionalDiscountAmount;

    if (final < 0) {
      throw new BadRequestException(
        'Giá bán cuối không được âm. Vui lòng kiểm tra lại chiết khấu.',
      );
    }

    return Math.round(final);
  }

  private calcSubtotal(finalPrice: number, quantity: number): number {
    return Math.round(finalPrice * quantity);
  }

  // VAT tính SAU Discount Engine (chốt 16/07/2026) — trên subtotal đã chiết
  // khấu và extend theo số lượng, không phải trên systemPrice gốc.
  private calcVatAmount(subtotal: number, vatRate: number): number {
    return Math.round(subtotal * (vatRate / 100));
  }
}
