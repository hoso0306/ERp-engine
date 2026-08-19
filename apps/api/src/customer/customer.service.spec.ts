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
    customer: { findFirst: jest.Mock; create: jest.Mock };
    receivable: { aggregate: jest.Mock };
    customerGroup: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let openingBalanceService: { sumOpenForCustomer: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn(), create: jest.fn() },
      receivable: { aggregate: jest.fn() },
      customerGroup: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          runningNumber: {
            update: jest.fn().mockResolvedValue({
              prefix: 'KH',
              lastNumber: 1,
              paddingLength: 6,
            }),
          },
        }),
      ),
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

    it('cộng Công nợ đầu kỳ còn mở vào totalRemaining', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.receivable.aggregate.mockResolvedValue({
        _sum: { remainingAmount: 500000 },
      });
      openingBalanceService.sumOpenForCustomer.mockResolvedValue({
        remaining: 200000,
      });

      const result = await service.getDebtSummary('cust-1');

      expect(result).toEqual({
        totalRemaining: 700000,
      });
      expect(openingBalanceService.sumOpenForCustomer).toHaveBeenCalledWith(
        'cust-1',
      );
    });

    it('vẫn đúng khi khách chỉ có Công nợ đầu kỳ, chưa từng có Receivable', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-2' });
      prisma.receivable.aggregate.mockResolvedValue({
        _sum: { remainingAmount: null },
      });
      openingBalanceService.sumOpenForCustomer.mockResolvedValue({
        remaining: 300000,
      });

      const result = await service.getDebtSummary('cust-2');

      expect(result).toEqual({
        totalRemaining: 300000,
      });
    });

    it('chỉ tính Receivable của SalesOrder chưa CANCELLED', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.receivable.aggregate.mockResolvedValue({
        _sum: { remainingAmount: 0 },
      });
      openingBalanceService.sumOpenForCustomer.mockResolvedValue({
        remaining: 0,
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

  // Mặc định khách hàng mới (chốt 27/07/2026): nhóm "Đại lý" + hạn mức công
  // nợ 30 triệu khi không truyền — chỉ áp dụng lúc tạo mới.
  describe('create() — mặc định nhóm KH + hạn mức công nợ', () => {
    beforeEach(() => {
      prisma.customer.findFirst.mockResolvedValue(null); // không trùng SĐT
      prisma.customer.create.mockResolvedValue({ id: 'new-cust' });
    });

    it('tự gán nhóm "Đại lý" và hạn mức 30 triệu khi không truyền', async () => {
      prisma.customerGroup.findUnique.mockResolvedValue({
        id: 'grp-agency',
        name: 'Đại lý',
      });

      await service.create({ name: 'KH Test', phone: '0901234567' });

      expect(prisma.customerGroup.findUnique).toHaveBeenCalledWith({
        where: { name: 'Đại lý' },
      });
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerGroupId: 'grp-agency',
            debtLimit: 30_000_000,
          }),
        }),
      );
    });

    it('không ghi đè nếu người dùng đã chọn nhóm/hạn mức khác', async () => {
      await service.create({
        name: 'KH Test',
        phone: '0901234568',
        customerGroupId: 'grp-enterprise',
        debtLimit: 5_000_000,
      });

      expect(prisma.customerGroup.findUnique).not.toHaveBeenCalled();
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerGroupId: 'grp-enterprise',
            debtLimit: 5_000_000,
          }),
        }),
      );
    });

    it('nhóm "Đại lý" không tồn tại → customerGroupId về null, không lỗi', async () => {
      prisma.customerGroup.findUnique.mockResolvedValue(null);

      await service.create({ name: 'KH Test', phone: '0901234569' });

      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerGroupId: null }),
        }),
      );
    });
  });
});
