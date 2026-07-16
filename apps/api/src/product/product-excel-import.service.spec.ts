import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { BomEngineService } from '../bom-engine/bom-engine.service';
import { ExcelService } from '../shared/excel/excel.service';

async function buildWorkbookBuffer(
  header: string[],
  rows: (string | number)[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');
  sheet.addRow(header);
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('ProductService — Excel Import (Matrix + BOM)', () => {
  let service: ProductService;
  let prisma: {
    pricingRuleVersion: { findUnique: jest.Mock };
    productParameter: { findMany: jest.Mock };
    materialRequirementVersion: { findUnique: jest.Mock };
    material: { findMany: jest.Mock };
    materialRequirementItem: { update: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      pricingRuleVersion: { findUnique: jest.fn() },
      productParameter: { findMany: jest.fn() },
      materialRequirementVersion: { findUnique: jest.fn() },
      material: { findMany: jest.fn() },
      materialRequirementItem: { update: jest.fn(), create: jest.fn() },
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
        // ExcelService thật (không mock) — test round-trip write→read ExcelJS thật.
        ExcelService,
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('previewPriceMatrixImport()', () => {
    const enumParams = [
      {
        id: 'p1',
        name: 'mausac',
        label: 'Màu sắc',
        type: 'ENUM',
        usedInPricing: true,
        options: [
          { value: 'xanh', label: 'Xanh' },
          { value: 'do', label: 'Đỏ' },
        ],
      },
      {
        id: 'p2',
        name: 'size',
        label: 'Kích cỡ',
        type: 'ENUM',
        usedInPricing: true,
        options: [
          { value: 's', label: 'S' },
          { value: 'l', label: 'L' },
        ],
      },
    ];

    beforeEach(() => {
      prisma.pricingRuleVersion.findUnique.mockResolvedValue({
        id: 'v1',
        status: 'DRAFT',
        pricingRule: { productId: 'prod-1' },
      });
      prisma.productParameter.findMany.mockResolvedValue(enumParams);
    });

    it('throws NotFoundException when version does not exist', async () => {
      prisma.pricingRuleVersion.findUnique.mockResolvedValue(null);
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [],
      );
      await expect(
        service.previewPriceMatrixImport('missing', buf),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when version is not DRAFT', async () => {
      prisma.pricingRuleVersion.findUnique.mockResolvedValue({
        id: 'v1',
        status: 'ACTIVE',
        pricingRule: { productId: 'prod-1' },
      });
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [],
      );
      await expect(service.previewPriceMatrixImport('v1', buf)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('parses a valid file into rows with 0 errors', async () => {
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [
          ['Xanh', 'S', 100000],
          ['Xanh', 'L', 120000],
          ['Đỏ', 'S', 110000],
          ['Đỏ', 'L', 130000],
        ],
      );

      const result = await service.previewPriceMatrixImport('v1', buf);

      expect(result.errors).toEqual([]);
      expect(result.rows).toHaveLength(4);
      expect(result.rows[0]).toEqual({
        dimensions: { mausac: 'xanh', size: 's' },
        unitPrice: 100000,
        displayOrder: 0,
      });
      expect(result.rows[2].dimensions).toEqual({ mausac: 'do', size: 's' });
    });

    it('matches enum by raw value too, not just label', async () => {
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [['xanh', 's', 100000]],
      );
      const result = await service.previewPriceMatrixImport('v1', buf);
      expect(result.errors).toEqual([]);
      expect(result.rows[0].dimensions).toEqual({ mausac: 'xanh', size: 's' });
    });

    it('reports an error for missing enum value', async () => {
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [['', 'S', 100000]],
      );
      const result = await service.previewPriceMatrixImport('v1', buf);
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Màu sắc');
    });

    it('reports an error for an invalid enum value not in options', async () => {
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [['Tím', 'S', 100000]],
      );
      const result = await service.previewPriceMatrixImport('v1', buf);
      expect(result.rows).toHaveLength(0);
      expect(result.errors[0].message).toContain('Tím');
    });

    it('reports an error for zero/negative/non-numeric unit price', async () => {
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [
          ['Xanh', 'S', 0],
          ['Xanh', 'L', -5],
          ['Đỏ', 'S', 'abc'],
        ],
      );
      const result = await service.previewPriceMatrixImport('v1', buf);
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(3);
    });

    it('reports an error for duplicate config combos within the file', async () => {
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [
          ['Xanh', 'S', 100000],
          ['Xanh', 'S', 999999],
        ],
      );
      const result = await service.previewPriceMatrixImport('v1', buf);
      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('trùng');
    });

    it('skips fully blank trailing rows silently', async () => {
      const buf = await buildWorkbookBuffer(
        ['Màu sắc', 'Kích cỡ', 'Đơn giá'],
        [
          ['Xanh', 'S', 100000],
          ['', '', ''],
        ],
      );
      const result = await service.previewPriceMatrixImport('v1', buf);
      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('previewMaterialRequirementImport()', () => {
    const materials = [
      { id: 'mat-1', code: 'NL000001', name: 'Khung nhôm' },
      { id: 'mat-2', code: 'NL000002', name: 'Lưới chống muỗi' },
    ];

    beforeEach(() => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue({
        id: 'mrv-1',
        status: 'DRAFT',
      });
      prisma.material.findMany.mockResolvedValue(materials);
    });

    it('throws NotFoundException when version does not exist', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue(null);
      const buf = await buildWorkbookBuffer(
        [
          'Mã vật tư',
          'Expression',
          'Condition',
          'Hao hụt (%)',
          'Round Step',
          'Ghi chú',
        ],
        [],
      );
      await expect(
        service.previewMaterialRequirementImport('missing', buf),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when version is not DRAFT', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue({
        id: 'mrv-1',
        status: 'ACTIVE',
      });
      const buf = await buildWorkbookBuffer(
        [
          'Mã vật tư',
          'Expression',
          'Condition',
          'Hao hụt (%)',
          'Round Step',
          'Ghi chú',
        ],
        [],
      );
      await expect(
        service.previewMaterialRequirementImport('mrv-1', buf),
      ).rejects.toThrow(BadRequestException);
    });

    it('parses a valid file into rows with 0 errors', async () => {
      const buf = await buildWorkbookBuffer(
        [
          'Mã vật tư',
          'Expression',
          'Condition',
          'Hao hụt (%)',
          'Round Step',
          'Ghi chú',
        ],
        [
          ['NL000001', '(chieucao+chieurong)*2', '', 5, 0.1, 'khung'],
          ['nl000002', 'chieucao*chieurong', 'socanh == 2', '', '', ''],
        ],
      );

      const result = await service.previewMaterialRequirementImport(
        'mrv-1',
        buf,
      );

      expect(result.errors).toEqual([]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toMatchObject({
        materialId: 'mat-1',
        materialCode: 'NL000001',
        wastePercent: 5,
        roundStep: 0.1,
        note: 'khung',
      });
      // Mã vật tư khớp không phân biệt hoa/thường.
      expect(result.rows[1]).toMatchObject({
        materialId: 'mat-2',
        condition: 'socanh == 2',
      });
    });

    it('reports an error and does NOT auto-create when material code is unknown', async () => {
      const buf = await buildWorkbookBuffer(
        [
          'Mã vật tư',
          'Expression',
          'Condition',
          'Hao hụt (%)',
          'Round Step',
          'Ghi chú',
        ],
        [['NL999999', 'chieucao', '', '', '', '']],
      );
      const result = await service.previewMaterialRequirementImport(
        'mrv-1',
        buf,
      );
      expect(result.rows).toHaveLength(0);
      expect(result.errors[0].message).toContain('NL999999');
      expect(prisma.material.findMany).toHaveBeenCalledTimes(1); // không gọi thêm create nào
    });

    it('reports an error for invalid expression syntax', async () => {
      const buf = await buildWorkbookBuffer(
        [
          'Mã vật tư',
          'Expression',
          'Condition',
          'Hao hụt (%)',
          'Round Step',
          'Ghi chú',
        ],
        [['NL000001', 'chieucao +', '', '', '', '']],
      );
      const result = await service.previewMaterialRequirementImport(
        'mrv-1',
        buf,
      );
      expect(result.rows).toHaveLength(0);
      expect(result.errors[0].message).toContain('Expression lỗi');
    });

    it('reports an error for duplicate material code within the file', async () => {
      const buf = await buildWorkbookBuffer(
        [
          'Mã vật tư',
          'Expression',
          'Condition',
          'Hao hụt (%)',
          'Round Step',
          'Ghi chú',
        ],
        [
          ['NL000001', 'chieucao', '', '', '', ''],
          ['NL000001', 'chieurong', '', '', '', ''],
        ],
      );
      const result = await service.previewMaterialRequirementImport(
        'mrv-1',
        buf,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('trùng');
    });
  });

  describe('bulkUpsertMaterialRequirementItems()', () => {
    it('updates existing items by materialId, creates new ones, and leaves items not in the list untouched', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue({
        id: 'mrv-1',
        status: 'DRAFT',
        items: [
          { id: 'item-existing', materialId: 'mat-1', displayOrder: 0 },
          { id: 'item-untouched', materialId: 'mat-99', displayOrder: 1 },
        ],
      });
      prisma.material.findMany.mockResolvedValue([
        { id: 'mat-1' },
        { id: 'mat-2' },
      ]);
      const findUniqueFinal = { id: 'mrv-1', items: [] };
      prisma.materialRequirementVersion.findUnique
        .mockResolvedValueOnce({
          id: 'mrv-1',
          status: 'DRAFT',
          items: [
            { id: 'item-existing', materialId: 'mat-1', displayOrder: 0 },
            { id: 'item-untouched', materialId: 'mat-99', displayOrder: 1 },
          ],
        })
        .mockResolvedValueOnce(findUniqueFinal);

      const rows = [
        { materialId: 'mat-1', expression: 'chieucao * 2', wastePercent: 3 },
        { materialId: 'mat-2', expression: 'chieurong', roundStep: 1 },
      ];

      const result = await service.bulkUpsertMaterialRequirementItems(
        'mrv-1',
        rows,
      );

      expect(prisma.materialRequirementItem.update).toHaveBeenCalledWith({
        where: { id: 'item-existing' },
        data: expect.objectContaining({
          expression: 'chieucao * 2',
          wastePercent: 3,
        }),
      });
      expect(prisma.materialRequirementItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          materialRequirementVersionId: 'mrv-1',
          materialId: 'mat-2',
          expression: 'chieurong',
          roundType: 'CEIL',
          roundValue: 1,
          displayOrder: 2,
        }),
      });
      // item-untouched (mat-99) không nằm trong payload — không có lệnh update/create/delete nào nhắm tới nó.
      expect(prisma.materialRequirementItem.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'item-untouched' } }),
      );
      expect(result).toEqual(findUniqueFinal);
    });

    it('throws BadRequestException when version is not DRAFT', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue({
        id: 'mrv-1',
        status: 'ACTIVE',
        items: [],
      });
      await expect(
        service.bulkUpsertMaterialRequirementItems('mrv-1', [
          { materialId: 'mat-1', expression: 'chieucao' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on empty rows', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue({
        id: 'mrv-1',
        status: 'DRAFT',
        items: [],
      });
      await expect(
        service.bulkUpsertMaterialRequirementItems('mrv-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on duplicate materialId within payload', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue({
        id: 'mrv-1',
        status: 'DRAFT',
        items: [],
      });
      await expect(
        service.bulkUpsertMaterialRequirementItems('mrv-1', [
          { materialId: 'mat-1', expression: 'chieucao' },
          { materialId: 'mat-1', expression: 'chieurong' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a materialId does not exist', async () => {
      prisma.materialRequirementVersion.findUnique.mockResolvedValue({
        id: 'mrv-1',
        status: 'DRAFT',
        items: [],
      });
      prisma.material.findMany.mockResolvedValue([]);
      await expect(
        service.bulkUpsertMaterialRequirementItems('mrv-1', [
          { materialId: 'mat-missing', expression: 'chieucao' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
