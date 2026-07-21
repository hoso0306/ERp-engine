import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const code of ['SP000056', 'SP000057', 'SP000058']) {
    const p = await prisma.product.findUnique({
      where: { code },
      include: {
        pricingRule: { include: { versions: { where: { status: 'ACTIVE' }, include: { matrixRows: true } } } },
        parameters: { include: { options: true } },
      },
    });
    const v = p!.pricingRule!.versions[0];
    console.log(`\n${code} ${p!.name}: matrixRows count =`, v.matrixRows.length);
    console.log(JSON.stringify(v.matrixRows, null, 2));
    console.log('ENUM params usedInPricing:', p!.parameters.filter(x=>x.type==='ENUM').map(x => ({name:x.name, usedInPricing:x.usedInPricing, options: x.options.map(o=>o.value)})));
  }
}
main().finally(() => prisma.$disconnect());
