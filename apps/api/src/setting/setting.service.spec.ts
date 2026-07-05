import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingService } from './setting.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingService', () => {
  let service: SettingService;
  let prisma: {
    company: { findFirst: jest.Mock; update: jest.Mock };
    runningNumber: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    setting: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      company: { findFirst: jest.fn(), update: jest.fn() },
      runningNumber: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      setting: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SettingService>(SettingService);
  });

  describe('Company Settings (Task 01) — Singleton', () => {
    it('throws NotFoundException when Company is not seeded', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.getCompany()).rejects.toThrow(NotFoundException);
    });

    it('rejects empty companyName on update', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', companyName: 'ERP Engine' });
      await expect(service.updateCompany({ companyName: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('updates the single existing Company row by id (no Create)', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', companyName: 'ERP Engine' });
      prisma.company.update.mockResolvedValue({ id: 'company-1', companyName: 'New Name' });

      await service.updateCompany({ companyName: 'New Name' });

      expect(prisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'company-1' } }),
      );
    });
  });

  describe('Running Number (Task 02) — không sửa lastNumber', () => {
    it('throws NotFoundException for unknown type', async () => {
      prisma.runningNumber.findUnique.mockResolvedValue(null);
      await expect(service.updateRunningNumber('UNKNOWN', { prefix: 'XX' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects empty prefix', async () => {
      prisma.runningNumber.findUnique.mockResolvedValue({ type: 'PAYMENT', prefix: 'PT' });
      await expect(service.updateRunningNumber('PAYMENT', { prefix: '  ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects paddingLength <= 0', async () => {
      prisma.runningNumber.findUnique.mockResolvedValue({ type: 'PAYMENT', prefix: 'PT' });
      await expect(
        service.updateRunningNumber('PAYMENT', { paddingLength: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('only updates prefix/paddingLength/enabled — never lastNumber, even if smuggled in', async () => {
      prisma.runningNumber.findUnique.mockResolvedValue({ type: 'PAYMENT', prefix: 'PT' });
      prisma.runningNumber.update.mockResolvedValue({ type: 'PAYMENT', prefix: 'XX' });

      await service.updateRunningNumber('PAYMENT', { prefix: 'XX', enabled: false } as never);

      const callArg = prisma.runningNumber.update.mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty('lastNumber');
      expect(callArg.data.prefix).toBe('XX');
      expect(callArg.data.enabled).toBe(false);
    });
  });

  describe('Setting Engine (Task 03) — key-value', () => {
    it('rejects update with empty values', async () => {
      await expect(service.updateSettingsByModule('Dashboard', { values: {} })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when updating a key that does not exist (no ad-hoc Create)', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);
      await expect(
        service.updateSettingsByModule('Dashboard', { values: { unknownKey: '1' } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a non-numeric value for a NUMBER setting', async () => {
      prisma.setting.findUnique.mockResolvedValue({
        module: 'Dashboard',
        key: 'upcomingDueDays',
        valueType: 'NUMBER',
      });
      await expect(
        service.updateSettingsByModule('Dashboard', { values: { upcomingDueDays: 'abc' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-boolean value for a BOOLEAN setting', async () => {
      prisma.setting.findUnique.mockResolvedValue({
        module: 'Notification',
        key: 'notifyLowStock',
        valueType: 'BOOLEAN',
      });
      await expect(
        service.updateSettingsByModule('Notification', { values: { notifyLowStock: 'maybe' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid NUMBER update and stores it as a string', async () => {
      prisma.setting.findUnique.mockResolvedValue({
        module: 'Dashboard',
        key: 'upcomingDueDays',
        valueType: 'NUMBER',
      });
      prisma.setting.findMany.mockResolvedValue([]);

      await service.updateSettingsByModule('Dashboard', { values: { upcomingDueDays: 14 } });

      expect(prisma.setting.update).toHaveBeenCalledWith({
        where: { module_key: { module: 'Dashboard', key: 'upcomingDueDays' } },
        data: { value: '14' },
      });
    });
  });

  describe('getValue helpers — dùng bởi module khác (Task 04)', () => {
    it('getNumberValue() parses the stored string value as a number', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: '7' });
      await expect(service.getNumberValue('Dashboard', 'upcomingDueDays')).resolves.toBe(7);
    });

    it('getBooleanValue() parses the stored string value as a boolean', async () => {
      prisma.setting.findUnique.mockResolvedValue({ value: 'true' });
      await expect(service.getBooleanValue('Notification', 'notifyLowStock')).resolves.toBe(true);
    });

    it('getValue() throws NotFoundException for an unknown module.key', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);
      await expect(service.getValue('Dashboard', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
