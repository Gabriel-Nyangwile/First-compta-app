#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

function normDesc(d){ return (d || '').toString().trim().toLowerCase().replace(/\s+/g,' '); }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','auto-created-je-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});

  const txns = await prisma.transaction.findMany({ where: { companyId }, orderBy: { date: 'asc' }, include: { account: true } });
  const orphans = txns.filter(t => !t.journalEntryId);
  console.log('Orphan transactions found:', orphans.length);

  const groups = new Map();
  for(const t of orphans){
    const dateKey = t.date ? t.date.toISOString().slice(0,10) : 'nodate';
    const descKey = normDesc(t.description || t.kind || '');
    const key = `${dateKey}||${descKey}`;
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const report = { totalOrphans: orphans.length, groupsConsidered: groups.size, created: 0, skipped: 0, details: [] };

  for(const [key, items] of groups.entries()){
    // skip trivial groups
    if(items.length < 2){ report.skipped++; report.details.push({ key, reason: 'too_small', count: items.length }); continue; }
    let debit = 0, credit = 0;
    for(const it of items){ if(it.direction === 'DEBIT') debit += toNumber(it.amount); else credit += toNumber(it.amount); }
    const diff = Math.round((debit - credit) * 100) / 100;
    if(Math.abs(diff) > 0.01){ report.skipped++; report.details.push({ key, reason: 'unbalanced', debit, credit, diff, count: items.length }); continue; }

    // create JournalEntry and attach
    try{
      const sample = items[0];
      const numbered = await nextSequence(prisma, 'JRN', 'JRN-', companyId);
      const je = await prisma.journalEntry.create({ data: { companyId, number: numbered, date: sample.date || new Date(), sourceType: 'MANUAL', description: `Auto: ${sample.description || sample.kind || ''}` } });
      const ids = items.map(i=>i.id);
      await prisma.transaction.updateMany({ where: { id: { in: ids } }, data: { journalEntryId: je.id } });
      report.created++; report.details.push({ key, journalEntryId: je.id, count: items.length });
    }catch(e){ report.skipped++; report.details.push({ key, reason: 'error', message: e.message }); }
  }

  const outFile = path.join(outDir,'report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log('Auto-create complete. Created:', report.created, 'Skipped:', report.skipped, 'Report:', outFile);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
