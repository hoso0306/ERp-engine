import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ProductService } from './product/product.service';
import * as dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter }) as any;
const service = new ProductService(prisma, {} as any, {} as any, {} as any);

const SOURCE_CODES = ['NL000008', 'NL000009', 'NL000010', 'NL000011', 'NL000012', 'NL000013'];

(async () => {
  const sources = await prisma.material.findMany({
    where: { code: { in: SOURCE_CODES } },
    include: {
      unit: true,
      productionCenters: { select: { productionCenterId: true } },
    },
  });
  // preserve order
  const orderedSources = SOURCE_CODES.map((c) => sources.find((s: any) => s.code === c));

  for (const src of orderedSources) {
    if (!src) throw new Error('missing source material');
    console.log('Source:', src.code, src.name, '| unit=', src.unit.name, '| centers=', src.productionCenters.map((p: any) => p.productionCenterId));

    const newName = `${src.name} - Vân gỗ`;
    const material = await service.createMaterial({
      name: newName,
      unitId: src.unitId,
      productionCenterIds: src.productionCenters.map((p: any) => p.productionCenterId),
    } as any);
    console.log('  -> created', material.code, material.name);

    const price = await service.createMaterialPrice(material.id, {
      price: 137000,
      effectiveFrom: new Date().toISOString(),
      isDefault: true,
    } as any);
    console.log('  -> price', price.price.toString(), 'isDefault=', price.isDefault, 'effectiveFrom=', price.effectiveFrom);
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
