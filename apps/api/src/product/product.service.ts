import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { BomEngineService } from '../bom-engine/bom-engine.service';
import { validate as validateExpressionSyntax } from '../shared/expression';
import { Prisma, ProductStatus, ParameterType, RoundType, PricingRuleType } from '@prisma/client';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialQueryDto } from './dto/material-query.dto';
import { CreateMaterialPriceDto } from './dto/create-material-price.dto';
import { UpdateMaterialPriceDto } from './dto/update-material-price.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductParameterDto } from './dto/create-product-parameter.dto';
import { UpdateProductParameterDto } from './dto/update-product-parameter.dto';
import { CreatePricingRuleVersionDto } from './dto/create-pricing-rule-version.dto';
import { UpdatePricingRuleVersionDto } from './dto/update-pricing-rule-version.dto';
import { CreatePricingRuleItemDto } from './dto/create-pricing-rule-item.dto';
import { UpdatePricingRuleItemDto } from './dto/update-pricing-rule-item.dto';
import { CreateMaterialRequirementVersionDto } from './dto/create-material-requirement-version.dto';
import { UpdateMaterialRequirementVersionDto } from './dto/update-material-requirement-version.dto';
import { CreateMaterialRequirementItemDto } from './dto/create-material-requirement-item.dto';
import { UpdateMaterialRequirementItemDto } from './dto/update-material-requirement-item.dto';
import { CreateProductionCenterDto } from './dto/create-production-center.dto';
import { UpdateProductionCenterDto } from './dto/update-production-center.dto';
import { CreateValidationRuleDto, UpdateValidationRuleDto } from './dto/validation-rule.dto';
import { CreateDerivedParameterDto, UpdateDerivedParameterDto } from './dto/derived-parameter.dto';
import { PriceMatrixRowDto } from './dto/update-price-matrix.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService,
    private readonly bomEngine: BomEngineService,
  ) {}

  // ──────────────────────────────────────
  // Production Center
  // ──────────────────────────────────────

  async findAllProductionCenters() {
    return this.prisma.productionCenter.findMany({ orderBy: { name: 'asc' } });
  }

  async findOneProductionCenter(id: string) {
    const pc = await this.prisma.productionCenter.findUnique({ where: { id } });
    if (!pc) throw new NotFoundException('Xưởng sản xuất không tồn tại.');
    return pc;
  }

  async createProductionCenter(dto: CreateProductionCenterDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Tên xưởng là bắt buộc.');
    const existing = await this.prisma.productionCenter.findFirst({ where: { name: dto.name.trim() } });
    if (existing) throw new ConflictException('Tên xưởng đã tồn tại.');
    const code = await this.generateCode('PRODUCTION_CENTER');
    return this.prisma.productionCenter.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateProductionCenter(id: string, dto: UpdateProductionCenterDto) {
    await this.findOneProductionCenter(id);
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('Tên xưởng là bắt buộc.');
      const existing = await this.prisma.productionCenter.findFirst({
        where: { name: dto.name.trim(), id: { not: id } },
      });
      if (existing) throw new ConflictException('Tên xưởng đã tồn tại.');
    }
    return this.prisma.productionCenter.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteProductionCenter(id: string) {
    await this.findOneProductionCenter(id);
    const inUse = await this.prisma.product.count({ where: { productionCenterId: id } });
    if (inUse > 0) throw new BadRequestException('Không thể xoá xưởng đang được sử dụng bởi sản phẩm.');
    return this.prisma.productionCenter.delete({ where: { id } });
  }

  // ──────────────────────────────────────
  // Unit
  // ──────────────────────────────────────

  async findAllUnits() {
    return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  async findOneUnit(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Đơn vị không tồn tại.');
    return unit;
  }

  async createUnit(dto: CreateUnitDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Tên đơn vị là bắt buộc.');
    const existing = await this.prisma.unit.findUnique({ where: { name: dto.name.trim() } });
    if (existing) throw new ConflictException('Tên đơn vị đã tồn tại.');
    return this.prisma.unit.create({ data: { name: dto.name.trim() } });
  }

  async updateUnit(id: string, dto: UpdateUnitDto) {
    await this.findOneUnit(id);
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('Tên đơn vị là bắt buộc.');
      const existing = await this.prisma.unit.findFirst({
        where: { name: dto.name.trim(), id: { not: id } },
      });
      if (existing) throw new ConflictException('Tên đơn vị đã tồn tại.');
    }
    return this.prisma.unit.update({
      where: { id },
      data: dto.name !== undefined ? { name: dto.name.trim() } : {},
    });
  }

  async deleteUnit(id: string) {
    await this.findOneUnit(id);
    const usedInProduct = await this.prisma.product.count({ where: { unitId: id } });
    if (usedInProduct > 0) {
      throw new BadRequestException('Đơn vị đang được sử dụng bởi sản phẩm, không thể xoá.');
    }
    const usedInMaterial = await this.prisma.material.count({ where: { unitId: id } });
    if (usedInMaterial > 0) {
      throw new BadRequestException('Đơn vị đang được sử dụng bởi nguyên liệu, không thể xoá.');
    }
    return this.prisma.unit.delete({ where: { id } });
  }

  // ──────────────────────────────────────
  // Product Type
  // ──────────────────────────────────────

  async findAllProductTypes() {
    return this.prisma.productType.findMany({ orderBy: { name: 'asc' } });
  }

  async findOneProductType(id: string) {
    const pt = await this.prisma.productType.findUnique({ where: { id } });
    if (!pt) throw new NotFoundException('Loại sản phẩm không tồn tại.');
    return pt;
  }

  async createProductType(dto: CreateProductTypeDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Tên loại sản phẩm là bắt buộc.');
    const existing = await this.prisma.productType.findUnique({ where: { name: dto.name.trim() } });
    if (existing) throw new ConflictException('Tên loại sản phẩm đã tồn tại.');
    return this.prisma.productType.create({
      data: { name: dto.name.trim(), isActive: dto.isActive ?? true },
    });
  }

  async updateProductType(id: string, dto: UpdateProductTypeDto) {
    await this.findOneProductType(id);
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('Tên loại sản phẩm là bắt buộc.');
      const existing = await this.prisma.productType.findFirst({
        where: { name: dto.name.trim(), id: { not: id } },
      });
      if (existing) throw new ConflictException('Tên loại sản phẩm đã tồn tại.');
    }
    const data: Prisma.ProductTypeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.productType.update({ where: { id }, data });
  }

  async deleteProductType(id: string) {
    await this.findOneProductType(id);
    const used = await this.prisma.product.count({ where: { productTypeId: id } });
    if (used > 0) {
      throw new BadRequestException('Loại sản phẩm đang được sử dụng, không thể xoá.');
    }
    return this.prisma.productType.delete({ where: { id } });
  }

  // ──────────────────────────────────────
  // Material
  // ──────────────────────────────────────

  async findAllMaterials(query: MaterialQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.MaterialWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }
    // Lọc theo xưởng (chốt 08/07/2026 — chỉ để lọc, không ảnh hưởng kho/BOM).
    if (query.productionCenterId) {
      where.productionCenters = {
        some: { productionCenterId: query.productionCenterId },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          unit: { select: { id: true, name: true } },
          // Giá nhập mặc định — hiển thị cạnh giá bán lẻ ở danh sách (Task 07
          // sprint-02/002): lấy 1 giá isDefault mới nhất, không load cả bảng giá.
          prices: {
            where: { isDefault: true },
            orderBy: { effectiveFrom: 'desc' },
            take: 1,
            select: { price: true },
          },
          productionCenters: {
            select: {
              productionCenter: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.material.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneMaterial(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, name: true } },
        prices: { orderBy: { effectiveFrom: 'desc' } },
        productionCenters: {
          select: {
            productionCenter: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!material) throw new NotFoundException('Nguyên liệu không tồn tại.');
    return material;
  }

  async createMaterial(dto: CreateMaterialDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Tên nguyên liệu là bắt buộc.');
    if (!dto.unitId) throw new BadRequestException('Đơn vị là bắt buộc.');
    await this.findOneUnit(dto.unitId);

    const code = await this.generateCode('MATERIAL');
    return this.prisma.material.create({
      data: {
        code,
        name: dto.name.trim(),
        unitId: dto.unitId,
        note: dto.note?.trim() || null,
        minimumStock: dto.minimumStock ?? null,
        retailPrice: dto.retailPrice ?? null,
        ...(dto.productionCenterIds && dto.productionCenterIds.length > 0
          ? {
              productionCenters: {
                create: dto.productionCenterIds.map((id) => ({
                  productionCenterId: id,
                })),
              },
            }
          : {}),
      },
      include: {
        unit: { select: { id: true, name: true } },
        productionCenters: {
          select: { productionCenter: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto) {
    await this.findOneMaterial(id);
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Tên nguyên liệu là bắt buộc.');
    }
    if (dto.unitId) await this.findOneUnit(dto.unitId);
    if (dto.code !== undefined) {
      if (!dto.code.trim()) throw new BadRequestException('Mã nguyên liệu là bắt buộc.');
      const existing = await this.prisma.material.findFirst({
        where: { code: dto.code.trim(), id: { not: id } },
      });
      if (existing) throw new ConflictException('Mã nguyên liệu đã tồn tại.');
    }

    const data: Prisma.MaterialUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.unitId !== undefined) data.unit = { connect: { id: dto.unitId } };
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.note !== undefined) data.note = dto.note?.trim() || null;
    if (dto.minimumStock !== undefined) data.minimumStock = dto.minimumStock;
    if (dto.retailPrice !== undefined) data.retailPrice = dto.retailPrice;
    // Set lại toàn bộ danh sách xưởng khi FE gửi lên (mảng rỗng = bỏ hết).
    if (dto.productionCenterIds !== undefined) {
      data.productionCenters = {
        deleteMany: {},
        create: dto.productionCenterIds.map((pcId) => ({
          productionCenterId: pcId,
        })),
      };
    }

    return this.prisma.material.update({
      where: { id },
      data,
      include: {
        unit: { select: { id: true, name: true } },
        productionCenters: {
          select: { productionCenter: { select: { id: true, name: true } } },
        },
      },
    });
  }

  // ──────────────────────────────────────
  // Material Price
  // ──────────────────────────────────────

  async findMaterialPrices(materialId: string) {
    await this.findOneMaterial(materialId);
    return this.prisma.materialPrice.findMany({
      where: { materialId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async createMaterialPrice(materialId: string, dto: CreateMaterialPriceDto) {
    await this.findOneMaterial(materialId);
    if (dto.price === undefined || dto.price <= 0) {
      throw new BadRequestException('Giá phải lớn hơn 0.');
    }
    if (!dto.effectiveFrom) throw new BadRequestException('Ngày hiệu lực là bắt buộc.');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.materialPrice.updateMany({
          where: { materialId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.materialPrice.create({
        data: {
          materialId,
          supplierId: dto.supplierId || null,
          price: dto.price,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          isDefault: dto.isDefault ?? false,
          note: dto.note?.trim() || null,
        },
      });
    });
  }

  async updateMaterialPrice(id: string, dto: UpdateMaterialPriceDto) {
    const price = await this.prisma.materialPrice.findUnique({ where: { id } });
    if (!price) throw new NotFoundException('Giá nguyên liệu không tồn tại.');
    if (dto.price !== undefined && dto.price <= 0) {
      throw new BadRequestException('Giá phải lớn hơn 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.materialPrice.updateMany({
          where: { materialId: price.materialId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const data: Prisma.MaterialPriceUpdateInput = {};
      if (dto.supplierId !== undefined) data.supplierId = dto.supplierId || null;
      if (dto.price !== undefined) data.price = dto.price;
      if (dto.effectiveFrom !== undefined) data.effectiveFrom = new Date(dto.effectiveFrom);
      if (dto.effectiveTo !== undefined) {
        data.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
      }
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
      if (dto.note !== undefined) data.note = dto.note?.trim() || null;
      return tx.materialPrice.update({ where: { id }, data });
    });
  }

  async deleteMaterialPrice(id: string) {
    const price = await this.prisma.materialPrice.findUnique({ where: { id } });
    if (!price) throw new NotFoundException('Giá nguyên liệu không tồn tại.');
    return this.prisma.materialPrice.delete({ where: { id } });
  }

  // ──────────────────────────────────────
  // Product
  // ──────────────────────────────────────

  async findAllProducts(query: ProductQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status === 'DRAFT' || query.status === 'ACTIVE' || query.status === 'INACTIVE') {
      where.status = query.status;
    }
    if (query.productTypeId) {
      where.productTypeId = query.productTypeId;
    }
    if (query.productionCenterId) {
      where.productionCenterId = query.productionCenterId;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          productType: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
          productionCenter: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findDeletedProducts(query: ProductQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { deletedAt: { not: null } };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          productType: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
          productionCenter: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        productType: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        productionCenter: { select: { id: true, code: true, name: true } },
      },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại.');
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Tên sản phẩm là bắt buộc.');
    if (!dto.productTypeId) throw new BadRequestException('Loại sản phẩm là bắt buộc.');
    if (!dto.unitId) throw new BadRequestException('Đơn vị là bắt buộc.');
    if (!dto.productionCenterId) throw new BadRequestException('Xưởng sản xuất là bắt buộc.');
    await this.findOneProductType(dto.productTypeId);
    await this.findOneUnit(dto.unitId);
    await this.findOneProductionCenter(dto.productionCenterId);

    const code = await this.generateCode('PRODUCT');
    return this.prisma.product.create({
      data: {
        code,
        name: dto.name.trim(),
        productTypeId: dto.productTypeId,
        unitId: dto.unitId,
        productionCenterId: dto.productionCenterId,
        description: dto.description?.trim() || null,
        status: 'DRAFT',
      },
      include: {
        productType: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        productionCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.findOneProduct(id);
    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('Tên sản phẩm là bắt buộc.');
    }
    if (dto.productTypeId) await this.findOneProductType(dto.productTypeId);
    if (dto.unitId) await this.findOneUnit(dto.unitId);
    if (dto.productionCenterId) await this.findOneProductionCenter(dto.productionCenterId);

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.productTypeId !== undefined) data.productType = { connect: { id: dto.productTypeId } };
    if (dto.unitId !== undefined) data.unit = { connect: { id: dto.unitId } };
    if (dto.productionCenterId !== undefined) data.productionCenter = { connect: { id: dto.productionCenterId } };
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        productType: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        productionCenter: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateProductStatus(id: string, status: string) {
    const product = await this.findOneProduct(id);
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['ACTIVE'],
      ACTIVE: ['INACTIVE'],
      INACTIVE: ['ACTIVE'],
    };
    const allowed = validTransitions[product.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${product.status} sang ${status}.`,
      );
    }
    return this.prisma.product.update({
      where: { id },
      data: { status: status as ProductStatus },
      include: {
        productType: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
    });
  }

  async softDeleteProduct(id: string) {
    const product = await this.findOneProduct(id);
    if (product.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xoá sản phẩm ở trạng thái DRAFT.');
    }
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restoreProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.deletedAt) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc chưa bị xoá.');
    }
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        productType: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
    });
  }

  // ──────────────────────────────────────
  // Validation Rule (Sprint 03 Task 04/06) — trực tiếp trên Product, không
  // versioned (không phải công thức tính giá/vật tư, chỉ là ràng buộc kiểm tra).
  // ──────────────────────────────────────

  async findValidationRules(productId: string) {
    await this.findOneProduct(productId);
    return this.prisma.validationRule.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createValidationRule(productId: string, dto: CreateValidationRuleDto) {
    await this.findOneProduct(productId);
    if (!dto.expression?.trim()) throw new BadRequestException('Biểu thức điều kiện là bắt buộc.');
    this.validateExpression(dto.expression.trim());
    if (!dto.message?.trim()) throw new BadRequestException('Thông báo là bắt buộc.');
    const severity = dto.severity === 'BLOCK' ? 'BLOCK' : 'WARN';

    return this.prisma.validationRule.create({
      data: {
        productId,
        expression: dto.expression.trim(),
        severity,
        message: dto.message.trim(),
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updateValidationRule(id: string, dto: UpdateValidationRuleDto) {
    const rule = await this.prisma.validationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Validation Rule không tồn tại.');
    if (dto.expression !== undefined) {
      if (!dto.expression.trim()) throw new BadRequestException('Biểu thức điều kiện là bắt buộc.');
      this.validateExpression(dto.expression.trim());
    }
    if (dto.message !== undefined && !dto.message.trim()) {
      throw new BadRequestException('Thông báo là bắt buộc.');
    }

    const data: Prisma.ValidationRuleUpdateInput = {};
    if (dto.expression !== undefined) data.expression = dto.expression.trim();
    if (dto.severity !== undefined) data.severity = dto.severity === 'BLOCK' ? 'BLOCK' : 'WARN';
    if (dto.message !== undefined) data.message = dto.message.trim();
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

    return this.prisma.validationRule.update({ where: { id }, data });
  }

  async deleteValidationRule(id: string) {
    const rule = await this.prisma.validationRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Validation Rule không tồn tại.');
    return this.prisma.validationRule.delete({ where: { id } });
  }

  // ──────────────────────────────────────
  // Derived Parameter (Sprint 03 Task 04/06) — biến phái sinh dùng chung cho
  // cả Pricing lẫn BOM, trực tiếp trên Product, không versioned.
  // ──────────────────────────────────────

  async findDerivedParameters(productId: string) {
    await this.findOneProduct(productId);
    return this.prisma.derivedParameter.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createDerivedParameter(productId: string, dto: CreateDerivedParameterDto) {
    await this.findOneProduct(productId);
    if (!dto.name?.trim()) throw new BadRequestException('Tên biến phái sinh là bắt buộc.');
    if (!dto.expression?.trim()) throw new BadRequestException('Công thức là bắt buộc.');
    this.validateExpression(dto.expression.trim());

    const existing = await this.prisma.derivedParameter.findFirst({
      where: { productId, name: dto.name.trim() },
    });
    if (existing) throw new ConflictException('Tên biến phái sinh đã tồn tại trong sản phẩm này.');

    return this.prisma.derivedParameter.create({
      data: {
        productId,
        name: dto.name.trim(),
        expression: dto.expression.trim(),
        unit: dto.unit?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updateDerivedParameter(id: string, dto: UpdateDerivedParameterDto) {
    const param = await this.prisma.derivedParameter.findUnique({ where: { id } });
    if (!param) throw new NotFoundException('Biến phái sinh không tồn tại.');

    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('Tên biến phái sinh là bắt buộc.');
      const existing = await this.prisma.derivedParameter.findFirst({
        where: { productId: param.productId, name: dto.name.trim(), id: { not: id } },
      });
      if (existing) throw new ConflictException('Tên biến phái sinh đã tồn tại trong sản phẩm này.');
    }
    if (dto.expression !== undefined) {
      if (!dto.expression.trim()) throw new BadRequestException('Công thức là bắt buộc.');
      this.validateExpression(dto.expression.trim());
    }

    const data: Prisma.DerivedParameterUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.expression !== undefined) data.expression = dto.expression.trim();
    if (dto.unit !== undefined) data.unit = dto.unit?.trim() || null;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

    return this.prisma.derivedParameter.update({ where: { id }, data });
  }

  async deleteDerivedParameter(id: string) {
    const param = await this.prisma.derivedParameter.findUnique({ where: { id } });
    if (!param) throw new NotFoundException('Biến phái sinh không tồn tại.');
    return this.prisma.derivedParameter.delete({ where: { id } });
  }

  // ──────────────────────────────────────
  // Product Parameter
  // ──────────────────────────────────────

  private readonly validParamTypes = ['NUMBER', 'TEXT', 'ENUM', 'BOOLEAN'];

  async findProductParameters(productId: string) {
    await this.findOneProduct(productId);
    return this.prisma.productParameter.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async createProductParameter(productId: string, dto: CreateProductParameterDto) {
    await this.findOneProduct(productId);
    if (!dto.name?.trim()) throw new BadRequestException('Tên thông số là bắt buộc.');
    if (!dto.label?.trim()) throw new BadRequestException('Nhãn hiển thị là bắt buộc.');
    if (!this.validParamTypes.includes(dto.type)) {
      throw new BadRequestException('Kiểu dữ liệu không hợp lệ.');
    }
    if (dto.type === 'ENUM' && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('Kiểu ENUM cần có ít nhất một lựa chọn.');
    }

    const existing = await this.prisma.productParameter.findFirst({
      where: { productId, name: dto.name.trim() },
    });
    if (existing) throw new ConflictException('Tên thông số đã tồn tại trong sản phẩm này.');

    return this.prisma.productParameter.create({
      data: {
        productId,
        name: dto.name.trim(),
        label: dto.label.trim(),
        type: dto.type as ParameterType,
        unit: dto.unit?.trim() || null,
        defaultValue: dto.defaultValue?.trim() || null,
        isRequired: dto.isRequired ?? false,
        minValue: dto.type === 'NUMBER' ? (dto.minValue ?? null) : null,
        maxValue: dto.type === 'NUMBER' ? (dto.maxValue ?? null) : null,
        step: dto.type === 'NUMBER' ? (dto.step ?? null) : null,
        usedInPricing: dto.usedInPricing ?? true,
        usedInMaterial: dto.usedInMaterial ?? true,
        displayOrder: dto.displayOrder ?? 0,
        options:
          dto.type === 'ENUM'
            ? {
                create: (dto.options ?? []).map((opt, idx) => ({
                  value: opt.value.trim(),
                  label: opt.label?.trim() || null,
                  displayOrder: opt.displayOrder ?? idx,
                })),
              }
            : undefined,
      },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async updateProductParameter(id: string, dto: UpdateProductParameterDto) {
    const param = await this.prisma.productParameter.findUnique({ where: { id } });
    if (!param) throw new NotFoundException('Thông số không tồn tại.');

    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('Tên thông số là bắt buộc.');
      const existing = await this.prisma.productParameter.findFirst({
        where: { productId: param.productId, name: dto.name.trim(), id: { not: id } },
      });
      if (existing) throw new ConflictException('Tên thông số đã tồn tại trong sản phẩm này.');
    }

    if (dto.type !== undefined && !this.validParamTypes.includes(dto.type)) {
      throw new BadRequestException('Kiểu dữ liệu không hợp lệ.');
    }

    const effectiveType = (dto.type as ParameterType | undefined) ?? param.type;

    const data: Prisma.ProductParameterUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.type !== undefined) data.type = dto.type as ParameterType;
    if (dto.unit !== undefined) data.unit = dto.unit?.trim() || null;
    if ('defaultValue' in dto) data.defaultValue = dto.defaultValue?.trim() || null;
    if (dto.isRequired !== undefined) data.isRequired = dto.isRequired;
    if (dto.usedInPricing !== undefined) data.usedInPricing = dto.usedInPricing;
    if (dto.usedInMaterial !== undefined) data.usedInMaterial = dto.usedInMaterial;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

    if (effectiveType === 'NUMBER') {
      if ('minValue' in dto) data.minValue = dto.minValue ?? null;
      if ('maxValue' in dto) data.maxValue = dto.maxValue ?? null;
      if ('step' in dto) data.step = dto.step ?? null;
    } else if (dto.type !== undefined && param.type === 'NUMBER') {
      data.minValue = null;
      data.maxValue = null;
      data.step = null;
    }

    if (effectiveType === 'ENUM' && dto.options !== undefined) {
      data.options = {
        deleteMany: {},
        create: dto.options.map((opt, idx) => ({
          value: opt.value.trim(),
          label: opt.label?.trim() || null,
          displayOrder: opt.displayOrder ?? idx,
        })),
      };
    } else if (effectiveType !== 'ENUM') {
      data.options = { deleteMany: {} };
    }

    return this.prisma.productParameter.update({
      where: { id },
      data,
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async deleteProductParameter(id: string) {
    const param = await this.prisma.productParameter.findUnique({ where: { id } });
    if (!param) throw new NotFoundException('Thông số không tồn tại.');
    return this.prisma.productParameter.delete({ where: { id } });
  }

  // ──────────────────────────────────────
  // Pricing Rule
  // ──────────────────────────────────────

  async findPricingRule(productId: string) {
    await this.findOneProduct(productId);
    let rule = await this.prisma.pricingRule.findUnique({
      where: { productId },
      include: {
        versions: {
          orderBy: { versionNumber: 'asc' },
        },
      },
    });
    if (!rule) {
      rule = await this.prisma.pricingRule.create({
        data: { productId },
        include: { versions: { orderBy: { versionNumber: 'asc' } } },
      });
    }
    return rule;
  }

  async findPricingRuleVersion(versionId: string) {
    const version = await this.prisma.pricingRuleVersion.findUnique({
      where: { id: versionId },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        matrixRows: { orderBy: { displayOrder: 'asc' } },
        pricingRule: { select: { productId: true } },
      },
    });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    return version;
  }

  async createPricingRuleVersion(productId: string, dto: CreatePricingRuleVersionDto) {
    await this.findOneProduct(productId);
    let rule = await this.prisma.pricingRule.findUnique({ where: { productId } });
    if (!rule) {
      rule = await this.prisma.pricingRule.create({ data: { productId } });
    }

    const lastVersion = await this.prisma.pricingRuleVersion.findFirst({
      where: { pricingRuleId: rule.id },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    if (dto.expression?.trim()) {
      this.validateExpression(dto.expression.trim());
    }

    return this.prisma.pricingRuleVersion.create({
      data: {
        pricingRuleId: rule.id,
        versionNumber: nextVersionNumber,
        name: dto.name?.trim() || null,
        expression: dto.expression?.trim() || null,
        priceRoundType: (dto.priceRoundType as RoundType) ?? 'NONE',
        priceRoundValue: dto.priceRoundValue ?? null,
        status: 'DRAFT',
        note: dto.note?.trim() || null,
      },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        matrixRows: { orderBy: { displayOrder: 'asc' } },
        pricingRule: { select: { productId: true } },
      },
    });
  }

  async updatePricingRuleVersion(id: string, dto: UpdatePricingRuleVersionDto) {
    const version = await this.prisma.pricingRuleVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể chỉnh sửa phiên bản DRAFT.');
    }
    if (dto.expression !== undefined && dto.expression?.trim()) {
      this.validateExpression(dto.expression.trim());
    }

    const data: Prisma.PricingRuleVersionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name?.trim() || null;
    if (dto.expression !== undefined) data.expression = dto.expression?.trim() || null;
    if (dto.priceRoundType !== undefined) data.priceRoundType = dto.priceRoundType as RoundType;
    if ('priceRoundValue' in dto) data.priceRoundValue = dto.priceRoundValue ?? null;
    if (dto.note !== undefined) data.note = dto.note?.trim() || null;

    return this.prisma.pricingRuleVersion.update({
      where: { id },
      data,
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        matrixRows: { orderBy: { displayOrder: 'asc' } },
        pricingRule: { select: { productId: true } },
      },
    });
  }

  async activatePricingRuleVersion(id: string) {
    const version = await this.prisma.pricingRuleVersion.findUnique({
      where: { id },
      include: { _count: { select: { matrixRows: true } } },
    });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status === 'ACTIVE') {
      throw new BadRequestException('Phiên bản này đã đang hoạt động.');
    }
    // Sprint 03: Bảng giá ma trận là cách tính chính; expression là fallback.
    // Version hợp lệ khi có ít nhất một trong hai.
    if (version._count.matrixRows === 0 && !version.expression?.trim()) {
      throw new BadRequestException(
        'Phiên bản cần có Bảng giá ma trận hoặc Expression trước khi kích hoạt.',
      );
    }
    if (version.expression?.trim()) {
      this.validateExpression(version.expression.trim());
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.pricingRuleVersion.updateMany({
        where: { pricingRuleId: version.pricingRuleId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      return tx.pricingRuleVersion.update({
        where: { id },
        data: { status: 'ACTIVE' },
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
          matrixRows: { orderBy: { displayOrder: 'asc' } },
          pricingRule: { select: { productId: true } },
        },
      });
    });
  }

  async deletePricingRuleVersion(id: string) {
    const version = await this.prisma.pricingRuleVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xoá phiên bản DRAFT.');
    }
    return this.prisma.pricingRuleVersion.delete({ where: { id } });
  }

  /**
   * Validate chung cho Rule Item (Sprint 03): 4 loại rule + condition.
   * MIN_DIMENSION/MIN_VALUE cần targetParameter; MIN_* cần value > 0;
   * BILLABLE_STEP cần billValue > 0 và khoảng [rangeFrom, rangeTo) hợp lệ.
   */
  private validatePricingRuleItemInput(input: {
    ruleType: string;
    targetParameter?: string | null;
    value?: number | null;
    condition?: string | null;
    rangeFrom?: number | null;
    rangeTo?: number | null;
    billValue?: number | null;
  }): void {
    const validTypes = ['MIN_AREA', 'MIN_DIMENSION', 'MIN_VALUE', 'BILLABLE_STEP'];
    if (!validTypes.includes(input.ruleType)) {
      throw new BadRequestException(
        `Loại Rule không hợp lệ. Chọn: ${validTypes.join(', ')}.`,
      );
    }
    if (
      (input.ruleType === 'MIN_DIMENSION' || input.ruleType === 'MIN_VALUE') &&
      !input.targetParameter?.trim()
    ) {
      throw new BadRequestException(`${input.ruleType} cần chỉ định targetParameter.`);
    }
    if (input.ruleType !== 'BILLABLE_STEP') {
      if (input.value === undefined || input.value === null || input.value <= 0) {
        throw new BadRequestException('Giá trị tối thiểu phải lớn hơn 0.');
      }
    } else {
      if (input.billValue === undefined || input.billValue === null || input.billValue <= 0) {
        throw new BadRequestException('BILLABLE_STEP cần billValue lớn hơn 0.');
      }
      if (
        input.rangeFrom !== null &&
        input.rangeFrom !== undefined &&
        input.rangeTo !== null &&
        input.rangeTo !== undefined &&
        input.rangeFrom >= input.rangeTo
      ) {
        throw new BadRequestException('BILLABLE_STEP cần rangeFrom nhỏ hơn rangeTo.');
      }
    }
    if (input.condition?.trim()) {
      this.validateExpression(input.condition.trim());
    }
  }

  async createPricingRuleItem(versionId: string, dto: CreatePricingRuleItemDto) {
    const version = await this.prisma.pricingRuleVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể thêm Rule vào phiên bản DRAFT.');
    }
    this.validatePricingRuleItemInput(dto);

    const needsTarget = dto.ruleType === 'MIN_DIMENSION' || dto.ruleType === 'MIN_VALUE';
    return this.prisma.pricingRuleItem.create({
      data: {
        pricingRuleVersionId: versionId,
        ruleType: dto.ruleType as PricingRuleType,
        // BILLABLE_STEP: targetParameter tùy chọn (mặc định 'area' khi tính)
        targetParameter:
          needsTarget || dto.ruleType === 'BILLABLE_STEP'
            ? dto.targetParameter?.trim() || null
            : null,
        value: dto.value ?? 0,
        condition: dto.condition?.trim() || null,
        rangeFrom: dto.ruleType === 'BILLABLE_STEP' ? (dto.rangeFrom ?? null) : null,
        rangeTo: dto.ruleType === 'BILLABLE_STEP' ? (dto.rangeTo ?? null) : null,
        billValue: dto.ruleType === 'BILLABLE_STEP' ? (dto.billValue ?? null) : null,
        description: dto.description?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updatePricingRuleItem(id: string, dto: UpdatePricingRuleItemDto) {
    const item = await this.prisma.pricingRuleItem.findUnique({
      where: { id },
      include: { pricingRuleVersion: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Rule Item không tồn tại.');
    if (item.pricingRuleVersion.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể chỉnh sửa Rule Item trong phiên bản DRAFT.');
    }

    const effectiveType = (dto.ruleType as PricingRuleType) ?? item.ruleType;
    this.validatePricingRuleItemInput({
      ruleType: effectiveType,
      targetParameter: dto.targetParameter !== undefined ? dto.targetParameter : item.targetParameter,
      value: dto.value !== undefined ? dto.value : Number(item.value),
      condition: dto.condition !== undefined ? dto.condition : item.condition,
      rangeFrom: dto.rangeFrom !== undefined ? dto.rangeFrom : item.rangeFrom ? Number(item.rangeFrom) : null,
      rangeTo: dto.rangeTo !== undefined ? dto.rangeTo : item.rangeTo ? Number(item.rangeTo) : null,
      billValue: dto.billValue !== undefined ? dto.billValue : item.billValue ? Number(item.billValue) : null,
    });

    const data: Prisma.PricingRuleItemUpdateInput = {};
    if (dto.ruleType !== undefined) data.ruleType = dto.ruleType as PricingRuleType;
    if (dto.targetParameter !== undefined) {
      data.targetParameter = dto.targetParameter?.trim() || null;
    }
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.condition !== undefined) data.condition = dto.condition?.trim() || null;
    if (dto.rangeFrom !== undefined) data.rangeFrom = dto.rangeFrom;
    if (dto.rangeTo !== undefined) data.rangeTo = dto.rangeTo;
    if (dto.billValue !== undefined) data.billValue = dto.billValue;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

    return this.prisma.pricingRuleItem.update({ where: { id }, data });
  }

  /**
   * Bulk replace toàn bộ Bảng giá ma trận của một version DRAFT (Sprint 03 Task 10).
   * Editor dạng Excel lưu cả bảng một lần — đơn giản và không lo lệch từng dòng.
   */
  async updatePriceMatrix(versionId: string, rows: PriceMatrixRowDto[]) {
    const version = await this.prisma.pricingRuleVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể sửa Bảng giá trong phiên bản DRAFT.');
    }

    const seen = new Set<string>();
    const data = (rows ?? []).map((row, idx) => {
      if (!row.dimensions || Object.keys(row.dimensions).length === 0) {
        throw new BadRequestException(`Dòng ${idx + 1}: thiếu tổ hợp cấu hình.`);
      }
      if (!(row.unitPrice > 0)) {
        throw new BadRequestException(`Dòng ${idx + 1}: đơn giá phải lớn hơn 0.`);
      }
      const configKey = Object.entries(row.dimensions)
        .map(([k, v]) => [k.trim(), String(v).trim()] as const)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('|');
      if (seen.has(configKey)) {
        throw new BadRequestException(`Dòng ${idx + 1}: tổ hợp "${configKey}" bị trùng.`);
      }
      seen.add(configKey);
      return {
        pricingRuleVersionId: versionId,
        dimensions: row.dimensions,
        configKey,
        unitPrice: row.unitPrice,
        displayOrder: row.displayOrder ?? idx,
      };
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.priceMatrixRow.deleteMany({ where: { pricingRuleVersionId: versionId } });
      if (data.length > 0) {
        await tx.priceMatrixRow.createMany({ data });
      }
      return tx.pricingRuleVersion.findUnique({
        where: { id: versionId },
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
          matrixRows: { orderBy: { displayOrder: 'asc' } },
          pricingRule: { select: { productId: true } },
        },
      });
    });
  }

  async deletePricingRuleItem(id: string) {
    const item = await this.prisma.pricingRuleItem.findUnique({
      where: { id },
      include: { pricingRuleVersion: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Rule Item không tồn tại.');
    if (item.pricingRuleVersion.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xoá Rule Item trong phiên bản DRAFT.');
    }
    return this.prisma.pricingRuleItem.delete({ where: { id } });
  }

  async previewPrice(versionId: string, inputParams: Record<string, number | string>) {
    // Preview dùng đúng pipeline của Pricing Engine (kể cả version DRAFT) —
    // trước đây preview tự tính riêng nên lệch với giá thật (bug, fix 10/07/2026).
    const config = await this.pricingEngine.loadConfigForVersion(versionId);
    const result = this.pricingEngine.calculatePrice(config, { ...inputParams });

    return {
      inputParams,
      adjustedParams: result.billableParams,
      rawPrice: result.rawPrice,
      finalPrice: result.systemPrice,
      unitPrice: result.unitPrice,
      warnings: result.warnings,
    };
  }

  // ──────────────────────────────────────
  // Material Requirement
  // ──────────────────────────────────────

  async findMaterialRequirement(productId: string) {
    await this.findOneProduct(productId);
    let req = await this.prisma.materialRequirement.findUnique({
      where: { productId },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });
    if (!req) {
      req = await this.prisma.materialRequirement.create({
        data: { productId },
        include: { versions: { orderBy: { versionNumber: 'asc' } } },
      });
    }
    return req;
  }

  async findMaterialRequirementVersion(versionId: string) {
    const version = await this.prisma.materialRequirementVersion.findUnique({
      where: { id: versionId },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: {
            material: {
              select: { id: true, name: true, code: true, unit: { select: { id: true, name: true } } },
            },
          },
        },
        materialRequirement: { select: { productId: true } },
      },
    });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    return version;
  }

  async createMaterialRequirementVersion(productId: string, dto: CreateMaterialRequirementVersionDto) {
    await this.findOneProduct(productId);
    let req = await this.prisma.materialRequirement.findUnique({ where: { productId } });
    if (!req) {
      req = await this.prisma.materialRequirement.create({ data: { productId } });
    }

    const last = await this.prisma.materialRequirementVersion.findFirst({
      where: { materialRequirementId: req.id },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersionNumber = (last?.versionNumber ?? 0) + 1;

    return this.prisma.materialRequirementVersion.create({
      data: {
        materialRequirementId: req.id,
        versionNumber: nextVersionNumber,
        name: dto.name?.trim() || null,
        status: 'DRAFT',
        note: dto.note?.trim() || null,
      },
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: {
            material: {
              select: { id: true, name: true, code: true, unit: { select: { id: true, name: true } } },
            },
          },
        },
        materialRequirement: { select: { productId: true } },
      },
    });
  }

  async updateMaterialRequirementVersion(id: string, dto: UpdateMaterialRequirementVersionDto) {
    const version = await this.prisma.materialRequirementVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể chỉnh sửa phiên bản DRAFT.');
    }

    const data: Prisma.MaterialRequirementVersionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name?.trim() || null;
    if (dto.note !== undefined) data.note = dto.note?.trim() || null;

    return this.prisma.materialRequirementVersion.update({
      where: { id },
      data,
      include: {
        items: {
          orderBy: { displayOrder: 'asc' },
          include: {
            material: {
              select: { id: true, name: true, code: true, unit: { select: { id: true, name: true } } },
            },
          },
        },
        materialRequirement: { select: { productId: true } },
      },
    });
  }

  async activateMaterialRequirementVersion(id: string) {
    const version = await this.prisma.materialRequirementVersion.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status === 'ACTIVE') {
      throw new BadRequestException('Phiên bản này đã đang hoạt động.');
    }
    if (version.items.length === 0) {
      throw new BadRequestException('Phiên bản cần có ít nhất một Item trước khi kích hoạt.');
    }
    for (const item of version.items) {
      this.validateExpression(item.expression);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.materialRequirementVersion.updateMany({
        where: { materialRequirementId: version.materialRequirementId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      });
      return tx.materialRequirementVersion.update({
        where: { id },
        data: { status: 'ACTIVE' },
        include: {
          items: {
            orderBy: { displayOrder: 'asc' },
            include: {
              material: {
                select: { id: true, name: true, code: true, unit: { select: { id: true, name: true } } },
              },
            },
          },
          materialRequirement: { select: { productId: true } },
        },
      });
    });
  }

  async deleteMaterialRequirementVersion(id: string) {
    const version = await this.prisma.materialRequirementVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xoá phiên bản DRAFT.');
    }
    return this.prisma.materialRequirementVersion.delete({ where: { id } });
  }

  async createMaterialRequirementItem(versionId: string, dto: CreateMaterialRequirementItemDto) {
    const version = await this.prisma.materialRequirementVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Phiên bản không tồn tại.');
    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể thêm Item vào phiên bản DRAFT.');
    }
    if (!dto.materialId) throw new BadRequestException('Nguyên liệu là bắt buộc.');
    const material = await this.prisma.material.findUnique({ where: { id: dto.materialId } });
    if (!material) throw new NotFoundException('Nguyên liệu không tồn tại.');
    if (!dto.expression?.trim()) throw new BadRequestException('Expression là bắt buộc.');
    this.validateExpression(dto.expression.trim());
    if (dto.condition?.trim()) {
      this.validateExpression(dto.condition.trim());
    }
    if (dto.wastePercent !== undefined && dto.wastePercent < 0) {
      throw new BadRequestException('Tỷ lệ hao hụt không được âm.');
    }
    if (dto.roundStep !== undefined && dto.roundStep < 0) {
      throw new BadRequestException('Round Step không được âm.');
    }

    const roundType = dto.roundStep && dto.roundStep > 0 ? 'CEIL' : 'NONE';
    const roundValue = dto.roundStep && dto.roundStep > 0 ? dto.roundStep : null;

    return this.prisma.materialRequirementItem.create({
      data: {
        materialRequirementVersionId: versionId,
        materialId: dto.materialId,
        expression: dto.expression.trim(),
        condition: dto.condition?.trim() || null,
        wastePercent: dto.wastePercent ?? 0,
        roundType: roundType as RoundType,
        roundValue: roundValue,
        note: dto.note?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
      },
      include: {
        material: {
          select: { id: true, name: true, code: true, unit: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async updateMaterialRequirementItem(id: string, dto: UpdateMaterialRequirementItemDto) {
    const item = await this.prisma.materialRequirementItem.findUnique({
      where: { id },
      include: { materialRequirementVersion: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item không tồn tại.');
    if (item.materialRequirementVersion.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể chỉnh sửa Item trong phiên bản DRAFT.');
    }

    if (dto.materialId !== undefined) {
      const mat = await this.prisma.material.findUnique({ where: { id: dto.materialId } });
      if (!mat) throw new NotFoundException('Nguyên liệu không tồn tại.');
    }
    if (dto.expression !== undefined && dto.expression.trim()) {
      this.validateExpression(dto.expression.trim());
    }
    if (dto.condition !== undefined && dto.condition?.trim()) {
      this.validateExpression(dto.condition.trim());
    }
    if (dto.wastePercent !== undefined && dto.wastePercent < 0) {
      throw new BadRequestException('Tỷ lệ hao hụt không được âm.');
    }
    if (dto.roundStep !== undefined && dto.roundStep < 0) {
      throw new BadRequestException('Round Step không được âm.');
    }

    const data: Prisma.MaterialRequirementItemUpdateInput = {};
    if (dto.materialId !== undefined) data.material = { connect: { id: dto.materialId } };
    if (dto.expression !== undefined) data.expression = dto.expression.trim();
    if (dto.condition !== undefined) data.condition = dto.condition?.trim() || null;
    if (dto.wastePercent !== undefined) data.wastePercent = dto.wastePercent;
    if (dto.roundStep !== undefined) {
      data.roundType = dto.roundStep > 0 ? 'CEIL' : 'NONE';
      data.roundValue = dto.roundStep > 0 ? dto.roundStep : null;
    }
    if (dto.note !== undefined) data.note = dto.note?.trim() || null;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

    return this.prisma.materialRequirementItem.update({
      where: { id },
      data,
      include: {
        material: {
          select: { id: true, name: true, code: true, unit: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async deleteMaterialRequirementItem(id: string) {
    const item = await this.prisma.materialRequirementItem.findUnique({
      where: { id },
      include: { materialRequirementVersion: { select: { status: true } } },
    });
    if (!item) throw new NotFoundException('Item không tồn tại.');
    if (item.materialRequirementVersion.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xoá Item trong phiên bản DRAFT.');
    }
    return this.prisma.materialRequirementItem.delete({ where: { id } });
  }

  async previewMaterial(versionId: string, inputParams: Record<string, number | string>) {
    // Preview dùng đúng pipeline của BOM Engine (Filter theo condition →
    // Formula → Waste → Round) — cùng một logic với lúc Approve sinh OrderBOM.
    const config = await this.bomEngine.loadConfigForVersion(versionId);
    if (config.items.length === 0) {
      throw new BadRequestException('Phiên bản chưa có Item nào.');
    }

    const result = this.bomEngine.calculateBom(config, { ...inputParams });

    return {
      inputParams,
      items: result.lines.map((line) => ({
        materialId: line.materialId,
        materialCode: line.materialCode,
        materialName: line.materialName,
        unit: line.materialUnit ? { name: line.materialUnit } : null,
        expression: line.expression,
        baseQty: line.baseQty,
        wastePercent: line.wastePercent,
        wastedQty: line.wastedQty,
        roundStep: line.roundValue,
        finalQty: line.finalQtyPerUnit,
        unitPrice: line.unitPrice,
        itemCost: line.lineTotal,
      })),
      totalCost: result.plannedCost,
    };
  }

  // ──────────────────────────────────────
  // Export
  // ──────────────────────────────────────

  async exportProduct(productId: string): Promise<{ buffer: Buffer; code: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        productType: { select: { name: true } },
        unit: { select: { name: true } },
      },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại.');

    const parameters = await this.prisma.productParameter.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });

    const pricingRule = await this.prisma.pricingRule.findUnique({
      where: { productId },
      include: {
        versions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: { items: { orderBy: { displayOrder: 'asc' } } },
        },
      },
    });

    const materialReq = await this.prisma.materialRequirement.findUnique({
      where: { productId },
      include: {
        versions: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            items: {
              orderBy: { displayOrder: 'asc' },
              include: {
                material: {
                  select: {
                    code: true,
                    name: true,
                    unit: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ERP Engine';
    workbook.created = new Date();

    // Sheet 1 — Product Info
    const infoSheet = workbook.addWorksheet('Thông tin sản phẩm');
    infoSheet.getColumn(1).width = 24;
    infoSheet.getColumn(2).width = 40;
    const infoRows = [
      ['Mã sản phẩm', product.code],
      ['Tên sản phẩm', product.name],
      ['Loại sản phẩm', product.productType?.name ?? ''],
      ['Đơn vị tính', product.unit?.name ?? ''],
      ['Trạng thái', product.status],
      ['Mô tả', product.description ?? ''],
      ['Ngày tạo', product.createdAt.toLocaleString('vi-VN')],
      ['Cập nhật', product.updatedAt.toLocaleString('vi-VN')],
    ];
    infoRows.forEach(([label, value]) => {
      const row = infoSheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    });

    // Sheet 2 — Parameters
    const paramSheet = workbook.addWorksheet('Thông số sản phẩm');
    paramSheet.columns = [
      { header: 'Tên biến', key: 'name', width: 20 },
      { header: 'Nhãn', key: 'label', width: 25 },
      { header: 'Kiểu', key: 'type', width: 12 },
      { header: 'Đơn vị', key: 'unit', width: 12 },
      { header: 'Bắt buộc', key: 'isRequired', width: 12 },
      { header: 'Giá trị mặc định', key: 'defaultValue', width: 20 },
      { header: 'Min', key: 'minValue', width: 10 },
      { header: 'Max', key: 'maxValue', width: 10 },
      { header: 'Step', key: 'step', width: 10 },
      { header: 'Dùng báo giá', key: 'usedInPricing', width: 14 },
      { header: 'Dùng định mức', key: 'usedInMaterial', width: 14 },
      { header: 'Thứ tự', key: 'displayOrder', width: 10 },
      { header: 'Options (ENUM)', key: 'options', width: 50 },
    ];
    paramSheet.getRow(1).font = { bold: true };
    for (const p of parameters) {
      paramSheet.addRow({
        name: p.name,
        label: p.label,
        type: p.type,
        unit: p.unit ?? '',
        isRequired: p.isRequired ? 'Có' : 'Không',
        defaultValue: p.defaultValue ?? '',
        minValue: p.minValue !== null ? Number(p.minValue) : '',
        maxValue: p.maxValue !== null ? Number(p.maxValue) : '',
        step: p.step !== null ? Number(p.step) : '',
        usedInPricing: p.usedInPricing ? 'Có' : 'Không',
        usedInMaterial: p.usedInMaterial ? 'Có' : 'Không',
        displayOrder: p.displayOrder,
        options: p.options
          .map((o) => (o.label ? `${o.value}:${o.label}` : o.value))
          .join(' | '),
      });
    }

    // Sheet 3 — Pricing Rule
    const priceSheet = workbook.addWorksheet('Quy tắc báo giá');
    priceSheet.getColumn(1).width = 24;
    priceSheet.getColumn(2).width = 60;
    const activePriceVersion = pricingRule?.versions?.[0] ?? null;
    if (activePriceVersion) {
      const metaRows = [
        ['Phiên bản', `v${activePriceVersion.versionNumber}${activePriceVersion.name ? ` — ${activePriceVersion.name}` : ''}`],
        ['Expression', activePriceVersion.expression ?? ''],
        ['Round Type', activePriceVersion.priceRoundType],
        ['Round Value', activePriceVersion.priceRoundValue !== null ? Number(activePriceVersion.priceRoundValue) : ''],
        ['Ghi chú', activePriceVersion.note ?? ''],
      ];
      metaRows.forEach(([label, value]) => {
        const row = priceSheet.addRow([label, value]);
        row.getCell(1).font = { bold: true };
      });

      if (activePriceVersion.items.length > 0) {
        priceSheet.addRow([]);
        const headerRow = priceSheet.addRow(['Loại Rule', 'Thông số áp dụng', 'Giá trị tối thiểu', 'Mô tả']);
        headerRow.font = { bold: true };
        for (const item of activePriceVersion.items) {
          priceSheet.addRow([
            item.ruleType,
            item.targetParameter ?? '',
            Number(item.value),
            item.description ?? '',
          ]);
        }
      }
    } else {
      priceSheet.addRow(['Chưa có phiên bản ACTIVE']);
    }

    // Sheet 4 — Material Requirement
    const matSheet = workbook.addWorksheet('Định mức vật liệu');
    matSheet.getColumn(1).width = 24;
    matSheet.getColumn(2).width = 40;
    const activeMatVersion = materialReq?.versions?.[0] ?? null;
    if (activeMatVersion) {
      const matMetaRows = [
        ['Phiên bản', `v${activeMatVersion.versionNumber}${activeMatVersion.name ? ` — ${activeMatVersion.name}` : ''}`],
        ['Ghi chú', activeMatVersion.note ?? ''],
      ];
      matMetaRows.forEach(([label, value]) => {
        const row = matSheet.addRow([label, value]);
        row.getCell(1).font = { bold: true };
      });

      if (activeMatVersion.items.length > 0) {
        matSheet.addRow([]);
        const matHeader = matSheet.addRow([
          'Nguyên liệu', 'Mã', 'Đơn vị', 'Expression', 'Hao hụt (%)', 'Round Step', 'Ghi chú',
        ]);
        matHeader.font = { bold: true };
        matSheet.getColumn(4).width = 50;
        for (const item of activeMatVersion.items) {
          matSheet.addRow([
            item.material.name,
            item.material.code,
            item.material.unit?.name ?? '',
            item.expression,
            Number(item.wastePercent),
            item.roundValue !== null ? Number(item.roundValue) : 0,
            item.note ?? '',
          ]);
        }
      }
    } else {
      matSheet.addRow(['Chưa có phiên bản ACTIVE']);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(arrayBuffer), code: product.code };
  }

  // ──────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────

  private validateExpression(expression: string): void {
    const result = validateExpressionSyntax(expression);
    if (!result.valid) {
      throw new BadRequestException(`Cú pháp biểu thức không hợp lệ: ${result.error}`);
    }
  }

  private async generateCode(type: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.runningNumber.update({
        where: { type },
        data: { lastNumber: { increment: 1 } },
      });
      return `${record.prefix}${String(record.lastNumber).padStart(record.paddingLength, '0')}`;
    });
  }
}
