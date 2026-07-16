import { PrismaClient } from '@prisma/client';

/**
 * Snapshot tên người thực hiện (Sprint 04, 005-nguoi-thuc-hien-lich-su-hoat-dong.md)
 * — dùng chung cho mọi nơi ghi createdBy/completedBy/discountBy kèm *ByName.
 * Trả null nếu userId null hoặc User không tồn tại (dữ liệu cũ).
 */
export async function resolveActorName(
  prisma: Pick<PrismaClient, 'user'>,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) return null;

  return user.name ?? user.email;
}
