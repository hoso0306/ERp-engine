import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, OpeningBalanceTimelineAction, OpeningBalanceTimelineActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActorName } from '../shared/resolve-actor-name';
import { CreateOpeningBalanceDto } from './dto/create-opening-balance.dto';
import { ReduceOpeningBalanceDto } from './dto/reduce-opening-balance.dto';

// opening-balance.md — Công nợ đầu kỳ: số dư khách hàng còn nợ TRƯỚC KHI dùng
// phần mềm, nhập tay bởi kế toán lúc migrate dữ liệu. Không có SalesOrder gốc
// nên KHÔNG dùng Receivable. Không có PaymentAllocation/FIFO/VAT-split engine
// — cố tình đơn giản, giảm số dư chỉ qua reduce() duy nhất (không phải Payment).
@Injectable()
export class OpeningBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextOpeningBalanceCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const running = await tx.runningNumber.update({
      where: { type: 'OPENING_BALANCE' },
      data: { lastNumber: { increment: 1 } },
    });
    return `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;
  }

  async create(dto: CreateOpeningBalanceDto, userId?: string | null) {
    if (!dto.customerId) {
      throw new BadRequestException('Khách hàng là bắt buộc.');
    }
    if (!dto.amountBeforeVat || dto.amountBeforeVat <= 0) {
      throw new BadRequestException('Số tiền trước VAT phải lớn hơn 0.');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Khách hàng không tồn tại.');
    }

    // Sau VAT — tuỳ chọn, resolve = amountBeforeVat NGAY LÚC TẠO nếu bỏ trống
    // (opening-balance.md) — không null+fallback ở downstream.
    const amount = dto.amount != null ? dto.amount : dto.amountBeforeVat;
    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const code = await this.nextOpeningBalanceCode(tx);

      const openingBalance = await tx.openingBalance.create({
        data: {
          code,
          customerId: dto.customerId,
          amountBeforeVat: dto.amountBeforeVat,
          amount,
          remainingAmountBeforeVat: dto.amountBeforeVat,
          remainingAmount: amount,
          note: dto.note?.trim() || null,
          createdBy: userId ?? null,
        },
      });

      await tx.openingBalanceTimeline.create({
        data: {
          openingBalanceId: openingBalance.id,
          action: OpeningBalanceTimelineAction.OPENING_BALANCE_CREATED,
          actorType: OpeningBalanceTimelineActorType.USER,
          payload: { amountBeforeVat: dto.amountBeforeVat, amount },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return openingBalance;
    });
  }

  async findAllByCustomer(customerId: string) {
    return this.prisma.openingBalance.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const openingBalance = await this.prisma.openingBalance.findUnique({
      where: { id },
      include: { timeline: { orderBy: { createdAt: 'asc' } } },
    });
    if (!openingBalance) {
      throw new NotFoundException('Công nợ đầu kỳ không tồn tại.');
    }
    return openingBalance;
  }

  // Action duy nhất để giảm số dư — dùng chung cho cả thu tiền rời rạc (không
  // liên quan hoá đơn) lẫn đóng phần dư sau khi xuất hoá đơn qua VatSettlement
  // (opening-balance.md). Không có VAT-split engine ở đây — giảm CẢ
  // remainingAmount lẫn remainingAmountBeforeVat cùng 1 số tiền. Kiểu Manual
  // Override (bắt buộc lý do, ghi Timeline), không phải Payment.
  async reduce(id: string, dto: ReduceOpeningBalanceDto, userId?: string | null) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do là bắt buộc.');
    }
    if (!dto.amountBeforeVat || dto.amountBeforeVat <= 0) {
      throw new BadRequestException('Số tiền giảm phải lớn hơn 0.');
    }

    const openingBalance = await this.prisma.openingBalance.findUnique({
      where: { id },
    });
    if (!openingBalance) {
      throw new NotFoundException('Công nợ đầu kỳ không tồn tại.');
    }

    const fromRemaining = Number(openingBalance.remainingAmountBeforeVat);
    if (dto.amountBeforeVat > fromRemaining) {
      throw new BadRequestException('Số tiền giảm vượt quá số dư còn lại.');
    }
    const toRemaining = fromRemaining - dto.amountBeforeVat;

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.openingBalance.update({
        where: { id },
        data: {
          remainingAmountBeforeVat: { decrement: dto.amountBeforeVat },
          remainingAmount: { decrement: dto.amountBeforeVat },
        },
      });

      await tx.openingBalanceTimeline.create({
        data: {
          openingBalanceId: id,
          action: OpeningBalanceTimelineAction.OPENING_BALANCE_REDUCED,
          actorType: OpeningBalanceTimelineActorType.USER,
          payload: {
            amount: dto.amountBeforeVat,
            reason: dto.reason.trim(),
            fromRemaining,
            toRemaining,
          },
          createdBy: userId ?? null,
          createdByName,
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────
  // Helper tổng hợp — dùng chung cho mọi nơi cần cộng Công nợ đầu kỳ vào tổng
  // công nợ (Dashboard/theo khách hàng/bản in Báo giá), tránh lặp lại cùng 1
  // câu query ở nhiều service khác nhau.
  // ─────────────────────────────────────────────────────

  async sumOpenByCustomerIds(customerIds?: string[]) {
    const grouped = await this.prisma.openingBalance.groupBy({
      by: ['customerId'],
      where: {
        remainingAmount: { gt: 0 },
        ...(customerIds ? { customerId: { in: customerIds } } : {}),
      },
      _sum: { remainingAmount: true, remainingAmountBeforeVat: true },
    });
    return new Map(
      grouped.map((g) => [
        g.customerId,
        {
          remaining: Number(g._sum.remainingAmount ?? 0),
          remainingBeforeVat: Number(g._sum.remainingAmountBeforeVat ?? 0),
        },
      ]),
    );
  }

  async sumOpenForCustomer(customerId: string) {
    const agg = await this.prisma.openingBalance.aggregate({
      where: { customerId, remainingAmount: { gt: 0 } },
      _sum: { remainingAmount: true, remainingAmountBeforeVat: true },
    });
    return {
      remaining: Number(agg._sum.remainingAmount ?? 0),
      remainingBeforeVat: Number(agg._sum.remainingAmountBeforeVat ?? 0),
    };
  }

  async sumAllOpen() {
    const agg = await this.prisma.openingBalance.aggregate({
      where: { remainingAmount: { gt: 0 } },
      _sum: { remainingAmount: true, remainingAmountBeforeVat: true },
    });
    return {
      remaining: Number(agg._sum.remainingAmount ?? 0),
      remainingBeforeVat: Number(agg._sum.remainingAmountBeforeVat ?? 0),
    };
  }
}
