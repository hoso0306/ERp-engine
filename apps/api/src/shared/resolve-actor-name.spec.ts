import { resolveActorName } from './resolve-actor-name';

describe('resolveActorName()', () => {
  function makePrisma(user: { name: string | null; email: string } | null) {
    return { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  }

  it('trả null khi userId null', async () => {
    const prisma = makePrisma(null);
    expect(await resolveActorName(prisma as never, null)).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('trả null khi userId undefined', async () => {
    const prisma = makePrisma(null);
    expect(await resolveActorName(prisma as never, undefined)).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('trả null khi User không tồn tại (dữ liệu cũ)', async () => {
    const prisma = makePrisma(null);
    expect(await resolveActorName(prisma as never, 'user-1')).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { name: true, email: true },
    });
  });

  it('trả user.name khi có', async () => {
    const prisma = makePrisma({ name: 'Nguyễn Văn An', email: 'an@acme.vn' });
    expect(await resolveActorName(prisma as never, 'user-1')).toBe(
      'Nguyễn Văn An',
    );
  });

  it('fallback sang email khi user.name null', async () => {
    const prisma = makePrisma({ name: null, email: 'an@acme.vn' });
    expect(await resolveActorName(prisma as never, 'user-1')).toBe(
      'an@acme.vn',
    );
  });
});
