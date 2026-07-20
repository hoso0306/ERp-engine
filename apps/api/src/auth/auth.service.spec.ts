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
    phone: null,
    name: 'Owner',
    passwordHash: 'hashed-real-password',
    isActive: true,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
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

    it('email không tồn tại → thông báo chung, KHÔNG có "còn X lần" (chỉ user có thật mới đếm lần sai)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.login({ identifier: 'nope@erp.local', password: 'x' }, null),
      ).rejects.toThrow(
        'Email hoặc mật khẩu không đúng. Hãy liên hệ với người sáng lập để cấp lại mật khẩu.',
      );
    });

    it('sai mật khẩu (lần đầu, chưa tới ngưỡng khoá) → thông báo chung kèm "còn X lần thử"', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login(
          { identifier: 'owner@erp.local', password: 'wrong' },
          null,
        ),
      ).rejects.toThrow(
        'Email hoặc mật khẩu không đúng. Hãy liên hệ với người sáng lập để cấp lại mật khẩu. Còn 4 lần thử.',
      );
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
        data: {
          lastLoginAt: expect.any(Date),
          lastLoginIp: '1.2.3.4',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
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

  describe('login() — chống dò mật khẩu (chốt 20/07/2026)', () => {
    it('sai lần thứ 5 → khoá 5 phút, thông báo nêu rõ thời gian', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ failedLoginAttempts: 4 }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login(
          { identifier: 'owner@erp.local', password: 'wrong' },
          null,
        ),
      ).rejects.toThrow('Sai mật khẩu quá 5 lần. Chờ 300 giây để thử lại.');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 5, lockedUntil: expect.any(Date) },
      });
    });

    it('sai lần thứ 10 → khoá 30 phút', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ failedLoginAttempts: 9 }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login(
          { identifier: 'owner@erp.local', password: 'wrong' },
          null,
        ),
      ).rejects.toThrow('Sai mật khẩu quá 10 lần. Chờ 30 phút để thử lại.');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 10, lockedUntil: expect.any(Date) },
      });
    });

    it('sai lần thứ 6 (giữa 2 mốc, sau khi lần 5 đã từng khoá) → KHÔNG khoá lại, chỉ báo còn 4 lần tới mốc 10', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ failedLoginAttempts: 5 }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login(
          { identifier: 'owner@erp.local', password: 'wrong' },
          null,
        ),
      ).rejects.toThrow(
        'Email hoặc mật khẩu không đúng. Hãy liên hệ với người sáng lập để cấp lại mật khẩu. Còn 4 lần thử.',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 6, lockedUntil: null },
      });
    });

    it('sai lần dưới ngưỡng (VD lần 3) → chỉ báo lỗi chung, không khoá', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ failedLoginAttempts: 2 }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login(
          { identifier: 'owner@erp.local', password: 'wrong' },
          null,
        ),
      ).rejects.toThrow('Email hoặc mật khẩu không đúng');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 3, lockedUntil: null },
      });
    });

    it('đang bị khoá → từ chối ngay, không kiểm tra mật khẩu, không tăng thêm số lần sai', async () => {
      const future = new Date(Date.now() + 3 * 60000);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ failedLoginAttempts: 5, lockedUntil: future }),
      );

      await expect(
        service.login(
          { identifier: 'owner@erp.local', password: 'correct' },
          null,
        ),
      ).rejects.toThrow('Tài khoản đang tạm khoá. Chờ 180 giây để thử lại.');

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('đã hết thời gian khoá → cho kiểm tra mật khẩu lại bình thường', async () => {
      const past = new Date(Date.now() - 1000);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ failedLoginAttempts: 5, lockedUntil: past }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(makeUser());

      const result = await service.login(
        { identifier: 'owner@erp.local', password: 'correct' },
        null,
      );

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          lastLoginAt: expect.any(Date),
          lastLoginIp: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
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
