import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  OpeningBalanceTimelineAction,
  OpeningBalanceTimelineActorType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActorName } from '../shared/resolve-actor-name';
import { retryOnCodeConflict } from '../shared/retry-on-code-conflict';
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
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Số tiền phải lớn hơn 0.');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Khách hàng không tồn tại.');
    }

    const createdByName = await resolveActorName(this.prisma, userId);

    return retryOnCodeConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const code = await this.nextOpeningBalanceCode(tx);

        const openingBalance = await tx.openingBalance.create({
          data: {
            code,
            customerId: dto.customerId,
            amount: dto.amount,
            remainingAmount: dto.amount,
            note: dto.note?.trim() || null,
            createdBy: userId ?? null,
          },
        });

        await tx.openingBalanceTimeline.create({
          data: {
            openingBalanceId: openingBalance.id,
            action: OpeningBalanceTimelineAction.OPENING_BALANCE_CREATED,
            actorType: OpeningBalanceTimelineActorType.USER,
            payload: { amount: dto.amount },
            createdBy: userId ?? null,
            createdByName,
          },
        });

        return openingBalance;
      }),
    );
  }

  // Tab "Tiến trình thanh toán" trong trang khách hàng (rà soát tab Công nợ,
  // 11/08/2026) cần hiện "Ngày thanh toán"/"Phiếu thu tương ứng" cho Công nợ
  // đầu kỳ giống Receivable — trả kèm payments (đọc qua PaymentAllocation,
  // đã tham gia chung Allocation Engine). Không đổi shape cũ (chỉ thêm field
  // mới) nên không ảnh hưởng OpeningBalanceSection ở tab Thông tin.
  async findAllByCustomer(customerId: string) {
    const rows = await this.prisma.openingBalance.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
      include: {
        allocations: {
          select: {
            payment: { select: { code: true, paymentDate: true, type: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return rows.map(({ allocations, ...b }) => ({
      ...b,
      payments: allocations.map((a) => a.payment),
    }));
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

  // Action duy nhất để giảm số dư — dùng cho thu tiền rời rạc (không qua
  // Payment/PaymentAllocation). Kiểu Manual Override (bắt buộc lý do, ghi
  // Timeline), không phải Payment.
  async reduce(
    id: string,
    dto: ReduceOpeningBalanceDto,
    userId?: string | null,
  ) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Lý do là bắt buộc.');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Số tiền giảm phải lớn hơn 0.');
    }

    const openingBalance = await this.prisma.openingBalance.findUnique({
      where: { id },
    });
    if (!openingBalance) {
      throw new NotFoundException('Công nợ đầu kỳ không tồn tại.');
    }

    const fromRemaining = Number(openingBalance.remainingAmount);
    if (dto.amount > fromRemaining) {
      throw new BadRequestException('Số tiền giảm vượt quá số dư còn lại.');
    }
    const toRemaining = fromRemaining - dto.amount;

    const createdByName = await resolveActorName(this.prisma, userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.openingBalance.update({
        where: { id },
        data: {
          remainingAmount: { decrement: dto.amount },
        },
      });

      await tx.openingBalanceTimeline.create({
        data: {
          openingBalanceId: id,
          action: OpeningBalanceTimelineAction.OPENING_BALANCE_REDUCED,
          actorType: OpeningBalanceTimelineActorType.USER,
          payload: {
            amount: dto.amount,
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
      _sum: { remainingAmount: true },
    });
    return new Map(
      grouped.map((g) => [
        g.customerId,
        { remaining: Number(g._sum.remainingAmount ?? 0) },
      ]),
    );
  }

  async sumOpenForCustomer(customerId: string) {
    const agg = await this.prisma.openingBalance.aggregate({
      where: { customerId, remainingAmount: { gt: 0 } },
      _sum: { remainingAmount: true },
    });
    return { remaining: Number(agg._sum.remainingAmount ?? 0) };
  }

  async sumAllOpen() {
    const agg = await this.prisma.openingBalance.aggregate({
      where: { remainingAmount: { gt: 0 } },
      _sum: { remainingAmount: true },
    });
    return { remaining: Number(agg._sum.remainingAmount ?? 0) };
  }
}
