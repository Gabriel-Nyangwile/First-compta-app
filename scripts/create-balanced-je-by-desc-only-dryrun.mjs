#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }
function normDesc(d){ return (d || '').toString().trim().toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 \-_,\.]/g,''); }

const tolArgIndex = process.argv.indexOf('--tolerance');
const tolerance = tolArgIndex >= 0 ? Number(process.argv[tolArgIndex+1] || 0) : 0.5;

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','auto-created-je-desc-only-dryrun-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});

  const txns = await prisma.transaction.findMany({ where: { companyId }, orderBy: { date: 'asc' } });
  const orphans = txns.filter(t => !t.journalEntryId);
  console.log('Orphan transactions found:', orphans.length);

  const groups = new Map();
  for(const t of orphans){
    const descKey = normDesc(t.description || t.kind || '');
    if(!groups.has(descKey)) groups.set(descKey, []);
    groups.get(descKey).push(t);
  }

  const candidates = [];
  for(const [key, items] of groups.entries()){
    if(items.length < 2) continue;
    let debit = 0, credit = 0;
    for(const it of items){ if(it.direction === 'DEBIT') debit += toNumber(it.amount); else credit += toNumber(it.amount); }
    const diff = Math.round((debit - credit) * 100) / 100;
    if(Math.abs(diff) <= tolerance){
      candidates.push({ key, count: items.length, debit, credit, diff, ids: items.map(i=>i.id), sampleDesc: items[0].description || items[0].kind || '' });
    }
  }

  const report = { totalOrphans: orphans.length, groupsConsidered: groups.size, candidates: candidates.length, tolerance, candidates };
  const outFile = path.join(outDir,'dryrun-report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log('Dry-run complete. Candidates:', candidates.length, 'Report:', outFile);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
