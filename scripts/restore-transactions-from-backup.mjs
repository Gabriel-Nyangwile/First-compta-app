#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const backupFile = path.resolve('backups','2025-09-25T16-26-43-481Z','transaction.json');
const dryRun = process.argv.includes('--dry-run');
const targetDb = process.env.DATABASE_URL;

async function main(){
  if(!fs.existsSync(backupFile)){
    console.error('Backup file not found:', backupFile);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(backupFile,'utf8'));
  console.log('Loaded', raw.length, 'transactions from backup');

  // Backup current transactions from target db to a file
  const outDir = path.resolve('backups','restore-attempt-'+Date.now());
  fs.mkdirSync(outDir,{recursive:true});
  const existing = await prisma.transaction.findMany();
  fs.writeFileSync(path.join(outDir,'existing-transactions.json'), JSON.stringify(existing,null,2));
  console.log('Saved current transactions to', outDir);

  if(dryRun){
    console.log('Dry-run: will not write to DB. Preview first 5 items:');
    console.log(JSON.stringify(raw.slice(0,5),null,2));
    process.exit(0);
  }

  let created=0, skipped=0;
  for(const row of raw){
    try{
      // avoid duplicates: skip if transaction with same id exists
      const exists = await prisma.transaction.findUnique({where:{id: row.id}});
      if(exists){ skipped++; continue; }
      // Prepare data mapping: remove fields not in Prisma create signature (createdAt etc. allowed)
      const data = {...row};
      // Prisma may expect numbers for amount? transaction.amount is Decimal in schema; client accepts string
      await prisma.transaction.create({data});
      created++;
    }catch(err){
      console.error('Error inserting', row.id, err.message);
    }
  }
  console.log('Restore complete. created=',created,'skipped=',skipped);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error('Fatal', e); await prisma.$disconnect(); process.exit(1); });
