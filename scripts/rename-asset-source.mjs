#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

async function main() {
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const oldCode = process.argv[2];
  const newCode = process.argv[3] || `${oldCode}-old`;
  if (!oldCode) {
    console.error('Usage: node scripts/rename-asset-source.mjs <OLD_CODE> [<NEW_CODE>]');
    process.exit(1);
  }
  const asset = await prisma.asset.findFirst({ where: { companyId, meta: { path: ['sourceCode'], equals: oldCode } } });
  if (!asset) {
    console.log(JSON.stringify({ renamed: false, reason: 'not_found', oldCode }));
    await prisma.$disconnect();
    return;
  }
  const meta = asset.meta || {};
  meta.sourceCode = newCode;
  const updated = await prisma.asset.update({ where: { id: asset.id }, data: { meta } });
  console.log(JSON.stringify({ renamed: true, id: updated.id, oldCode, newCode }));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
