import prisma from '../src/lib/prisma.js';
import { createAsset, postDepreciation } from '../src/lib/assets.js';

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  console.log(`Smoke immobilisations: dotation ${month}/${year}`);

  const category = await prisma.assetCategory.upsert({
    where: { code: 'TEST-IMM' },
    update: {},
    create: {
      code: 'TEST-IMM',
      label: 'Test Immobilisation',
      durationMonths: 36,
      assetAccountNumber: '218000',
      depreciationAccountNumber: '281800',
      expenseAccountNumber: '681100',
      disposalGainAccountNumber: '775000',
      disposalLossAccountNumber: '675000',
    },
  });
  console.log('Category ready', category.code);

  const asset = await createAsset({
    label: `Laptop demo ${Date.now()}`,
    categoryId: category.id,
    acquisitionDate: now,
    inServiceDate: now,
    cost: 1200,
    salvage: 0,
    usefulLifeMonths: 36,
    method: 'LINEAR',
    status: 'ACTIVE',
  });
  console.log('Asset created', asset.ref);

  const { journal, line } = await postDepreciation(asset.id, year, month);
  console.log('Depreciation posted', { journal: journal.number, amount: line.amount });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
