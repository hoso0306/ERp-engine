import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DebtService } from './debt.service';
import { PrismaService } from '../prisma/prisma.service';

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
    },
    ...overrides,
  };
}

describe('DebtService', () => {
  let service: DebtService;
  let prisma: {
    salesOrder: { findUnique: jest.Mock; update: jest.Mock };
    receivable: { update: jest.Mock; findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; groupBy: jest.Mock };
    runningNumber: { update: jest.Mock };
    payment: { create: jest.Mock; findUniqueOrThrow: jest.Mock };
    salesOrderTimeline: { create: jest.Mock };
    customer: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      salesOrder: { findUnique: jest.fn(), update: jest.fn() },
      receivable: {
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        groupBy: jest.fn(),
      },
      runningNumber: { update: jest.fn() },
      payment: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
      salesOrderTimeline: { create: jest.fn() },
      customer: { findMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DebtService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DebtService>(DebtService);
  });

  describe('createPayment() — validation', () => {
    it('rejects amount <= 0', async () => {
      await expect(
        service.createPayment({ salesOrderId: 'so-1', amount: 0, paymentMethod: 'CASH' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid paymentMethod', async () => {
      await expect(
        service.createPayment({ salesOrderId: 'so-1', amount: 100, paymentMethod: 'CARD' }),
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
        service.createPayment({ salesOrderId: 'nonexistent', amount: 100, paymentMethod: 'CASH' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when SalesOrder is CANCELLED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder({ status: 'CANCELLED' }));
      await expect(
        service.createPayment({ salesOrderId: 'so-1', amount: 100, paymentMethod: 'CASH' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when Receivable is missing (data integrity)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder({ receivable: null }));
      await expect(
        service.createPayment({ salesOrderId: 'so-1', amount: 100, paymentMethod: 'CASH' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects amount > remainingAmount', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ receivable: { id: 'rec-1', totalAmount: 1000000, paidAmount: 900000, remainingAmount: 100000 } }),
      );
      await expect(
        service.createPayment({ salesOrderId: 'so-1', amount: 200000, paymentMethod: 'CASH' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPayment() — success path (Task 03/04/05)', () => {
    beforeEach(() => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      prisma.runningNumber.update.mockResolvedValue({ prefix: 'PT', lastNumber: 1, paddingLength: 6 });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', code: 'PT000001' });
    });

    it('updates Receivable atomically via increment/decrement (not read-calculate-write)', async () => {
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 300000,
        totalAmount: 1000000,
        remainingAmount: 700000,
      });

      await service.createPayment({ salesOrderId: 'so-1', amount: 300000, paymentMethod: 'CASH' });

      expect(prisma.receivable.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: {
          paidAmount: { increment: 300000 },
          remainingAmount: { decrement: 300000 },
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

      await service.createPayment({ salesOrderId: 'so-1', amount: 300000, paymentMethod: 'CASH' });

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

      await service.createPayment({ salesOrderId: 'so-1', amount: 1000000, paymentMethod: 'CASH' });

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
          receivable: { id: 'rec-1', totalAmount: 1000000, paidAmount: 300000, remainingAmount: 700000 },
        }),
      );
      prisma.receivable.update.mockResolvedValue({
        id: 'rec-1',
        paidAmount: 400000,
        totalAmount: 1000000,
        remainingAmount: 600000,
      });

      await service.createPayment({ salesOrderId: 'so-1', amount: 100000, paymentMethod: 'CASH' });

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
  });
});
