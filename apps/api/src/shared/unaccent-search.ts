import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tìm kiếm không phân biệt dấu tiếng Việt (vd gõ "hoang"/"hoàn" đều khớp
 * "Hoàng") — Prisma `contains`/`mode: insensitive` không gọi được hàm
 * `unaccent()` của Postgres nên phải qua raw SQL. Dùng chung 2 hàm dưới đây
 * ở MỌI nơi có ô tìm kiếm: build fragment so khớp cho từng cột, chạy 1 câu
 * SELECT id lấy danh sách id khớp, rồi truyền vào `where: { id: { in } }`
 * của Prisma như bình thường — không đổi field nào đang được tìm, không đổi
 * logic filter/phân trang khác.
 */

/** Fragment: unaccent(lower(column)) LIKE unaccent(lower('%value%')) */
export function unaccentLike(column: Prisma.Sql, value: string): Prisma.Sql {
  return Prisma.sql`unaccent(lower(${column})) LIKE unaccent(lower(${'%' + value + '%'}))`;
}

/**
 * Chạy "SELECT id FROM ... WHERE ..." (sql do nơi gọi tự ghép từ
 * unaccentLike + JOIN nếu cần) và trả về mảng id khớp.
 */
export async function findMatchingIds(
  prisma: PrismaService,
  sql: Prisma.Sql,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(sql);
  return rows.map((r) => r.id);
}
