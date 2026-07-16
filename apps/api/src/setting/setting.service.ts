import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SettingValueType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateRunningNumberDto } from './dto/update-running-number.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────
  // Company Settings (Task 01) — Singleton, không Create/Delete.
  // ─────────────────────────────────────────────────────

  async getCompany() {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException('Company Settings chưa được khởi tạo.');
    }
    return company;
  }

  async updateCompany(dto: UpdateCompanyDto) {
    const company = await this.getCompany();

    if (dto.companyName !== undefined && !dto.companyName.trim()) {
      throw new BadRequestException('Tên công ty là bắt buộc.');
    }

    return this.prisma.company.update({
      where: { id: company.id },
      data: {
        companyName: dto.companyName?.trim() ?? undefined,
        logo: dto.logo !== undefined ? dto.logo?.trim() || null : undefined,
        address:
          dto.address !== undefined ? dto.address?.trim() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
        email: dto.email !== undefined ? dto.email?.trim() || null : undefined,
        website:
          dto.website !== undefined ? dto.website?.trim() || null : undefined,
        taxCode:
          dto.taxCode !== undefined ? dto.taxCode?.trim() || null : undefined,
        currency: dto.currency?.trim() ?? undefined,
        currencySymbol: dto.currencySymbol?.trim() ?? undefined,
        timezone: dto.timezone?.trim() ?? undefined,
      },
    });
  }

  // ─────────────────────────────────────────────────────
  // Running Number (Task 02) — sửa prefix/paddingLength/enabled.
  // Không sửa lastNumber. Không Reset. Không Delete.
  // ─────────────────────────────────────────────────────

  async findAllRunningNumbers() {
    return this.prisma.runningNumber.findMany({ orderBy: { type: 'asc' } });
  }

  async updateRunningNumber(type: string, dto: UpdateRunningNumberDto) {
    const runningNumber = await this.prisma.runningNumber.findUnique({
      where: { type },
    });
    if (!runningNumber) {
      throw new NotFoundException(`Running Number "${type}" không tồn tại.`);
    }

    if (dto.prefix !== undefined && !dto.prefix.trim()) {
      throw new BadRequestException('Prefix là bắt buộc.');
    }
    if (dto.paddingLength !== undefined && dto.paddingLength <= 0) {
      throw new BadRequestException('Padding Length phải lớn hơn 0.');
    }

    return this.prisma.runningNumber.update({
      where: { type },
      data: {
        prefix: dto.prefix?.trim() ?? undefined,
        paddingLength: dto.paddingLength ?? undefined,
        enabled: dto.enabled ?? undefined,
      },
    });
  }

  // ─────────────────────────────────────────────────────
  // Setting Engine (Task 03) — key-value CRUD dùng chung cho
  // Dashboard/Notification/Document/Security/Backup Settings.
  // Không Create key mới qua API — chỉ Update giá trị của key đã seed sẵn.
  // Không Delete.
  // ─────────────────────────────────────────────────────

  async findAllSettings() {
    return this.prisma.setting.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    });
  }

  async findSettingsByModule(module: string) {
    return this.prisma.setting.findMany({
      where: { module },
      orderBy: { key: 'asc' },
    });
  }

  async updateSettingsByModule(module: string, dto: UpdateSettingDto) {
    if (!dto.values || Object.keys(dto.values).length === 0) {
      throw new BadRequestException('Không có giá trị nào để cập nhật.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const [key, rawValue] of Object.entries(dto.values)) {
        const setting = await tx.setting.findUnique({
          where: { module_key: { module, key } },
        });
        if (!setting) {
          throw new NotFoundException(
            `Setting "${module}.${key}" không tồn tại.`,
          );
        }

        const value = this.serializeValue(setting.valueType, rawValue);

        await tx.setting.update({
          where: { module_key: { module, key } },
          data: { value },
        });
      }

      return tx.setting.findMany({
        where: { module },
        orderBy: { key: 'asc' },
      });
    });
  }

  private serializeValue(
    valueType: SettingValueType,
    rawValue: string | number | boolean,
  ): string {
    switch (valueType) {
      case SettingValueType.BOOLEAN: {
        if (typeof rawValue === 'boolean') return String(rawValue);
        if (rawValue === 'true' || rawValue === 'false') return rawValue;
        throw new BadRequestException(
          `Giá trị phải là boolean (true/false), nhận được "${rawValue}".`,
        );
      }
      case SettingValueType.NUMBER: {
        const n = Number(rawValue);
        if (!Number.isFinite(n)) {
          throw new BadRequestException(
            `Giá trị phải là số, nhận được "${rawValue}".`,
          );
        }
        return String(n);
      }
      case SettingValueType.STRING:
      case SettingValueType.TEXT:
        return String(rawValue);
      default:
        return String(rawValue);
    }
  }

  // ─────────────────────────────────────────────────────
  // Đọc giá trị Setting cho Module khác (Debt/Dashboard/Print...) — luôn qua
  // SettingService, không tự query bảng Setting (setting.md "Module Dependencies").
  // ─────────────────────────────────────────────────────

  async getValue(module: string, key: string): Promise<string> {
    const setting = await this.prisma.setting.findUnique({
      where: { module_key: { module, key } },
    });
    if (!setting) {
      throw new NotFoundException(`Setting "${module}.${key}" không tồn tại.`);
    }
    return setting.value;
  }

  async getNumberValue(module: string, key: string): Promise<number> {
    const raw = await this.getValue(module, key);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  async getBooleanValue(module: string, key: string): Promise<boolean> {
    const raw = await this.getValue(module, key);
    return raw === 'true';
  }
}
