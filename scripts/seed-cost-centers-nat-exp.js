#!/usr/bin/env node
import prisma from '../src/lib/prisma.js';

async function main() {
  const desired = [
    { code: 'NAT', label: 'Salariés nationaux' },
    { code: 'EXP', label: 'Salariés expatriés' },
  ];
  for (const c of desired) {
    const existing = await prisma.costCenter.findFirst({ where: { code: c.code } });
    if (existing) {
      console.log(`[OK] Cost center ${c.code} exists: ${existing.label}`);
      continue;
    }
    const created = await prisma.costCenter.create({ data: { code: c.code, label: c.label } });
    console.log(`[CREATED] Cost center ${created.code}: ${created.label}`);
  }
}

main()
  .catch((e) => {
    console.error('seed-cost-centers-nat-exp failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
