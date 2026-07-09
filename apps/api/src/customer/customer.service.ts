import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../shared/excel/excel.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ExcelService,
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
        orderBy: { createdAt: 'desc' },
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
    if (dto.defaultDiscount !== undefined && (dto.defaultDiscount < 0 || dto.defaultDiscount > 100)) {
      throw new BadRequestException('Chiết khấu phải từ 0 đến 100.');
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
        customerGroupId: dto.customerGroupId || null,
        deliveryRouteId: dto.deliveryRouteId || null,
        saleId: dto.saleId || null,
        priority: dto.priority || 'MEDIUM',
        status: dto.status || 'ACTIVE',
        defaultDiscount: dto.defaultDiscount ?? 0,
        debtLimit: dto.debtLimit ?? 0,
        debtTermDays: dto.debtTermDays ?? 30,
        note: dto.note?.trim() || null,
      },
      include: {
        customerGroup: { select: { id: true, name: true } },
        deliveryRoute: { select: { id: true, name: true } },
      },
    });
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
    if (dto.defaultDiscount !== undefined && (dto.defaultDiscount < 0 || dto.defaultDiscount > 100)) {
      throw new BadRequestException('Chiết khấu phải từ 0 đến 100.');
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
    if (dto.companyName !== undefined) data.companyName = dto.companyName?.trim() || null;
    if (dto.taxCode !== undefined) data.taxCode = dto.taxCode?.trim() || null;
    if (dto.province !== undefined) data.province = dto.province?.trim() || null;
    if (dto.district !== undefined) data.district = dto.district?.trim() || null;
    if (dto.ward !== undefined) data.ward = dto.ward?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.note !== undefined) data.note = dto.note?.trim() || null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.defaultDiscount !== undefined) data.defaultDiscount = dto.defaultDiscount;
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
    if (query.status === 'ACTIVE' || query.status === 'INACTIVE') where.status = query.status;

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        customerGroup: { select: { name: true } },
        deliveryRoute: { select: { name: true } },
      },
    });

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
      { header: 'Nhóm KH', key: 'groupName', width: 15 },
      { header: 'Tuyến GH', key: 'routeName', width: 15 },
      { header: 'Ưu tiên', key: 'priority', width: 10 },
      { header: 'Trạng thái', key: 'status', width: 12 },
      { header: 'Chiết khấu (%)', key: 'defaultDiscount', width: 14 },
      { header: 'Hạn mức CN', key: 'debtLimit', width: 15 },
      { header: 'Thời hạn CN (ngày)', key: 'debtTermDays', width: 18 },
      { header: 'Ghi chú', key: 'note', width: 30 },
      // 2 cột doanh nghiệp thêm CUỐI danh sách (chốt 08/07/2026) — giữ nguyên
      // thứ tự cột cũ để file import/export cũ không bị lệch cột.
      { header: 'Tên công ty', key: 'companyName', width: 25 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15, numFmt: '@' },
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
      defaultDiscount: Number(c.defaultDiscount),
      debtLimit: Number(c.debtLimit),
      debtTermDays: c.debtTermDays,
      note: c.note || '',
    }));

    await this.excel.export(res, 'khach-hang', columns, rows);
  }

  async exportTemplate(res: Response) {
    const columns = [
      { header: 'Tên khách hàng *', key: 'name', width: 25 },
      // numFmt '@' — cột Text để Excel không cắt số 0 đầu khi nhập liệu.
      { header: 'Số điện thoại *', key: 'phone', width: 18, numFmt: '@' },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Tỉnh/TP', key: 'province', width: 15 },
      { header: 'Quận/Huyện', key: 'district', width: 15 },
      { header: 'Phường/Xã', key: 'ward', width: 15 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      { header: 'Nhóm KH', key: 'groupName', width: 15 },
      { header: 'Tuyến GH', key: 'routeName', width: 15 },
      { header: 'Ưu tiên', key: 'priority', width: 10 },
      { header: 'Trạng thái', key: 'status', width: 12 },
      { header: 'Chiết khấu (%)', key: 'defaultDiscount', width: 14 },
      { header: 'Hạn mức CN', key: 'debtLimit', width: 15 },
      { header: 'Thời hạn CN (ngày)', key: 'debtTermDays', width: 18 },
      { header: 'Ghi chú', key: 'note', width: 30 },
      // 2 cột doanh nghiệp thêm CUỐI (chốt 08/07/2026) — file theo template cũ
      // (15 cột) vẫn import được, 2 cột cuối coi như trống.
      { header: 'Tên công ty', key: 'companyName', width: 25 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15, numFmt: '@' },
    ];

    const sampleRows = [
      { name: 'Nguyễn Văn A', phone: '0901000001', email: 'a@email.com', province: 'Hà Nội', district: 'Cầu Giấy', ward: 'Dịch Vọng', address: '123 Cầu Giấy', groupName: 'Khách lẻ', routeName: 'Nội thành', priority: 'MEDIUM', status: 'ACTIVE', defaultDiscount: 5, debtLimit: 50000000, debtTermDays: 30, note: '', companyName: '', taxCode: '' },
      { name: 'Trần Thị B', phone: '0901000002', email: '', province: 'Hải Phòng', district: '', ward: '', address: '', groupName: 'Đại lý', routeName: 'Liên tỉnh', priority: 'HIGH', status: 'ACTIVE', defaultDiscount: 0, debtLimit: 0, debtTermDays: 30, note: 'Khách VIP', companyName: 'Công ty TNHH B', taxCode: '0101234567', },
    ];

    await this.excel.export(res, 'mau-import-khach-hang', columns, sampleRows);
  }

  async importExcel(buffer: Buffer) {
    const sheet = await this.excel.readFile(buffer);
    const errors: { row: number; message: string }[] = [];
    const toCreate: CreateCustomerDto[] = [];

    const allGroups = await this.prisma.customerGroup.findMany();
    const allRoutes = await this.prisma.deliveryRoute.findMany();
    const groupMap = new Map(allGroups.map((g) => [g.name, g.id]));
    const routeMap = new Map(allRoutes.map((r) => [r.name, r.id]));

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
    const validStatuses = ['ACTIVE', 'INACTIVE'];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const cell = (col: number) => String(row.getCell(col).value || '').trim();
      const numCell = (col: number) => {
        const v = row.getCell(col).value;
        return v !== null && v !== undefined && v !== '' ? Number(v) : undefined;
      };
      // SĐT: Excel định dạng số tự cắt số 0 đầu (0901... → 901...). Chuẩn hoá:
      // bỏ khoảng trắng/ký tự phân tách, nếu còn 9-10 chữ số không bắt đầu
      // bằng 0 (bị Excel cắt) → thêm lại "0" (testlan1 mục Khách hàng).
      const phoneCell = (col: number) => {
        let s = cell(col).replace(/[\s.\-()]/g, '');
        if (/^[1-9]\d{8,9}$/.test(s)) s = '0' + s;
        return s;
      };

      const name = cell(1);
      const phone = phoneCell(2);
      const email = cell(3) || undefined;
      const groupName = cell(8);
      const routeName = cell(9);
      const priority = cell(10).toUpperCase() || undefined;
      const status = cell(11).toUpperCase() || undefined;
      const defaultDiscount = numCell(12);
      const debtLimit = numCell(13);
      const debtTermDays = numCell(14);
      const companyName = cell(16) || undefined;
      // MST VN 10 số thường bắt đầu bằng 0 (mã tỉnh) — Excel cắt như SĐT.
      let taxCode: string | undefined = cell(17).replace(/\s/g, '') || undefined;
      if (taxCode && /^\d{9}$/.test(taxCode)) taxCode = '0' + taxCode;

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
        errors.push({ row: rowNumber, message: `Email "${email}" không đúng định dạng.` });
        return;
      }
      if (groupName && !groupMap.has(groupName)) {
        errors.push({ row: rowNumber, message: `Nhóm KH "${groupName}" không tồn tại.` });
        return;
      }
      if (routeName && !routeMap.has(routeName)) {
        errors.push({ row: rowNumber, message: `Tuyến GH "${routeName}" không tồn tại.` });
        return;
      }
      if (priority && !validPriorities.includes(priority)) {
        errors.push({ row: rowNumber, message: `Ưu tiên "${priority}" không hợp lệ (LOW/MEDIUM/HIGH).` });
        return;
      }
      if (status && !validStatuses.includes(status)) {
        errors.push({ row: rowNumber, message: `Trạng thái "${status}" không hợp lệ (ACTIVE/INACTIVE).` });
        return;
      }
      if (defaultDiscount !== undefined && (defaultDiscount < 0 || defaultDiscount > 100)) {
        errors.push({ row: rowNumber, message: 'Chiết khấu phải từ 0 đến 100.' });
        return;
      }

      toCreate.push({
        name,
        phone,
        email,
        province: cell(4) || undefined,
        district: cell(5) || undefined,
        ward: cell(6) || undefined,
        address: cell(7) || undefined,
        customerGroupId: groupName ? groupMap.get(groupName) : undefined,
        deliveryRouteId: routeName ? routeMap.get(routeName) : undefined,
        priority: (priority as 'LOW' | 'MEDIUM' | 'HIGH') || undefined,
        status: (status as 'ACTIVE' | 'INACTIVE') || undefined,
        defaultDiscount,
        debtLimit,
        debtTermDays,
        note: cell(15) || undefined,
        companyName,
        taxCode,
      });
    });

    if (errors.length > 0) {
      return { success: 0, errors };
    }

    // Check duplicate phones in file
    const phones = toCreate.map((c) => c.phone);
    const uniquePhones = new Set(phones);
    if (uniquePhones.size !== phones.length) {
      const duplicates = phones.filter((p, i) => phones.indexOf(p) !== i);
      return {
        success: 0,
        errors: [{ row: 0, message: `Số điện thoại trùng trong file: ${[...new Set(duplicates)].join(', ')}` }],
      };
    }

    // Check against database
    const existingCustomers = await this.prisma.customer.findMany({
      where: { phone: { in: phones }, deletedAt: null },
      select: { phone: true },
    });
    if (existingCustomers.length > 0) {
      return {
        success: 0,
        errors: existingCustomers.map((c) => ({
          row: 0,
          message: `Số điện thoại "${c.phone}" đã tồn tại trong hệ thống.`,
        })),
      };
    }

    let created = 0;
    for (const dto of toCreate) {
      const code = await this.generateCode('CUSTOMER');
      await this.prisma.customer.create({
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
          customerGroupId: dto.customerGroupId || null,
          deliveryRouteId: dto.deliveryRouteId || null,
          priority: dto.priority || 'MEDIUM',
          status: dto.status || 'ACTIVE',
          defaultDiscount: dto.defaultDiscount ?? 0,
          debtLimit: dto.debtLimit ?? 0,
          debtTermDays: dto.debtTermDays ?? 30,
          note: dto.note || null,
        },
      });
      created++;
    }

    return { success: created, errors: [] };
  }
}
