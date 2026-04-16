#!/usr/bin/env node
import prisma from "../src/lib/prisma.js";

async function main(){
  const id = process.argv[2];
  if(!id){ console.error('Usage: node scripts/describe-transaction.mjs <id>'); process.exit(1); }
  const t = await prisma.transaction.findUnique({ where: { id }, include: { account: true, journalEntry: true } });
  console.log(JSON.stringify(t, (k,v)=> typeof v === 'bigint' ? String(v) : v, 2));
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
