#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','auto-attach-orphans-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});

  const txns = await prisma.transaction.findMany({ where: { companyId }, include: { account: true } });
  const orphans = txns.filter(t => !t.groupId);
  const grouped = txns.filter(t => t.groupId).map(t => ({ id: t.id, groupId: t.groupId, amount: t.amount, direction: t.direction, date: t.date }));

  // compute group balances (debit - credit)
  const groupBalances = new Map();
  for(const t of grouped){
    const amt = toNumber(t.amount);
    const sign = t.direction === 'DEBIT' ? 1 : -1;
    groupBalances.set(t.groupId, (groupBalances.get(t.groupId) || 0) + sign * amt);
  }

  const results = [];
  let updated = 0;

  for(const o of orphans){
    const orphanAmt = toNumber(o.amount);
    const orphanSigned = o.direction === 'DEBIT' ? orphanAmt : -orphanAmt;

    // Heuristic 1: match by invoiceId
    let candidate = null;
    if(o.invoiceId){
      candidate = await prisma.transaction.findFirst({ where: { companyId, invoiceId: o.invoiceId, groupId: { not: null } } });
    }
    // Heuristic 2: match by incomingInvoiceId
    if(!candidate && o.incomingInvoiceId){
      candidate = await prisma.transaction.findFirst({ where: { companyId, incomingInvoiceId: o.incomingInvoiceId, groupId: { not: null } } });
    }
    // Heuristic 3: match by voucherRef
    if(!candidate && o.voucherRef){
      candidate = await prisma.transaction.findFirst({ where: { companyId, voucherRef: o.voucherRef, groupId: { not: null } } });
    }

    // Heuristic 4: try to find a group whose balance complements this orphan
    if(!candidate){
      for(const [gid, bal] of groupBalances.entries()){
        if(Math.abs(bal + orphanSigned) < 0.01){
          // pick this group
          candidate = { groupId: gid };
          break;
        }
      }
    }

    if(candidate && candidate.groupId){
      try{
        await prisma.transaction.update({ where: { id: o.id }, data: { groupId: candidate.groupId } });
        updated++;
        results.push({ id: o.id, attachedTo: candidate.groupId, reason: candidate.invoiceId ? 'invoiceId' : (o.voucherRef ? 'voucherRef' : 'balance') });
        // update local group balance
        groupBalances.set(candidate.groupId, (groupBalances.get(candidate.groupId) || 0) + orphanSigned);
      }catch(e){
        results.push({ id: o.id, error: e.message });
      }
    } else {
      results.push({ id: o.id, attachedTo: null });
    }
  }

  const outFile = path.join(outDir,'auto-attach-results.json');
  fs.writeFileSync(outFile, JSON.stringify({ totalOrphans: orphans.length, updated, results }, null, 2));
  console.log('Auto-attach complete. Orphans:', orphans.length, 'Updated:', updated, 'Details:', outFile);

  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
