#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

async function main() {
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const codes = (process.argv.slice(2) || []).filter(Boolean);
  if (!codes.length) {
    console.error('Usage: node scripts/find-assets-by-source.mjs <SOURCE_CODE> [<SOURCE_CODE> ...]');
    process.exit(1);
  }
  for (const code of codes) {
    const asset = await prisma.asset.findFirst({ where: { companyId, meta: { path: ['sourceCode'], equals: code } } }).catch(() => null);
    console.log(JSON.stringify({ code, found: !!asset, asset: asset ? { id: asset.id, ref: asset.ref, label: asset.label } : null }));
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect().finally(() => process.exit(1)); });
