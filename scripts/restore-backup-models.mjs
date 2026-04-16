#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const backupDir = path.resolve('backups','2025-09-25T16-26-43-481Z');
const dryRun = process.argv.includes('--dry-run');

const modelsOrder = [
  'account','moneyAccount','client','supplier','invoice','invoiceLine','incomingInvoice','incomingInvoiceLine','moneyMovement','payment','paymentInvoiceLink','product','productInventory','stockMovement'
];

async function readFileIfExists(name){
  const file = path.join(backupDir, `${name}.json`);
  if(!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

async function backupCurrent(outDir){
  fs.mkdirSync(outDir,{recursive:true});
  for(const m of modelsOrder){
    try{
      const rows = await prisma[m].findMany();
      fs.writeFileSync(path.join(outDir, `${m}.existing.json`), JSON.stringify(rows,null,2));
    }catch(e){
      // ignore missing models
    }
  }
}

async function main(){
  if(!fs.existsSync(backupDir)){
    console.error('Backup dir not found:', backupDir);
    process.exit(1);
  }
  const outDir = path.resolve('backups','restore-models-attempt-'+Date.now());
  console.log('Backing up current test DB models to', outDir);
  await backupCurrent(outDir);

  const planned = {};
  for(const m of modelsOrder){
    const rows = await readFileIfExists(m);
    if(!rows) continue;
    planned[m]=rows.length;
  }
  console.log('Planned restore counts:', planned);
  if(dryRun){
    console.log('Dry-run mode; no writes will be performed.');
    process.exit(0);
  }

  for(const m of modelsOrder){
    const rows = await readFileIfExists(m);
    if(!rows) continue;
    console.log('Restoring model', m, 'rows=', rows.length);
    for(const r of rows){
      try{
        // skip if exists
        const ex = await prisma[m].findUnique({where:{id: r.id}}).catch(()=>null);
        if(ex) continue;
        // create
        // special-case sanitization for known schema drift fields
        if(m === 'moneyMovement'){
          const allowed = ['id','companyId','date','amount','direction','kind','description','voucherRef','createdAt'];
          const data = {};
          for(const k of allowed){ if(Object.prototype.hasOwnProperty.call(r,k)) data[k]=r[k]; }
          // map foreign key scalars to relation connects when schema expects nested relations
          if(r.moneyAccountId) data.moneyAccount = { connect: { id: r.moneyAccountId } };
          if(r.invoiceId) data.invoice = { connect: { id: r.invoiceId } };
          if(r.incomingInvoiceId) data.incomingInvoice = { connect: { id: r.incomingInvoiceId } };
          if(r.supplierId) data.supplier = { connect: { id: r.supplierId } };
          // ensure required scalar `voucherRef` exists in current schema (replace null with empty string)
          if(r.voucherRef == null) data.voucherRef = '';
          await prisma.moneyMovement.create({data});
        } else {
          await prisma[m].create({data: r});
        }
      }catch(err){
        console.error(`Error creating ${m} id=${r.id}:`, err.message);
      }
    }
  }
  console.log('Model restore complete.');
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error('Fatal', e); await prisma.$disconnect(); process.exit(1); });
