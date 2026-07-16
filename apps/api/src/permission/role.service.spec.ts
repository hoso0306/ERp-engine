import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RoleService } from './role.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from './permission.service';

function makeRole(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-1',
    code: 'SALES',
    name: 'Kinh doanh',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    rolePermissions: [],
    ...overrides,
  };
}

describe('RoleService', () => {
  let service: RoleService;
  let prisma: {
    role: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: { count: jest.Mock };
    permission: { findMany: jest.Mock };
    rolePermission: { create: jest.Mock; deleteMany: jest.Mock };
  };
  let permissionService: { recordAudit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: { count: jest.fn() },
      permission: { findMany: jest.fn() },
      rolePermission: { create: jest.fn(), deleteMany: jest.fn() },
    };
    permissionService = { recordAudit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissionService },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  describe('disable', () => {
    it('rejects disabling a Role that still has active Users', async () => {
      prisma.role.findUnique.mockResolvedValue(makeRole());
      prisma.user.count.mockResolvedValue(2);

      await expect(service.disable('role-1', 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.role.update).not.toHaveBeenCalled();
    });

    it('disables the Role and records ROLE_DISABLED when no active Users remain', async () => {
      prisma.role.findUnique.mockResolvedValue(makeRole());
      prisma.user.count.mockResolvedValue(0);
      prisma.role.update.mockResolvedValue(makeRole({ isActive: false }));

      await service.disable('role-1', 'actor-1');

      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: 'role-1' },
        data: { isActive: false },
      });
      expect(permissionService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROLE_DISABLED', roleId: 'role-1' }),
      );
    });
  });

  describe('create', () => {
    it('rejects a duplicate Role code', async () => {
      prisma.role.findUnique.mockResolvedValue(makeRole());

      await expect(
        service.create({ code: 'SALES', name: 'Kinh doanh 2' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.role.create).not.toHaveBeenCalled();
    });

    it('creates the Role and records ROLE_CREATED', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue(
        makeRole({ id: 'role-new', code: 'SUPPORT' }),
      );

      await service.create({ code: 'SUPPORT', name: 'Hỗ trợ' }, 'actor-1');

      expect(permissionService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROLE_CREATED', roleId: 'role-new' }),
      );
    });
  });

  describe('update — permission grant/revoke diff', () => {
    it('grants newly added permissions and revokes removed ones, auditing each', async () => {
      const role = makeRole({
        rolePermissions: [
          {
            permissionId: 'perm-view',
            permission: { id: 'perm-view', key: 'customer.view' },
          },
        ],
      });
      prisma.role.findUnique
        .mockResolvedValueOnce(role)
        .mockResolvedValueOnce(role);
      prisma.permission.findMany
        .mockResolvedValueOnce([{ id: 'perm-create', key: 'customer.create' }])
        .mockResolvedValueOnce([{ id: 'perm-view', key: 'customer.view' }]);

      await service.update(
        'role-1',
        { permissionIds: ['perm-create'] },
        'actor-1',
      );

      expect(prisma.rolePermission.create).toHaveBeenCalledWith({
        data: { roleId: 'role-1', permissionId: 'perm-create' },
      });
      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: 'role-1', permissionId: { in: ['perm-view'] } },
      });
      expect(permissionService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GRANT',
          permissionId: 'perm-create',
        }),
      );
      expect(permissionService.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REVOKE',
          permissionId: 'perm-view',
        }),
      );
    });
  });
});
