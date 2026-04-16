#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','export-transactions-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});
  const outCsv = path.join(outDir,'transactions.csv');

  const txns = await prisma.transaction.findMany({ where: { companyId }, include: { account: true } });

  const headers = ['id','date','companyId','accountId','accountNumber','amount','direction','kind','journalEntryId','invoiceId','incomingInvoiceId','moneyMovementId','description','isOrphan'];
  const rows = [headers.join(',')];

  for(const t of txns){
    const vals = [];
    vals.push(t.id);
    vals.push(t.date.toISOString());
    vals.push(t.companyId || '');
    vals.push(t.accountId || '');
    vals.push(t.account?.number || '');
    vals.push(String(toNumber(t.amount)));
    vals.push(t.direction);
    vals.push(t.kind);
    vals.push(t.journalEntryId || '');
    vals.push(t.invoiceId || '');
    vals.push(t.incomingInvoiceId || '');
    vals.push(t.moneyMovementId || '');
    // escape description
    const desc = (t.description || '').replace(/"/g,'""');
    vals.push('"'+desc+'"');
    vals.push(t.journalEntryId ? 'false' : 'true');
    rows.push(vals.join(','));
  }

  fs.writeFileSync(outCsv, rows.join('\n'));
  console.log('Exported', txns.length, 'transactions to', outCsv);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
