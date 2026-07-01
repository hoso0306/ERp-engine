import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ProductStatus } from '@prisma/client';
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

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: { unit: { select: { id: true, name: true } } },
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
      },
      include: { unit: { select: { id: true, name: true } } },
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

    return this.prisma.material.update({
      where: { id },
      data,
      include: { unit: { select: { id: true, name: true } } },
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

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          productType: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
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
      },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại.');
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    if (!dto.name?.trim()) throw new BadRequestException('Tên sản phẩm là bắt buộc.');
    if (!dto.productTypeId) throw new BadRequestException('Loại sản phẩm là bắt buộc.');
    if (!dto.unitId) throw new BadRequestException('Đơn vị là bắt buộc.');
    await this.findOneProductType(dto.productTypeId);
    await this.findOneUnit(dto.unitId);

    const code = await this.generateCode('PRODUCT');
    return this.prisma.product.create({
      data: {
        code,
        name: dto.name.trim(),
        productTypeId: dto.productTypeId,
        unitId: dto.unitId,
        description: dto.description?.trim() || null,
        status: 'DRAFT',
      },
      include: {
        productType: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
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

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.productTypeId !== undefined) data.productType = { connect: { id: dto.productTypeId } };
    if (dto.unitId !== undefined) data.unit = { connect: { id: dto.unitId } };
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;

    return this.prisma.product.update({
      where: { id },
      data,
      include: {
        productType: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
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
  // Private helpers
  // ──────────────────────────────────────

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
