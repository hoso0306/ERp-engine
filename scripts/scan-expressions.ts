/**
 * Task 02 (workbench/sprint-03/011) — quét toàn bộ expression đang lưu trong DB
 * và kiểm tra tương thích với grammar mới của shared ExpressionEvaluator.
 *
 * Chạy: npx ts-node ../../scripts/scan-expressions.ts (từ apps/api)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { validate } from '../apps/api/src/shared/expression';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL ?? 'postgresql://erp:erp123@localhost:5432/erp?schema=public'),
  });
  const rows: Array<{ source: string; id: string; expression: string }> = [];

  const pricingVersions = await prisma.pricingRuleVersion.findMany({
    select: { id: true, expression: true, status: true },
  });
  for (const v of pricingVersions) {
    if (v.expression?.trim()) {
      rows.push({ source: `PricingRuleVersion(${v.status})`, id: v.id, expression: v.expression });
    }
  }

  const mrItems = await prisma.materialRequirementItem.findMany({
    select: { id: true, expression: true, materialRequirementVersion: { select: { status: true } } },
  });
  for (const item of mrItems) {
    rows.push({
      source: `MaterialRequirementItem(${item.materialRequirementVersion.status})`,
      id: item.id,
      expression: item.expression,
    });
  }

  let bad = 0;
  for (const row of rows) {
    const result = validate(row.expression);
    if (!result.valid) {
      bad++;
      console.log(`KHÔNG TƯƠNG THÍCH ${row.source} ${row.id}: "${row.expression}" — ${result.error}`);
    }
  }
  console.log(`\nĐã quét ${rows.length} expression — ${bad} cần chuyển đổi.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
