import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SalesOrderService } from './sales-order.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from '../setting/setting.service';

function makeSalesOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'so-1',
    code: 'SO000001',
    status: 'PRODUCTION_COMPLETED',
    receivable: null,
    productionOrders: [],
    deliveryName: 'Nguyễn Văn Cũ',
    deliveryPhone: '0900000000',
    deliveryAddress: 'Địa chỉ cũ',
    deliveryProvince: 'Hà Nội',
    deliveryDistrict: 'Cầu Giấy',
    deliveryWard: null,
    carrierName: null,
    carrierPhone: null,
    carrierNote: null,
    ...overrides,
  };
}

// Sprint 04 (005-nguoi-thuc-hien-lich-su-hoat-dong.md) — ship/deliver/override/
// cancel giờ ghi createdBy/createdByName từ JWT userId thay vì bỏ trống hoặc
// free-text overrideBy/cancelledBy (đã xoá khỏi DTO).
describe('SalesOrderService — actor name snapshot', () => {
  let service: SalesOrderService;
  let prisma: {
    salesOrder: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    salesOrderTimeline: { create: jest.Mock };
    productionOrder: { updateMany: jest.Mock };
    productionOrderTimeline: { createMany: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      salesOrder: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      salesOrderTimeline: { create: jest.fn() },
      productionOrder: { updateMany: jest.fn() },
      productionOrderTimeline: { createMany: jest.fn() },
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
        SalesOrderService,
        { provide: PrismaService, useValue: prisma },
        // Report methods (014-bao-cao.md Task 00) cần timezone — các test ở
        // đây không đụng tới, mock tối thiểu.
        {
          provide: SettingService,
          useValue: {
            getCompany: jest
              .fn()
              .mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }),
          },
        },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
    prisma.salesOrder.findUniqueOrThrow.mockResolvedValue(makeSalesOrder());
  });

  describe('ship()', () => {
    it('ghi createdBy/createdByName từ JWT userId', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.ship('so-1', 'user-1');

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
    });

    it('createdBy/createdByName đều null khi không có userId', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.ship('so-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: null,
            createdByName: null,
          }),
        }),
      );
    });
  });

  describe('deliver()', () => {
    it('ghi createdBy/createdByName từ JWT userId, fallback email khi name null', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'SHIPPED' }),
      );
      prisma.user.findUnique.mockResolvedValue({
        name: null,
        email: 'an@acme.vn',
      });

      await service.deliver('so-1', 'user-1');

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'an@acme.vn',
          }),
        }),
      );
    });
  });

  describe('override()', () => {
    it('ghi createdBy/createdByName từ JWT userId — không còn overrideBy free-text', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.override(
        'so-1',
        { newStatus: 'SHIPPED', reason: 'Sửa lại theo yêu cầu khách' },
        'user-1',
      );

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
          }),
        }),
      );
    });
  });

  describe('cancel()', () => {
    it('ghi createdBy/createdByName từ JWT userId — không còn cancelledBy free-text', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'IN_PRODUCTION' }),
      );

      await service.cancel('so-1', { reason: 'Khách huỷ đơn' }, 'user-1');

      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
          }),
        }),
      );
    });

    it('rejects khi đã DELIVERED (business rule sẵn có, không đụng khi thêm actor name)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'DELIVERED' }),
      );
      await expect(
        service.cancel('so-1', { reason: 'x' }, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Sprint 04 (009-in-phieu-san-xuat.md) — không phải Manual Override: không
  // đổi Status, không bắt buộc lý do, sửa được ở mọi Status.
  describe('updateDeliveryAddress()', () => {
    const dto = {
      deliveryName: 'Nguyễn Văn Mới',
      deliveryPhone: '0911111111',
      deliveryAddress: 'Công trình Ecopark',
      deliveryProvince: 'Hưng Yên',
      deliveryDistrict: 'Văn Giang',
      deliveryWard: null,
    };

    it('ghi Timeline DELIVERY_ADDRESS_UPDATED với payload old/new + createdBy', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.updateDeliveryAddress('so-1', dto, 'user-1');

      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: {
          deliveryName: 'Nguyễn Văn Mới',
          deliveryPhone: '0911111111',
          deliveryAddress: 'Công trình Ecopark',
          deliveryProvince: 'Hưng Yên',
          deliveryDistrict: 'Văn Giang',
          deliveryWard: null,
        },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELIVERY_ADDRESS_UPDATED',
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
            payload: {
              old: {
                deliveryName: 'Nguyễn Văn Cũ',
                deliveryPhone: '0900000000',
                deliveryAddress: 'Địa chỉ cũ',
                deliveryProvince: 'Hà Nội',
                deliveryDistrict: 'Cầu Giấy',
                deliveryWard: null,
              },
              new: {
                deliveryName: 'Nguyễn Văn Mới',
                deliveryPhone: '0911111111',
                deliveryAddress: 'Công trình Ecopark',
                deliveryProvince: 'Hưng Yên',
                deliveryDistrict: 'Văn Giang',
                deliveryWard: null,
              },
            },
          }),
        }),
      );
    });

    it('không đổi Status — sửa được kể cả khi đã DELIVERED/CANCELLED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateDeliveryAddress('so-1', dto, 'user-1'),
      ).resolves.toBeDefined();
      expect(prisma.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
      );
    });

    it('bắt buộc deliveryName', async () => {
      await expect(
        service.updateDeliveryAddress('so-1', { ...dto, deliveryName: '  ' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('bắt buộc deliveryPhone', async () => {
      await expect(
        service.updateDeliveryAddress('so-1', { ...dto, deliveryPhone: '' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('không bắt buộc lý do (khác Manual Override)', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());
      // dto không có field `reason` — service không được đòi hỏi nó.
      await expect(
        service.updateDeliveryAddress('so-1', dto, 'user-1'),
      ).resolves.toBeDefined();
    });
  });

  // 009-in-phieu-san-xuat.md — cùng cơ chế updateDeliveryAddress() nhưng khác
  // nhóm dữ liệu (nhà xe chở hàng), không field nào bắt buộc.
  describe('updateCarrierInfo()', () => {
    const dto = {
      carrierName: 'Xe Anh Công',
      carrierPhone: '0988670165',
      carrierNote: 'Giao trước 9h sáng',
    };

    it('ghi Timeline CARRIER_INFO_UPDATED với payload old/new + createdBy', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await service.updateCarrierInfo('so-1', dto, 'user-1');

      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: {
          carrierName: 'Xe Anh Công',
          carrierPhone: '0988670165',
          carrierNote: 'Giao trước 9h sáng',
        },
      });
      expect(prisma.salesOrderTimeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CARRIER_INFO_UPDATED',
            createdBy: 'user-1',
            createdByName: 'Nguyễn Văn An',
            payload: {
              old: { carrierName: null, carrierPhone: null, carrierNote: null },
              new: {
                carrierName: 'Xe Anh Công',
                carrierPhone: '0988670165',
                carrierNote: 'Giao trước 9h sáng',
              },
            },
          }),
        }),
      );
    });

    it('không có field nào bắt buộc — cho lưu rỗng hết', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(makeSalesOrder());

      await expect(
        service.updateCarrierInfo('so-1', {}, 'user-1'),
      ).resolves.toBeDefined();
      expect(prisma.salesOrder.update).toHaveBeenCalledWith({
        where: { id: 'so-1' },
        data: { carrierName: null, carrierPhone: null, carrierNote: null },
      });
    });

    it('không đổi Status — sửa được kể cả khi đã DELIVERED/CANCELLED', async () => {
      prisma.salesOrder.findUnique.mockResolvedValue(
        makeSalesOrder({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateCarrierInfo('so-1', dto, 'user-1'),
      ).resolves.toBeDefined();
      expect(prisma.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ status: expect.anything() }) }),
      );
    });
  });
});
