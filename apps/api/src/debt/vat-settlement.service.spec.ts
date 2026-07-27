import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VatSettlementService } from './vat-settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';

describe('VatSettlementService', () => {
  let service: VatSettlementService;
  let prisma: {
    receivable: { findMany: jest.Mock };
    vatSettlement: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    vatSettlementItem: { create: jest.Mock };
    vatSettlementItemLine: { create: jest.Mock };
    vatSettlementTimeline: { create: jest.Mock };
    salesOrderTimeline: { create: jest.Mock };
    runningNumber: { update: jest.Mock };
    payment: { create: jest.Mock };
    openingBalance: { findUnique: jest.Mock };
    product: { findUnique: jest.Mock };
    customerProductDiscount: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let pricingEngineService: { calculate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      receivable: { findMany: jest.fn() },
      vatSettlement: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      vatSettlementItem: { create: jest.fn() },
      vatSettlementItemLine: { create: jest.fn() },
      vatSettlementTimeline: { create: jest.fn() },
      salesOrderTimeline: { create: jest.fn() },
      runningNumber: { update: jest.fn() },
      payment: { create: jest.fn() },
      openingBalance: { findUnique: jest.fn() },
      product: { findUnique: jest.fn() },
      customerProductDiscount: { findUnique: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Nguyễn Văn An', email: 'an@acme.vn' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    pricingEngineService = { calculate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VatSettlementService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: pricingEngineService },
      ],
    }).compile();

    service = module.get<VatSettlementService>(VatSettlementService);
  });

  describe('create()', () => {
    beforeEach(() => {
      prisma.runningNumber.update.mockResolvedValue({
        prefix: 'VS',
        lastNumber: 1,
        paddingLength: 6,
      });
      prisma.vatSettlement.create.mockResolvedValue({ id: 'vs-1', code: 'VS000001' });
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({
        id: 'vs-1',
        code: 'VS000001',
      });
    });

    it('tính đúng totalAmount = SUM(totalAmount - totalAmountBeforeVat) của các Receivable đã chọn', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          customerId: 'cust-1',
          salesOrderId: 'so-1',
          closedWithoutVat: true,
          totalAmount: 1100000,
          totalAmountBeforeVat: 1000000,
          salesOrder: { id: 'so-1', status: 'DELIVERED' },
          vatSettlementItems: [],
        },
        {
          id: 'rec-2',
          customerId: 'cust-1',
          salesOrderId: 'so-2',
          closedWithoutVat: true,
          totalAmount: 550000,
          totalAmountBeforeVat: 500000,
          salesOrder: { id: 'so-2', status: 'DELIVERED' },
          vatSettlementItems: [],
        },
      ]);

      await service.create({
        customerId: 'cust-1',
        receivableIds: ['rec-1', 'rec-2'],
      });

      expect(prisma.vatSettlement.create).toHaveBeenCalledWith({
        data: { code: 'VS000001', customerId: 'cust-1', totalAmount: 150000 },
      });
      expect(prisma.vatSettlementItem.create).toHaveBeenNthCalledWith(1, {
        data: { vatSettlementId: 'vs-1', receivableId: 'rec-1', amount: 100000 },
      });
      expect(prisma.vatSettlementItem.create).toHaveBeenNthCalledWith(2, {
        data: { vatSettlementId: 'vs-1', receivableId: 'rec-2', amount: 50000 },
      });
    });

    it('chặn khi Receivable chưa closedWithoutVat', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          customerId: 'cust-1',
          salesOrderId: 'so-1',
          closedWithoutVat: false,
          totalAmount: 1100000,
          totalAmountBeforeVat: 1000000,
          salesOrder: { id: 'so-1', status: 'DELIVERED' },
          vatSettlementItems: [],
        },
      ]);

      await expect(
        service.create({ customerId: 'cust-1', receivableIds: ['rec-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('chặn khi Receivable đã thuộc 1 VatSettlement đang hoạt động (chưa INVOICED)', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          customerId: 'cust-1',
          salesOrderId: 'so-1',
          closedWithoutVat: true,
          totalAmount: 1100000,
          totalAmountBeforeVat: 1000000,
          salesOrder: { id: 'so-1', status: 'DELIVERED' },
          vatSettlementItems: [{ vatSettlement: { status: 'SENT' } }],
        },
      ]);

      await expect(
        service.create({ customerId: 'cust-1', receivableIds: ['rec-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cho phép khi Receivable từng thuộc 1 VatSettlement đã INVOICED (không còn active)', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          customerId: 'cust-1',
          salesOrderId: 'so-1',
          closedWithoutVat: true,
          totalAmount: 1100000,
          totalAmountBeforeVat: 1000000,
          salesOrder: { id: 'so-1', status: 'DELIVERED' },
          vatSettlementItems: [{ vatSettlement: { status: 'INVOICED' } }],
        },
      ]);

      await expect(
        service.create({ customerId: 'cust-1', receivableIds: ['rec-1'] }),
      ).resolves.toBeDefined();
    });

    it('cho phép khi Receivable từng thuộc 1 VatSettlement đã CANCELLED (không còn active)', async () => {
      prisma.receivable.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          customerId: 'cust-1',
          salesOrderId: 'so-1',
          closedWithoutVat: true,
          totalAmount: 1100000,
          totalAmountBeforeVat: 1000000,
          salesOrder: { id: 'so-1', status: 'DELIVERED' },
          vatSettlementItems: [{ vatSettlement: { status: 'CANCELLED' } }],
        },
      ]);

      await expect(
        service.create({ customerId: 'cust-1', receivableIds: ['rec-1'] }),
      ).resolves.toBeDefined();
    });

    it('chặn khi không truyền receivableIds', async () => {
      await expect(
        service.create({ customerId: 'cust-1', receivableIds: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEligibleReceivables() — loại trừ cả INVOICED lẫn CANCELLED', () => {
    it('query loại trừ Receivable có VatSettlement chưa INVOICED và chưa CANCELLED', async () => {
      prisma.receivable.findMany.mockResolvedValue([]);

      await service.getEligibleReceivables('cust-1');

      expect(prisma.receivable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vatSettlementItems: {
              none: {
                vatSettlement: { status: { notIn: ['INVOICED', 'CANCELLED'] } },
              },
            },
          }),
        }),
      );
    });
  });

  describe('cancel() — bổ sung 26/07/2026 (rà soát mô hình công nợ)', () => {
    it('chuyển status sang CANCELLED khi đang DRAFT', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue({
        id: 'vs-1',
        code: 'VS000001',
        status: 'DRAFT',
        totalAmount: 100000,
        items: [{ receivable: { salesOrderId: 'so-1' } }],
      });
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({ id: 'vs-1' });

      await service.cancel('vs-1');

      expect(prisma.vatSettlement.update).toHaveBeenCalledWith({
        where: { id: 'vs-1' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.vatSettlementTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'VAT_SETTLEMENT_CANCELLED' }),
        }),
      );
    });

    it('chặn khi không ở trạng thái DRAFT', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue({
        id: 'vs-1',
        status: 'SENT',
        items: [],
      });

      await expect(service.cancel('vs-1')).rejects.toThrow(BadRequestException);
    });

    it('chặn khi VatSettlement không tồn tại', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue(null);

      await expect(service.cancel('vs-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmPayment() — Quyết định #6', () => {
    it('tạo Payment với vatSettlementId, KHÔNG tạo PaymentAllocation, KHÔNG đụng Receivable', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue({
        id: 'vs-1',
        code: 'VS000001',
        status: 'SENT',
        totalAmount: 150000,
        items: [{ receivable: { salesOrderId: 'so-1' } }],
      });
      prisma.runningNumber.update.mockResolvedValue({
        prefix: 'PT',
        lastNumber: 5,
        paddingLength: 6,
      });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1', code: 'PT000005' });
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({ id: 'vs-1' });

      await service.confirmPayment('vs-1', { paymentMethod: 'CASH' });

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 150000,
            vatSettlementId: 'vs-1',
          }),
        }),
      );
      expect(prisma.vatSettlement.update).toHaveBeenCalledWith({
        where: { id: 'vs-1' },
        data: { status: 'PAID', paymentId: 'pay-1' },
      });
    });

    it('chặn khi VatSettlement không ở trạng thái SENT', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue({
        id: 'vs-1',
        status: 'DRAFT',
        items: [],
      });

      await expect(
        service.confirmPayment('vs-1', { paymentMethod: 'CASH' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('chặn khi VatSettlement không tồn tại', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmPayment('vs-x', { paymentMethod: 'CASH' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createFromOpeningBalance() — opening-balance.md', () => {
    const dto = {
      openingBalanceId: 'ob-1',
      lines: [
        {
          productId: 'prod-1',
          quantity: 2,
          parameters: [],
        },
      ],
    };

    beforeEach(() => {
      prisma.openingBalance.findUnique.mockResolvedValue({
        id: 'ob-1',
        customerId: 'cust-1',
        remainingAmount: 500000,
      });
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        code: 'P001',
        name: 'Sản phẩm A',
        productTypeId: 'pt-1',
        parameters: [],
      });
      pricingEngineService.calculate.mockResolvedValue({
        systemPrice: 1000000,
        pricingRuleVersionId: 'prv-1',
        vatRate: 10,
        surchargeAfterDiscount: 0,
      });
      prisma.customerProductDiscount.findUnique.mockResolvedValue(null);
      prisma.runningNumber.update.mockResolvedValue({
        prefix: 'VS',
        lastNumber: 2,
        paddingLength: 6,
      });
      prisma.vatSettlement.create.mockResolvedValue({ id: 'vs-2', code: 'VS000002' });
      prisma.vatSettlementItem.create.mockResolvedValue({ id: 'item-1' });
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({
        id: 'vs-2',
        code: 'VS000002',
      });
    });

    it('rejects khi thiếu openingBalanceId', async () => {
      await expect(
        service.createFromOpeningBalance({ openingBalanceId: '', lines: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects khi không có dòng sản phẩm nào', async () => {
      await expect(
        service.createFromOpeningBalance({ openingBalanceId: 'ob-1', lines: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects khi Công nợ đầu kỳ không tồn tại', async () => {
      prisma.openingBalance.findUnique.mockResolvedValue(null);
      await expect(service.createFromOpeningBalance(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects khi Công nợ đầu kỳ đã đóng hết (remainingAmount <= 0)', async () => {
      prisma.openingBalance.findUnique.mockResolvedValue({
        id: 'ob-1',
        customerId: 'cust-1',
        remainingAmount: 0,
      });
      await expect(service.createFromOpeningBalance(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('tính totalAmount = SUM(vatAmount), tạo VatSettlementItem gắn openingBalanceId (không có receivableId)', async () => {
      // finalPrice = 1000000 (không chiết khấu) → subtotal = 1000000*2 = 2000000
      // → vatAmount = 2000000*10% = 200000.
      await service.createFromOpeningBalance(dto, 'user-1');

      expect(prisma.vatSettlement.create).toHaveBeenCalledWith({
        data: { code: 'VS000002', customerId: 'cust-1', totalAmount: 200000 },
      });
      expect(prisma.vatSettlementItem.create).toHaveBeenCalledWith({
        data: {
          vatSettlementId: 'vs-2',
          openingBalanceId: 'ob-1',
          amount: 200000,
        },
      });
      expect(prisma.vatSettlementItemLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vatSettlementItemId: 'item-1',
            productId: 'prod-1',
            quantity: 2,
            subtotal: 2000000,
            vatAmount: 200000,
          }),
        }),
      );
    });

    it('KHÔNG ghi SalesOrderTimeline — nguồn Công nợ đầu kỳ không có Sales Order liên quan', async () => {
      await service.createFromOpeningBalance(dto);

      expect(prisma.salesOrderTimeline.create).not.toHaveBeenCalled();
    });

    it('rejects khi Sản phẩm không tồn tại', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.createFromOpeningBalance(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects khi quantity <= 0', async () => {
      await expect(
        service.createFromOpeningBalance({
          openingBalanceId: 'ob-1',
          lines: [{ productId: 'prod-1', quantity: 0, parameters: [] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // opening-balance.md — VatSettlementItem giờ có 2 nguồn (Receivable hoặc
  // OpeningBalance). writeSalesOrderTimelines() chỉ ghi được cho item có
  // Receivable/SalesOrder gốc — 4 điểm gọi (send/cancel/confirmPayment/
  // markInvoiced) đều phải lọc bỏ item receivable = null trước khi gọi.
  describe('writeSalesOrderTimelines() — lọc item nguồn Công nợ đầu kỳ (receivable = null)', () => {
    function settlementWithMixedItems(status: string) {
      return {
        id: 'vs-1',
        code: 'VS000001',
        status,
        totalAmount: 200000,
        items: [
          { receivable: { salesOrderId: 'so-1' } },
          // Item nguồn OpeningBalance — không có Receivable gốc.
          { receivable: null },
        ],
      };
    }

    it('send(): chỉ ghi SalesOrderTimeline cho item có Receivable', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue(
        settlementWithMixedItems('DRAFT'),
      );
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({ id: 'vs-1' });

      await service.send('vs-1');

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledTimes(1);
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ salesOrderId: 'so-1' }),
        }),
      );
    });

    it('cancel(): chỉ ghi SalesOrderTimeline cho item có Receivable', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue(
        settlementWithMixedItems('DRAFT'),
      );
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({ id: 'vs-1' });

      await service.cancel('vs-1');

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledTimes(1);
    });

    it('confirmPayment(): chỉ ghi SalesOrderTimeline cho item có Receivable', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue(
        settlementWithMixedItems('SENT'),
      );
      prisma.runningNumber.update.mockResolvedValue({
        prefix: 'PT',
        lastNumber: 5,
        paddingLength: 6,
      });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1', code: 'PT000005' });
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({ id: 'vs-1' });

      await service.confirmPayment('vs-1', { paymentMethod: 'CASH' });

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledTimes(1);
    });

    it('markInvoiced(): chỉ ghi SalesOrderTimeline cho item có Receivable', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue(
        settlementWithMixedItems('PAID'),
      );
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({ id: 'vs-1' });

      await service.markInvoiced('vs-1', {
        invoiceNumber: 'HD001',
        invoiceDate: '2026-07-27',
      });

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledTimes(1);
    });

    it('không throw khi TẤT CẢ item đều nguồn Công nợ đầu kỳ (không gọi SalesOrderTimeline lần nào)', async () => {
      prisma.vatSettlement.findUnique.mockResolvedValue({
        id: 'vs-1',
        code: 'VS000001',
        status: 'DRAFT',
        totalAmount: 200000,
        items: [{ receivable: null }],
      });
      prisma.vatSettlement.findUniqueOrThrow.mockResolvedValue({ id: 'vs-1' });

      await expect(service.send('vs-1')).resolves.toBeDefined();
      expect(prisma.salesOrderTimeline.create).not.toHaveBeenCalled();
    });
  });
});
