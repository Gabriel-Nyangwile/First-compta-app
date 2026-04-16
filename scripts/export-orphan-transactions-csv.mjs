#!/usr/bin/env node
import fs from "fs";
import path from "path";
import prisma from "../src/lib/prisma.js";

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  if(!companyId) {
    console.error('DEFAULT_COMPANY_ID is required');
    process.exit(1);
  }

  const outDir = path.resolve('backups');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = Date.now();
  const outFile = path.join(outDir, `orphan-transactions-${ts}.csv`);

  // Transactions not yet linked to a JournalEntry are considered orphans
  const txns = await prisma.transaction.findMany({ where: { companyId, journalEntryId: null }, include: { account: true }, orderBy: { date: 'asc' } });

  const header = [
    'id', 'date', 'amount', 'direction', 'accountNumber', 'accountLabel', 'kind', 'description', 'journalEntryId', 'createdAt'
  ];

  const lines = [header.join(',')];
  for(const t of txns){
    const row = [];
    row.push(t.id);
    row.push((t.date||'').toISOString());
    row.push(toNumber(t.amount).toFixed(2));
    row.push(t.direction || '');
    row.push(t.account?.number || '');
    row.push((t.account?.label || '').replace(/"/g,'""'));
    row.push(t.kind || '');
    // wrap description in quotes and escape
    const desc = (t.description || '').replace(/"/g,'""');
    row.push(`"${desc}"`);
    row.push(t.journalEntryId || '');
    row.push((t.createdAt||'').toISOString());
    lines.push(row.join(','));
  }

  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(JSON.stringify({ file: outFile, count: txns.length }));
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
