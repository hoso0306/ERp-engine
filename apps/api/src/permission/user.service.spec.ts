import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from './permission.service';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'sales@erp.local',
    name: 'Sales User',
    isActive: true,
    roleId: 'role-sales',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
    role: { id: 'role-sales', code: 'SALES', name: 'Kinh doanh' },
    ...overrides,
  };
}

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    role: { findUnique: jest.Mock };
  };
  let authService: { setTemporaryPassword: jest.Mock };
  let permissionService: { recordAudit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      role: { findUnique: jest.fn() },
    };
    authService = {
      setTemporaryPassword: jest.fn().mockResolvedValue('tempPass123'),
    };
    permissionService = { recordAudit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: PermissionService, useValue: permissionService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('update — self disable', () => {
    it('rejects when a user tries to disable themselves', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.update('user-1', { isActive: false }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('update — last active Owner', () => {
    it('rejects disabling the last active Owner', async () => {
      const owner = makeUser({
        id: 'owner-1',
        role: { id: 'role-owner', code: 'OWNER', name: 'Chủ doanh nghiệp' },
      });
      prisma.user.findUnique.mockResolvedValue(owner);
      prisma.user.count.mockResolvedValue(1);

      await expect(
        service.update('owner-1', { isActive: false }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('allows disabling an Owner when another active Owner remains', async () => {
      const owner = makeUser({
        id: 'owner-1',
        role: { id: 'role-owner', code: 'OWNER', name: 'Chủ doanh nghiệp' },
      });
      prisma.user.findUnique.mockResolvedValue(owner);
      prisma.user.count.mockResolvedValue(2);
      prisma.user.update.mockResolvedValue({ ...owner, isActive: false });

      await service.update('owner-1', { isActive: false }, 'actor-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'owner-1' },
        data: { isActive: false },
        include: { role: true },
      });
      expect(permissionService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_DISABLED', userId: 'owner-1' }),
      );
    });

    it('allows disabling a non-Owner regardless of Owner count', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, isActive: false });

      await service.update('user-1', { isActive: false }, 'actor-1');

      expect(prisma.user.count).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('update — role change audit', () => {
    it('records USER_ROLE_CHANGED with fromRole/toRole codes', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-manager',
        code: 'MANAGER',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({
        ...user,
        roleId: 'role-manager',
        role: { id: 'role-manager', code: 'MANAGER', name: 'Quản lý' },
      });

      await service.update('user-1', { roleId: 'role-manager' }, 'actor-1');

      expect(permissionService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_ROLE_CHANGED',
          payload: { fromRole: 'SALES', toRole: 'MANAGER' },
        }),
      );
    });
  });

  describe('create', () => {
    it('creates the user then calls AuthService.setTemporaryPassword and records USER_CREATED', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-sales',
        isActive: true,
      });
      prisma.user.create.mockResolvedValue(makeUser());
      prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser());

      const result = await service.create(
        { email: 'sales@erp.local', name: 'Sales User', roleId: 'role-sales' },
        'actor-1',
      );

      expect(authService.setTemporaryPassword).toHaveBeenCalledWith('user-1');
      expect(result.temporaryPassword).toBe('tempPass123');
      expect(permissionService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'USER_CREATED', userId: 'user-1' }),
      );
    });

    it('rejects when the target Role is disabled', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-x',
        isActive: false,
      });

      await expect(
        service.create({ email: 'a@b.com', roleId: 'role-x' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
});
