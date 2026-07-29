import { Prisma } from '@prisma/client';
import { retryOnCodeConflict } from './retry-on-code-conflict';

function makeUniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('retryOnCodeConflict', () => {
  it('trả kết quả ngay nếu thành công lần đầu, không retry', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryOnCodeConflict(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('tự thử lại khi gặp lỗi trùng khoá (P2002), thành công ở lần sau', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeUniqueConstraintError())
      .mockResolvedValueOnce('ok-lan-2');
    const result = await retryOnCodeConflict(fn);
    expect(result).toBe('ok-lan-2');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('ném đúng lỗi gốc nếu vẫn trùng khoá sau tối đa số lần thử', async () => {
    const err = makeUniqueConstraintError();
    const fn = jest.fn().mockRejectedValue(err);
    await expect(retryOnCodeConflict(fn)).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('ném ngay lỗi khác (không phải P2002), không retry', async () => {
    const otherError = new Error('Lỗi khác không liên quan đến mã trùng.');
    const fn = jest.fn().mockRejectedValue(otherError);
    await expect(retryOnCodeConflict(fn)).rejects.toBe(otherError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
