import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
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
        { id: 'row-1', dimensions: { maukhung: 'cafe' }, configKey: 'maukhung=cafe', unitPrice: 500000, displayOrder: 0 },
        { id: 'row-2', dimensions: { maukhung: 'trang' }, configKey: 'maukhung=trang', unitPrice: 550000, displayOrder: 1 },
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
      await expect(service.duplicatePricingRuleVersion('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new DRAFT version with next versionNumber and copies all matrix rows and items, leaving the source untouched', async () => {
      prisma.pricingRuleVersion.findUnique.mockResolvedValueOnce(sourceVersion);
      prisma.pricingRuleVersion.findFirst.mockResolvedValue({ versionNumber: 3 });
      prisma.pricingRuleVersion.create.mockResolvedValue({ id: 'prv-new-1', versionNumber: 4 });
      const finalResult = { id: 'prv-new-1', versionNumber: 4, status: 'DRAFT' };
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
      expect(prisma.pricingRuleVersion.create.mock.calls[0][0].data.pricingRuleId).toBe('pr-1');
      expect(sourceVersion.status).toBe('ACTIVE');
      expect(sourceVersion.matrixRows).toHaveLength(2);
      expect(sourceVersion.items).toHaveLength(1);
    });

    it('skips createMany calls when source has no matrix rows or items', async () => {
      const emptySource = { ...sourceVersion, matrixRows: [], items: [] };
      prisma.pricingRuleVersion.findUnique.mockResolvedValueOnce(emptySource);
      prisma.pricingRuleVersion.findFirst.mockResolvedValue({ versionNumber: 3 });
      prisma.pricingRuleVersion.create.mockResolvedValue({ id: 'prv-new-2', versionNumber: 4 });
      prisma.pricingRuleVersion.findUnique.mockResolvedValueOnce({ id: 'prv-new-2' });

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
      prisma.materialRequirementVersion.findUnique.mockResolvedValueOnce(sourceVersion);
      prisma.materialRequirementVersion.findFirst.mockResolvedValue({ versionNumber: 2 });
      prisma.materialRequirementVersion.create.mockResolvedValue({ id: 'mrv-new-1', versionNumber: 3 });
      const finalResult = { id: 'mrv-new-1', versionNumber: 3, status: 'DRAFT' };
      prisma.materialRequirementVersion.findUnique.mockResolvedValueOnce(finalResult);

      const result = await service.duplicateMaterialRequirementVersion('mrv-active-1');

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
