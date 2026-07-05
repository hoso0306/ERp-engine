import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  WarehouseDirection,
  WarehouseTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialReceiptDto } from './dto/create-material-receipt.dto';
import { MaterialReceiptQueryDto } from './dto/material-receipt-query.dto';
import { WarehouseTransactionQueryDto } from './dto/warehouse-transaction-query.dto';
import { StockQueryDto } from './dto/stock-query.dto';

const MATERIAL_RECEIPT_INCLUDE = {
  transaction: true,
} satisfies Prisma.MaterialReceiptInclude;

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────
  // Material Receipt (Task 02) — document Create API duy nhất của module này
  // ─────────────────────────────────────────────────────

  async createMaterialReceipt(dto: CreateMaterialReceiptDto) {
    if (!dto.materialId) {
      throw new BadRequestException('Nguyên liệu là bắt buộc.');
    }
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0.');
    }

    const material = await this.prisma.material.findUnique({
      where: { id: dto.materialId },
      include: { unit: { select: { name: true } } },
    });

    if (!material) {
      throw new NotFoundException('Nguyên liệu không tồn tại.');
    }
    if (!material.isActive) {
      throw new BadRequestException('Nguyên liệu không còn hoạt động.');
    }

    return this.prisma.$transaction(async (tx) => {
      const running = await tx.runningNumber.update({
        where: { type: 'MATERIAL_RECEIPT' },
        data: { lastNumber: { increment: 1 } },
      });
      const code = `${running.prefix}${String(running.lastNumber).padStart(running.paddingLength, '0')}`;

      const receipt = await tx.materialReceipt.create({
        data: {
          code,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          unit: material.unit.name,
          quantity: dto.quantity,
          supplierName: dto.supplierName?.trim() || null,
          note: dto.note?.trim() || null,
          createdBy: dto.createdBy?.trim() || null,
        },
      });

      await tx.warehouseTransaction.create({
        data: {
          direction: WarehouseDirection.IN,
          transactionType: WarehouseTransactionType.MATERIAL_RECEIPT,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          unit: material.unit.name,
          quantity: dto.quantity,
          materialReceiptId: receipt.id,
        },
      });

      await tx.material.update({
        where: { id: material.id },
        data: { currentStock: { increment: dto.quantity } },
      });

      return tx.materialReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        include: MATERIAL_RECEIPT_INCLUDE,
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // Read API (Task 04)
  // ─────────────────────────────────────────────────────

  async findAllMaterialReceipts(query: MaterialReceiptQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.MaterialReceiptWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { materialCode: { contains: query.search, mode: 'insensitive' } },
        { materialName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.materialId) {
      where.materialId = query.materialId;
    }

    const [data, total] = await Promise.all([
      this.prisma.materialReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.materialReceipt.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneMaterialReceipt(id: string) {
    const receipt = await this.prisma.materialReceipt.findUnique({
      where: { id },
      include: MATERIAL_RECEIPT_INCLUDE,
    });

    if (!receipt) {
      throw new NotFoundException('Phiếu nhập kho không tồn tại.');
    }

    return receipt;
  }

  async findAllTransactions(query: WarehouseTransactionQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseTransactionWhereInput = {};

    if (query.materialId) {
      where.materialId = query.materialId;
    }

    const validDirections = Object.values(WarehouseDirection) as string[];
    if (query.direction && validDirections.includes(query.direction)) {
      where.direction = query.direction as WarehouseDirection;
    }

    const validTypes = Object.values(WarehouseTransactionType) as string[];
    if (query.transactionType && validTypes.includes(query.transactionType)) {
      where.transactionType = query.transactionType as WarehouseTransactionType;
    }

    if (query.productionOrderId) {
      where.productionOrderId = query.productionOrderId;
    }

    const [data, total] = await Promise.all([
      this.prisma.warehouseTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warehouseTransaction.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCurrentStock(query: StockQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.MaterialWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          currentStock: true,
          isActive: true,
          unit: { select: { id: true, name: true } },
        },
      }),
      this.prisma.material.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────────────
  // Material Issue (Task 03) — không có Create API, chỉ gọi từ
  // ProductionOrderService.start(), trong cùng transaction (tx truyền vào).
  // ─────────────────────────────────────────────────────

  async issueForProductionOrder(
    productionOrderId: string,
    tx: Prisma.TransactionClient,
  ) {
    const items = await tx.productionOrderItem.findMany({
      where: { productionOrderId },
    });

    const salesOrderItemIds = items.map((item) => item.salesOrderItemId);
    if (salesOrderItemIds.length === 0) {
      return;
    }

    const boms = await tx.orderBOM.findMany({
      where: { salesOrderItemId: { in: salesOrderItemIds } },
      include: { items: true },
    });

    // Warehouse không tự tính định mức — đọc thẳng OrderBOMItem.quantity đã
    // snapshot từ lúc duyệt báo giá. Gộp theo materialId vì "cho từng vật tư"
    // (warehouse.md mục Material Issue), không phải theo từng dòng BOM.
    const materialQuantities = new Map<string, number>();
    for (const bom of boms) {
      for (const bomItem of bom.items) {
        const current = materialQuantities.get(bomItem.materialId) ?? 0;
        materialQuantities.set(
          bomItem.materialId,
          current + Number(bomItem.quantity),
        );
      }
    }

    for (const [materialId, quantity] of materialQuantities) {
      if (quantity <= 0) continue;

      const material = await tx.material.findUnique({
        where: { id: materialId },
        include: { unit: { select: { name: true } } },
      });

      if (!material) {
        throw new NotFoundException('Nguyên liệu không tồn tại.');
      }
      if (!material.isActive) {
        throw new BadRequestException(
          `Nguyên liệu "${material.name}" không còn hoạt động.`,
        );
      }
      if (Number(material.currentStock) < quantity) {
        throw new BadRequestException(
          `Không đủ tồn kho nguyên liệu "${material.name}". Tồn hiện tại: ${material.currentStock}, cần: ${quantity}.`,
        );
      }

      // Idempotency (Task 03/07): unique constraint DB [productionOrderId, materialId] —
      // nếu bị gọi lại (retry/concurrent), insert thứ hai sẽ vi phạm unique và làm
      // rollback toàn bộ transaction start().
      await tx.warehouseTransaction.create({
        data: {
          direction: WarehouseDirection.OUT,
          transactionType: WarehouseTransactionType.MATERIAL_ISSUE,
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          unit: material.unit.name,
          quantity,
          productionOrderId,
        },
      });

      await tx.material.update({
        where: { id: material.id },
        data: { currentStock: { decrement: quantity } },
      });
    }
  }
}
