import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../shared/excel/excel.service';
import { OpeningBalanceService } from '../debt/opening-balance.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { SettingService } from '../setting/setting.service';

// Chỉ cover getDebtSummary() — nơi merge Công nợ đầu kỳ vào tổng công nợ
// hiện tại của khách hàng (opening-balance.md). Các method CRUD khác của
// CustomerService không thuộc phạm vi thay đổi lần này.
describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: {
    customer: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
    receivable: { aggregate: jest.Mock };
    customerGroup: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let openingBalanceService: { sumOpenForCustomer: jest.Mock };
  let salesOrderService: { getOrderStatsByCustomer: jest.Mock };
  let settingService: { getNumberValue: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customer: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
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
    salesOrderService = { getOrderStatsByCustomer: jest.fn() };
    settingService = { getNumberValue: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExcelService, useValue: {} },
        { provide: OpeningBalanceService, useValue: openingBalanceService },
        { provide: SalesOrderService, useValue: salesOrderService },
        { provide: SettingService, useValue: settingService },
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
  // sprint-04/028 — Tab "Khách cần nhắc".
  describe('getReminders()', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const NOW = new Date('2026-10-11T12:00:00Z').getTime();
    const daysAgo = (n: number) => new Date(NOW - n * DAY);

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(NOW);
      const thresholds: Record<string, number> = {
        reminderDaysHigh: 30,
        reminderDaysMedium: 60,
        reminderDaysLow: 90,
      };
      settingService.getNumberValue.mockImplementation(
        (_module: string, key: string) => Promise.resolve(thresholds[key]),
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function customer(id: string, priority: string, createdDaysAgo = 365) {
      return {
        id,
        code: id.toUpperCase(),
        name: `Khách ${id}`,
        phone: `09${id}`,
        companyName: null,
        priority,
        createdAt: daysAgo(createdDaysAgo),
      };
    }

    it('ngưỡng theo priority, khách chưa mua lấy mốc ngày tạo, sắp Cao → Thấp rồi quá ngưỡng giảm dần', async () => {
      prisma.customer.findMany.mockResolvedValue([
        customer('h1', 'HIGH'), // mua 31 ngày trước → quá 1
        customer('h2', 'HIGH'), // mua 29 ngày trước → chưa tới ngưỡng
        customer('h3', 'HIGH'), // mua 45 ngày trước → quá 15
        customer('m1', 'MEDIUM', 70), // chưa mua, tạo 70 ngày trước → quá 10
        customer('m2', 'MEDIUM', 10), // chưa mua, tạo 10 ngày trước → chưa nhắc
        customer('l1', 'LOW'), // mua đúng 90 ngày trước → quá 0 (vẫn nhắc)
      ]);
      salesOrderService.getOrderStatsByCustomer.mockResolvedValue([
        {
          customerId: 'h1',
          orderCount: 3,
          totalRevenue: 900,
          lastOrderAt: daysAgo(31),
        },
        {
          customerId: 'h2',
          orderCount: 1,
          totalRevenue: 100,
          lastOrderAt: daysAgo(29),
        },
        {
          customerId: 'h3',
          orderCount: 2,
          totalRevenue: 400,
          lastOrderAt: daysAgo(45),
        },
        {
          customerId: 'l1',
          orderCount: 1,
          totalRevenue: 50,
          lastOrderAt: daysAgo(90),
        },
      ]);

      const result = await service.getReminders();

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, status: 'ACTIVE' },
        }),
      );
      expect(result.thresholds).toEqual({ HIGH: 30, MEDIUM: 60, LOW: 90 });
      expect(
        result.customers.map((c) => [c.customerId, c.overdueDays]),
      ).toEqual([
        ['h3', 15],
        ['h1', 1],
        ['m1', 10],
        ['l1', 0],
      ]);
      const m1 = result.customers.find((c) => c.customerId === 'm1')!;
      expect(m1.lastOrderAt).toBeNull();
      expect(m1.totalRevenue).toBe(0);
      expect(m1.orderCount).toBe(0);
    });

    it('lọc theo priority truyền vào', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      salesOrderService.getOrderStatsByCustomer.mockResolvedValue([]);

      await service.getReminders('HIGH');

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null, status: 'ACTIVE', priority: 'HIGH' },
        }),
      );
    });

    it('priority không hợp lệ -> BadRequestException', async () => {
      await expect(service.getReminders('URGENT')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
