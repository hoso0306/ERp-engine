import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingService } from '../setting/setting.service';

jest.mock('bcrypt');

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'owner@erp.local',
    name: 'Owner',
    passwordHash: 'hashed-real-password',
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let jwtService: { signAsync: jest.Mock };
  let settingService: { getNumberValue: jest.Mock; getBooleanValue: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    settingService = {
      getNumberValue: jest.fn().mockResolvedValue(60),
      getBooleanValue: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: SettingService, useValue: settingService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login() — Task 01', () => {
    it('rejects with a generic message when the email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'nope@erp.local', password: 'x' }, null),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects with the SAME generic message when the password is wrong (no user-enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      let notFoundMessage = '';
      let wrongPasswordMessage = '';
      try {
        prisma.user.findUnique.mockResolvedValueOnce(null);
        await service.login({ identifier: 'nope@erp.local', password: 'x' }, null);
      } catch (e) {
        notFoundMessage = (e as Error).message;
      }
      try {
        await service.login(
          { identifier: 'owner@erp.local', password: 'wrong' },
          null,
        );
      } catch (e) {
        wrongPasswordMessage = (e as Error).message;
      }

      expect(notFoundMessage).toBe(wrongPasswordMessage);
      expect(notFoundMessage).not.toBe('');
    });

    it('rejects when isActive = false, even with correct password', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(
        service.login({ identifier: 'owner@erp.local', password: 'correct' }, null),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues a token and updates lastLoginAt/lastLoginIp on success, never leaking passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(
        makeUser({ lastLoginAt: new Date(), lastLoginIp: '1.2.3.4' }),
      );

      const result = await service.login(
        { identifier: 'owner@erp.local', password: 'correct' },
        '1.2.3.4',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date), lastLoginIp: '1.2.3.4' },
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.mustChangePassword).toBe(false);
    });

    it('reads JWT expiry from Settings.Security.sessionTimeout, not hard-coded', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(makeUser());
      settingService.getNumberValue.mockResolvedValue(45);

      await service.login(
        { identifier: 'owner@erp.local', password: 'correct' },
        null,
      );

      expect(settingService.getNumberValue).toHaveBeenCalledWith(
        'Security',
        'sessionTimeout',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1' },
        { expiresIn: '45m' },
      );
    });
  });

  describe('changePassword() — Task 03', () => {
    it('rejects when newPassword is too short', async () => {
      await expect(
        service.changePassword('user-1', {
          oldPassword: 'old',
          newPassword: '123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when oldPassword does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.changePassword('user-1', {
          oldPassword: 'wrong',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets mustChangePassword = false after a successful change', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ mustChangePassword: true }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await service.changePassword('user-1', {
        oldPassword: 'old',
        newPassword: 'newpass123',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: 'new-hashed-password',
          mustChangePassword: false,
        },
      });
    });
  });

  describe('setTemporaryPassword() — Task 05 (internal, no HTTP endpoint)', () => {
    it('sets mustChangePassword according to Settings.Security.forceChangePasswordOnFirstLogin', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.hash as jest.Mock).mockResolvedValue('temp-hashed');
      settingService.getBooleanValue.mockResolvedValue(true);

      const plaintext = await service.setTemporaryPassword('user-1');

      expect(typeof plaintext).toBe('string');
      expect(plaintext.length).toBeGreaterThan(0);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'temp-hashed', mustChangePassword: true },
      });
    });

    it('does not force mustChangePassword when the setting is off', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.hash as jest.Mock).mockResolvedValue('temp-hashed');
      settingService.getBooleanValue.mockResolvedValue(false);

      await service.setTemporaryPassword('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'temp-hashed', mustChangePassword: false },
      });
    });
  });

  describe('getMe() — Task 02', () => {
    it('never returns passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      const result = await service.getMe('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('owner@erp.local');
    });
  });
});
