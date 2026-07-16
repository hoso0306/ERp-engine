import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PermissionService } from './permission.service';
import type { AuthenticatedRequest } from '../auth/auth.guard';

function makeContext(
  user: AuthenticatedRequest['user'] | undefined,
  requiredKey?: string,
) {
  const request: Partial<AuthenticatedRequest> = { user };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
  return { context, requiredKey };
}

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: { get: jest.Mock };
  let permissionService: { hasPermission: jest.Mock };

  beforeEach(() => {
    reflector = { get: jest.fn() };
    permissionService = { hasPermission: jest.fn() };
    guard = new PermissionGuard(
      reflector as unknown as Reflector,
      permissionService as unknown as PermissionService,
    );
  });

  it('allows through when no @RequirePermission metadata is set', async () => {
    reflector.get.mockReturnValue(undefined);
    const { context } = makeContext({ userId: 'u1', roleId: 'r1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(permissionService.hasPermission).not.toHaveBeenCalled();
  });

  it('rejects when the user has no roleId', async () => {
    reflector.get.mockReturnValue('customer.view');
    const { context } = makeContext({ userId: 'u1', roleId: undefined });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects when the Role lacks the required permission', async () => {
    reflector.get.mockReturnValue('sales-order.ship');
    permissionService.hasPermission.mockResolvedValue(false);
    const { context } = makeContext({ userId: 'u1', roleId: 'r1' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(permissionService.hasPermission).toHaveBeenCalledWith(
      'r1',
      'sales-order.ship',
    );
  });

  it('allows through when the Role has the required permission', async () => {
    reflector.get.mockReturnValue('sales-order.ship');
    permissionService.hasPermission.mockResolvedValue(true);
    const { context } = makeContext({ userId: 'u1', roleId: 'r1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
