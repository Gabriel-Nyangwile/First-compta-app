import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const rows = await prisma.productInventory.findMany({
    where: { companyId: null },
    select: {
      productId: true,
      product: {
        select: {
          companyId: true,
          sku: true,
          name: true,
        },
      },
    },
  });

  const resolvable = rows.filter((row) => row.product?.companyId);
  const unresolved = rows.filter((row) => !row.product?.companyId);

  console.log(`mode: ${apply ? 'apply' : 'dry-run'}`);
  console.log(`productInventories.resolvable: ${resolvable.length}`);
  console.log(`productInventories.unresolved: ${unresolved.length}`);

  if (resolvable.length) {
    console.log('\nResolvable product inventories:');
    for (const row of resolvable.slice(0, 10)) {
      console.log(
        `- ${row.productId} ${row.product.sku ?? '<no-sku>'} -> ${row.product.companyId}`,
      );
    }
  }

  if (unresolved.length) {
    console.log('\nUnresolved product inventories:');
    for (const row of unresolved.slice(0, 10)) {
      console.log(`- ${row.productId}`);
    }
  }

  if (!apply) {
    return;
  }

  for (const row of resolvable) {
    await prisma.productInventory.update({
      where: { productId: row.productId },
      data: { companyId: row.product.companyId },
    });
  }

  console.log('\nBackfill applied.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
