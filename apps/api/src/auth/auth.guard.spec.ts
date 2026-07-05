import { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

function makeContext(headers: Record<string, string>) {
  const request: Partial<AuthenticatedRequest> = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new AuthGuard(jwtService as unknown as JwtService);
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
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ userId: 'user-1', roleId: 'role-1' });
  });
});
