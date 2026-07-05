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
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { CancelQuotationDto } from './dto/cancel-quotation.dto';
import { OverrideQuotationDto } from './dto/override-quotation.dto';

const EDITABLE_STATUSES: QuotationStatus[] = [QuotationStatus.DRAFT, QuotationStatus.SENT];

const QUOTATION_INCLUDE = {
  customer: {
    include: {
      customerGroup: { select: { id: true, name: true, discountPercent: true } },
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

    const validStatuses: QuotationStatus[] = ['DRAFT', 'SENT', 'APPROVED', 'CANCELLED'];
    if (query.status && validStatuses.includes(query.status as QuotationStatus)) {
      where.status = query.status as QuotationStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, code: true, name: true, phone: true } },
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

  async create(dto: CreateQuotationDto) {
    if (!dto.customerId) {
      throw new BadRequestException('Khách hàng là bắt buộc.');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Khách hàng không tồn tại.');
    }

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
        },
        include: QUOTATION_INCLUDE,
      });

      await tx.quotationTimeline.create({
        data: {
          quotationId: quotation.id,
          action: QuotationTimelineAction.QUOTATION_CREATED,
          payload: { code: quotation.code },
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

  async addItem(quotationId: string, dto: CreateQuotationItemDto) {
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
    const groupDiscount = Number(customerWithGroup?.customerGroup?.discountPercent ?? 0);

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

    const paramMap = new Map(product.parameters.map((p) => [p.name, p]));
    const displayOrder = dto.displayOrder ?? quotation.items.length;

    return this.prisma.quotationItem.create({
      data: {
        quotationId,
        productId: dto.productId,
        quantity: dto.quantity,
        pricingRuleVersionId: priceResult.pricingRuleVersionId,
        systemPrice,
        groupDiscount,
        additionalDiscountPercent,
        additionalDiscountAmount,
        discountReason: dto.discountReason?.trim() || null,
        discountBy: dto.discountBy?.trim() || null,
        finalPrice,
        subtotal,
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

  async updateItem(quotationId: string, itemId: string, dto: UpdateQuotationItemDto) {
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
    const discountBy =
      dto.discountBy !== undefined ? dto.discountBy?.trim() || null : item.discountBy;

    this.validateDiscountFields(
      additionalDiscountPercent,
      additionalDiscountAmount,
      discountReason,
    );

    const quantity = dto.quantity ?? Number(item.quantity);
    let systemPrice = Number(item.systemPrice);
    let pricingRuleVersionId = item.pricingRuleVersionId;
    const newParameters = dto.parameters;

    if (dto.parameters !== undefined) {
      const priceResult = await this.pricingEngine.calculate({
        productId: item.productId,
        parameters: dto.parameters,
      });
      systemPrice = priceResult.systemPrice;
      pricingRuleVersionId = priceResult.pricingRuleVersionId;
    }

    const groupDiscount = Number(item.groupDiscount);
    const finalPrice = this.calcFinalPrice(
      systemPrice,
      groupDiscount,
      additionalDiscountPercent,
      additionalDiscountAmount,
    );
    const subtotal = this.calcSubtotal(finalPrice, quantity);

    return this.prisma.$transaction(async (tx) => {
      if (newParameters !== undefined) {
        await tx.quotationItemParameter.deleteMany({ where: { quotationItemId: itemId } });

        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { parameters: { orderBy: { displayOrder: 'asc' } } },
        });
        const paramMap = new Map((product?.parameters ?? []).map((p) => [p.name, p]));

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
          quantity,
          systemPrice,
          pricingRuleVersionId,
          additionalDiscountPercent,
          additionalDiscountAmount,
          discountReason,
          discountBy,
          finalPrice,
          subtotal,
          ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
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

  async send(id: string) {
    const quotation = await this.findOne(id);

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new ForbiddenException(
        `Chỉ có thể gửi báo giá từ trạng thái Nháp. Trạng thái hiện tại: ${quotation.status}.`,
      );
    }

    if (quotation.items.length === 0) {
      throw new BadRequestException('Báo giá phải có ít nhất một sản phẩm trước khi gửi.');
    }

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
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Cancel (Task 05)
  // ─────────────────────────────────────────────────────

  async cancel(id: string, dto: CancelQuotationDto) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do huỷ là bắt buộc.');
    }

    const quotation = await this.findOne(id);

    if (quotation.status === QuotationStatus.CANCELLED) {
      throw new ForbiddenException('Báo giá đã ở trạng thái Đã huỷ.');
    }

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
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Manual Override (Task 08)
  // ─────────────────────────────────────────────────────

  async override(id: string, dto: OverrideQuotationDto) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do điều chỉnh là bắt buộc.');
    }

    const validStatuses = Object.values(QuotationStatus) as string[];
    if (!dto.newStatus || !validStatuses.includes(dto.newStatus)) {
      throw new BadRequestException(`Trạng thái "${dto.newStatus}" không hợp lệ.`);
    }

    const quotation = await this.findOne(id);

    if (quotation.status === (dto.newStatus as QuotationStatus)) {
      throw new BadRequestException('Trạng thái mới phải khác trạng thái hiện tại.');
    }

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
            overrideBy: dto.overrideBy?.trim() || null,
          },
          createdBy: dto.overrideBy?.trim() || null,
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Workflow: Approve (Task 06)
  // ─────────────────────────────────────────────────────

  async approve(id: string) {
    // Load full data for validation + snapshot
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
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
      throw new ForbiddenException('Báo giá đã được chuyển thành đơn hàng trước đó.');
    }

    if (quotation.items.length === 0) {
      throw new BadRequestException('Báo giá phải có ít nhất một sản phẩm trước khi duyệt.');
    }

    // Validate each item
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

      const activeMaterialVersion = item.product.materialRequirement?.versions[0];
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

    // All validations pass — execute in a single transaction
    return this.prisma.$transaction(async (tx) => {
      // Snapshot Rule (knowledge/modules/order.md): OrderBOM must be computed from
      // QuotationItem.materialRequirementVersionId — the exact version snapshotted when the
      // quotation item was priced — NOT the version currently marked ACTIVE on the product.
      // Fetch only those specific versions by id (no ACTIVE filter).
      const materialRequirementVersionIds = Array.from(
        new Set(
          quotation.items
            .map((i) => i.materialRequirementVersionId)
            .filter((v): v is string => !!v),
        ),
      );

      const materialRequirementVersions = materialRequirementVersionIds.length
        ? await tx.materialRequirementVersion.findMany({
            where: { id: { in: materialRequirementVersionIds } },
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
          })
        : [];
      const materialVersionMap = new Map(materialRequirementVersions.map((v) => [v.id, v]));

      type BomItemData = {
        materialId: string;
        materialCode: string;
        materialName: string;
        materialUnit: string | null;
        expression: string;
        wastePercent: number;
        roundType: RoundType;
        roundValue: number | null;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      };

      // Pre-compute BOM + plannedCost per item (pure calculation, no DB writes yet) so that
      // SalesOrder-level plannedCost/plannedProfit/totalProductionOrders are known upfront.
      const itemComputations = quotation.items.map((item) => {
        const materialVersion = item.materialRequirementVersionId
          ? materialVersionMap.get(item.materialRequirementVersionId)
          : undefined;

        // Build parameter map for expression evaluation
        const paramMap: Record<string, number> = {};
        for (const p of item.parameters) {
          const n = parseFloat(p.value);
          paramMap[p.name] = isNaN(n) ? 0 : n;
        }
        // Derived: area in m²
        const w = paramMap['width'] ?? 0;
        const h = paramMap['height'] ?? 0;
        paramMap['area'] = (w * h) / 1_000_000;

        let itemPlannedCost = 0;
        const bomItemsData: BomItemData[] = [];

        if (materialVersion) {
          for (const matReqItem of materialVersion.items) {
            let matQty = 0;
            try {
              matQty = this.evalExpression(matReqItem.expression, paramMap);
              matQty = matQty * (1 + Number(matReqItem.wastePercent) / 100);
              matQty = this.applyRounding(matQty, matReqItem.roundType, matReqItem.roundValue ? Number(matReqItem.roundValue) : 0);
              matQty = matQty * Number(item.quantity);
            } catch {
              matQty = 0;
            }

            const defaultPrice = matReqItem.material.prices[0];
            const unitPrice = defaultPrice ? Number(defaultPrice.price) : 0;
            const lineTotal = Math.round(matQty * unitPrice);
            itemPlannedCost += lineTotal;

            bomItemsData.push({
              materialId: matReqItem.materialId,
              materialCode: matReqItem.material.code,
              materialName: matReqItem.material.name,
              materialUnit: matReqItem.material.unit?.name ?? null,
              expression: matReqItem.expression,
              wastePercent: Number(matReqItem.wastePercent),
              roundType: matReqItem.roundType,
              roundValue: matReqItem.roundValue ? Number(matReqItem.roundValue) : null,
              quantity: matQty,
              unitPrice,
              lineTotal,
            });
          }
        }

        return { item, bomItemsData, itemPlannedCost };
      });

      // Planned Financials (order.md): computed once at creation, never re-derived later.
      const totalAmount = quotation.items.reduce((s, i) => s + Number(i.subtotal), 0);
      const plannedCost = itemComputations.reduce((s, c) => s + c.itemPlannedCost, 0);
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
      for (const { item, bomItemsData, itemPlannedCost } of itemComputations) {
        const soItem = await tx.salesOrderItem.create({
          data: {
            salesOrderId: salesOrder.id,
            productId: item.productId,
            productCode: item.product.code,
            productName: item.product.name,
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

        // Create OrderBOM if the quotation item had a material requirement version snapshotted
        if (item.materialRequirementVersionId && bomItemsData.length > 0) {
          await tx.orderBOM.create({
            data: {
              salesOrderId: salesOrder.id,
              salesOrderItemId: soItem.id,
              materialRequirementVersionId: item.materialRequirementVersionId,
              plannedCost: itemPlannedCost,
              items: { create: bomItemsData },
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

      // Write Timeline (Quotation)
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
      throw new BadRequestException('Lý do giảm giá là bắt buộc khi áp dụng chiết khấu thêm.');
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

  private evalExpression(expression: string, vars: Record<string, number>): number {
    const keys = Object.keys(vars);
    const values = Object.values(vars);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `"use strict"; return (${expression});`);
    const result = fn(...values);
    if (typeof result !== 'number' || !isFinite(result)) return 0;
    return result;
  }

  private applyRounding(value: number, roundType: RoundType, step: number): number {
    if (step <= 0 || roundType === RoundType.NONE) return value;
    switch (roundType) {
      case RoundType.CEIL:  return Math.ceil(value / step) * step;
      case RoundType.FLOOR: return Math.floor(value / step) * step;
      case RoundType.ROUND: return Math.round(value / step) * step;
      default: return value;
    }
  }
}
