#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }
function normDesc(d){ return (d || '').toString().trim().toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 \-_,\.]/g,''); }

const tolArgIndex = process.argv.indexOf('--tolerance');
const tolerance = tolArgIndex >= 0 ? Number(process.argv[tolArgIndex+1] || 0) : 0.01;

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','auto-created-je-desc-only-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});

  const txns = await prisma.transaction.findMany({ where: { companyId }, include: { account: true } });
  const orphans = txns.filter(t => !t.journalEntryId);
  console.log('Orphan transactions found:', orphans.length);

  const groups = new Map();
  for(const t of orphans){
    const descKey = normDesc(t.description || t.kind || '');
    if(!groups.has(descKey)) groups.set(descKey, []);
    groups.get(descKey).push(t);
  }

  const report = { totalOrphans: orphans.length, groupsConsidered: groups.size, created: 0, skipped: 0, details: [] };

  for(const [key, items] of groups.entries()){
    if(items.length < 2){ report.skipped++; report.details.push({ key, reason: 'too_small', count: items.length }); continue; }
    let debit = 0, credit = 0;
    for(const it of items){ if(it.direction === 'DEBIT') debit += toNumber(it.amount); else credit += toNumber(it.amount); }
    const diff = Math.round((debit - credit) * 100) / 100;
    if(Math.abs(diff) > tolerance){ report.skipped++; report.details.push({ key, reason: 'unbalanced', debit, credit, diff, count: items.length }); continue; }

    try{
      const sample = items[0];
      const numbered = await nextSequence(prisma, 'JRN', 'JRN-', companyId);
      const je = await prisma.journalEntry.create({ data: { companyId, number: numbered, date: sample.date || new Date(), sourceType: 'MANUAL', description: `Auto(desc): ${sample.description || sample.kind || ''}` } });
      const ids = items.map(i=>i.id);
      await prisma.transaction.updateMany({ where: { id: { in: ids } }, data: { journalEntryId: je.id } });
      report.created++; report.details.push({ key, journalEntryId: je.id, count: items.length, diff });
    }catch(e){ report.skipped++; report.details.push({ key, reason: 'error', message: e.message }); }
  }

  const outFile = path.join(outDir,'report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log('Auto-create (desc-only) complete. Created:', report.created, 'Skipped:', report.skipped, 'Report:', outFile);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
