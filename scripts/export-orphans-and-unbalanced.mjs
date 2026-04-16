#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','export-orphans-unbalanced-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});

  const txns = await prisma.transaction.findMany({ where: { companyId }, include: { account: true } });

  const orphans = txns.filter(t => !t.groupId);
  const byGroup = new Map();
  for(const t of txns){ if(t.groupId){ if(!byGroup.has(t.groupId)) byGroup.set(t.groupId, []); byGroup.get(t.groupId).push(t); } }

  const unbalanced = [];
  for(const [gid, items] of byGroup.entries()){
    let debit=0, credit=0;
    for(const it of items){ if(it.direction === 'DEBIT') debit += toNumber(it.amount); else credit += toNumber(it.amount); }
    const diff = Math.round((debit - credit) * 100) / 100;
    if(Math.abs(diff) > 0.01) unbalanced.push({ groupId: gid, debit, credit, diff, count: items.length, items });
  }

  // write orphans JSON + CSV
  fs.writeFileSync(path.join(outDir,'orphans.json'), JSON.stringify(orphans, null, 2));
  const orphansCsv = ['id,date,accountNumber,amount,direction,kind,description,invoiceId,incomingInvoiceId,moneyMovementId,journalEntryId'];
  for(const o of orphans){
    const row = [o.id, o.date.toISOString(), o.account?.number || '', toNumber(o.amount), o.direction, o.kind, '"'+(o.description||'').replace(/"/g,'""')+'"', o.invoiceId||'', o.incomingInvoiceId||'', o.moneyMovementId||'', o.journalEntryId||''];
    orphansCsv.push(row.join(','));
  }
  fs.writeFileSync(path.join(outDir,'orphans.csv'), orphansCsv.join('\n'));

  // write unbalanced JSON + CSV and per-group CSVs
  fs.writeFileSync(path.join(outDir,'unbalanced.json'), JSON.stringify(unbalanced, null, 2));
  const ubCsv = ['groupId,debit,credit,diff,count'];
  const groupsDir = path.join(outDir,'groups'); fs.mkdirSync(groupsDir,{recursive:true});
  for(const g of unbalanced){ ubCsv.push([g.groupId,g.debit,g.credit,g.diff,g.count].join(','));
    const lines = ['id,date,accountNumber,amount,direction,kind,description,invoiceId,incomingInvoiceId,moneyMovementId,journalEntryId'];
    for(const it of g.items){ lines.push([it.id, it.date.toISOString(), it.account?.number||'', toNumber(it.amount), it.direction, it.kind, '"'+(it.description||'').replace(/"/g,'""')+'"', it.invoiceId||'', it.incomingInvoiceId||'', it.moneyMovementId||'', it.journalEntryId||''].join(',')); }
    fs.writeFileSync(path.join(groupsDir, g.groupId + '.csv'), lines.join('\n'));
  }
  fs.writeFileSync(path.join(outDir,'unbalanced.csv'), ubCsv.join('\n'));

  console.log('Export complete. Orphans:', orphans.length, 'Unbalanced groups:', unbalanced.length, 'OutDir:', outDir);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
