import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  PaymentMethod,
  SalesOrderStatus,
  SalesOrderTimelineAction,
  SalesOrderTimelineActorType,
  VatSettlementStatus,
  VatSettlementTimelineAction,
  VatSettlementTimelineActorType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActorName } from '../shared/resolve-actor-name';
import { retryOnCodeConflict } from '../shared/retry-on-code-conflict';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import {
  calcFinalPrice,
  calcSubtotal,
  calcVatAmount,
} from '../pricing-engine/pricing-calc.helpers';
import { CreateVatSettlementDto } from './dto/create-vat-settlement.dto';
import { CreateVatSettlementFromOpeningBalanceDto } from './dto/create-vat-settlement-from-opening-balance.dto';
import { ConfirmVatSettlementPaymentDto } from './dto/confirm-vat-settlement-payment.dto';
import { MarkVatSettlementInvoicedDto } from './dto/mark-vat-settlement-invoiced.dto';
import { VatSettlementQueryDto } from './dto/vat-settlement-query.dto';

const ELIGIBLE_RECEIVABLE_INCLUDE = {
  salesOrder: {
    select: { id: true, code: true, customerName: true, customerPhone: true },
  },
} satisfies Prisma.ReceivableInclude;

const VAT_SETTLEMENT_DETAIL_INCLUDE = {
  items: {
    include: {
      receivable: {
        include: {
          salesOrder: {
            select: {
              id: true,
              code: true,
              customerName: true,
              customerPhone: true,
            },
          },
        },
      },
      // opening-balance.md — nguồn thứ 2 (không có Receivable/SalesOrder gốc).
      openingBalance: { select: { id: true, code: true, customerId: true } },
      lines: {
        include: { parameters: { orderBy: { displayOrder: 'asc' as const } } },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  payment: true,
  timeline: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.VatSettlementInclude;

// 024-cong-no-vat-settlement.md — VatSettlement là MỘT CHỨNG TỪ TÀI CHÍNH ĐỘC
// LẬP, không phải giao dịch bán hàng mới (không tạo SalesOrder mới). Tách
// khỏi DebtService (dù cùng module Debt) vì đây là 1 workflow/entity riêng
// (DRAFT → SENT → PAID → INVOICED) — action "Thu tiền mặt không xuất hóa
// đơn" (chạm Receivable) vẫn ở DebtService, đúng nơi đang sở hữu Receivable.
@Injectable()
export class VatSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngineService: PricingEngineService,
  ) {}

  private validatePaymentMethod(
    paymentMethod: string | undefined,
    referenceNumber: string | undefined,
  ): PaymentMethod {
    const validMethods = Object.values(PaymentMethod) as string[];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      throw new BadRequestException(
        `Phương thức thanh toán "${paymentMethod}" không hợp lệ.`,
      );
    }
    if (
      paymentMethod === PaymentMethod.BANK_TRANSFER &&
      !referenceNumber?.trim()
    ) {
      throw new BadRequestException(
        'Số tham chiếu là bắt buộc khi thanh toán bằng chuyển khoản.',
      );
    }
    return paymentMethod as PaymentMethod;
  }

  private async nextVatSettlementCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const running = await tx.runningNumber.update({
      where: { type: 'VAT_SETTLEMENT' },
      data: { lastNumber: { increment: 1 } },
    });
    return `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;
  }

  // "Đang hoạt động" = chưa INVOICED (đã settle xong) và chưa CANCELLED (huỷ
  // trước khi gửi khách, không còn giá trị) — dùng chung cho getEligibleReceivables()
  // và validate ở create().
  private static readonly INACTIVE_STATUSES: VatSettlementStatus[] = [
    VatSettlementStatus.INVOICED,
    VatSettlementStatus.CANCELLED,
  ];

  // Đơn đủ điều kiện tạo VatSettlement: đã closedWithoutVat, đơn chưa CANCELLED,
  // chưa thuộc VatSettlement nào đang hoạt động (Quyết định #4; CANCELLED bổ
  // sung 26/07/2026 — 1 settlement đã huỷ không còn chặn Receivable nguồn).
  async getEligibleReceivables(customerId: string) {
    return this.prisma.receivable.findMany({
      where: {
        customerId,
        closedWithoutVat: true,
        salesOrder: { status: { not: SalesOrderStatus.CANCELLED } },
        vatSettlementItems: {
          none: {
            vatSettlement: {
              status: { notIn: VatSettlementService.INACTIVE_STATUSES },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: ELIGIBLE_RECEIVABLE_INCLUDE,
    });
  }

  async findAll(query: VatSettlementQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.VatSettlementWhereInput = {};
    if (query.customerId) where.customerId = query.customerId;
    const validStatuses = Object.values(VatSettlementStatus) as string[];
    if (query.status && validStatuses.includes(query.status)) {
      where.status = query.status as VatSettlementStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.vatSettlement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vatSettlement.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const settlement = await this.prisma.vatSettlement.findUnique({
      where: { id },
      include: VAT_SETTLEMENT_DETAIL_INCLUDE,
    });
    if (!settlement) {
      throw new NotFoundException('VAT Settlement không tồn tại.');
    }
    return settlement;
  }

  // Tạo VatSettlement (DRAFT) — Quyết định #7/#8: amount snapshot =
  // totalAmount - totalAmountBeforeVat của từng Receivable tại thời điểm này.
  async create(dto: CreateVatSettlementDto, userId?: string | null) {
    if (!dto.customerId) {
      throw new BadRequestException('Khách hàng là bắt buộc.');
    }
    if (!dto.receivableIds || dto.receivableIds.length === 0) {
      throw new BadRequestException('Phải chọn ít nhất 1 công nợ.');
    }

    const receivables = await this.prisma.receivable.findMany({
      where: { id: { in: dto.receivableIds } },
      include: {
        salesOrder: { select: { id: true, status: true } },
        vatSettlementItems: {
          include: { vatSettlement: { select: { status: true } } },
        },
      },
    });
    const map = new Map(receivables.map((r) => [r.id, r]));

    for (const receivableId of dto.receivableIds) {
      const r = map.get(receivableId);
      if (!r) {
        throw new NotFoundException(`Công nợ ${receivableId} không tồn tại.`);
      }
      if (r.customerId !== dto.customerId) {
        throw new BadRequestException(
          `Công nợ ${receivableId} không thuộc khách hàng đang chọn.`,
        );
      }
      if (!r.closedWithoutVat) {
        throw new BadRequestException(
          `Công nợ ${receivableId} chưa được đóng theo chế độ "Đóng công nợ (không xuất hóa đơn)".`,
        );
      }
      const alreadyActive = r.vatSettlementItems.some(
        (item) =>
          !VatSettlementService.INACTIVE_STATUSES.includes(
            item.vatSettlement.status,
          ),
      );
      if (alreadyActive) {
        throw new BadRequestException(
          `Công nợ ${receivableId} đã thuộc một VAT Settlement đang xử lý.`,
        );
      }
    }

    const items = dto.receivableIds.map((receivableId) => {
      const r = map.get(receivableId)!;
      return {
        receivableId,
        salesOrderId: r.salesOrderId,
        amount: Number(r.totalAmount) - Number(r.totalAmountBeforeVat),
      };
    });
    const totalAmount = items.reduce((s, i) => s + i.amount, 0);
    const createdByName = await resolveActorName(this.prisma, userId);

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const code = await this.nextVatSettlementCode(tx);

        const settlement = await tx.vatSettlement.create({
          data: { code, customerId: dto.customerId, totalAmount },
        });

        for (const item of items) {
          await tx.vatSettlementItem.create({
            data: {
              vatSettlementId: settlement.id,
              receivableId: item.receivableId,
              amount: item.amount,
            },
          });
        }

        await tx.vatSettlementTimeline.create({
          data: {
            vatSettlementId: settlement.id,
            action: VatSettlementTimelineAction.VAT_SETTLEMENT_CREATED,
            actorType: VatSettlementTimelineActorType.USER,
            payload: { totalAmount, receivableCount: items.length },
            createdBy: userId ?? null,
            createdByName,
          },
        });

        await this.writeSalesOrderTimelines(
          tx,
          items,
          code,
          'CREATED',
          totalAmount,
          userId,
          createdByName,
        );

        return tx.vatSettlement.findUniqueOrThrow({
          where: { id: settlement.id },
          include: VAT_SETTLEMENT_DETAIL_INCLUDE,
        });
      }),
    );
  }

  // "Phục dựng hoá đơn" cho Công nợ đầu kỳ (opening-balance.md) — nguồn thứ 2,
  // KHÔNG có Receivable/SalesOrder gốc. Kế toán thêm dòng sản phẩm THẬT (chọn
  // từ danh mục Product, dùng Pricing Rule đang ACTIVE) chỉ để TÍNH RA số tiền
  // cần xuất hoá đơn — không tạo SalesOrder/ProductionOrder/Warehouse. Tái
  // dùng đúng logic tính giá của Quotation.addItem() (copy thuần, không sửa
  // quotation-workflow.service.ts — xem pricing-calc.helpers.ts).
  // amount = SUM(vatAmount) các dòng — VAT-only, khớp ý nghĩa đang dùng ở path
  // Receivable (totalAmount - totalAmountBeforeVat). KHÔNG đụng
  // OpeningBalance.remainingAmount — đóng phần dư là bước tay riêng qua
  // OpeningBalanceService.reduce().
  async createFromOpeningBalance(
    dto: CreateVatSettlementFromOpeningBalanceDto,
    userId?: string | null,
  ) {
    if (!dto.openingBalanceId) {
      throw new BadRequestException('Công nợ đầu kỳ là bắt buộc.');
    }
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Phải thêm ít nhất 1 dòng sản phẩm.');
    }

    const openingBalance = await this.prisma.openingBalance.findUnique({
      where: { id: dto.openingBalanceId },
    });
    if (!openingBalance) {
      throw new NotFoundException('Công nợ đầu kỳ không tồn tại.');
    }
    if (Number(openingBalance.remainingAmount) <= 0) {
      throw new BadRequestException(
        'Công nợ đầu kỳ này đã đóng hết, không thể phục dựng hoá đơn.',
      );
    }

    const lines: {
      productId: string;
      productCode: string;
      productName: string;
      quantity: number;
      pricingRuleVersionId: string;
      systemPrice: number;
      discountPercent: number;
      surchargeAfterDiscount: number;
      finalPrice: number;
      subtotal: number;
      vatRate: number;
      vatAmount: number;
      parameters: {
        name: string;
        label: string;
        value: string;
        valueLabel: string | null;
        unit: string | null;
        displayOrder: number;
      }[];
    }[] = [];

    for (const line of dto.lines) {
      if (!line.productId) {
        throw new BadRequestException('Sản phẩm là bắt buộc.');
      }
      if (!line.quantity || line.quantity <= 0) {
        throw new BadRequestException('Số lượng phải lớn hơn 0.');
      }

      const product = await this.prisma.product.findUnique({
        where: { id: line.productId },
        include: {
          parameters: {
            include: { options: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      if (!product) {
        throw new NotFoundException(
          `Sản phẩm ${line.productId} không tồn tại.`,
        );
      }

      const priceResult = await this.pricingEngineService.calculate({
        productId: line.productId,
        parameters: line.parameters,
      });

      // Snapshot % Chiết khấu Khách hàng × Loại sản phẩm — cùng logic
      // Quotation.addItem() (customer.md/quotation.md).
      const customerProductDiscount =
        await this.prisma.customerProductDiscount.findUnique({
          where: {
            customerId_productTypeId: {
              customerId: openingBalance.customerId,
              productTypeId: product.productTypeId,
            },
          },
        });
      const discountPercent = Number(
        customerProductDiscount?.discountPercent ?? 0,
      );

      const systemPrice = priceResult.systemPrice;
      const surchargeAfterDiscount = priceResult.surchargeAfterDiscount;
      const finalPrice = calcFinalPrice(
        systemPrice,
        discountPercent,
        surchargeAfterDiscount,
      );
      const subtotal = calcSubtotal(finalPrice, line.quantity);
      const vatRate = priceResult.vatRate;
      const vatAmount = calcVatAmount(subtotal, vatRate);

      const paramMap = new Map(product.parameters.map((p) => [p.name, p]));

      lines.push({
        productId: line.productId,
        productCode: product.code,
        productName: product.name,
        quantity: line.quantity,
        pricingRuleVersionId: priceResult.pricingRuleVersionId,
        systemPrice,
        discountPercent,
        surchargeAfterDiscount,
        finalPrice,
        subtotal,
        vatRate,
        vatAmount,
        parameters: line.parameters.map((p, idx) => {
          const productParam = paramMap.get(p.name);
          return {
            name: p.name,
            label: productParam?.label ?? p.name,
            value: p.value,
            valueLabel:
              productParam?.options.find((o) => o.value === p.value)?.label ??
              null,
            unit: productParam?.unit ?? null,
            displayOrder: productParam?.displayOrder ?? idx,
          };
        }),
      });
    }

    const totalVatAmount = lines.reduce((s, l) => s + l.vatAmount, 0);
    const createdByName = await resolveActorName(this.prisma, userId);

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const code = await this.nextVatSettlementCode(tx);

        const settlement = await tx.vatSettlement.create({
          data: {
            code,
            customerId: openingBalance.customerId,
            totalAmount: totalVatAmount,
          },
        });

        const item = await tx.vatSettlementItem.create({
          data: {
            vatSettlementId: settlement.id,
            openingBalanceId: openingBalance.id,
            amount: totalVatAmount,
          },
        });

        for (const line of lines) {
          await tx.vatSettlementItemLine.create({
            data: {
              vatSettlementItemId: item.id,
              productId: line.productId,
              productCode: line.productCode,
              productName: line.productName,
              quantity: line.quantity,
              pricingRuleVersionId: line.pricingRuleVersionId,
              systemPrice: line.systemPrice,
              discountPercent: line.discountPercent,
              surchargeAfterDiscount: line.surchargeAfterDiscount,
              finalPrice: line.finalPrice,
              subtotal: line.subtotal,
              vatRate: line.vatRate,
              vatAmount: line.vatAmount,
              parameters: { create: line.parameters },
            },
          });
        }

        await tx.vatSettlementTimeline.create({
          data: {
            vatSettlementId: settlement.id,
            action: VatSettlementTimelineAction.VAT_SETTLEMENT_CREATED,
            actorType: VatSettlementTimelineActorType.USER,
            payload: {
              totalAmount: totalVatAmount,
              openingBalanceId: openingBalance.id,
              lineCount: lines.length,
            },
            createdBy: userId ?? null,
            createdByName,
          },
        });

        // Không ghi SalesOrderTimeline — nguồn là Công nợ đầu kỳ, không có Sales
        // Order nào liên quan (khác path Receivable ở create()).

        return tx.vatSettlement.findUniqueOrThrow({
          where: { id: settlement.id },
          include: VAT_SETTLEMENT_DETAIL_INCLUDE,
        });
      }),
    );
  }

  async send(id: string, userId?: string | null) {
    const settlement = await this.prisma.vatSettlement.findUnique({
      where: { id },
      include: {
        items: { include: { receivable: { select: { salesOrderId: true } } } },
      },
    });
    if (!settlement)
      throw new NotFoundException('VAT Settlement không tồn tại.');
    if (settlement.status !== VatSettlementStatus.DRAFT) {
      throw new BadRequestException(
        'Chỉ có thể gửi khách khi VAT Settlement đang ở trạng thái Nháp.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.vatSettlement.update({
        where: { id },
        data: { status: VatSettlementStatus.SENT },
      });

      await tx.vatSettlementTimeline.create({
        data: {
          vatSettlementId: id,
          action: VatSettlementTimelineAction.VAT_SETTLEMENT_SENT,
          actorType: VatSettlementTimelineActorType.USER,
          createdBy: userId ?? null,
          createdByName,
        },
      });

      await this.writeSalesOrderTimelines(
        tx,
        // opening-balance.md — item nguồn Công nợ đầu kỳ không có Receivable/
        // SalesOrder gốc (receivable = null), lọc bỏ trước khi ghi SalesOrderTimeline.
        settlement.items
          .filter((i) => i.receivable)
          .map((i) => ({ salesOrderId: i.receivable!.salesOrderId })),
        settlement.code,
        'SENT',
        Number(settlement.totalAmount),
        userId,
        createdByName,
      );

      return tx.vatSettlement.findUniqueOrThrow({
        where: { id },
        include: VAT_SETTLEMENT_DETAIL_INCLUDE,
      });
    });
  }

  // Huỷ VatSettlement (bổ sung 26/07/2026, theo rà soát mô hình công nợ) —
  // chỉ cho phép khi còn DRAFT (chưa gửi khách, chưa có Payment nào gắn vào)
  // nên hoàn toàn an toàn, không đụng gì downstream. Giữ bản ghi lại (đổi
  // status, không xoá) — Receivable nguồn tự động "nhả ra" khỏi
  // getEligibleReceivables() vì CANCELLED nằm trong INACTIVE_STATUSES.
  async cancel(id: string, userId?: string | null) {
    const settlement = await this.prisma.vatSettlement.findUnique({
      where: { id },
      include: {
        items: { include: { receivable: { select: { salesOrderId: true } } } },
      },
    });
    if (!settlement)
      throw new NotFoundException('VAT Settlement không tồn tại.');
    if (settlement.status !== VatSettlementStatus.DRAFT) {
      throw new BadRequestException(
        'Chỉ có thể huỷ khi VAT Settlement đang ở trạng thái Nháp.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.vatSettlement.update({
        where: { id },
        data: { status: VatSettlementStatus.CANCELLED },
      });

      await tx.vatSettlementTimeline.create({
        data: {
          vatSettlementId: id,
          action: VatSettlementTimelineAction.VAT_SETTLEMENT_CANCELLED,
          actorType: VatSettlementTimelineActorType.USER,
          createdBy: userId ?? null,
          createdByName,
        },
      });

      await this.writeSalesOrderTimelines(
        tx,
        // opening-balance.md — item nguồn Công nợ đầu kỳ không có Receivable/
        // SalesOrder gốc (receivable = null), lọc bỏ trước khi ghi SalesOrderTimeline.
        settlement.items
          .filter((i) => i.receivable)
          .map((i) => ({ salesOrderId: i.receivable!.salesOrderId })),
        settlement.code,
        'CANCELLED',
        Number(settlement.totalAmount),
        userId,
        createdByName,
      );

      return tx.vatSettlement.findUniqueOrThrow({
        where: { id },
        include: VAT_SETTLEMENT_DETAIL_INCLUDE,
      });
    });
  }

  // Ghi nhận thanh toán (Quyết định #6) — tạo đúng 1 Payment, vatSettlementId
  // set trực tiếp, KHÔNG tạo PaymentAllocation, KHÔNG đụng Receivable (không
  // "hồi sinh" nghiệp vụ đã đóng). V1 khoá cứng trả đủ 1 lần.
  async confirmPayment(
    id: string,
    dto: ConfirmVatSettlementPaymentDto,
    userId?: string | null,
  ) {
    const settlement = await this.prisma.vatSettlement.findUnique({
      where: { id },
      include: {
        items: { include: { receivable: { select: { salesOrderId: true } } } },
      },
    });
    if (!settlement)
      throw new NotFoundException('VAT Settlement không tồn tại.');
    if (settlement.status !== VatSettlementStatus.SENT) {
      throw new BadRequestException(
        'Chỉ có thể ghi nhận thanh toán khi VAT Settlement đang ở trạng thái Đã gửi.',
      );
    }

    const paymentMethod = this.validatePaymentMethod(
      dto.paymentMethod,
      dto.referenceNumber,
    );
    const createdByName = await resolveActorName(this.prisma, userId);

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            code: await this.nextVatSettlementPaymentCode(tx),
            paymentDate: dto.paymentDate
              ? new Date(dto.paymentDate)
              : new Date(),
            amount: settlement.totalAmount,
            paymentMethod,
            referenceNumber: dto.referenceNumber?.trim() || null,
            note: dto.note?.trim() || null,
            vatSettlementId: id,
          },
        });

        await tx.vatSettlement.update({
          where: { id },
          data: { status: VatSettlementStatus.PAID, paymentId: payment.id },
        });

        await tx.vatSettlementTimeline.create({
          data: {
            vatSettlementId: id,
            action: VatSettlementTimelineAction.VAT_SETTLEMENT_PAID,
            actorType: VatSettlementTimelineActorType.USER,
            payload: {
              paymentCode: payment.code,
              amount: Number(settlement.totalAmount),
            },
            createdBy: userId ?? null,
            createdByName,
          },
        });

        await this.writeSalesOrderTimelines(
          tx,
          // opening-balance.md — item nguồn Công nợ đầu kỳ không có Receivable/
          // SalesOrder gốc (receivable = null), lọc bỏ trước khi ghi SalesOrderTimeline.
          settlement.items
            .filter((i) => i.receivable)
            .map((i) => ({ salesOrderId: i.receivable!.salesOrderId })),
          settlement.code,
          'PAID',
          Number(settlement.totalAmount),
          userId,
          createdByName,
        );

        return tx.vatSettlement.findUniqueOrThrow({
          where: { id },
          include: VAT_SETTLEMENT_DETAIL_INCLUDE,
        });
      }),
    );
  }

  async markInvoiced(
    id: string,
    dto: MarkVatSettlementInvoicedDto,
    userId?: string | null,
  ) {
    if (!dto.invoiceNumber?.trim()) {
      throw new BadRequestException('Số hóa đơn là bắt buộc.');
    }
    if (!dto.invoiceDate) {
      throw new BadRequestException('Ngày hóa đơn là bắt buộc.');
    }

    const settlement = await this.prisma.vatSettlement.findUnique({
      where: { id },
      include: {
        items: { include: { receivable: { select: { salesOrderId: true } } } },
      },
    });
    if (!settlement)
      throw new NotFoundException('VAT Settlement không tồn tại.');
    if (settlement.status !== VatSettlementStatus.PAID) {
      throw new BadRequestException(
        'Chỉ có thể đánh dấu đã xuất hóa đơn khi VAT Settlement đang ở trạng thái Đã thanh toán.',
      );
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.vatSettlement.update({
        where: { id },
        data: {
          status: VatSettlementStatus.INVOICED,
          invoiceNumber: dto.invoiceNumber.trim(),
          invoiceDate: new Date(dto.invoiceDate),
        },
      });

      await tx.vatSettlementTimeline.create({
        data: {
          vatSettlementId: id,
          action: VatSettlementTimelineAction.VAT_SETTLEMENT_INVOICED,
          actorType: VatSettlementTimelineActorType.USER,
          payload: {
            invoiceNumber: dto.invoiceNumber.trim(),
            invoiceDate: dto.invoiceDate,
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      await this.writeSalesOrderTimelines(
        tx,
        // opening-balance.md — item nguồn Công nợ đầu kỳ không có Receivable/
        // SalesOrder gốc (receivable = null), lọc bỏ trước khi ghi SalesOrderTimeline.
        settlement.items
          .filter((i) => i.receivable)
          .map((i) => ({ salesOrderId: i.receivable!.salesOrderId })),
        settlement.code,
        'INVOICED',
        Number(settlement.totalAmount),
        userId,
        createdByName,
      );

      return tx.vatSettlement.findUniqueOrThrow({
        where: { id },
        include: VAT_SETTLEMENT_DETAIL_INCLUDE,
      });
    });
  }

  // Payment của VatSettlement dùng chung Running Number 'PAYMENT' — vẫn là 1
  // phiếu thu thật (mã PT...), chỉ khác luồng ghi nhận (không qua PaymentAllocation).
  private async nextVatSettlementPaymentCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const running = await tx.runningNumber.update({
      where: { type: 'PAYMENT' },
      data: { lastNumber: { increment: 1 } },
    });
    return `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;
  }

  // Quyết định #10 — mỗi mốc quan trọng ghi thêm SalesOrderTimeline cho từng
  // đơn liên quan (qua VatSettlementItem), để mở đơn hàng gốc vẫn thấy dấu vết.
  private async writeSalesOrderTimelines(
    tx: Prisma.TransactionClient,
    items: { salesOrderId: string }[],
    vatSettlementCode: string,
    event: 'CREATED' | 'SENT' | 'PAID' | 'INVOICED' | 'CANCELLED',
    totalAmount: number,
    userId: string | null | undefined,
    createdByName: string | null,
  ) {
    for (const item of items) {
      await tx.salesOrderTimeline.create({
        data: {
          salesOrderId: item.salesOrderId,
          action: SalesOrderTimelineAction.VAT_SETTLEMENT_UPDATED,
          actorType: SalesOrderTimelineActorType.USER,
          payload: {
            vatSettlementCode,
            event,
            amount: totalAmount,
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });
    }
  }
}
