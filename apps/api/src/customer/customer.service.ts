import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../shared/excel/excel.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerProductDiscountDto } from './dto/create-customer-product-discount.dto';
import { UpdateCustomerProductDiscountDto } from './dto/update-customer-product-discount.dto';
import { Prisma, SalesOrderStatus } from '@prisma/client';
import { OpeningBalanceService } from '../debt/opening-balance.service';
import { retryOnCodeConflict } from '../shared/retry-on-code-conflict';

const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH'];
const STATUS_VALUES = ['ACTIVE', 'INACTIVE'];

// Mặc định cho khách hàng mới khi không chọn/không điền (chốt 27/07/2026) —
// chỉ áp dụng lúc TẠO MỚI (form UI + API + dòng mới trong Excel import),
// không áp dụng khi cập nhật khách đã tồn tại qua import.
const DEFAULT_CUSTOMER_GROUP_NAME = 'Đại lý';
const DEFAULT_DEBT_LIMIT = 30_000_000;

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
    private readonly openingBalanceService: OpeningBalanceService,
  ) {}

  async findAll(query: CustomerQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.customerGroupId) {
      where.customerGroupId = query.customerGroupId;
    }

    if (query.deliveryRouteId) {
      where.deliveryRouteId = query.deliveryRouteId;
    }

    if (query.status === 'ACTIVE' || query.status === 'INACTIVE') {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          customerGroup: { select: { id: true, name: true } },
          deliveryRoute: { select: { id: true, name: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateCustomerDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Tên khách hàng là bắt buộc.');
    }
    if (!dto.phone?.trim()) {
      throw new BadRequestException('Số điện thoại là bắt buộc.');
    }
    if (dto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new BadRequestException('Email không đúng định dạng.');
    }
    if (dto.debtLimit !== undefined && dto.debtLimit < 0) {
      throw new BadRequestException('Hạn mức công nợ phải ≥ 0.');
    }
    if (dto.debtTermDays !== undefined && dto.debtTermDays < 0) {
      throw new BadRequestException('Thời hạn công nợ phải ≥ 0.');
    }

    const existingPhone = await this.prisma.customer.findFirst({
      where: { phone: dto.phone, deletedAt: null },
    });
    if (existingPhone) {
      throw new ConflictException('Số điện thoại đã tồn tại.');
    }

    const customerGroupId =
      dto.customerGroupId || (await this.getDefaultCustomerGroupId());

    return retryOnCodeConflict(async () => {
      const code = await this.generateCode('CUSTOMER');
      return this.prisma.customer.create({
        data: {
          code,
          name: dto.name.trim(),
          phone: dto.phone.trim(),
          email: dto.email?.trim() || null,
          companyName: dto.companyName?.trim() || null,
          taxCode: dto.taxCode?.trim() || null,
          province: dto.province?.trim() || null,
          district: dto.district?.trim() || null,
          ward: dto.ward?.trim() || null,
          address: dto.address?.trim() || null,
          customerGroupId,
          deliveryRouteId: dto.deliveryRouteId || null,
          saleId: dto.saleId || null,
          priority: dto.priority || 'MEDIUM',
          status: dto.status || 'ACTIVE',
          debtLimit: dto.debtLimit ?? DEFAULT_DEBT_LIMIT,
          debtTermDays: dto.debtTermDays ?? 30,
          note: dto.note?.trim() || null,
          defaultCarrierName: dto.defaultCarrierName?.trim() || null,
          defaultCarrierPhone: dto.defaultCarrierPhone?.trim() || null,
          defaultCarrierNote: dto.defaultCarrierNote?.trim() || null,
        },
        include: {
          customerGroup: { select: { id: true, name: true } },
          deliveryRoute: { select: { id: true, name: true } },
        },
      });
    });
  }

  private async getDefaultCustomerGroupId(): Promise<string | null> {
    const group = await this.prisma.customerGroup.findUnique({
      where: { name: DEFAULT_CUSTOMER_GROUP_NAME },
    });
    return group?.id ?? null;
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

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        customerGroup: { select: { id: true, name: true } },
        deliveryRoute: { select: { id: true, name: true } },
        sale: { select: { id: true, name: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException('Khách hàng không tồn tại.');
    }
    return customer;
  }

  // Công nợ hiện tại của khách hàng — tổng SUM(remainingAmount) các Receivable
  // thuộc SalesOrder chưa CANCELLED (theo đúng pattern debt.service.ts
  // notCancelledFilter). Dùng cho bản in Báo giá/Xác nhận đơn hàng — không có
  // khái niệm "Nợ đầu kỳ" cố định, luôn tính real-time (xem debt.md).
  async getDebtSummary(id: string) {
    await this.findOne(id);

    const [totals, openingBalance] = await Promise.all([
      this.prisma.receivable.aggregate({
        where: {
          customerId: id,
          salesOrder: { status: { not: SalesOrderStatus.CANCELLED } },
        },
        _sum: { remainingAmount: true },
      }),
      // opening-balance.md — cộng thêm Công nợ đầu kỳ còn mở của khách này,
      // dùng cho bản in Báo giá (khối "Công nợ cũ").
      this.openingBalanceService.sumOpenForCustomer(id),
    ]);

    return {
      totalRemaining:
        Number(totals._sum.remainingAmount ?? 0) + openingBalance.remaining,
    };
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);

    if (dto.name !== undefined && !dto.name?.trim()) {
      throw new BadRequestException('Tên khách hàng là bắt buộc.');
    }
    if (dto.phone !== undefined && !dto.phone?.trim()) {
      throw new BadRequestException('Số điện thoại là bắt buộc.');
    }
    if (dto.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      throw new BadRequestException('Email không đúng định dạng.');
    }
    if (dto.debtLimit !== undefined && dto.debtLimit < 0) {
      throw new BadRequestException('Hạn mức công nợ phải ≥ 0.');
    }
    if (dto.debtTermDays !== undefined && dto.debtTermDays < 0) {
      throw new BadRequestException('Thời hạn công nợ phải ≥ 0.');
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: { phone: dto.phone, deletedAt: null, id: { not: id } },
      });
      if (existingPhone) {
        throw new ConflictException('Số điện thoại đã tồn tại.');
      }
    }

    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim();
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.companyName !== undefined)
      data.companyName = dto.companyName?.trim() || null;
    if (dto.taxCode !== undefined) data.taxCode = dto.taxCode?.trim() || null;
    if (dto.province !== undefined)
      data.province = dto.province?.trim() || null;
    if (dto.district !== undefined)
      data.district = dto.district?.trim() || null;
    if (dto.ward !== undefined) data.ward = dto.ward?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.note !== undefined) data.note = dto.note?.trim() || null;
    if (dto.defaultCarrierName !== undefined)
      data.defaultCarrierName = dto.defaultCarrierName?.trim() || null;
    if (dto.defaultCarrierPhone !== undefined)
      data.defaultCarrierPhone = dto.defaultCarrierPhone?.trim() || null;
    if (dto.defaultCarrierNote !== undefined)
      data.defaultCarrierNote = dto.defaultCarrierNote?.trim() || null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.debtLimit !== undefined) data.debtLimit = dto.debtLimit;
    if (dto.debtTermDays !== undefined) data.debtTermDays = dto.debtTermDays;

    if (dto.customerGroupId !== undefined) {
      data.customerGroup = dto.customerGroupId
        ? { connect: { id: dto.customerGroupId } }
        : { disconnect: true };
    }
    if (dto.deliveryRouteId !== undefined) {
      data.deliveryRoute = dto.deliveryRouteId
        ? { connect: { id: dto.deliveryRouteId } }
        : { disconnect: true };
    }
    if (dto.saleId !== undefined) {
      data.sale = dto.saleId
        ? { connect: { id: dto.saleId } }
        : { disconnect: true };
    }

    return this.prisma.customer.update({
      where: { id },
      data,
      include: {
        customerGroup: { select: { id: true, name: true } },
        deliveryRoute: { select: { id: true, name: true } },
      },
    });
  }

  async softDelete(id: string) {
    const customer = await this.findOne(id);

    // Business Rule: không xóa KH đã phát sinh đơn hàng
    // (Khi có Module Order sẽ kiểm tra thêm ở đây)

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: { deletedAt: new Date() },
    });
  }

  async findDeleted(query: CustomerQueryDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      deletedAt: { not: null },
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          customerGroup: { select: { id: true, name: true } },
          deliveryRoute: { select: { id: true, name: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async restore(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer || !customer.deletedAt) {
      throw new NotFoundException('Khách hàng không tồn tại hoặc chưa bị xoá.');
    }

    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async findAllGroups() {
    return this.prisma.customerGroup.findMany({ orderBy: { name: 'asc' } });
  }

  async findAllRoutes() {
    return this.prisma.deliveryRoute.findMany({ orderBy: { name: 'asc' } });
  }

  async exportExcel(res: Response, query: CustomerQueryDto) {
    const where: Prisma.CustomerWhereInput = { deletedAt: null };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.customerGroupId) where.customerGroupId = query.customerGroupId;
    if (query.deliveryRouteId) where.deliveryRouteId = query.deliveryRouteId;
    if (query.status === 'ACTIVE' || query.status === 'INACTIVE')
      where.status = query.status;

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        customerGroup: { select: { name: true } },
        deliveryRoute: { select: { name: true } },
      },
    });

    const { groupNames, routeNames } = await this.getGroupRouteNames();

    const columns = [
      { header: 'Mã KH', key: 'code', width: 12 },
      { header: 'Tên khách hàng', key: 'name', width: 25 },
      // numFmt '@' — cột Text để Excel không cắt số 0 đầu khi người dùng sửa file.
      { header: 'Số điện thoại', key: 'phone', width: 15, numFmt: '@' },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Tỉnh/TP', key: 'province', width: 15 },
      { header: 'Quận/Huyện', key: 'district', width: 15 },
      { header: 'Phường/Xã', key: 'ward', width: 15 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      {
        header: 'Nhóm KH',
        key: 'groupName',
        width: 15,
        validationList: groupNames,
      },
      {
        header: 'Tuyến GH',
        key: 'routeName',
        width: 15,
        validationList: routeNames,
      },
      {
        header: 'Ưu tiên',
        key: 'priority',
        width: 10,
        validationList: PRIORITY_VALUES,
      },
      {
        header: 'Trạng thái',
        key: 'status',
        width: 12,
        validationList: STATUS_VALUES,
      },
      { header: 'Hạn mức CN', key: 'debtLimit', width: 15 },
      { header: 'Thời hạn CN (ngày)', key: 'debtTermDays', width: 18 },
      { header: 'Ghi chú', key: 'note', width: 30 },
      // 2 cột doanh nghiệp thêm CUỐI danh sách (chốt 08/07/2026) — giữ nguyên
      // thứ tự cột cũ để file import/export cũ không bị lệch cột.
      { header: 'Tên công ty', key: 'companyName', width: 25 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15, numFmt: '@' },
      // Thông tin nhà xe mặc định thêm CUỐI (chốt 24/07/2026) — cùng lý do
      // giữ tương thích file cũ.
      { header: 'Nhà xe', key: 'carrierName', width: 20 },
      { header: 'SĐT nhà xe', key: 'carrierPhone', width: 15, numFmt: '@' },
      { header: 'Ghi chú giao hàng', key: 'carrierNote', width: 25 },
    ];

    const rows = customers.map((c) => ({
      code: c.code,
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      companyName: c.companyName || '',
      taxCode: c.taxCode || '',
      province: c.province || '',
      district: c.district || '',
      ward: c.ward || '',
      address: c.address || '',
      groupName: c.customerGroup?.name || '',
      routeName: c.deliveryRoute?.name || '',
      priority: c.priority,
      status: c.status,
      debtLimit: Number(c.debtLimit),
      debtTermDays: c.debtTermDays,
      note: c.note || '',
      carrierName: c.defaultCarrierName || '',
      carrierPhone: c.defaultCarrierPhone || '',
      carrierNote: c.defaultCarrierNote || '',
    }));

    await this.excel.export(res, 'khach-hang', columns, rows);
  }

  // Xuất dữ liệu backup (report.md mục "Xuất dữ liệu backup", E4) — lọc theo
  // createdAt trong kỳ, cùng loại trừ deletedAt như exportExcel() (chốt
  // 28/07/2026: khách đã xoá mềm không đưa vào bản backup này).
  async getAllCustomersRaw(from: Date, to: Date) {
    return this.prisma.customer.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      include: {
        customerGroup: { select: { name: true } },
        deliveryRoute: { select: { name: true } },
      },
    });
  }

  private async getGroupRouteNames() {
    const [groups, routes] = await Promise.all([
      this.prisma.customerGroup.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.deliveryRoute.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return {
      groupNames: groups.map((g) => g.name),
      routeNames: routes.map((r) => r.name),
    };
  }

  async exportTemplate(res: Response) {
    const { groupNames, routeNames } = await this.getGroupRouteNames();

    const columns = [
      { header: 'Tên khách hàng *', key: 'name', width: 25 },
      // numFmt '@' — cột Text để Excel không cắt số 0 đầu khi nhập liệu.
      { header: 'Số điện thoại *', key: 'phone', width: 18, numFmt: '@' },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Tỉnh/TP', key: 'province', width: 15 },
      { header: 'Quận/Huyện', key: 'district', width: 15 },
      { header: 'Phường/Xã', key: 'ward', width: 15 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      {
        header: 'Nhóm KH',
        key: 'groupName',
        width: 15,
        validationList: groupNames,
      },
      {
        header: 'Tuyến GH',
        key: 'routeName',
        width: 15,
        validationList: routeNames,
      },
      {
        header: 'Ưu tiên',
        key: 'priority',
        width: 10,
        validationList: PRIORITY_VALUES,
      },
      {
        header: 'Trạng thái',
        key: 'status',
        width: 12,
        validationList: STATUS_VALUES,
      },
      { header: 'Hạn mức CN', key: 'debtLimit', width: 15 },
      { header: 'Thời hạn CN (ngày)', key: 'debtTermDays', width: 18 },
      { header: 'Ghi chú', key: 'note', width: 30 },
      // 2 cột doanh nghiệp thêm CUỐI (chốt 08/07/2026) — file theo template cũ
      // (15 cột) vẫn import được, 2 cột cuối coi như trống.
      { header: 'Tên công ty', key: 'companyName', width: 25 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15, numFmt: '@' },
      // Thông tin nhà xe mặc định thêm CUỐI (chốt 24/07/2026).
      { header: 'Nhà xe', key: 'carrierName', width: 20 },
      { header: 'SĐT nhà xe', key: 'carrierPhone', width: 15, numFmt: '@' },
      { header: 'Ghi chú giao hàng', key: 'carrierNote', width: 25 },
    ];

    const sampleRows = [
      {
        name: 'Nguyễn Văn A',
        phone: '0901000001',
        email: 'a@email.com',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng',
        address: '123 Cầu Giấy',
        groupName: 'Khách lẻ',
        routeName: 'Nội thành',
        priority: 'MEDIUM',
        status: 'ACTIVE',
        debtLimit: 50000000,
        debtTermDays: 30,
        note: '',
        companyName: '',
        taxCode: '',
        carrierName: '',
        carrierPhone: '',
        carrierNote: '',
      },
      {
        name: 'Trần Thị B',
        phone: '0901000002',
        email: '',
        province: 'Hải Phòng',
        district: '',
        ward: '',
        address: '',
        groupName: 'Đại lý',
        routeName: 'Liên tỉnh',
        priority: 'HIGH',
        status: 'ACTIVE',
        debtLimit: 0,
        debtTermDays: 30,
        note: 'Khách VIP',
        companyName: 'Công ty TNHH B',
        taxCode: '0101234567',
        carrierName: 'Nhà xe Thành Công',
        carrierPhone: '0912345678',
        carrierNote: 'Giao trước 10h sáng',
      },
    ];

    await this.excel.export(res, 'mau-import-khach-hang', columns, sampleRows);
  }

  // Nhãn hiển thị field cho bảng Preview import (chốt 24/07/2026) — field nào
  // không có trong map này (priority/status/debtLimit/debtTermDays) không
  // bao giờ xuất hiện trong changedFields vì không nằm trong SCALAR_MERGE_FIELDS.
  private readonly IMPORT_FIELD_LABELS: Record<string, string> = {
    email: 'Email',
    companyName: 'Tên công ty',
    taxCode: 'Mã số thuế',
    province: 'Tỉnh/TP',
    district: 'Quận/Huyện',
    ward: 'Phường/Xã',
    address: 'Địa chỉ',
    note: 'Ghi chú',
    defaultCarrierName: 'Nhà xe',
    defaultCarrierPhone: 'SĐT nhà xe',
    defaultCarrierNote: 'Ghi chú giao hàng',
    customerGroupId: 'Nhóm KH',
    deliveryRouteId: 'Tuyến GH',
  };

  // Tên cột chuẩn (không kèm dấu "*") — dùng để tra vị trí cột theo header
  // dòng 1 thay vì vị trí cố định, để cả file Xuất Excel (có thêm cột
  // "Mã KH" ở đầu) lẫn file Tải mẫu (không có cột đó) đều import đúng, không
  // bị lệch cột (sửa bug lệch cột giữa 2 loại file, chốt 06/08/2026).
  private readonly IMPORT_COLUMNS = {
    name: 'Tên khách hàng',
    phone: 'Số điện thoại',
    email: 'Email',
    province: 'Tỉnh/TP',
    district: 'Quận/Huyện',
    ward: 'Phường/Xã',
    address: 'Địa chỉ',
    groupName: 'Nhóm KH',
    routeName: 'Tuyến GH',
    priority: 'Ưu tiên',
    status: 'Trạng thái',
    debtLimit: 'Hạn mức CN',
    debtTermDays: 'Thời hạn CN (ngày)',
    note: 'Ghi chú',
    companyName: 'Tên công ty',
    taxCode: 'Mã số thuế',
    defaultCarrierName: 'Nhà xe',
    defaultCarrierPhone: 'SĐT nhà xe',
    defaultCarrierNote: 'Ghi chú giao hàng',
  } as const;

  // Parse + validate + so khớp DB — dùng chung cho Preview (chỉ đọc) và Import
  // thật (có ghi DB), đảm bảo preview thấy đúng những gì sẽ xảy ra (chốt
  // 24/07/2026). Mỗi dòng lỗi CHỈ bị bỏ qua riêng dòng đó, không chặn cả
  // file. SĐT trùng khách đã có trong DB (chưa xoá) → CẬP NHẬT thay vì báo
  // lỗi, nhưng chỉ điền field đang trống (không đè dữ liệu đã có).
  private async resolveImport(buffer: Buffer) {
    const sheet = await this.excel.readFile(buffer);
    const errors: { row: number; message: string }[] = [];
    const rowsData: {
      row: number;
      dto: CreateCustomerDto;
      groupName: string;
      routeName: string;
    }[] = [];

    // Header dòng 1 → vị trí cột. Cột bắt buộc trên file mẫu có hậu tố " *"
    // (VD "Tên khách hàng *") nên bỏ hậu tố này khi so khớp.
    const normalizeHeader = (v: unknown) =>
      String(v ?? '')
        .replace(/\s*\*\s*$/, '')
        .trim();
    const colIndex = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, col) => {
      colIndex.set(normalizeHeader(cell.value), col);
    });
    const colOf = (label: string) => colIndex.get(label);
    const C = this.IMPORT_COLUMNS;

    if (!colOf(C.name) || !colOf(C.phone)) {
      errors.push({
        row: 0,
        message:
          'File không đúng cấu trúc (thiếu cột "Tên khách hàng" hoặc "Số điện thoại"). Vui lòng dùng file mẫu hoặc file Xuất Excel.',
      });
      return { errors, toCreate: [], toUpdate: [] };
    }

    const allGroups = await this.prisma.customerGroup.findMany();
    const allRoutes = await this.prisma.deliveryRoute.findMany();
    const groupMap = new Map(allGroups.map((g) => [g.name, g.id]));
    const routeMap = new Map(allRoutes.map((r) => [r.name, r.id]));

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cell = (label: string) => {
        const col = colOf(label);
        return col ? String(row.getCell(col).value || '').trim() : '';
      };
      const numCell = (label: string) => {
        const col = colOf(label);
        if (!col) return undefined;
        const v = row.getCell(col).value;
        return v !== null && v !== undefined && v !== ''
          ? Number(v)
          : undefined;
      };
      // SĐT: Excel định dạng số tự cắt số 0 đầu (0901... → 901...). Chuẩn hoá:
      // bỏ khoảng trắng/ký tự phân tách, nếu còn 9-10 chữ số không bắt đầu
      // bằng 0 (bị Excel cắt) → thêm lại "0" (testlan1 mục Khách hàng).
      const phoneCell = (label: string) => {
        let s = cell(label).replace(/[\s.\-()]/g, '');
        if (/^[1-9]\d{8,9}$/.test(s)) s = '0' + s;
        return s;
      };

      // Bỏ qua dòng hoàn toàn trống (VD dòng thừa cuối file mẫu).
      if (
        row.values === undefined ||
        (Array.isArray(row.values) &&
          row.values.every((v) => v === null || v === undefined || v === ''))
      ) {
        return;
      }

      const name = cell(C.name);
      const phone = phoneCell(C.phone);
      const email = cell(C.email) || undefined;
      const groupName = cell(C.groupName);
      const routeName = cell(C.routeName);
      const priority = cell(C.priority).toUpperCase() || undefined;
      const status = cell(C.status).toUpperCase() || undefined;
      const debtLimit = numCell(C.debtLimit);
      const debtTermDays = numCell(C.debtTermDays);
      const companyName = cell(C.companyName) || undefined;
      // MST VN 10 số thường bắt đầu bằng 0 (mã tỉnh) — Excel cắt như SĐT.
      let taxCode: string | undefined =
        cell(C.taxCode).replace(/\s/g, '') || undefined;
      if (taxCode && /^\d{9}$/.test(taxCode)) taxCode = '0' + taxCode;
      const defaultCarrierName = cell(C.defaultCarrierName) || undefined;
      const defaultCarrierPhone = phoneCell(C.defaultCarrierPhone) || undefined;
      const defaultCarrierNote = cell(C.defaultCarrierNote) || undefined;

      if (!name) {
        errors.push({ row: rowNumber, message: 'Tên khách hàng là bắt buộc.' });
        return;
      }
      if (!phone) {
        errors.push({ row: rowNumber, message: 'Số điện thoại là bắt buộc.' });
        return;
      }
      // 10 số di động hoặc 11 số cố định, bắt đầu bằng 0.
      if (!/^0\d{9,10}$/.test(phone)) {
        errors.push({
          row: rowNumber,
          message: `Số điện thoại "${phone}" không hợp lệ (cần 10-11 chữ số, bắt đầu bằng 0).`,
        });
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({
          row: rowNumber,
          message: `Email "${email}" không đúng định dạng.`,
        });
        return;
      }
      if (groupName && !groupMap.has(groupName)) {
        errors.push({
          row: rowNumber,
          message: `Nhóm KH "${groupName}" không tồn tại.`,
        });
        return;
      }
      if (routeName && !routeMap.has(routeName)) {
        errors.push({
          row: rowNumber,
          message: `Tuyến GH "${routeName}" không tồn tại.`,
        });
        return;
      }
      if (priority && !PRIORITY_VALUES.includes(priority)) {
        errors.push({
          row: rowNumber,
          message: `Ưu tiên "${priority}" không hợp lệ (LOW/MEDIUM/HIGH).`,
        });
        return;
      }
      if (status && !STATUS_VALUES.includes(status)) {
        errors.push({
          row: rowNumber,
          message: `Trạng thái "${status}" không hợp lệ (ACTIVE/INACTIVE).`,
        });
        return;
      }
      if (debtLimit !== undefined && Number.isNaN(debtLimit)) {
        errors.push({
          row: rowNumber,
          message: `Hạn mức công nợ "${cell(C.debtLimit)}" không hợp lệ (phải là số).`,
        });
        return;
      }
      if (debtTermDays !== undefined && Number.isNaN(debtTermDays)) {
        errors.push({
          row: rowNumber,
          message: `Thời hạn công nợ "${cell(C.debtTermDays)}" không hợp lệ (phải là số).`,
        });
        return;
      }

      rowsData.push({
        row: rowNumber,
        groupName,
        routeName,
        dto: {
          name,
          phone,
          email,
          province: cell(C.province) || undefined,
          district: cell(C.district) || undefined,
          ward: cell(C.ward) || undefined,
          address: cell(C.address) || undefined,
          customerGroupId: groupName ? groupMap.get(groupName) : undefined,
          deliveryRouteId: routeName ? routeMap.get(routeName) : undefined,
          priority: (priority as 'LOW' | 'MEDIUM' | 'HIGH') || undefined,
          status: (status as 'ACTIVE' | 'INACTIVE') || undefined,
          debtLimit,
          debtTermDays,
          note: cell(C.note) || undefined,
          companyName,
          taxCode,
          defaultCarrierName,
          defaultCarrierPhone,
          defaultCarrierNote,
        },
      });
    });

    // SĐT trùng trong cùng file — giữ dòng đầu tiên, các dòng sau bị bỏ qua.
    const seenPhones = new Map<string, number>();
    const uniqueRows: typeof rowsData = [];
    for (const item of rowsData) {
      const firstRow = seenPhones.get(item.dto.phone);
      if (firstRow !== undefined) {
        errors.push({
          row: item.row,
          message: `Số điện thoại "${item.dto.phone}" trùng với dòng ${firstRow} trong file.`,
        });
        continue;
      }
      seenPhones.set(item.dto.phone, item.row);
      uniqueRows.push(item);
    }

    const existingCustomers = await this.prisma.customer.findMany({
      where: {
        phone: { in: uniqueRows.map((r) => r.dto.phone) },
        deletedAt: null,
      },
    });
    const existingByPhone = new Map(existingCustomers.map((c) => [c.phone, c]));

    // Field cho phép merge khi cập nhật khách đã tồn tại — chỉ điền field
    // đang trống, không đè dữ liệu đã có (chốt 24/07/2026). Không gồm
    // priority/status/debtLimit/debtTermDays vì các field này luôn có giá
    // trị mặc định sẵn (không bao giờ "trống"), tránh import sửa nhầm hạn
    // mức công nợ.
    const SCALAR_MERGE_FIELDS = [
      'email',
      'companyName',
      'taxCode',
      'province',
      'district',
      'ward',
      'address',
      'note',
      'defaultCarrierName',
      'defaultCarrierPhone',
      'defaultCarrierNote',
    ] as const;

    const toCreate: { row: number; dto: CreateCustomerDto }[] = [];
    const toUpdate: {
      row: number;
      dto: CreateCustomerDto;
      existingId: string;
      updateData: Prisma.CustomerUpdateInput;
      changedFields: { label: string; newValue: string }[];
    }[] = [];

    for (const { row, dto, groupName, routeName } of uniqueRows) {
      const existing = existingByPhone.get(dto.phone);

      if (existing) {
        const updateData: Prisma.CustomerUpdateInput = {};
        const changedFields: { label: string; newValue: string }[] = [];
        for (const field of SCALAR_MERGE_FIELDS) {
          const current = existing[field];
          const incoming = dto[field];
          if ((current === null || current === undefined) && incoming) {
            (updateData as Record<string, unknown>)[field] = incoming;
            changedFields.push({
              label: this.IMPORT_FIELD_LABELS[field],
              newValue: String(incoming),
            });
          }
        }
        if (!existing.customerGroupId && dto.customerGroupId) {
          updateData.customerGroup = { connect: { id: dto.customerGroupId } };
          changedFields.push({ label: 'Nhóm KH', newValue: groupName });
        }
        if (!existing.deliveryRouteId && dto.deliveryRouteId) {
          updateData.deliveryRoute = { connect: { id: dto.deliveryRouteId } };
          changedFields.push({ label: 'Tuyến GH', newValue: routeName });
        }
        toUpdate.push({
          row,
          dto,
          existingId: existing.id,
          updateData,
          changedFields,
        });
      } else {
        toCreate.push({ row, dto });
      }
    }

    return { errors, toCreate, toUpdate };
  }

  // Preview import (chốt 24/07/2026) — chạy toàn bộ logic thật (validate +
  // so khớp DB) nhưng KHÔNG ghi DB, để người dùng thấy trước chính xác dòng
  // nào tạo mới, dòng nào cập nhật (kèm field nào sẽ được điền) trước khi
  // bấm xác nhận.
  async previewImportExcel(buffer: Buffer) {
    const { errors, toCreate, toUpdate } = await this.resolveImport(buffer);

    const items = [
      ...toCreate.map((r) => ({
        row: r.row,
        action: 'create' as const,
        name: r.dto.name,
        phone: r.dto.phone,
        changedFields: [],
      })),
      ...toUpdate.map((r) => ({
        row: r.row,
        action: 'update' as const,
        name: r.dto.name,
        phone: r.dto.phone,
        changedFields: r.changedFields,
      })),
    ].sort((a, b) => a.row - b.row);

    return {
      toCreate: toCreate.length,
      toUpdate: toUpdate.length,
      errors,
      items,
    };
  }

  // Bọc toàn bộ ghi DB (update + create) trong 1 transaction (chốt 12/08/2026,
  // cùng pattern applyMaterialImport()) — nếu 1 dòng lỗi giữa chừng (vd DB
  // constraint không bắt được ở bước validate), các dòng trước đó trong cùng
  // lượt import không bị kẹt lại nửa vời.
  async importExcel(buffer: Buffer) {
    const { errors, toCreate, toUpdate } = await this.resolveImport(buffer);

    const { created, updated } = await this.prisma.$transaction(
      async (tx) => {
        for (const { existingId, updateData } of toUpdate) {
          if (Object.keys(updateData).length > 0) {
            await tx.customer.update({
              where: { id: existingId },
              data: updateData,
            });
          }
        }

        const defaultGroupId = toCreate.length
          ? await this.getDefaultCustomerGroupId()
          : null;

        for (const { dto } of toCreate) {
          await retryOnCodeConflict(async () => {
            const code = await this.generateCode('CUSTOMER');
            return tx.customer.create({
              data: {
                code,
                name: dto.name,
                phone: dto.phone,
                email: dto.email || null,
                companyName: dto.companyName || null,
                taxCode: dto.taxCode || null,
                province: dto.province || null,
                district: dto.district || null,
                ward: dto.ward || null,
                address: dto.address || null,
                customerGroupId: dto.customerGroupId || defaultGroupId,
                deliveryRouteId: dto.deliveryRouteId || null,
                priority: dto.priority || 'MEDIUM',
                status: dto.status || 'ACTIVE',
                debtLimit: dto.debtLimit ?? DEFAULT_DEBT_LIMIT,
                debtTermDays: dto.debtTermDays ?? 30,
                note: dto.note || null,
                defaultCarrierName: dto.defaultCarrierName || null,
                defaultCarrierPhone: dto.defaultCarrierPhone || null,
                defaultCarrierNote: dto.defaultCarrierNote || null,
              },
            });
          });
        }

        return { created: toCreate.length, updated: toUpdate.length };
      },
      { timeout: 30000 },
    );

    return { created, updated, errors };
  }

  // ──────────────────────────────────────
  // Chiết khấu theo Khách hàng × Sản phẩm (Sprint 04, chốt 16/07/2026)
  // ──────────────────────────────────────

  async findProductDiscounts(customerId: string) {
    await this.findOne(customerId);
    return this.prisma.customerProductDiscount.findMany({
      where: { customerId },
      include: { productType: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProductDiscount(
    customerId: string,
    dto: CreateCustomerProductDiscountDto,
  ) {
    await this.findOne(customerId);

    if (!dto.productTypeId) {
      throw new BadRequestException('Loại sản phẩm là bắt buộc.');
    }
    if (
      dto.discountPercent === undefined ||
      dto.discountPercent < 0 ||
      dto.discountPercent > 100
    ) {
      throw new BadRequestException('Chiết khấu phải từ 0 đến 100.');
    }

    const productType = await this.prisma.productType.findUnique({
      where: { id: dto.productTypeId },
    });
    if (!productType) {
      throw new NotFoundException('Loại sản phẩm không tồn tại.');
    }

    const existing = await this.prisma.customerProductDiscount.findUnique({
      where: {
        customerId_productTypeId: {
          customerId,
          productTypeId: dto.productTypeId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Loại sản phẩm này đã được cấu hình chiết khấu.',
      );
    }

    return this.prisma.customerProductDiscount.create({
      data: {
        customerId,
        productTypeId: dto.productTypeId,
        discountPercent: dto.discountPercent,
      },
      include: { productType: { select: { id: true, name: true } } },
    });
  }

  async updateProductDiscount(
    customerId: string,
    id: string,
    dto: UpdateCustomerProductDiscountDto,
  ) {
    const discount = await this.prisma.customerProductDiscount.findFirst({
      where: { id, customerId },
    });
    if (!discount) {
      throw new NotFoundException('Cấu hình chiết khấu không tồn tại.');
    }
    if (
      dto.discountPercent === undefined ||
      dto.discountPercent < 0 ||
      dto.discountPercent > 100
    ) {
      throw new BadRequestException('Chiết khấu phải từ 0 đến 100.');
    }

    return this.prisma.customerProductDiscount.update({
      where: { id },
      data: { discountPercent: dto.discountPercent },
      include: { productType: { select: { id: true, name: true } } },
    });
  }

  async deleteProductDiscount(customerId: string, id: string) {
    const discount = await this.prisma.customerProductDiscount.findFirst({
      where: { id, customerId },
    });
    if (!discount) {
      throw new NotFoundException('Cấu hình chiết khấu không tồn tại.');
    }
    return this.prisma.customerProductDiscount.delete({ where: { id } });
  }

  // Lookup dùng khi thêm dòng báo giá — nhận productId (sản phẩm đang chọn),
  // tự suy ra productTypeId để tìm cấu hình. 0% nếu chưa cấu hình (không throw).
  async lookupProductDiscount(customerId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { productTypeId: true },
    });
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại.');
    }

    const discount = await this.prisma.customerProductDiscount.findUnique({
      where: {
        customerId_productTypeId: {
          customerId,
          productTypeId: product.productTypeId,
        },
      },
    });
    return { discountPercent: discount ? Number(discount.discountPercent) : 0 };
  }

  // ─────────────────────────────────────────────────────
  // Report (Module Báo cáo, 014-bao-cao.md Task 00) — phần "khách mới trong
  // kỳ" của C2, mốc ngày Customer.createdAt.
  // ─────────────────────────────────────────────────────

  async getNewCustomersInRange(from: Date, to: Date) {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      createdAt: { gte: from, lte: to },
    };

    const [count, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          createdAt: true,
        },
      }),
    ]);

    return { count, customers };
  }
}
