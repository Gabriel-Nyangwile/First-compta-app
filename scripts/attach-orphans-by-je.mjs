#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

async function main(){
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','attach-orphans-by-je-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});

  const orphans = await prisma.transaction.findMany({ where: { companyId, journalEntryId: null } });
  const results = [];
  let attached = 0;

  for(const o of orphans){
    let jeId = null;
    // 1) journalEntry by sourceType/sourceId
    if(!jeId && o.invoiceId){
      const je = await prisma.journalEntry.findFirst({ where: { companyId, sourceType: 'INVOICE', sourceId: o.invoiceId } });
      if(je) jeId = je.id;
    }
    if(!jeId && o.incomingInvoiceId){
      const je = await prisma.journalEntry.findFirst({ where: { companyId, sourceType: 'INCOMING_INVOICE', sourceId: o.incomingInvoiceId } });
      if(je) jeId = je.id;
    }
    if(!jeId && o.moneyMovementId){
      const je = await prisma.journalEntry.findFirst({ where: { companyId, sourceType: 'MONEY_MOVEMENT', sourceId: o.moneyMovementId } });
      if(je) jeId = je.id;
    }

    // 2) find existing transaction referencing same invoice/incoming/moneyMovement and reuse its journalEntryId
    if(!jeId && o.invoiceId){
      const tx = await prisma.transaction.findFirst({ where: { companyId, invoiceId: o.invoiceId, journalEntryId: { not: null } } });
      if(tx) jeId = tx.journalEntryId;
    }
    if(!jeId && o.incomingInvoiceId){
      const tx = await prisma.transaction.findFirst({ where: { companyId, incomingInvoiceId: o.incomingInvoiceId, journalEntryId: { not: null } } });
      if(tx) jeId = tx.journalEntryId;
    }
    if(!jeId && o.moneyMovementId){
      const tx = await prisma.transaction.findFirst({ where: { companyId, moneyMovementId: o.moneyMovementId, journalEntryId: { not: null } } });
      if(tx) jeId = tx.journalEntryId;
    }

    // 3) voucherRef -> find transaction with same voucherRef already attached
    if(!jeId && o.voucherRef){
      const tx = await prisma.transaction.findFirst({ where: { companyId, letterRef: o.voucherRef, journalEntryId: { not: null } } });
      if(tx) jeId = tx.journalEntryId;
    }

    // 4) fallback: match by same date (day) and same amount opposite direction
    if(!jeId){
      const dateStr = o.date.toISOString().slice(0,10);
      const candidates = await prisma.transaction.findMany({ where: { companyId, journalEntryId: { not: null } } });
      for(const c of candidates){
        if(c.date.toISOString().slice(0,10) === dateStr && Math.abs(toNumber(c.amount) - toNumber(o.amount)) < 0.01 && c.direction !== o.direction){
          jeId = c.journalEntryId; break;
        }
      }
    }

    if(jeId){
      try{
        await prisma.transaction.update({ where: { id: o.id }, data: { journalEntryId: jeId } });
        attached++;
        results.push({ id: o.id, attachedTo: jeId });
      }catch(e){
        results.push({ id: o.id, error: e.message });
      }
    } else {
      results.push({ id: o.id, attachedTo: null });
    }
  }

  const outFile = path.join(outDir,'attach-results.json');
  fs.writeFileSync(outFile, JSON.stringify({ totalOrphans: orphans.length, attached, results }, null, 2));
  console.log('Attach by JE complete. Orphans:', orphans.length, 'Attached:', attached, 'Details:', outFile);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
