#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

const apply = process.argv.includes('--apply');
const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;

async function toCSV(rows){
  if(rows.length===0) return '';
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(',')];
  for(const r of rows){ lines.push(keys.map(k=>{ const v = r[k]; if(v===null||v===undefined) return ''; if(typeof v==='string' && v.includes(',')) return `"${v.replace(/"/g,'""') }"`; return String(v); }).join(',')); }
  return lines.join('\n');
}

async function main(){
  const outDir = path.resolve('backups', `purge-orphans-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  const orphans = await prisma.transaction.findMany({ where: { companyId, journalEntryId: null } });
  console.log('Orphan transactions found:', orphans.length);

  fs.writeFileSync(path.join(outDir,'orphans.json'), JSON.stringify(orphans, null, 2));
  fs.writeFileSync(path.join(outDir,'orphans.csv'), await toCSV(orphans));

  if(!apply){
    console.log('Dry-run complete. No deletions performed. Review:', outDir);
    await prisma.$disconnect();
    return;
  }

  if(orphans.length===0){ console.log('Nothing to delete.'); await prisma.$disconnect(); return; }

  // Perform deletion
  const ids = orphans.map(o=>o.id);
  const res = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
  fs.writeFileSync(path.join(outDir,'apply-result.json'), JSON.stringify({ deletedCount: res.count }, null, 2));
  console.log('Apply complete. Deleted:', res.count, 'Backup in', outDir);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
