import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../shared/excel/excel.service';
import { OpeningBalanceService } from '../debt/opening-balance.service';

// Chỉ cover getDebtSummary() — nơi merge Công nợ đầu kỳ vào tổng công nợ
// hiện tại của khách hàng (opening-balance.md). Các method CRUD khác của
// CustomerService không thuộc phạm vi thay đổi lần này.
describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: {
    customer: { findFirst: jest.Mock };
    receivable: { aggregate: jest.Mock };
  };
  let openingBalanceService: { sumOpenForCustomer: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn() },
      receivable: { aggregate: jest.fn() },
    };
    openingBalanceService = { sumOpenForCustomer: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExcelService, useValue: {} },
        { provide: OpeningBalanceService, useValue: openingBalanceService },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  describe('getDebtSummary()', () => {
    it('throws NotFoundException nếu khách hàng không tồn tại', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.getDebtSummary('cust-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('cộng Công nợ đầu kỳ còn mở vào totalRemaining/totalRemainingBeforeVat', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.receivable.aggregate.mockResolvedValue({
        _sum: { remainingAmount: 500000, remainingAmountBeforeVat: 450000 },
      });
      openingBalanceService.sumOpenForCustomer.mockResolvedValue({
        remaining: 200000,
        remainingBeforeVat: 200000,
      });

      const result = await service.getDebtSummary('cust-1');

      expect(result).toEqual({
        totalRemaining: 700000,
        totalRemainingBeforeVat: 650000,
      });
      expect(openingBalanceService.sumOpenForCustomer).toHaveBeenCalledWith(
        'cust-1',
      );
    });

    it('vẫn đúng khi khách chỉ có Công nợ đầu kỳ, chưa từng có Receivable', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-2' });
      prisma.receivable.aggregate.mockResolvedValue({
        _sum: { remainingAmount: null, remainingAmountBeforeVat: null },
      });
      openingBalanceService.sumOpenForCustomer.mockResolvedValue({
        remaining: 300000,
        remainingBeforeVat: 300000,
      });

      const result = await service.getDebtSummary('cust-2');

      expect(result).toEqual({
        totalRemaining: 300000,
        totalRemainingBeforeVat: 300000,
      });
    });

    it('chỉ tính Receivable của SalesOrder chưa CANCELLED', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.receivable.aggregate.mockResolvedValue({
        _sum: { remainingAmount: 0, remainingAmountBeforeVat: 0 },
      });
      openingBalanceService.sumOpenForCustomer.mockResolvedValue({
        remaining: 0,
        remainingBeforeVat: 0,
      });

      await service.getDebtSummary('cust-1');

      expect(prisma.receivable.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customerId: 'cust-1',
            salesOrder: { status: { not: 'CANCELLED' } },
          },
        }),
      );
    });
  });
});
