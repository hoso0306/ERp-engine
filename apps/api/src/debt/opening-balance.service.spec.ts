import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OpeningBalanceService } from './opening-balance.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OpeningBalanceService', () => {
  let service: OpeningBalanceService;
  let prisma: {
    runningNumber: { update: jest.Mock };
    customer: { findUnique: jest.Mock };
    openingBalance: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      groupBy: jest.Mock;
      aggregate: jest.Mock;
    };
    openingBalanceTimeline: { create: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      runningNumber: {
        update: jest.fn().mockResolvedValue({
          prefix: 'CNK',
          lastNumber: 1,
          paddingLength: 5,
        }),
      },
      customer: { findUnique: jest.fn() },
      openingBalance: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      openingBalanceTimeline: { create: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ name: 'Nguyễn Văn An', email: 'an@acme.vn' }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpeningBalanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OpeningBalanceService>(OpeningBalanceService);
  });

  describe('create()', () => {
    it('rejects khi thiếu customerId', async () => {
      await expect(
        service.create({ customerId: '', amount: 100000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects khi amount <= 0', async () => {
      await expect(
        service.create({ customerId: 'cust-1', amount: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects khi Customer không tồn tại', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ customerId: 'cust-1', amount: 100000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('tạo OpeningBalance với amount/remainingAmount = amount nhập vào', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.openingBalance.create.mockImplementation(({ data }) => data);

      await service.create(
        { customerId: 'cust-1', amount: 100000 },
        'user-1',
      );

      expect(prisma.openingBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 100000,
            remainingAmount: 100000,
          }),
        }),
      );
    });

    it('sinh mã từ RunningNumber OPENING_BALANCE và ghi Timeline OPENING_BALANCE_CREATED', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.openingBalance.create.mockResolvedValue({
        id: 'ob-1',
        code: 'CNK00001',
      });

      const result = await service.create(
        { customerId: 'cust-1', amount: 100000 },
        'user-1',
      );

      expect(prisma.runningNumber.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'OPENING_BALANCE' } }),
      );
      expect(prisma.openingBalanceTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            openingBalanceId: 'ob-1',
            action: 'OPENING_BALANCE_CREATED',
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
          }),
        }),
      );
      expect(result).toEqual({ id: 'ob-1', code: 'CNK00001' });
    });
  });

  describe('findAllByCustomer()', () => {
    it('lọc theo customerId, sắp createdAt asc', async () => {
      prisma.openingBalance.findMany.mockResolvedValue([]);

      await service.findAllByCustomer('cust-1');

      expect(prisma.openingBalance.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
        orderBy: { createdAt: 'asc' },
        include: expect.objectContaining({ allocations: expect.anything() }),
      });
    });
  });

  describe('findOne()', () => {
    it('throws NotFoundException nếu không tồn tại', async () => {
      prisma.openingBalance.findUnique.mockResolvedValue(null);
      await expect(service.findOne('ob-x')).rejects.toThrow(NotFoundException);
    });

    it('trả về kèm timeline khi tồn tại', async () => {
      prisma.openingBalance.findUnique.mockResolvedValue({
        id: 'ob-1',
        timeline: [],
      });
      const result = await service.findOne('ob-1');
      expect(result).toEqual({ id: 'ob-1', timeline: [] });
    });
  });

  describe('reduce()', () => {
    it('rejects khi thiếu reason', async () => {
      await expect(
        service.reduce('ob-1', { amount: 10000, reason: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects khi amount <= 0', async () => {
      await expect(
        service.reduce('ob-1', { amount: 0, reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects khi OpeningBalance không tồn tại', async () => {
      prisma.openingBalance.findUnique.mockResolvedValue(null);
      await expect(
        service.reduce('ob-x', { amount: 10000, reason: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects khi số tiền giảm vượt quá số dư còn lại', async () => {
      prisma.openingBalance.findUnique.mockResolvedValue({
        id: 'ob-1',
        remainingAmount: 50000,
      });
      await expect(
        service.reduce('ob-1', { amount: 60000, reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('giảm remainingAmount và ghi Timeline OPENING_BALANCE_REDUCED', async () => {
      prisma.openingBalance.findUnique.mockResolvedValue({
        id: 'ob-1',
        remainingAmount: 100000,
      });
      prisma.openingBalance.update.mockResolvedValue({
        id: 'ob-1',
        remainingAmount: 70000,
      });

      await service.reduce(
        'ob-1',
        { amount: 30000, reason: 'Khách trả một phần' },
        'user-1',
      );

      expect(prisma.openingBalance.update).toHaveBeenCalledWith({
        where: { id: 'ob-1' },
        data: {
          remainingAmount: { decrement: 30000 },
        },
      });
      expect(prisma.openingBalanceTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            openingBalanceId: 'ob-1',
            action: 'OPENING_BALANCE_REDUCED',
            payload: expect.objectContaining({
              amount: 30000,
              reason: 'Khách trả một phần',
              fromRemaining: 100000,
              toRemaining: 70000,
            }),
          }),
        }),
      );
    });
  });

  describe('sumOpenByCustomerIds()', () => {
    it('chỉ tính OpeningBalance còn remainingAmount > 0, trả về Map theo customerId', async () => {
      prisma.openingBalance.groupBy.mockResolvedValue([
        {
          customerId: 'cust-1',
          _sum: { remainingAmount: 300000 },
        },
      ]);

      const result = await service.sumOpenByCustomerIds(['cust-1']);

      expect(prisma.openingBalance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            remainingAmount: { gt: 0 },
            customerId: { in: ['cust-1'] },
          },
        }),
      );
      expect(result.get('cust-1')).toEqual({ remaining: 300000 });
    });

    it('không lọc customerId khi gọi không truyền tham số', async () => {
      prisma.openingBalance.groupBy.mockResolvedValue([]);

      await service.sumOpenByCustomerIds();

      expect(prisma.openingBalance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { remainingAmount: { gt: 0 } } }),
      );
    });
  });

  describe('sumOpenForCustomer()', () => {
    it('trả về 0 nếu khách không có Công nợ đầu kỳ nào còn mở', async () => {
      prisma.openingBalance.aggregate.mockResolvedValue({
        _sum: { remainingAmount: null },
      });

      const result = await service.sumOpenForCustomer('cust-1');

      expect(result).toEqual({ remaining: 0 });
    });
  });

  describe('sumAllOpen()', () => {
    it('tổng hợp toàn bộ Công nợ đầu kỳ còn mở, không lọc theo khách', async () => {
      prisma.openingBalance.aggregate.mockResolvedValue({
        _sum: { remainingAmount: 900000 },
      });

      const result = await service.sumAllOpen();

      expect(prisma.openingBalance.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { remainingAmount: { gt: 0 } } }),
      );
      expect(result).toEqual({ remaining: 900000 });
    });
  });
});
