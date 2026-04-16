#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','auto-group-orphans-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});

  const txns = await prisma.transaction.findMany({ where: { companyId }, include: { account: true } });
  const orphans = txns.filter(t => !t.journalEntryId);
  console.log('Found orphans:', orphans.length);

  const used = new Set();
  const created = [];

  for(let i=0;i<orphans.length;i++){
    const a = orphans[i];
    if(used.has(a.id)) continue;
    // look for exact opposite amount with opposite direction
    const amt = toNumber(a.amount);
    const targetDir = a.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
    // prefer same date and same account
    let candidate = orphans.find(o => !used.has(o.id) && o.id !== a.id && o.direction === targetDir && Math.abs(toNumber(o.amount) - amt) < 0.01 && o.accountId === a.accountId && o.date.toISOString().slice(0,10) === a.date.toISOString().slice(0,10));
    if(!candidate){
      // fallback: same amount opposite direction any account same date
      candidate = orphans.find(o => !used.has(o.id) && o.id !== a.id && o.direction === targetDir && Math.abs(toNumber(o.amount) - amt) < 0.01 && o.date.toISOString().slice(0,10) === a.date.toISOString().slice(0,10));
    }
    if(!candidate){
      // fallback: find any matching opposite amount
      candidate = orphans.find(o => !used.has(o.id) && o.id !== a.id && o.direction === targetDir && Math.abs(toNumber(o.amount) - amt) < 0.01);
    }

    if(candidate){
      // create JournalEntry and attach both
      try{
        const number = await nextSequence(prisma, 'JRN', 'JRN-', companyId);
        const je = await prisma.journalEntry.create({ data: { companyId, number, date: a.date, sourceType: 'MANUAL', description: `Auto-group ${a.id} + ${candidate.id}` } });
        await prisma.transaction.update({ where: { id: a.id }, data: { journalEntryId: je.id } });
        await prisma.transaction.update({ where: { id: candidate.id }, data: { journalEntryId: je.id } });
        used.add(a.id); used.add(candidate.id);
        created.push({ journalEntryId: je.id, txns: [a.id, candidate.id] });
      }catch(e){
        console.error('Failed to create journal/group for', a.id, candidate.id, e.message);
      }
    }
  }

  const outFile = path.join(outDir,'auto-group-results.json');
  fs.writeFileSync(outFile, JSON.stringify({ found: orphans.length, created: created.length, createdDetails: created }, null, 2));
  console.log('Auto-group complete. Created groups:', created.length, 'Details:', outFile);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
