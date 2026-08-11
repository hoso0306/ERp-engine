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
import { retryOnCodeConflict } from '../shared/retry-on-code-conflict';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import {
  BomEngineService,
  BomConfig,
  BomLine,
} from '../bom-engine/bom-engine.service';
import { PermissionService } from '../permission/permission.service';
import { SettingService } from '../setting/setting.service';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { CreateQuotationMaterialItemDto } from './dto/create-quotation-material-item.dto';
import { UpdateQuotationMaterialItemDto } from './dto/update-quotation-material-item.dto';
import { CancelQuotationDto } from './dto/cancel-quotation.dto';
import { OverrideQuotationDto } from './dto/override-quotation.dto';
import { DiscountQuotationDto } from './dto/discount-quotation.dto';

const EDITABLE_STATUSES: QuotationStatus[] = [
  QuotationStatus.DRAFT,
  QuotationStatus.SENT,
];

const QUOTATION_INCLUDE = {
  customer: {
    include: {
      customerGroup: { select: { id: true, name: true } },
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
      // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — chỉ có khi itemType=MATERIAL.
      material: {
        select: { id: true, code: true, name: true, isActive: true },
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
    private readonly permissionService: PermissionService,
    private readonly settingService: SettingService,
  ) {}

  // ─────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────

  async findAll(query: QuotationQueryDto, roleId?: string | null) {
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

    // 022-gia-von-loi-nhuan-bao-gia.md — Việc 5: totalCost/profit CHỈ tính +
    // trả về khi role có quotation.view-cost (OWNER/ADMIN). Không có quyền →
    // field này bị omit hẳn khỏi response, không phải giấu ở FE.
    const canViewCost = roleId
      ? await this.permissionService.hasPermission(
          roleId,
          'quotation.view-cost',
        )
      : false;

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
          items: canViewCost
            ? {
                select: {
                  id: true,
                  itemType: true,
                  productId: true,
                  materialId: true,
                  quantity: true,
                  subtotal: true,
                  parameters: { select: { name: true, value: true } },
                },
              }
            : { select: { id: true, subtotal: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    let resultData: unknown[] = data;
    if (canViewCost) {
      // Batch tính giá vốn cho TOÀN BỘ item trong trang hiện tại — 1 lần
      // batch (tránh N+1 theo từng báo giá), đúng lý do estimateItemsCost
      // được thiết kế nhận mảng phẳng nhiều nguồn khác nhau.
      const flatItems = (
        data as Array<{
          items: Array<{
            id: string;
            itemType: 'PRODUCT' | 'MATERIAL';
            productId: string | null;
            materialId: string | null;
            quantity: unknown;
            subtotal: unknown;
            parameters: Array<{ name: string; value: string }>;
          }>;
        }>
      ).flatMap((q) =>
        q.items.map((i) => ({
          id: i.id,
          itemType: i.itemType,
          productId: i.productId,
          materialId: i.materialId,
          quantity: Number(i.quantity),
          parameters: i.parameters,
        })),
      );
      const costByItemId = await this.estimateItemsCost(flatItems);

      resultData = (
        data as Array<{
          items: Array<{ id: string; subtotal: unknown }>;
        }>
      ).map((q) => {
        const totalCost = q.items.reduce(
          (s, i) => s + (costByItemId.get(i.id)?.totalCost ?? 0),
          0,
        );
        const totalSale = q.items.reduce((s, i) => s + Number(i.subtotal), 0);
        return { ...q, totalCost, profit: totalSale - totalCost };
      });
    }

    return {
      data: resultData,
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

  // 022-gia-von-loi-nhuan-bao-gia.md — Việc 4. Chỉ dùng cho endpoint đã gắn
  // @RequirePermission('quotation.view-cost') (OWNER/ADMIN) ở controller.
  async getCostSummary(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      select: {
        items: {
          select: {
            id: true,
            itemType: true,
            productId: true,
            materialId: true,
            productCode: true,
            productName: true,
            materialCode: true,
            materialName: true,
            quantity: true,
            finalPrice: true,
            subtotal: true,
            parameters: { select: { name: true, value: true } },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException('Báo giá không tồn tại.');
    }

    const costByItemId = await this.estimateItemsCost(
      quotation.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        productId: item.productId,
        materialId: item.materialId,
        quantity: Number(item.quantity),
        parameters: item.parameters,
      })),
    );

    const items = quotation.items.map((item) => {
      const cost = costByItemId.get(item.id)!;
      const totalSale = Number(item.subtotal);
      const profit = totalSale - cost.totalCost;

      return {
        quotationItemId: item.id,
        itemType: item.itemType,
        productId: item.productId,
        productCode: item.productCode ?? item.materialCode,
        productName: item.productName ?? item.materialName,
        quantity: Number(item.quantity),
        costUnitPrice: cost.costUnitPrice,
        saleUnitPrice: Number(item.finalPrice),
        totalCost: cost.totalCost,
        // Đã không gồm VAT sẵn (subtotal = finalPrice × quantity, VAT tách
        // riêng ở vatAmount) — khớp yêu cầu "tổng giá bán không tính VAT".
        totalSale,
        profit,
        costAvailable: cost.costAvailable,
      };
    });

    const totals = items.reduce(
      (acc, i) => ({
        totalCost: acc.totalCost + i.totalCost,
        totalSale: acc.totalSale + i.totalSale,
        profit: acc.profit + i.profit,
      }),
      { totalCost: 0, totalSale: 0, profit: 0 },
    );

    return {
      items,
      totals,
      hasIncompleteData: items.some((i) => !i.costAvailable),
    };
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

    const shippingFee = dto.shippingFee ?? 0;
    if (shippingFee < 0) {
      throw new BadRequestException('Phí vận chuyển không được âm.');
    }

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
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
            expectedDeliveryDate: dto.expectedDeliveryDate
              ? new Date(dto.expectedDeliveryDate)
              : null,
            note: dto.note?.trim() || null,
            shippingFee,
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
      }),
    );
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
    if (dto.expectedDeliveryDate !== undefined) {
      data.expectedDeliveryDate = dto.expectedDeliveryDate
        ? new Date(dto.expectedDeliveryDate)
        : null;
    }
    if (dto.note !== undefined) {
      data.note = dto.note?.trim() ?? null;
    }
    if (dto.shippingFee !== undefined) {
      if (dto.shippingFee < 0) {
        throw new BadRequestException('Phí vận chuyển không được âm.');
      }
      data.shippingFee = dto.shippingFee;
    }

    // Đổi khách hàng (chốt 24/07/2026) — chỉ cho phép khi đang Nháp, chặt hơn
    // EDITABLE_STATUSES chung (không cho đổi lúc Đã gửi). Check dựa vào status
    // HIỆN TẠI nên báo giá bị Manual Override từ Đã gửi về lại Nháp vẫn đổi
    // được khách hàng.
    if (
      dto.customerId !== undefined &&
      dto.customerId !== quotation.customerId
    ) {
      if (quotation.status !== QuotationStatus.DRAFT) {
        throw new ForbiddenException(
          'Chỉ có thể đổi khách hàng khi báo giá ở trạng thái Nháp.',
        );
      }

      const newCustomer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null },
      });
      if (!newCustomer) {
        throw new NotFoundException('Khách hàng không tồn tại.');
      }

      data.customer = { connect: { id: dto.customerId } };

      // Đổi khách hàng thì snapshot lại % Chiết khấu Khách hàng × Loại sản
      // phẩm cho TẤT CẢ dòng PRODUCT đã có theo khách hàng mới — quyết định
      // chốt 24/07/2026, tránh dòng cũ giữ chiết khấu của khách cũ. Dòng
      // MATERIAL (chốt 28/07/2026, sprint-04/025) không dùng Discount Engine
      // nên bỏ qua hoàn toàn ở đây.
      const productItems = quotation.items.filter(
        (i): i is typeof i & { productId: string } =>
          i.itemType === 'PRODUCT' && i.productId !== null,
      );
      if (productItems.length > 0) {
        const productIds = [...new Set(productItems.map((i) => i.productId))];
        const products = await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, productTypeId: true },
        });
        const productTypeIdByProductId = new Map(
          products.map((p) => [p.id, p.productTypeId]),
        );

        const productTypeIds = [
          ...new Set(products.map((p) => p.productTypeId)),
        ];
        const discounts = await this.prisma.customerProductDiscount.findMany({
          where: {
            customerId: dto.customerId,
            productTypeId: { in: productTypeIds },
          },
        });
        const discountPercentByProductTypeId = new Map(
          discounts.map((d) => [d.productTypeId, Number(d.discountPercent)]),
        );

        return this.prisma.$transaction(async (tx) => {
          for (const item of productItems) {
            const productTypeId = productTypeIdByProductId.get(item.productId);
            const discountPercent = productTypeId
              ? (discountPercentByProductTypeId.get(productTypeId) ?? 0)
              : 0;
            const finalPrice = this.calcFinalPrice(
              Number(item.systemPrice),
              discountPercent,
              Number(item.surchargeAfterDiscount),
            );
            const subtotal = this.calcSubtotal(
              finalPrice,
              Number(item.quantity),
            );
            const vatAmount = this.calcVatAmount(
              subtotal,
              Number(item.vatRate),
            );

            await tx.quotationItem.update({
              where: { id: item.id },
              data: { discountPercent, finalPrice, subtotal, vatAmount },
            });
          }

          return tx.quotation.update({
            where: { id },
            data,
            include: QUOTATION_INCLUDE,
          });
        });
      }
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

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        parameters: {
          include: { options: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }

    const priceResult = await this.pricingEngine.calculate({
      productId: dto.productId,
      parameters: dto.parameters,
    });

    // Snapshot % Chiết khấu Khách hàng × Loại sản phẩm (Sprint 04, chốt
    // 16/07/2026; đổi từ theo Sản phẩm sang theo Loại sản phẩm, chốt
    // 24/07/2026) — THAY THẾ HOÀN TOÀN CustomerGroup.discountPercent ("CK
    // nhóm"). Mặc định 0% nếu chưa cấu hình.
    const customerProductDiscount =
      await this.prisma.customerProductDiscount.findUnique({
        where: {
          customerId_productTypeId: {
            customerId: quotation.customerId,
            productTypeId: product.productTypeId,
          },
        },
      });
    const discountPercent = Number(
      customerProductDiscount?.discountPercent ?? 0,
    );

    const systemPrice = priceResult.systemPrice;
    const surchargeAfterDiscount = priceResult.surchargeAfterDiscount;
    const finalPrice = this.calcFinalPrice(
      systemPrice,
      discountPercent,
      surchargeAfterDiscount,
    );
    const subtotal = this.calcSubtotal(finalPrice, dto.quantity);
    const vatRate = priceResult.vatRate;
    const vatAmount = this.calcVatAmount(subtotal, vatRate);

    const paramMap = new Map(product.parameters.map((p) => [p.name, p]));
    const displayOrder = dto.displayOrder ?? quotation.items.length;
    const areaParamCreate = this.buildAreaParameterCreate(
      priceResult.rawArea,
      dto.parameters.length,
    );

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
        unitPrice: priceResult.unitPrice,
        discountPercent,
        surchargeAfterDiscount,
        finalPrice,
        subtotal,
        vatRate,
        vatAmount,
        note: dto.note?.trim() || null,
        // Snapshot cảnh báo Validation Rule tại thời điểm tính giá (Task 06)
        warnings: priceResult.warnings,
        displayOrder,
        parameters: {
          create: [
            ...dto.parameters.map((p, idx) => {
              const productParam = paramMap.get(p.name);
              return {
                name: p.name,
                label: productParam?.label ?? p.name,
                value: p.value,
                valueLabel: this.resolveValueLabel(productParam, p.value),
                unit: productParam?.unit ?? null,
                displayOrder: productParam?.displayOrder ?? idx,
              };
            }),
            ...(areaParamCreate ? [areaParamCreate] : []),
          ],
        },
      },
      include: {
        product: { select: { id: true, code: true, name: true } },
        parameters: { orderBy: { displayOrder: 'asc' } },
      },
    });
  }

  // Snapshot biến phái sinh "area" (BG000031, chốt 11/08/2026) — sản phẩm
  // không có cặp chieurong/chieucao (Mái hiên, Bạt xếp...) không thể tính M2
  // trên bản in từ 2 tham số đó. Chỉ snapshot đúng "area" (không snapshot
  // các biến phái sinh phụ trợ khác như "dientichvai" — chỉ dùng nội bộ tính
  // định mức, không phải số đo hiển thị cho khách). Lưu GIÁ TRỊ GỐC
  // (priceResult.rawArea, trước MIN_AREA/BILLABLE_STEP) — cùng nguyên tắc
  // hiển thị kích thước gốc khách đặt như chieurong/chieucao.
  private buildAreaParameterCreate(
    rawArea: number | null,
    rawParamCount: number,
  ): { name: string; label: string; value: string; valueLabel: null; unit: string; displayOrder: number } | null {
    if (typeof rawArea !== 'number') return null;
    return {
      name: 'area',
      label: 'Diện tích',
      value: String(rawArea),
      valueLabel: null,
      unit: 'm²',
      displayOrder: rawParamCount,
    };
  }

  // 009-in-phieu-san-xuat.md (workbench/sprint-04) — snapshot nhãn hiển thị của option ENUM đã
  // chọn (vd "cuaso" → "Cửa sổ") tại thời điểm thêm/sửa dòng báo giá, để bản
  // in Phiếu sản xuất không phải đọc lại Master Data (ProductParameterOption)
  // — đúng nguyên tắc Snapshot. `value` giữ nguyên mã gốc, CHỈ thêm field mới
  // để hiển thị, không đổi hành vi tính giá/định mức đang đọc `value`.
  private resolveValueLabel(
    productParam:
      { options: { value: string; label: string | null }[] } | undefined,
    value: string,
  ): string | null {
    return productParam?.options.find((o) => o.value === value)?.label ?? null;
  }

  async updateItem(
    quotationId: string,
    itemId: string,
    dto: UpdateQuotationItemDto,
  ) {
    const quotation = await this.findOne(quotationId);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Không thể chỉnh sửa sản phẩm trong báo giá ở trạng thái ${quotation.status}.`,
      );
    }

    const item = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId, itemType: 'PRODUCT' },
      include: { parameters: true },
    });

    if (!item || !item.productId) {
      throw new NotFoundException('Dòng sản phẩm không tồn tại.');
    }
    const productId = item.productId;

    if (dto.quantity !== undefined && dto.quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0.');
    }

    const quantity = dto.quantity ?? Number(item.quantity);
    let systemPrice = Number(item.systemPrice);
    let unitPrice = item.unitPrice !== null ? Number(item.unitPrice) : null;
    let pricingRuleVersionId = item.pricingRuleVersionId;
    let warnings = item.warnings as string[] | null;
    let vatRate = Number(item.vatRate);
    let surchargeAfterDiscount = Number(item.surchargeAfterDiscount ?? 0);
    const newParameters = dto.parameters;
    let rawArea: number | null = null;

    if (dto.parameters !== undefined) {
      const priceResult = await this.pricingEngine.calculate({
        productId,
        parameters: dto.parameters,
      });
      systemPrice = priceResult.systemPrice;
      unitPrice = priceResult.unitPrice;
      pricingRuleVersionId = priceResult.pricingRuleVersionId;
      warnings = priceResult.warnings;
      vatRate = priceResult.vatRate;
      surchargeAfterDiscount = priceResult.surchargeAfterDiscount;
      rawArea = priceResult.rawArea;
    }

    // discountPercent là snapshot cố định từ lúc thêm dòng (giống hệt cách
    // groupDiscount cũ hoạt động) — sửa dòng không lookup lại CustomerProductDiscount.
    const discountPercent = Number(item.discountPercent);
    const finalPrice = this.calcFinalPrice(
      systemPrice,
      discountPercent,
      surchargeAfterDiscount,
    );
    // subtotal (và do đó vatAmount) luôn tính lại dù tham số không đổi —
    // số lượng có thể đổi độc lập với tham số sản phẩm.
    const subtotal = this.calcSubtotal(finalPrice, quantity);
    const vatAmount = this.calcVatAmount(subtotal, vatRate);

    // Snapshot Rule (quotation.md): snapshot productCode/productName tại thời
    // điểm thêm/SỬA dòng — refresh lại mỗi lần sửa khi còn Draft/Sent.
    const snapshotProduct = await this.prisma.product.findUnique({
      where: { id: productId },
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
          where: { id: productId },
          include: {
            parameters: {
              include: { options: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        });
        const paramMap = new Map(
          (product?.parameters ?? []).map((p) => [p.name, p]),
        );

        const areaParamCreate = this.buildAreaParameterCreate(
          rawArea,
          newParameters.length,
        );

        await tx.quotationItemParameter.createMany({
          data: [
            ...newParameters.map((p, idx) => {
              const productParam = paramMap.get(p.name);
              return {
                quotationItemId: itemId,
                name: p.name,
                label: productParam?.label ?? p.name,
                value: p.value,
                valueLabel: this.resolveValueLabel(productParam, p.value),
                unit: productParam?.unit ?? null,
                displayOrder: productParam?.displayOrder ?? idx,
              };
            }),
            ...(areaParamCreate
              ? [{ quotationItemId: itemId, ...areaParamCreate }]
              : []),
          ],
        });
      }

      return tx.quotationItem.update({
        where: { id: itemId },
        data: {
          productCode: snapshotProduct.code,
          productName: snapshotProduct.name,
          quantity,
          systemPrice,
          unitPrice,
          pricingRuleVersionId,
          surchargeAfterDiscount,
          finalPrice,
          subtotal,
          vatRate,
          vatAmount,
          warnings: warnings ?? [],
          ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
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
  // Bán lẻ Vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025) — dòng
  // MATERIAL, không qua CTO/Pricing Rule/Material Requirement. Giá cố định
  // theo Material.retailPrice, KHÔNG áp Discount Engine (quyết định mục 2) —
  // người dùng vẫn sửa tay được finalPrice qua updateMaterialItem.
  // ─────────────────────────────────────────────────────

  async addMaterialItem(
    quotationId: string,
    dto: CreateQuotationMaterialItemDto,
  ) {
    const quotation = await this.findOne(quotationId);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Không thể thêm vật tư vào báo giá ở trạng thái ${quotation.status}.`,
      );
    }

    if (!dto.materialId) {
      throw new BadRequestException('Vật tư là bắt buộc.');
    }
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0.');
    }

    const material = await this.prisma.material.findUnique({
      where: { id: dto.materialId },
      include: {
        unit: { select: { name: true } },
        retailUnit: { select: { name: true } },
      },
    });
    if (!material) {
      throw new NotFoundException('Vật tư không tồn tại.');
    }
    if (!material.isActive) {
      throw new BadRequestException('Vật tư đã ngừng sử dụng.');
    }
    if (!material.isRetailable) {
      throw new BadRequestException('Vật tư này chưa được bật bán lẻ.');
    }
    if (material.retailPrice === null || Number(material.retailPrice) <= 0) {
      throw new BadRequestException('Vật tư chưa có giá bán lẻ hợp lệ.');
    }

    const systemPrice = Number(material.retailPrice);
    // finalPrice có thể sửa tay (không có Discount Engine cho dòng vật tư).
    const finalPrice =
      dto.finalPrice !== undefined
        ? Math.round(dto.finalPrice)
        : Math.round(systemPrice);
    if (finalPrice < 0) {
      throw new BadRequestException('Giá bán không được âm.');
    }
    const subtotal = this.calcSubtotal(finalPrice, dto.quantity);
    const vatRate = Number(material.retailVatRate);
    const vatAmount = this.calcVatAmount(subtotal, vatRate);
    const displayOrder = dto.displayOrder ?? quotation.items.length;

    return this.prisma.quotationItem.create({
      data: {
        quotationId,
        itemType: 'MATERIAL',
        materialId: material.id,
        // Snapshot tại thời điểm thêm dòng — đơn vị đọc theo retailUnit nếu có
        // set riêng, không thì dùng unit gốc (đúng thiết kế sprint-04/025).
        materialCode: material.code,
        materialName: material.name,
        materialUnit: material.retailUnit?.name ?? material.unit.name,
        quantity: dto.quantity,
        systemPrice,
        discountPercent: 0,
        surchargeAfterDiscount: 0,
        finalPrice,
        subtotal,
        vatRate,
        vatAmount,
        note: dto.note?.trim() || null,
        displayOrder,
      },
      include: {
        material: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateMaterialItem(
    quotationId: string,
    itemId: string,
    dto: UpdateQuotationMaterialItemDto,
  ) {
    const quotation = await this.findOne(quotationId);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Không thể chỉnh sửa vật tư trong báo giá ở trạng thái ${quotation.status}.`,
      );
    }

    const item = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId, itemType: 'MATERIAL' },
    });
    if (!item) {
      throw new NotFoundException('Dòng vật tư không tồn tại.');
    }

    if (dto.quantity !== undefined && dto.quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0.');
    }

    const quantity = dto.quantity ?? Number(item.quantity);
    const finalPrice =
      dto.finalPrice !== undefined
        ? Math.round(dto.finalPrice)
        : Number(item.finalPrice);
    if (finalPrice < 0) {
      throw new BadRequestException('Giá bán không được âm.');
    }
    const subtotal = this.calcSubtotal(finalPrice, quantity);
    const vatAmount = this.calcVatAmount(subtotal, Number(item.vatRate));

    return this.prisma.quotationItem.update({
      where: { id: itemId },
      data: {
        quantity,
        finalPrice,
        subtotal,
        vatAmount,
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
      },
      include: {
        material: { select: { id: true, code: true, name: true } },
      },
    });
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
      unitPrice: number | null;
      pricingRuleVersionId: string;
      surchargeAfterDiscount: number;
      finalPrice: number;
      subtotal: number;
      vatRate: number;
      vatAmount: number;
      warnings: string[];
    }> = [];

    // Dòng MATERIAL (chốt 28/07/2026, sprint-04/025) không có Pricing Rule —
    // giá cố định theo Material.retailPrice, bỏ qua hoàn toàn ở "Tính lại giá".
    for (const item of quotation.items) {
      if (item.itemType !== 'PRODUCT' || !item.productId) continue;
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
        Number(item.discountPercent),
        priceResult.surchargeAfterDiscount,
      );
      const newSubtotal = this.calcSubtotal(
        newFinalPrice,
        Number(item.quantity),
      );
      const newVatAmount = this.calcVatAmount(newSubtotal, priceResult.vatRate);

      changes.push({
        itemId: item.id,
        productCode: item.productCode ?? '',
        productName: item.productName ?? '',
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
        unitPrice: priceResult.unitPrice,
        pricingRuleVersionId: priceResult.pricingRuleVersionId,
        surchargeAfterDiscount: priceResult.surchargeAfterDiscount,
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
            unitPrice: u.unitPrice,
            pricingRuleVersionId: u.pricingRuleVersionId,
            surchargeAfterDiscount: u.surchargeAfterDiscount,
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
  // Workflow: Giảm thêm cấp toàn báo giá (Sprint 04, chốt 16/07/2026)
  // ─────────────────────────────────────────────────────

  // Giảm thêm chuyển từ cấp dòng sản phẩm lên cấp toàn báo giá — chỉ giảm
  // bằng số tiền mặt, áp trên Tổng thanh toán (đã gồm VAT). Không ghi Timeline
  // riêng — audit đã có sẵn trong 3 field discountAmount/discountReason/discountBy
  // (tiền lệ đã chốt: quotation.md "Giảm giá thêm đã có audit riêng").
  async discount(
    id: string,
    dto: DiscountQuotationDto,
    userId?: string | null,
  ) {
    const quotation = await this.findOne(id);

    if (!EDITABLE_STATUSES.includes(quotation.status)) {
      throw new ForbiddenException(
        `Chỉ có thể áp Giảm thêm khi báo giá ở trạng thái Nháp hoặc Đã gửi. Trạng thái hiện tại: ${quotation.status}.`,
      );
    }

    const amount = dto.amount ?? 0;
    if (amount < 0) {
      throw new BadRequestException('Giảm thêm không được âm.');
    }

    const totalPayable = quotation.items.reduce(
      (s, i) => s + Number(i.subtotal) + Number(i.vatAmount),
      0,
    );
    if (amount > totalPayable) {
      throw new BadRequestException(
        'Giảm thêm không được vượt quá Tổng thanh toán (Tổng tiền hàng + VAT).',
      );
    }

    if (amount > 0 && !dto.reason?.trim()) {
      throw new BadRequestException(
        'Lý do giảm giá là bắt buộc khi áp dụng Giảm thêm.',
      );
    }

    return this.prisma.quotation.update({
      where: { id },
      data: {
        discountAmount: amount,
        discountReason: amount > 0 ? dto.reason!.trim() : null,
        discountBy: amount > 0 ? (userId ?? null) : null,
      },
      include: QUOTATION_INCLUDE,
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
                // ENUM param (vd "socanh") không được ép kiểu số khi coerceParameters()
                // — nếu không, condition BOM dạng `socanh == "1"` lỗi lệch kiểu
                // (phát hiện khi backfill 022-gia-von-loi-nhuan-bao-gia.md Việc 9,
                // cùng pattern PricingEngineService.enumParameterNames).
                parameters: { where: { type: 'ENUM' }, select: { name: true } },
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
            // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — chỉ có khi
            // itemType=MATERIAL, dùng giá vốn MaterialPrice mặc định, không
            // qua Pricing Rule/Material Requirement/Production.
            material: {
              include: {
                prices: {
                  where: { isDefault: true },
                  orderBy: { effectiveFrom: 'desc' },
                  take: 1,
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
    // materialRequirementVersionId dùng để tính BOM (Việc 1, 022-gia-von-loi-nhuan-bao-gia
    // — fix bug plannedCost luôn = 0): QuotationItem KHÔNG snapshot field này ở
    // Draft/Sent (chỉ pricingRuleVersionId), nên phải lấy từ version ACTIVE vừa
    // validate ở đây, không đọc lại item.materialRequirementVersionId (luôn null).
    const materialVersionIdByItem = new Map<string, string>();
    // Tên tham số ENUM của sản phẩm (vd "socanh") — coerceParameters() cần biết
    // để KHÔNG ép giá trị ENUM giống số (vd "1") sang number, nếu không condition
    // BOM dạng `socanh == "1"` lệch kiểu khi so sánh (cùng pattern PricingEngine).
    const enumParamNamesByItem = new Map<string, string[]>();
    // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — giá vốn/đơn vị (đã quy
    // đổi theo retailConversionFactor nếu có) cho từng dòng MATERIAL.
    const retailCostUnitByItem = new Map<string, number>();

    for (const item of quotation.items) {
      if (item.itemType === 'MATERIAL') {
        const material = item.material;
        if (!material) {
          throw new BadRequestException(
            `Dòng vật tư "${item.materialName}" không còn tồn tại.`,
          );
        }
        if (!material.isActive || !material.isRetailable) {
          throw new BadRequestException(
            `Vật tư "${material.name}" không còn được bán lẻ. Vui lòng cập nhật báo giá.`,
          );
        }
        const costPrice = material.prices[0]?.price;
        if (costPrice === undefined) {
          throw new BadRequestException(
            `Vật tư "${material.name}" chưa có giá vốn (giá nhập) mặc định.`,
          );
        }
        const factor = material.retailConversionFactor
          ? Number(material.retailConversionFactor)
          : 1;
        retailCostUnitByItem.set(item.id, Number(costPrice) * factor);

        if (Number(item.finalPrice) < 0) {
          throw new BadRequestException(
            `Giá bán của vật tư "${material.name}" không được âm.`,
          );
        }
        continue;
      }

      if (!item.product) {
        throw new BadRequestException(
          `Dòng sản phẩm "${item.productName}" không còn tồn tại.`,
        );
      }

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
          productCode: item.productCode ?? '',
          productName: item.productName ?? '',
        });
      }

      const activeMaterialVersion =
        item.product.materialRequirement?.versions[0];
      if (!activeMaterialVersion) {
        throw new BadRequestException(
          `Sản phẩm "${item.product.name}" không có Phiên bản Định mức vật tư đang hoạt động.`,
        );
      }
      materialVersionIdByItem.set(item.id, activeMaterialVersion.id);
      enumParamNamesByItem.set(
        item.id,
        item.product.parameters.map((p) => p.name),
      );

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

    // Planned Financials (order.md): computed once, never re-derived later.
    // VAT + Giảm thêm (Sprint 04, chốt 16/07/2026): grandTotal là số tiền hoá
    // đơn thực tế — chặn rõ ràng nếu âm, KHÔNG cho Approve âm thầm.
    const totalAmount = quotation.items.reduce(
      (s, i) => s + Number(i.subtotal),
      0,
    );
    const totalVatAmount = quotation.items.reduce(
      (s, i) => s + Number(i.vatAmount),
      0,
    );
    // Phí vận chuyển (chốt 27/07/2026) — cộng thẳng vào grandTotal, không chịu
    // VAT, không ảnh hưởng plannedProfit (khoản thu hộ khách).
    const shippingFee = Number(quotation.shippingFee);
    const grandTotal =
      totalAmount +
      totalVatAmount -
      Number(quotation.discountAmount) +
      shippingFee;
    if (grandTotal < 0) {
      throw new BadRequestException(
        'Không thể duyệt: Giảm thêm vượt quá Tổng thanh toán (Tổng tiền hàng + VAT).',
      );
    }
    // Công nợ song song trước-VAT (023-cong-no-truoc-sau-vat) — Giảm thêm trừ
    // vào cả 2 mức, nên chênh lệch giữa 2 track luôn đúng bằng totalVatAmount.
    // shippingFee không chịu VAT nên cộng đều vào cả 2 mức, giữ nguyên bất
    // biến này (xem vat-settlement.service.ts — tính VAT phải nộp từ chênh
    // lệch totalAmount - totalAmountBeforeVat của Receivable).
    const totalAmountBeforeVat =
      totalAmount - Number(quotation.discountAmount) + shippingFee;

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

    // Snapshot Rule (knowledge/modules/quotation.md mục "Khi Pricing Rule đổi
    // version giữa chừng"): giá vốn/BOM luôn tính tại Approve bằng Material
    // Requirement Version đang ACTIVE hiện tại (materialVersionIdByItem, đã
    // resolve + validate ở vòng lặp trên) — KHÔNG có khái niệm "đã snapshot
    // sớm" như Pricing Rule Version. Version đã kích hoạt là bất biến nên load
    // được trước transaction; toàn bộ tính toán là hàm thuần của BOM Engine
    // (Filter theo condition → Formula → Waste → Round).
    const bomConfigCache = new Map<string, BomConfig>();
    const itemComputations: Array<{
      item: (typeof quotation.items)[number];
      materialRequirementVersionId: string;
      bomLines: BomLine[];
      itemPlannedCost: number;
    }> = [];
    // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — giá vốn không qua BOM,
    // tính trực tiếp từ retailCostUnitByItem × quantity.
    const materialItemComputations: Array<{
      item: (typeof quotation.items)[number];
      itemPlannedCost: number;
    }> = [];

    for (const item of quotation.items) {
      if (item.itemType === 'MATERIAL') {
        const costUnit = retailCostUnitByItem.get(item.id) ?? 0;
        materialItemComputations.push({
          item,
          itemPlannedCost: Math.round(costUnit * Number(item.quantity)),
        });
        continue;
      }

      const materialRequirementVersionId = materialVersionIdByItem.get(
        item.id,
      )!;

      let config = bomConfigCache.get(materialRequirementVersionId);
      if (!config) {
        config = await this.bomEngine.loadConfigForVersion(
          materialRequirementVersionId,
        );
        bomConfigCache.set(materialRequirementVersionId, config);
      }

      // BOM nhận KÍCH THƯỚC GỐC khách đặt — không bao giờ nhận billable
      // params của Pricing Engine (nguyên tắc billable ≠ actual).
      const rawParams = coerceParameters(
        item.parameters,
        enumParamNamesByItem.get(item.id),
      );
      const bomResult = this.bomEngine.calculateBom(
        config,
        rawParams,
        Number(item.quantity),
      );

      itemComputations.push({
        item,
        materialRequirementVersionId,
        bomLines: bomResult.lines,
        itemPlannedCost: bomResult.plannedCost,
      });
    }

    // All validations pass — execute in a single transaction
    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const plannedCost =
          itemComputations.reduce((s, c) => s + c.itemPlannedCost, 0) +
          materialItemComputations.reduce((s, c) => s + c.itemPlannedCost, 0);
        // Trừ thêm discountAmount (Giảm thêm cấp toàn báo giá, chốt 18/07/2026 —
        // Review Nghiệp vụ Tài chính, Finding #1): grandTotal (Receivable) đã trừ
        // đúng, plannedProfit trước đây bị bỏ sót → lợi nhuận kế hoạch bị thổi
        // phồng đúng bằng số tiền Giảm thêm.
        const plannedProfit =
          totalAmount - plannedCost - Number(quotation.discountAmount);
        // Dòng MATERIAL không sinh Production Order — chỉ đếm xưởng của dòng PRODUCT.
        const totalProductionOrders = new Set(
          itemComputations.map((c) => c.item.product!.productionCenterId),
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
            // Địa chỉ giao hàng (009-in-phieu-san-xuat.md) — auto copy từ
            // Customer tại Approve, sau đó là nguồn dữ liệu địa chỉ giao hàng
            // duy nhất cho đơn (sửa được qua updateDeliveryAddress(), không đọc
            // lại Customer).
            deliveryName: quotation.customer.name,
            deliveryPhone: quotation.customer.phone,
            deliveryAddress: quotation.customer.address,
            deliveryProvince: quotation.customer.province,
            deliveryDistrict: quotation.customer.district,
            deliveryWard: quotation.customer.ward,
            // Thông tin nhà xe mặc định (chốt 24/07/2026) — auto copy từ
            // Customer.defaultCarrier* tại Approve nếu khách có sẵn, giống hệt
            // cách deliveryAddress hoạt động. Customer không có default thì vẫn
            // để trống như trước, người dùng tự nhập qua CarrierInfoDialog. Sau
            // Approve không đọc lại Customer nữa — sửa được qua carrier info
            // dialog ở từng đơn.
            carrierName: quotation.customer.defaultCarrierName,
            carrierPhone: quotation.customer.defaultCarrierPhone,
            carrierNote: quotation.customer.defaultCarrierNote,
            // Hạn giao hàng (fix 19/07/2026) — snapshot từ Quotation.expectedDeliveryDate
            // (nhập tay lúc tạo/sửa báo giá) tại Approve, không đọc lại Quotation sau đó.
            expectedDeliveryDate: quotation.expectedDeliveryDate,
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
            // VAT + Giảm thêm (Sprint 04, chốt 16/07/2026) — snapshot từ Quotation
            // tại Approve. totalAmount (doanh thu) giữ nguyên công thức cũ.
            totalVatAmount,
            discountAmount: quotation.discountAmount,
            discountReason: quotation.discountReason,
            discountBy: quotation.discountBy,
            shippingFee: quotation.shippingFee,
            grandTotal,
          },
        });

        // Task 02 (Debt module) — Receivable sinh đồng thời với SalesOrder, cùng
        // transaction — snapshot Credit Policy (debtLimitSnapshot/debtTermDaysSnapshot)
        // từ Customer tại thời điểm này. dueDate = NULL cho tới khi Delivered.
        // totalAmount/remainingAmount = grandTotal (số tiền thực thu, đã gồm VAT
        // và trừ Giảm thêm — chốt 16/07/2026), KHÔNG phải doanh thu totalAmount.
        await tx.receivable.create({
          data: {
            salesOrderId: salesOrder.id,
            customerId: quotation.customerId,
            totalAmount: grandTotal,
            remainingAmount: grandTotal,
            totalAmountBeforeVat,
            remainingAmountBeforeVat: totalAmountBeforeVat,
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
        for (const {
          item,
          materialRequirementVersionId,
          bomLines,
          itemPlannedCost,
        } of itemComputations) {
          const product = item.product!;
          const soItem = await tx.salesOrderItem.create({
            data: {
              salesOrderId: salesOrder.id,
              itemType: 'PRODUCT',
              productId: item.productId,
              productCode: product.code,
              productName: product.name,
              // Redundant Reference + snapshot phục vụ Báo cáo B2/B4 (report.md)
              // — copy trong transaction Approve, không đọc lại Master Data sau đó.
              productTypeId: product.productTypeId,
              productTypeName: product.productType.name,
              productionCenterId: product.productionCenterId,
              productionCenterName: product.productionCenter.name,
              pricingRuleVersionId: item.pricingRuleVersionId,
              systemPrice: Number(item.systemPrice),
              unitPrice:
                item.unitPrice !== null ? Number(item.unitPrice) : null,
              discountPercent: Number(item.discountPercent),
              // Snapshot y nguyên, không tính lại (023-phu-phi) — giống finalPrice.
              surchargeAfterDiscount: Number(item.surchargeAfterDiscount ?? 0),
              finalPrice: Number(item.finalPrice),
              quantity: Number(item.quantity),
              subtotal: Number(item.subtotal),
              vatRate: Number(item.vatRate),
              vatAmount: Number(item.vatAmount),
              note: item.note,
              materialRequirementVersionId,
              plannedCost: itemPlannedCost,
              displayOrder: item.displayOrder,
              parameters: {
                create: item.parameters.map((p) => ({
                  name: p.name,
                  label: p.label,
                  value: p.value,
                  valueLabel: p.valueLabel,
                  unit: p.unit,
                  displayOrder: p.displayOrder,
                })),
              },
            },
          });

          // Chỉ chứa các dòng đã qua Filter condition — vật tư không thuộc config
          // khách chọn (vd màu khác) không xuất hiện trong OrderBOM.
          if (bomLines.length > 0) {
            await tx.orderBOM.create({
              data: {
                salesOrderId: salesOrder.id,
                salesOrderItemId: soItem.id,
                materialRequirementVersionId,
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
          const centerId = product.productionCenterId;
          const centerName = product.productionCenter.name;
          if (!centerMap.has(centerId)) {
            centerMap.set(centerId, { centerName, items: [] });
          }
          centerMap.get(centerId)!.items.push({
            salesOrderItemId: soItem.id,
            productId: item.productId!,
            productCode: product.code,
            productName: product.name,
            quantity: Number(item.quantity),
          });
        }

        // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — tạo SalesOrderItem
        // riêng cho dòng MATERIAL, KHÔNG group vào centerMap (không sinh
        // Production Order — vật tư bán lẻ khách tự lắp, không qua sản xuất).
        for (const { item, itemPlannedCost } of materialItemComputations) {
          await tx.salesOrderItem.create({
            data: {
              salesOrderId: salesOrder.id,
              itemType: 'MATERIAL',
              materialId: item.materialId,
              materialCode: item.materialCode,
              materialName: item.materialName,
              materialUnit: item.materialUnit,
              systemPrice: Number(item.systemPrice),
              discountPercent: Number(item.discountPercent),
              surchargeAfterDiscount: Number(item.surchargeAfterDiscount ?? 0),
              finalPrice: Number(item.finalPrice),
              quantity: Number(item.quantity),
              subtotal: Number(item.subtotal),
              vatRate: Number(item.vatRate),
              vatAmount: Number(item.vatAmount),
              note: item.note,
              plannedCost: itemPlannedCost,
              displayOrder: item.displayOrder,
            },
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
      }),
    );
  }

  // ─────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────

  // surchargeAfterDiscount (023-phu-phi) — cộng SAU khi áp discountPercent,
  // không bị chiết khấu ăn vào (vd rèm cầu vồng: máng nhôm +20.000đ/m² dù
  // khách được CK 60%). Từ PricingRuleVersion.surchargeExpression, tính riêng
  // ở Pricing Engine (KHÔNG nằm trong systemPrice).
  private calcFinalPrice(
    systemPrice: number,
    discountPercent: number,
    surchargeAfterDiscount = 0,
  ): number {
    const final =
      systemPrice * (1 - discountPercent / 100) + surchargeAfterDiscount;

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

  // 022-gia-von-loi-nhuan-bao-gia.md — Giá vốn ƯỚC TÍNH (không phải snapshot)
  // dùng cho tính năng xem lãi/lỗ của OWNER/ADMIN. Áp dụng cho MỌI trạng thái
  // báo giá (kể cả Approved) — luôn tính bằng Material Requirement Version
  // đang ACTIVE hiện tại của sản phẩm, KHÔNG đọc plannedCost đã snapshot trên
  // SalesOrderItem (trước khi backfill, dữ liệu đó = 0 do bug đã fix ở Việc 1;
  // sau backfill vẫn chỉ là số liệu tại một thời điểm, không phải "giá vốn
  // hiện tại" nếu định mức đã đổi). Batch fetch theo productId để tránh N+1
  // khi gọi cho nhiều dòng/nhiều báo giá cùng lúc (dùng chung cho cost-summary
  // 1 báo giá lẫn danh sách nhiều báo giá).
  private async estimateItemsCost(
    inputs: Array<{
      id: string;
      itemType?: 'PRODUCT' | 'MATERIAL';
      productId: string | null;
      materialId?: string | null;
      quantity: number;
      parameters: Array<{ name: string; value: string }>;
    }>,
  ): Promise<
    Map<
      string,
      { costUnitPrice: number; totalCost: number; costAvailable: boolean }
    >
  > {
    const result = new Map<
      string,
      { costUnitPrice: number; totalCost: number; costAvailable: boolean }
    >();
    if (inputs.length === 0) return result;

    // Bán lẻ vật tư (chốt 28/07/2026, sprint-04/025) — giá vốn KHÔNG qua BOM,
    // tính trực tiếp từ MaterialPrice mặc định × hệ số quy đổi (nếu bán theo
    // đơn vị khác đơn vị gốc).
    const materialInputs = inputs.filter((i) => i.itemType === 'MATERIAL');
    if (materialInputs.length > 0) {
      const materialIds = [
        ...new Set(
          materialInputs
            .map((i) => i.materialId)
            .filter((v): v is string => !!v),
        ),
      ];
      const materials = await this.prisma.material.findMany({
        where: { id: { in: materialIds } },
        include: {
          prices: {
            where: { isDefault: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
            select: { price: true },
          },
        },
      });
      const materialById = new Map(materials.map((m) => [m.id, m]));
      for (const input of materialInputs) {
        const material = input.materialId
          ? materialById.get(input.materialId)
          : undefined;
        const costPrice = material?.prices[0]?.price;
        if (!material || costPrice === undefined) {
          result.set(input.id, {
            costUnitPrice: 0,
            totalCost: 0,
            costAvailable: false,
          });
          continue;
        }
        const factor = material.retailConversionFactor
          ? Number(material.retailConversionFactor)
          : 1;
        const costUnitPrice = Number(costPrice) * factor;
        result.set(input.id, {
          costUnitPrice,
          totalCost: costUnitPrice * input.quantity,
          costAvailable: true,
        });
      }
    }

    const productInputs = inputs.filter((i) => i.itemType !== 'MATERIAL');
    const productIds = [
      ...new Set(
        productInputs.map((i) => i.productId).filter((v): v is string => !!v),
      ),
    ];
    if (productIds.length === 0) return result;
    const materialRequirements = await this.prisma.materialRequirement.findMany(
      {
        where: { productId: { in: productIds } },
        include: {
          versions: {
            where: { status: VersionStatus.ACTIVE },
            take: 1,
          },
          // ENUM param (vd "socanh") không được ép kiểu số khi coerceParameters()
          // — cùng lý do đã sửa ở approve() (xem comment enumParamNamesByItem).
          product: {
            select: {
              parameters: { where: { type: 'ENUM' }, select: { name: true } },
            },
          },
        },
      },
    );
    const activeVersionIdByProductId = new Map<string, string>();
    const enumParamNamesByProductId = new Map<string, string[]>();
    for (const mr of materialRequirements) {
      const activeVersion = mr.versions[0];
      if (activeVersion) {
        activeVersionIdByProductId.set(mr.productId, activeVersion.id);
      }
      enumParamNamesByProductId.set(
        mr.productId,
        mr.product.parameters.map((p) => p.name),
      );
    }

    const configCache = new Map<string, BomConfig>();
    for (const input of productInputs) {
      const productId = input.productId;
      if (!productId) continue;
      const versionId = activeVersionIdByProductId.get(productId);
      if (!versionId) {
        // Sản phẩm chưa có Material Requirement Version ACTIVE (có thể xảy ra
        // ở Draft/Sent — Approve mới bắt buộc) — không chặn, chỉ đánh dấu
        // thiếu dữ liệu để FE hiện "—".
        result.set(input.id, {
          costUnitPrice: 0,
          totalCost: 0,
          costAvailable: false,
        });
        continue;
      }

      let config = configCache.get(versionId);
      if (!config) {
        config = await this.bomEngine.loadConfigForVersion(versionId);
        configCache.set(versionId, config);
      }

      // BOM nhận KÍCH THƯỚC GỐC khách đặt — không bao giờ nhận billable params
      // của Pricing Engine (nguyên tắc billable ≠ actual).
      const rawParams = coerceParameters(
        input.parameters,
        enumParamNamesByProductId.get(productId),
      );

      // Version ACTIVE hiện tại có thể lệch tham số so với snapshot của báo
      // giá cũ (sản phẩm bị sửa/đổi tên tham số sau khi báo giá đã tạo) —
      // calculateBom() ném lỗi trong trường hợp đó. Không chặn cả danh sách,
      // chỉ đánh dấu thiếu dữ liệu cho riêng dòng này (cùng cách xử lý với
      // "chưa có Material Requirement Version ACTIVE" ở trên).
      try {
        const bomResult = this.bomEngine.calculateBom(
          config,
          rawParams,
          input.quantity,
        );
        result.set(input.id, {
          costUnitPrice:
            input.quantity > 0 ? bomResult.plannedCost / input.quantity : 0,
          totalCost: bomResult.plannedCost,
          costAvailable: true,
        });
      } catch {
        result.set(input.id, {
          costUnitPrice: 0,
          totalCost: 0,
          costAvailable: false,
        });
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────
  // Dashboard Alerts (026-cai-tien-dashboard.md mục 3a) — chỉ đọc, không
  // Business Logic mới.
  // ─────────────────────────────────────────────────────

  // Báo giá SENT lâu chưa có phản hồi từ khách. Quotation không có cột
  // "ngày gửi" riêng — đọc mốc SENT qua QuotationTimeline (action
  // QUOTATION_SENT), giống cách SalesOrderTimeline lưu mốc SHIPPED. Không
  // hard-code số ngày — đọc Settings.Dashboard.quotationPendingDays nếu
  // caller không truyền.
  async getPendingResponseQuotations(pendingDays?: number) {
    const days =
      pendingDays ??
      (await this.settingService.getNumberValue(
        'Dashboard',
        'quotationPendingDays',
      ));
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    const sentTimelines = await this.prisma.quotationTimeline.findMany({
      where: {
        action: QuotationTimelineAction.QUOTATION_SENT,
        createdAt: { lte: threshold },
      },
      select: { quotationId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      distinct: ['quotationId'],
    });
    if (sentTimelines.length === 0) return [];

    const quotations = await this.prisma.quotation.findMany({
      where: {
        id: { in: sentTimelines.map((t) => t.quotationId) },
        status: QuotationStatus.SENT,
      },
      select: {
        id: true,
        code: true,
        customerId: true,
        customer: { select: { name: true, phone: true } },
      },
    });

    const sentAtById = new Map(
      sentTimelines.map((t) => [t.quotationId, t.createdAt]),
    );
    return quotations
      .map((q) => ({
        id: q.id,
        code: q.code,
        customerId: q.customerId,
        customerName: q.customer.name,
        customerPhone: q.customer.phone,
        sentAt: sentAtById.get(q.id)!,
      }))
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  }
}
