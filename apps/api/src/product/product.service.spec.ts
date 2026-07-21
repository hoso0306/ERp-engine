import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { BomEngineService } from '../bom-engine/bom-engine.service';
import { ExcelService } from '../shared/excel/excel.service';

describe('ProductService — duplicate version (Sửa = nhân bản)', () => {
  let service: ProductService;
  let prisma: {
    pricingRuleVersion: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    priceMatrixRow: { createMany: jest.Mock };
    pricingRuleItem: { createMany: jest.Mock };
    materialRequirementVersion: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    materialRequirementItem: { createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      pricingRuleVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      priceMatrixRow: { createMany: jest.fn() },
      pricingRuleItem: { createMany: jest.fn() },
      materialRequirementVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      materialRequirementItem: { createMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: {} },
        { provide: BomEngineService, useValue: {} },
        { provide: ExcelService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('duplicatePricingRuleVersion()', () => {
    const sourceVersion = {
      id: 'prv-active-1',
      pricingRuleId: 'pr-1',
      versionNumber: 3,
      name: 'Bảng giá v3',
      expression: 'area * unitPrice',
      priceRoundType: 'CEIL',
      priceRoundValue: 1000,
      status: 'ACTIVE',
      note: 'ghi chú gốc',
      matrixRows: [
        {
          id: 'row-1',
          dimensions: { maukhung: 'cafe' },
          configKey: 'maukhung=cafe',
          unitPrice: 500000,
          displayOrder: 0,
        },
        {
          id: 'row-2',
          dimensions: { maukhung: 'trang' },
          configKey: 'maukhung=trang',
          unitPrice: 550000,
          displayOrder: 1,
        },
      ],
      items: [
        {
          id: 'item-1',
          ruleType: 'MIN_AREA',
          targetParameter: null,
          value: 1.5,
          condition: null,
          rangeFrom: null,
          rangeTo: null,
          billValue: null,
          description: 'Diện tích tối thiểu',
          displayOrder: 0,
        },
      ],
    };

    it('throws NotFoundException when source version does not exist', async () => {
      prisma.pricingRuleVersion.findUnique.mockResolvedValue(null);
      await expect(
        service.duplicatePricingRuleVersion('missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a new DRAFT version with next versionNumber and copies all matrix rows and items, leaving the source untouched', async () => {
      prisma.pricingRuleVersion.findUnique.mockResolvedValueOnce(sourceVersion);
      prisma.pricingRuleVersion.findFirst.mockResolvedValue({
        versionNumber: 3,
      });
      prisma.pricingRuleVersion.create.mockResolvedValue({
        id: 'prv-new-1',
        versionNumber: 4,
      });
      const finalResult = {
        id: 'prv-new-1',
        versionNumber: 4,
        status: 'DRAFT',
      };
      prisma.pricingRuleVersion.findUnique.mockResolvedValueOnce(finalResult);

      const result = await service.duplicatePricingRuleVersion('prv-active-1');

      // New version created as DRAFT with versionNumber = max + 1, fields copied.
      expect(prisma.pricingRuleVersion.create).toHaveBeenCalledWith({
        data: {
          pricingRuleId: 'pr-1',
          versionNumber: 4,
          name: 'Bảng giá v3',
          expression: 'area * unitPrice',
          priceRoundType: 'CEIL',
          priceRoundValue: 1000,
          status: 'DRAFT',
          note: 'ghi chú gốc',
        },
      });

      // N = 2 matrix rows copied with same values, pointed at the new version.
      expect(prisma.priceMatrixRow.createMany).toHaveBeenCalledWith({
        data: [
          {
            pricingRuleVersionId: 'prv-new-1',
            dimensions: { maukhung: 'cafe' },
            configKey: 'maukhung=cafe',
            unitPrice: 500000,
            displayOrder: 0,
          },
          {
            pricingRuleVersionId: 'prv-new-1',
            dimensions: { maukhung: 'trang' },
            configKey: 'maukhung=trang',
            unitPrice: 550000,
            displayOrder: 1,
          },
        ],
      });

      // M = 1 rule item copied with same values, pointed at the new version.
      expect(prisma.pricingRuleItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            pricingRuleVersionId: 'prv-new-1',
            ruleType: 'MIN_AREA',
            targetParameter: null,
            value: 1.5,
            condition: null,
            rangeFrom: null,
            rangeTo: null,
            billValue: null,
            description: 'Diện tích tối thiểu',
            displayOrder: 0,
          },
        ],
      });

      expect(result).toEqual(finalResult);

      // Source version record itself was never updated or deleted.
      expect(
        prisma.pricingRuleVersion.create.mock.calls[0][0].data.pricingRuleId,
      ).toBe('pr-1');
      expect(sourceVersion.status).toBe('ACTIVE');
      expect(sourceVersion.matrixRows).toHaveLength(2);
      expect(sourceVersion.items).toHaveLength(1);
    });

    it('skips createMany calls when source has no matrix rows or items', async () => {
      const emptySource = { ...sourceVersion, matrixRows: [], items: [] };
      prisma.pricingRuleVersion.findUnique.mockResolvedValueOnce(emptySource);
      prisma.pricingRuleVersion.findFirst.mockResolvedValue({
        versionNumber: 3,
      });
      prisma.pricingRuleVersion.create.mockResolvedValue({
        id: 'prv-new-2',
        versionNumber: 4,
      });
      prisma.pricingRuleVersion.findUnique.mockResolvedValueOnce({
        id: 'prv-new-2',
      });

      await service.duplicatePricingRuleVersion('prv-active-1');

      expect(prisma.priceMatrixRow.createMany).not.toHaveBeenCalled();
      expect(prisma.pricingRuleItem.createMany).not.toHaveBeenCalled();
    });
  });

  describe('duplicateMaterialRequirementVersion()', () => {
    const sourceVersion = {
      id: 'mrv-active-1',
      materialRequirementId: 'mr-1',
      versionNumber: 2,
      name: 'Định mức v2',
      status: 'ACTIVE',
      note: 'ghi chú',
      items: [
        {
          id: 'mi-1',
          materialId: 'mat-1',
          expression: 'area * 1.1',
          condition: null,
          wastePercent: 5,
          roundType: 'CEIL',
          roundValue: 1,
          note: null,
          displayOrder: 0,
        },
        {
          id: 'mi-2',
          materialId: 'mat-2',
          expression: 'perimeter * 2',
          condition: 'socanh == 2',
          wastePercent: 0,
          roundType: 'NONE',
          roundValue: null,
          note: 'phụ kiện',
          displayOrder: 1,
        },
      ],
    };

    it('throws NotFoundException when source version does not exist', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue(null);
      await expect(
        service.duplicateMaterialRequirementVersion('missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a new DRAFT version with next versionNumber and copies all items, leaving the source untouched', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValueOnce(
        sourceVersion,
      );
      prisma.materialRequirementVersion.findFirst.mockResolvedValue({
        versionNumber: 2,
      });
      prisma.materialRequirementVersion.create.mockResolvedValue({
        id: 'mrv-new-1',
        versionNumber: 3,
      });
      const finalResult = {
        id: 'mrv-new-1',
        versionNumber: 3,
        status: 'DRAFT',
        // Prisma luôn trả mảng cho include.items (rỗng nếu không có) — mock
        // đúng shape thật để khớp .items.sort() trong service.
        items: [],
      };
      prisma.materialRequirementVersion.findUnique.mockResolvedValueOnce(
        finalResult,
      );

      const result =
        await service.duplicateMaterialRequirementVersion('mrv-active-1');

      expect(prisma.materialRequirementVersion.create).toHaveBeenCalledWith({
        data: {
          materialRequirementId: 'mr-1',
          versionNumber: 3,
          name: 'Định mức v2',
          status: 'DRAFT',
          note: 'ghi chú',
        },
      });

      // M = 2 items copied with same values, pointed at the new version.
      expect(prisma.materialRequirementItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            materialRequirementVersionId: 'mrv-new-1',
            materialId: 'mat-1',
            expression: 'area * 1.1',
            condition: null,
            wastePercent: 5,
            roundType: 'CEIL',
            roundValue: 1,
            note: null,
            displayOrder: 0,
          },
          {
            materialRequirementVersionId: 'mrv-new-1',
            materialId: 'mat-2',
            expression: 'perimeter * 2',
            condition: 'socanh == 2',
            wastePercent: 0,
            roundType: 'NONE',
            roundValue: null,
            note: 'phụ kiện',
            displayOrder: 1,
          },
        ],
      });

      expect(result).toEqual(finalResult);
      expect(sourceVersion.status).toBe('ACTIVE');
      expect(sourceVersion.items).toHaveLength(2);
    });
  });
});

// Bug thật gặp ở SP000036 (chốt 16/07/2026): đổi tên tham số "nhommau" →
// "maukhung" trong khi Bảng giá ma trận của phiên bản ACTIVE vẫn còn khóa cũ
// → tra cứu giá âm thầm sai. Chặn ngay tại chỗ đổi tên.
describe('ProductService.updateProductParameter() — chặn đổi tên khi Bảng giá ma trận ACTIVE đang tham chiếu', () => {
  let service: ProductService;
  let prisma: {
    productParameter: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    pricingRuleVersion: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      productParameter: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null), // không trùng tên trong sản phẩm
        update: jest.fn(),
      },
      pricingRuleVersion: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: PricingEngineService, useValue: {} },
        { provide: BomEngineService, useValue: {} },
        { provide: ExcelService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  const param = {
    id: 'param-1',
    productId: 'prod-1',
    name: 'nhommau',
    label: 'Nhóm màu khung',
    type: 'ENUM',
  };

  it('chặn đổi tên khi tên cũ vẫn còn trong dimensions của Bảng giá ma trận ACTIVE', async () => {
    prisma.productParameter.findUnique.mockResolvedValue(param);
    prisma.pricingRuleVersion.findFirst.mockResolvedValue({
      matrixRows: [{ dimensions: { socanh: '1', nhommau: 'van_go' } }],
    });

    await expect(
      service.updateProductParameter('param-1', { name: 'maukhung' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.productParameter.update).not.toHaveBeenCalled();
  });

  it('cho phép đổi tên khi không có phiên bản ACTIVE nào (vd sản phẩm còn DRAFT)', async () => {
    prisma.productParameter.findUnique.mockResolvedValue(param);
    prisma.pricingRuleVersion.findFirst.mockResolvedValue(null);
    prisma.productParameter.update.mockResolvedValue({ ...param, name: 'maukhung' });

    await service.updateProductParameter('param-1', { name: 'maukhung' });
    expect(prisma.productParameter.update).toHaveBeenCalled();
  });

  it('cho phép đổi tên khi ACTIVE tồn tại nhưng dimensions không còn dùng tên cũ (đã migrate)', async () => {
    prisma.productParameter.findUnique.mockResolvedValue(param);
    prisma.pricingRuleVersion.findFirst.mockResolvedValue({
      matrixRows: [{ dimensions: { socanh: '1', maukhung: 'van_go' } }],
    });
    prisma.productParameter.update.mockResolvedValue({ ...param, name: 'maukhung' });

    await service.updateProductParameter('param-1', { name: 'maukhung' });
    expect(prisma.productParameter.update).toHaveBeenCalled();
  });

  it('không chặn khi chỉ đổi label/các field khác, không đổi name', async () => {
    prisma.productParameter.findUnique.mockResolvedValue(param);
    prisma.productParameter.update.mockResolvedValue({ ...param, label: 'Màu khung mới' });

    await service.updateProductParameter('param-1', { label: 'Màu khung mới' });
    expect(prisma.pricingRuleVersion.findFirst).not.toHaveBeenCalled();
    expect(prisma.productParameter.update).toHaveBeenCalled();
  });
});
