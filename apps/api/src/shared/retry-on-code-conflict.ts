import { Prisma } from '@prisma/client';

const MAX_ATTEMPTS = 3;

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * Bọc quanh 1 lần "sinh mã (RunningNumber) + tạo bản ghi" — nếu mã bị trùng
 * khoá (RunningNumber lệch với dữ liệu thật do import/script tay bên ngoài
 * luồng sinh mã chuẩn), tự sinh mã mới và thử lại thay vì để lỗi 500 văng ra
 * người dùng. `fn` phải tự sinh mã MỚI mỗi lần gọi (không cache code cũ),
 * nên không giới hạn phải trùng đúng cột `code` — mọi lỗi P2002 khác (vd
 * trùng SĐT) vẫn thử lại tối đa `MAX_ATTEMPTS` lần rồi ném đúng lỗi gốc,
 * không che giấu lỗi nghiệp vụ thật.
 */
export async function retryOnCodeConflict<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isUniqueConstraintError(err) || attempt === MAX_ATTEMPTS) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
