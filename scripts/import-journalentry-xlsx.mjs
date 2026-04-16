#!/usr/bin/env node
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';

const filePath = path.resolve('backups','found-by-user','_JournalEntry__202604151631.xlsx');
const apply = process.argv.includes('--apply');

function parseDate(v){ if(!v) return null; if(v instanceof Date) return v; const d = new Date(v); return isNaN(d.getTime()) ? null : d; }

async function main(){
  if(!fs.existsSync(filePath)){ console.error('File not found:', filePath); process.exit(1); }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];

  const header = [];
  sheet.getRow(1).eachCell((cell, colNumber)=> {
    const raw = String(cell.value || '').trim();
    const clean = raw.replace(/^"|"$/g, '').replace(/^\'|\'$/g, '').trim();
    header.push(clean);
  });

  const rows = [];
  sheet.eachRow((row, rowNumber)=>{
    if(rowNumber === 1) return;
    const obj = {};
    row.eachCell((cell,col)=>{ const key = header[col-1] || `col${col}`; obj[key]= cell.value; });
    rows.push(obj);
  });

  console.log('Loaded rows from Excel:', rows.length);

  const planned = [];
  for(const r of rows){
    const item = {};
    if(r.id) item.id = String(r.id).trim();
    if(r.number) item.number = String(r.number).trim();
    if(r.date) item.date = parseDate(r.date) || new Date();
    if(r.sourceType) item.sourceType = String(r.sourceType).trim();
    if(r.sourceId) item.sourceId = String(r.sourceId).trim();
    if(r.description) item.description = r.description == null ? null : String(r.description);
    if(r.status) item.status = String(r.status).trim();
    if(r.postedAt) item.postedAt = parseDate(r.postedAt);
    if(r.createdAt) item.createdAt = parseDate(r.createdAt);
    if(r.updatedAt) item.updatedAt = parseDate(r.updatedAt);
    if(r.companyId) item.companyId = String(r.companyId).trim();
    planned.push(item);
  }

  console.log('Planned JournalEntry import count:', planned.length);
  console.log('Sample:', planned.slice(0,5));

  if(!apply){
    console.log('Dry-run mode; no writes performed. Rerun with --apply to write.');
    await prisma.$disconnect();
    process.exit(0);
  }

  let created = 0, skipped = 0;
  for(const p of planned){
    try{
      const companyIdVal = p.companyId || process.env.DEFAULT_COMPANY_ID || null;
      let exists = null;
      if(p.id){
        exists = await prisma.journalEntry.findUnique({ where: { id: p.id } }).catch(()=>null);
      }
      if(!exists && p.number){
        exists = await prisma.journalEntry.findUnique({ where: { companyId_number: { companyId: companyIdVal, number: p.number } } }).catch(()=>null);
      }
      if(exists){ skipped++; continue; }

      let numberVal = p.number;
      if(!numberVal){
        numberVal = await nextSequence(prisma, 'JRN', 'JRN-', companyIdVal);
      }

      await prisma.journalEntry.create({ data: {
        id: p.id || undefined,
        companyId: companyIdVal,
        number: numberVal,
        date: p.date || new Date(),
        sourceType: p.sourceType || 'OTHER',
        sourceId: p.sourceId || null,
        description: p.description || null,
        status: p.status || 'POSTED',
        postedAt: p.postedAt || null,
        createdAt: p.createdAt || undefined
      } });
      created++;
    }catch(e){
      console.error('Error creating JE', p.id, e.message);
    }
  }

  console.log('Import complete. created=', created, 'skipped=', skipped);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
