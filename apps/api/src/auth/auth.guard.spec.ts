import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';
import { AuthService } from './auth.service';

function makeContext(headers: Record<string, string>, setHeader = jest.fn()) {
  const request: Partial<AuthenticatedRequest> = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader }) }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let authService: { issueToken: jest.Mock };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    authService = { issueToken: jest.fn().mockResolvedValue('refreshed.token') };
    guard = new AuthGuard(jwtService as unknown as JwtService, authService as unknown as AuthService);
  });

  it('rejects when there is no Authorization header', async () => {
    const context = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a header that is not "Bearer <token>"', async () => {
    const context = makeContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid/expired token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = makeContext({ authorization: 'Bearer bad.token' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches req.user and allows the request through on a valid token', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', roleId: 'role-1' });
    const request: Partial<AuthenticatedRequest> = { headers: { authorization: 'Bearer good.token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader: jest.fn() }) }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ userId: 'user-1', roleId: 'role-1' });
  });

  // Sliding session (16/07/2026) — token chỉ hết hạn khi không còn hoạt động,
  // không phải hạn cứng từ lúc đăng nhập.
  it('cấp lại token mới qua header X-Refreshed-Token trên mỗi request hợp lệ', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', roleId: 'role-1' });
    const setHeader = jest.fn();
    const context = makeContext({ authorization: 'Bearer good.token' }, setHeader);

    await guard.canActivate(context);

    expect(authService.issueToken).toHaveBeenCalledWith('user-1', 'role-1');
    expect(setHeader).toHaveBeenCalledWith('X-Refreshed-Token', 'refreshed.token');
  });

  it('vẫn cho qua request nếu cấp lại token thất bại (best-effort)', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', roleId: 'role-1' });
    authService.issueToken.mockRejectedValue(new Error('setting service down'));
    const context = makeContext({ authorization: 'Bearer good.token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
