import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DebtService } from './debt.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from '../setting/setting.service';
import { OpeningBalanceService } from './opening-balance.service';

function makeSalesOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1',
    code: 'SO000001',
    status: 'IN_PRODUCTION',
    paymentStatus: 'UNPAID',
    receivable: {
      id: 'rec-1',
      salesOrderId: 'so-1',
      totalAmount: 1000000,
      paidAmount: 0,
      remainingAmount: 1000000,
      // Mặc định kịch bản không VAT (remainingAmountBeforeVat = remainingAmount)
      // — đủ cho các test không quan tâm tới BeforeVatFirstPolicy split.
      remainingAmountBeforeVat: 1000000,
    },
    ...overrides,
  };
}

describe('DebtService', () => {
  let service: DebtService;
  let prisma: {
    salesOrder: { findUnique: jest.Mock; update: jest.Mock };
    receivable: {
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      groupBy: jest.Mock;
      aggregate: jest.Mock;
    };
    runningNumber: { update: jest.Mock };
    payment: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    paymentAllocation: { create: jest.Mock };
    salesOrderTimeline: { create: jest.Mock };
    customer: { findMany: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let openingBalanceService: {
    sumOpenByCustomerIds: jest.Mock;
    sumOpenForCustomer: jest.Mock;
    sumAllOpen: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      salesOrder: { findUnique: jest.fn(), update: jest.fn() },
      receivable: {
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      runningNumber: { update: jest.fn() },
      payment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      paymentAllocation: { create: jest.fn() },
      salesOrderTimeline: { create: jest.fn() },
      customer: { findMany: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Nguyễn Văn An', email: 'an@acme.vn' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    // Mặc định không có Công nợ đầu kỳ nào — các test merge ghi đè riêng.
    openingBalanceService = {
      sumOpenByCustomerIds: jest.fn().mockResolvedValue(new Map()),
      sumOpenForCustomer: jest
        .fn()
        .mockResolvedValue({ remaining: 0, remainingBeforeVat: 0 }),
      sumAllOpen: jest
        .fn()
        .mockResolvedValue({ remaining: 0, remainingBeforeVat: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SettingService,
          useValue: { getNumberValue: jest.fn().mockResolvedValue(7) },
        },
        { provide: OpeningBalanceService, useValue: openingBalanceService },
      ],
    }).compile();

    service = module.get<DebtService>(DebtService);
  });

  describe('createPayment() — validation', () => {
    it('rejects amount <= 0', async () => {
      await expect(
        service.createPayment({
          salesOrderId: 'so-1',
          amount: 0,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid paymentMethod', async () => {
      await expect(
        service.createPayment({
          salesOrderId: 'so-1',
          amount: 100,
          paymentMethod: 'CARD',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects BANK_TRANSFER without referenceNumber', async () => {
      await expect(
        service.createPayment({
          salesOrderId: 'so-1',
          amount: 100,
          paymentMethod: 'BANK_TRANSFER',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when SalesOrder does not exist', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.createPayment({
          salesOrderId: 'nonexistent',
          amount: 100,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when SalesOrder is CANCELLED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'CANCELLED' }),
      );
      await expect(
        service.createPayment({
          salesOrderId: 'so-1',
          amount: 100,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when Receivable is missing (data integrity)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ receivable: null }),
      );
      await expect(
        service.createPayment({
          salesOrderId: 'so-1',
          amount: 100,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects amount > remainingAmount', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({
          receivable: {
            id: 'rec-1',
            totalAmount: 1000000,
            paidAmount: 900000,
            remainingAmount: 100000,
          },
        }),
      );
      await expect(
        service.createPayment({
          salesOrderId: 'so-1',
          amount: 200000,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPayment() — success path (Task 03/04/05)', () => {
    beforeEach(() => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      prisma.runningNumber.update.mockResolvedValue({
        prefix: 'PT',
        lastNumber: 1,
        paddingLength: 6,
      });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1',
        code: 'PT000001',
      });
    });

    it('updates Receivable atomically via increment/decrement (not read-calculate-write)', async () => {
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 300000,
        totalAmount: 1000000,
        remainingAmount: 700000,
      });

      await service.createPayment({
        salesOrderId: 'so-1',
        amount: 300000,
        paymentMethod: 'CASH',
      });

      expect(prisma.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: {
          paidAmount: { increment: 300000 },
          remainingAmount: { decrement: 300000 },
          remainingAmountBeforeVat: { decrement: 300000 },
        },
      });
    });

    it('sets SalesOrder.paymentStatus = PARTIALLY_PAID when 0 < paid < total', async () => {
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 300000,
        totalAmount: 1000000,
        remainingAmount: 700000,
      });

      await service.createPayment({
        salesOrderId: 'so-1',
        amount: 300000,
        paymentMethod: 'CASH',
      });

      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { paymentStatus: 'PARTIALLY_PAID' },
      });
    });

    it('sets SalesOrder.paymentStatus = PAID when paid >= total', async () => {
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 1000000,
        totalAmount: 1000000,
        remainingAmount: 0,
      });

      await service.createPayment({
        salesOrderId: 'so-1',
        amount: 1000000,
        paymentMethod: 'CASH',
      });

      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { paymentStatus: 'PAID' },
      });
    });

    it('writes SalesOrderTimeline PAYMENT_STATUS_CHANGED even when status does not change', async () => {
      // Sales order already PARTIALLY_PAID (fromStatus), stays PARTIALLY_PAID (toStatus) after a small extra payment
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({
          paymentStatus: 'PARTIALLY_PAID',
          receivable: {
            id: 'rec-1',
            totalAmount: 1000000,
            paidAmount: 300000,
            remainingAmount: 700000,
            remainingAmountBeforeVat: 700000,
          },
        }),
      );
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 400000,
        totalAmount: 1000000,
        remainingAmount: 600000,
      });

      await service.createPayment({
        salesOrderId: 'so-1',
        amount: 100000,
        paymentMethod: 'CASH',
      });

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_STATUS_CHANGED',
            payload: expect.objectContaining({
              fromStatus: 'PARTIALLY_PAID',
              toStatus: 'PARTIALLY_PAID',
              amount: 100000,
            }),
          }),
        }),
      );
    });

    it('SalesOrderTimeline.createdBy/createdByName lấy từ JWT userId — không phải Payment.createdBy (Sprint 04)', async () => {
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 300000,
        totalAmount: 1000000,
        remainingAmount: 700000,
      });

      await service.createPayment(
        {
          salesOrderId: 'so-1',
          amount: 300000,
          paymentMethod: 'CASH',
          createdBy: 'Tên tự gõ (free-text, ngoài phạm vi)',
        },
        'user-1',
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { name: true, email: true },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
          }),
        }),
      );
      // Payment.createdBy giữ nguyên free-text dto.createdBy — ngoài phạm vi task này.
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'Tên tự gõ (free-text, ngoài phạm vi)',
          }),
        }),
      );
    });

    it('BeforeVatFirstPolicy: phần vượt remainingAmountBeforeVat tính vào allocatedVat (023-cong-no-payment-allocation-fifo)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({
          receivable: {
            id: 'rec-1',
            totalAmount: 1100000,
            paidAmount: 0,
            remainingAmount: 1100000,
            remainingAmountBeforeVat: 800000, // VAT = 300000
          },
        }),
      );
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 1000000,
        totalAmount: 1100000,
        remainingAmount: 100000,
      });

      await service.createPayment({
        salesOrderId: 'so-1',
        amount: 1000000,
        paymentMethod: 'CASH',
      });

      expect(prisma.paymentAllocation.create).toHaveBeenCalledWith({
        data: {
          paymentId: 'pay-1',
          receivableId: 'rec-1',
          salesOrderId: 'so-1',
          allocatedSubtotal: 800000,
          allocatedVat: 200000,
          allocatedTotal: 1000000,
        },
      });
      expect(prisma.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: {
          paidAmount: { increment: 1000000 },
          remainingAmount: { decrement: 1000000 },
          remainingAmountBeforeVat: { decrement: 800000 },
        },
      });
    });
  });

  describe('createAllocatedPayment() — FIFO đa đơn (023-cong-no-payment-allocation-fifo)', () => {
    beforeEach(() => {
      prisma.runningNumber.update.mockResolvedValue({
        prefix: 'PT',
        lastNumber: 1,
        paddingLength: 6,
      });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1',
        code: 'PT000001',
      });
      prisma.receivable.update.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          paidAmount: 0,
          totalAmount: 1000000,
          remainingAmount: 0,
        }),
      );
    });

    it('tự cấn FIFO theo createdAt asc khi không truyền allocations', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          salesOrderId: 'so-1',
          customerId: 'cust-1',
          remainingAmount: 300000,
          remainingAmountBeforeVat: 300000,
          salesOrder: { paymentStatus: 'UNPAID' },
        },
        {
          id: 'rec-2',
          salesOrderId: 'so-2',
          customerId: 'cust-1',
          remainingAmount: 500000,
          remainingAmountBeforeVat: 500000,
          salesOrder: { paymentStatus: 'UNPAID' },
        },
      ]);

      await service.createAllocatedPayment({
        customerId: 'cust-1',
        amount: 600000,
        paymentMethod: 'CASH',
      });

      // rec-1 (cũ nhất, đứng đầu danh sách đã sort) nhận đủ 300000, rec-2 nhận phần còn lại 300000
      expect(prisma.paymentAllocation.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          receivableId: 'rec-1',
          allocatedTotal: 300000,
        }),
      });
      expect(prisma.paymentAllocation.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          receivableId: 'rec-2',
          allocatedTotal: 300000,
        }),
      });
    });

    it('chặn thanh toán vượt tổng công nợ hiện tại của khách hàng', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          salesOrderId: 'so-1',
          customerId: 'cust-1',
          remainingAmount: 300000,
          remainingAmountBeforeVat: 300000,
          salesOrder: { paymentStatus: 'UNPAID' },
        },
      ]);

      await expect(
        service.createAllocatedPayment({
          customerId: 'cust-1',
          amount: 500000,
          paymentMethod: 'CASH',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cho phép kế toán cấn tay (override) thay vì FIFO mặc định', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          customerId: 'cust-1',
          salesOrderId: 'so-1',
          remainingAmount: 500000,
          remainingAmountBeforeVat: 500000,
          salesOrder: { status: 'IN_PRODUCTION', paymentStatus: 'UNPAID' },
        },
        {
          id: 'rec-2',
          customerId: 'cust-1',
          salesOrderId: 'so-2',
          remainingAmount: 500000,
          remainingAmountBeforeVat: 500000,
          salesOrder: { status: 'IN_PRODUCTION', paymentStatus: 'UNPAID' },
        },
      ]);

      await service.createAllocatedPayment({
        customerId: 'cust-1',
        amount: 400000,
        paymentMethod: 'CASH',
        // kế toán chọn cấn hết vào rec-2 thay vì rec-1 (thứ tự FIFO mặc định)
        allocations: [{ receivableId: 'rec-2', amount: 400000 }],
      });

      expect(prisma.paymentAllocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          receivableId: 'rec-2',
          allocatedTotal: 400000,
        }),
      });
    });

    it('override: chặn khi tổng các dòng không khớp amount', async () => {
      await expect(
        service.createAllocatedPayment({
          customerId: 'cust-1',
          amount: 400000,
          paymentMethod: 'CASH',
          allocations: [{ receivableId: 'rec-1', amount: 100000 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reversePayment()', () => {
    beforeEach(() => {
      prisma.runningNumber.update.mockResolvedValue({
        prefix: 'PT',
        lastNumber: 2,
        paddingLength: 6,
      });
    });

    it('cộng lại đúng paidAmount/remainingAmount/remainingAmountBeforeVat theo từng PaymentAllocation gốc', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        code: 'PT000001',
        type: 'NORMAL',
        amount: 300000,
        paymentMethod: 'CASH',
        reversedBy: null,
        allocations: [
          {
            receivableId: 'rec-1',
            salesOrderId: 'so-1',
            allocatedSubtotal: 250000,
            allocatedVat: 50000,
            allocatedTotal: 300000,
          },
        ],
      });
      prisma.payment.create.mockResolvedValue({ id: 'pay-2' });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-2',
        code: 'PT000002',
      });
      prisma.receivable.findUniqueOrThrow.mockResolvedValue({
        id: 'rec-1',
        salesOrder: { paymentStatus: 'PARTIALLY_PAID' },
      });
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 0,
        totalAmount: 1000000,
        remainingAmount: 1000000,
      });

      await service.reversePayment('pay-1');

      expect(prisma.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: {
          paidAmount: { decrement: 300000 },
          remainingAmount: { increment: 300000 },
          remainingAmountBeforeVat: { increment: 250000 },
        },
      });
      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { paymentStatus: 'UNPAID' },
      });
    });

    it('chặn hoàn tác một Payment đã được hoàn tác trước đó', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        type: 'NORMAL',
        reversedBy: { id: 'pay-2' },
        allocations: [{}],
      });

      await expect(service.reversePayment('pay-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('chặn hoàn tác một Payment đảo chiều (reverse-of-reverse)', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-2',
        type: 'REVERSAL',
        reversedBy: null,
        allocations: [{}],
      });

      await expect(service.reversePayment('pay-2')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('closeReceivableWithoutVat() — 024-cong-no-vat-settlement.md', () => {
    it('set remainingAmount = 0, closedWithoutVat = true, paymentStatus = PAID; giữ nguyên remainingAmountBeforeVat', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: false,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PARTIALLY_PAID' },
      });
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        dueDate: null,
        remainingAmount: 0,
        closedWithoutVat: true,
      });

      await service.closeReceivableWithoutVat('rec-1');

      expect(prisma.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { remainingAmount: 0, closedWithoutVat: true },
      });
      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { paymentStatus: 'PAID' },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_STATUS_CHANGED',
            payload: expect.objectContaining({
              event: 'CLOSED_WITHOUT_VAT',
              fromStatus: 'PARTIALLY_PAID',
              toStatus: 'PAID',
            }),
          }),
        }),
      );
    });

    it('chặn khi Receivable không tồn tại', async () => {
      prisma.receivable.findUnique.mockResolvedValue(null);
      await expect(service.closeReceivableWithoutVat('rec-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('chặn khi SalesOrder đã CANCELLED', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: false,
        salesOrder: { id: 'so-1', status: 'CANCELLED', paymentStatus: 'UNPAID' },
      });
      await expect(service.closeReceivableWithoutVat('rec-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('chặn khi Receivable đã closedWithoutVat trước đó', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: true,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PAID' },
      });
      await expect(service.closeReceivableWithoutVat('rec-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    // Rà soát mô hình công nợ (chốt 27/07/2026): không cho đóng khi còn nợ gốc
    // dở dang, tránh remainingAmount (sau VAT) bị set về 0 trong khi khách còn
    // nợ tiền thật (không chỉ VAT).
    it('chặn khi còn nợ gốc dở dang (remainingAmountBeforeVat > 0)', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: false,
        remainingAmountBeforeVat: 500000,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PARTIALLY_PAID' },
      });
      await expect(service.closeReceivableWithoutVat('rec-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.receivable.update).not.toHaveBeenCalled();
    });

    it('cho phép đóng khi remainingAmountBeforeVat = 0 (đã thu đủ phần gốc)', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: false,
        remainingAmountBeforeVat: 0,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PARTIALLY_PAID' },
      });
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        dueDate: null,
        remainingAmount: 0,
        closedWithoutVat: true,
      });

      await service.closeReceivableWithoutVat('rec-1');

      expect(prisma.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { remainingAmount: 0, closedWithoutVat: true },
      });
    });
  });

  describe('reopenReceivableClosedWithoutVat() — bổ sung 26/07/2026 (rà soát mô hình công nợ)', () => {
    it('khôi phục remainingAmount/paymentStatus đúng công thức Derived Data gốc (totalAmount - paidAmount)', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: true,
        totalAmount: 1000000,
        paidAmount: 400000,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PAID' },
        vatSettlementItems: [],
      });
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        dueDate: null,
        remainingAmount: 600000,
        closedWithoutVat: false,
      });

      await service.reopenReceivableClosedWithoutVat('rec-1');

      expect(prisma.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { remainingAmount: 600000, closedWithoutVat: false },
      });
      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { paymentStatus: 'PARTIALLY_PAID' },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: expect.objectContaining({
              event: 'REOPENED_AFTER_CLOSE_WITHOUT_VAT',
              fromStatus: 'PAID',
              toStatus: 'PARTIALLY_PAID',
            }),
          }),
        }),
      );
    });

    it('chặn khi Receivable chưa closedWithoutVat', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: false,
        totalAmount: 1000000,
        paidAmount: 400000,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PARTIALLY_PAID' },
        vatSettlementItems: [],
      });

      await expect(service.reopenReceivableClosedWithoutVat('rec-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('chặn khi đã thuộc 1 VatSettlement chưa huỷ (SENT)', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: true,
        totalAmount: 1000000,
        paidAmount: 1000000,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PAID' },
        vatSettlementItems: [{ vatSettlement: { status: 'SENT' } }],
      });

      await expect(service.reopenReceivableClosedWithoutVat('rec-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cho phép khi VatSettlement liên quan đã CANCELLED', async () => {
      prisma.receivable.findUnique.mockResolvedValue({
        id: 'rec-1',
        salesOrderId: 'so-1',
        closedWithoutVat: true,
        totalAmount: 1000000,
        paidAmount: 1000000,
        salesOrder: { id: 'so-1', status: 'IN_PRODUCTION', paymentStatus: 'PAID' },
        vatSettlementItems: [{ vatSettlement: { status: 'CANCELLED' } }],
      });
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        dueDate: null,
        remainingAmount: 0,
        closedWithoutVat: false,
      });

      await expect(service.reopenReceivableClosedWithoutVat('rec-1')).resolves.toBeDefined();
    });
  });

  describe('findAllReceivables()', () => {
    it('always excludes Receivable của SalesOrder đã CANCELLED (công nợ đang mở)', async () => {
      prisma.receivable.findMany.mockResolvedValue([]);
      prisma.receivable.count.mockResolvedValue(0);

      await service.findAllReceivables({});

      expect(prisma.receivable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            salesOrder: expect.objectContaining({
              status: { not: 'CANCELLED' },
            }),
          }),
        }),
      );
    });
  });

  // opening-balance.md — 4 hàm dưới đây cộng thêm Công nợ đầu kỳ vào tổng
  // công nợ, và phải union tập customerId (không chỉ merge vào tập đã có từ
  // groupBy(Receivable)) vì có khách chỉ có Công nợ đầu kỳ, chưa từng có
  // Receivable nào.
  describe('findReceivablesByCustomer() — merge Công nợ đầu kỳ', () => {
    it('cộng dồn Công nợ đầu kỳ vào khách đã có Receivable', async () => {
      prisma.receivable.groupBy.mockResolvedValue([
        {
          customerId: 'cust-1',
          _sum: { remainingAmount: 500000, remainingAmountBeforeVat: 500000 },
          _count: { _all: 1 },
          _min: { dueDate: null },
        },
      ]);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-1', name: 'Khách A', phone: '0900000001', debtLimit: 0 },
      ]);
      openingBalanceService.sumOpenByCustomerIds.mockResolvedValue(
        new Map([
          ['cust-1', { remaining: 200000, remainingBeforeVat: 200000 }],
        ]),
      );

      const result = await service.findReceivablesByCustomer({});

      expect(result.data).toEqual([
        expect.objectContaining({
          customerId: 'cust-1',
          totalRemaining: 700000,
          totalRemainingBeforeVat: 700000,
        }),
      ]);
    });

    it('vẫn trả về khách chỉ có Công nợ đầu kỳ, chưa từng có Receivable', async () => {
      prisma.receivable.groupBy.mockResolvedValue([]);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-2', name: 'Khách B', phone: '0900000002', debtLimit: 0 },
      ]);
      openingBalanceService.sumOpenByCustomerIds.mockResolvedValue(
        new Map([
          ['cust-2', { remaining: 300000, remainingBeforeVat: 300000 }],
        ]),
      );

      const result = await service.findReceivablesByCustomer({});

      expect(result.data).toEqual([
        expect.objectContaining({
          customerId: 'cust-2',
          receivableCount: 0,
          totalRemaining: 300000,
          daysOverdue: null,
          riskLevel: null,
        }),
      ]);
    });
  });

  describe('getCreditLimitExceededCustomers() — merge Công nợ đầu kỳ', () => {
    it('tính vượt hạn mức dựa trên Receivable + Công nợ đầu kỳ cộng lại', async () => {
      prisma.receivable.groupBy.mockResolvedValue([
        { customerId: 'cust-1', _sum: { remainingAmount: 800000 } },
      ]);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-1', name: 'Khách A', debtLimit: 1000000 },
      ]);
      // Receivable riêng (800k) chưa vượt hạn mức (1tr), nhưng cộng thêm
      // Công nợ đầu kỳ (300k) thì vượt.
      openingBalanceService.sumOpenByCustomerIds.mockResolvedValue(
        new Map([['cust-1', { remaining: 300000, remainingBeforeVat: 300000 }]]),
      );

      const result = await service.getCreditLimitExceededCustomers();

      expect(result).toEqual([
        expect.objectContaining({ customerId: 'cust-1', totalRemaining: 1100000 }),
      ]);
    });

    it('phát hiện khách vượt hạn mức chỉ nhờ Công nợ đầu kỳ (không có Receivable)', async () => {
      prisma.receivable.groupBy.mockResolvedValue([]);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-3', name: 'Khách C', debtLimit: 100000 },
      ]);
      openingBalanceService.sumOpenByCustomerIds.mockResolvedValue(
        new Map([['cust-3', { remaining: 200000, remainingBeforeVat: 200000 }]]),
      );

      const result = await service.getCreditLimitExceededCustomers();

      expect(result).toEqual([
        expect.objectContaining({ customerId: 'cust-3', totalRemaining: 200000 }),
      ]);
    });
  });

  describe('getDashboardSummary() — merge Công nợ đầu kỳ', () => {
    it('cộng Công nợ đầu kỳ vào totalRemaining/totalRemainingBeforeVat, không đụng totalReceivable/totalPaid', async () => {
      prisma.receivable.aggregate
        .mockResolvedValueOnce({
          _sum: {
            totalAmount: 5000000,
            paidAmount: 2000000,
            remainingAmount: 3000000,
            totalAmountBeforeVat: 4500000,
            remainingAmountBeforeVat: 2700000,
          },
        })
        .mockResolvedValueOnce({
          _sum: { remainingAmount: 1000000 },
          _count: { _all: 2 },
        });
      openingBalanceService.sumAllOpen.mockResolvedValue({
        remaining: 500000,
        remainingBeforeVat: 500000,
      });

      const result = await service.getDashboardSummary();

      expect(result).toEqual({
        totalReceivable: 5000000,
        totalPaid: 2000000,
        totalRemaining: 3500000,
        totalReceivableBeforeVat: 4500000,
        totalRemainingBeforeVat: 3200000,
        overdueAmount: 1000000,
        overdueCount: 2,
      });
    });
  });

  describe('getTopDebtors() — merge Công nợ đầu kỳ', () => {
    it('xếp hạng theo tổng Receivable + Công nợ đầu kỳ, không chỉ theo Receivable', async () => {
      // Nếu chỉ tính riêng Receivable: cust-1 (900k) > cust-2 (100k).
      // Cộng thêm Công nợ đầu kỳ: cust-2 (100k + 1tr = 1.1tr) > cust-1 (900k).
      prisma.receivable.groupBy.mockResolvedValue([
        { customerId: 'cust-1', _sum: { remainingAmount: 900000 } },
        { customerId: 'cust-2', _sum: { remainingAmount: 100000 } },
      ]);
      openingBalanceService.sumOpenByCustomerIds.mockResolvedValue(
        new Map([['cust-2', { remaining: 1000000, remainingBeforeVat: 1000000 }]]),
      );
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-1', name: 'Khách A', phone: '0900000001' },
        { id: 'cust-2', name: 'Khách B', phone: '0900000002' },
      ]);

      const result = await service.getTopDebtors(2);

      expect(result).toEqual([
        expect.objectContaining({ customerId: 'cust-2', totalRemaining: 1100000 }),
        expect.objectContaining({ customerId: 'cust-1', totalRemaining: 900000 }),
      ]);
    });

    it('cắt đúng top N sau khi đã cộng Công nợ đầu kỳ, không cắt trước ở tầng DB', async () => {
      prisma.receivable.groupBy.mockResolvedValue([
        { customerId: 'cust-1', _sum: { remainingAmount: 100000 } },
      ]);
      openingBalanceService.sumOpenByCustomerIds.mockResolvedValue(
        new Map([
          ['cust-2', { remaining: 50000, remainingBeforeVat: 50000 }],
          ['cust-3', { remaining: 900000, remainingBeforeVat: 900000 }],
        ]),
      );
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-3', name: 'Khách C', phone: '0900000003' },
      ]);

      const result = await service.getTopDebtors(1);

      expect(result).toEqual([
        expect.objectContaining({ customerId: 'cust-3', totalRemaining: 900000 }),
      ]);
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['cust-3'] } },
        }),
      );
    });
  });
});
