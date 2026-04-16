#!/usr/bin/env node
import fs from "fs";
import path from "path";
import prisma from "../src/lib/prisma.js";

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  if(!companyId){ console.error('DEFAULT_COMPANY_ID required'); process.exit(1); }
  const outDir = path.resolve('backups');
  if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = Date.now();
  const outFile = path.join(outDir, `transactions-for-inspection-${ts}.csv`);

  const txns = await prisma.transaction.findMany({ where: { companyId }, include: { account: true, journalEntry: true }, orderBy: { date: 'asc' } });

  const header = ['id','date','amount','direction','accountNumber','accountLabel','kind','description','journalEntryId','journalNumber','createdAt'];
  const rows = [header.join(',')];
  for(const t of txns){
    const desc = (t.description||'').replace(/"/g,'""');
    const formatDate = (d) => { if(!d) return ''; if(typeof d === 'string') return new Date(d).toISOString(); if(d instanceof Date) return d.toISOString(); return new Date(d).toISOString(); };
    const row = [
      t.id,
      formatDate(t.date),
      toNumber(t.amount).toFixed(2),
      t.direction||'',
      t.account?.number||'',
      (t.account?.label||'').replace(/"/g,'""'),
      t.kind||'',
      `"${desc}"`,
      t.journalEntryId||'',
      t.journalEntry?.number||'',
      formatDate(t.createdAt),
    ];
    rows.push(row.join(','));
  }

  fs.writeFileSync(outFile, rows.join('\n'), 'utf8');
  console.log(JSON.stringify({ file: outFile, count: txns.length }));
  await prisma.$disconnect();
}

main().catch((e)=>{ console.error(e); prisma.$disconnect().finally(()=>process.exit(1)); });
