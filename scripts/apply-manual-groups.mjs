#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { nextSequence } from '../src/lib/sequence.js';

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  if(lines.length===0) return { header: [], rows: [] };
  const first = lines[0];
  const delimiter = first.includes(';') && !first.includes(',') ? ';' : ',';
  const header = splitCSVLine(lines[0], delimiter).map(h=>h.trim());
  const rows = [];
  for(let i=1;i<lines.length;i++){ const vals = splitCSVLine(lines[i], delimiter); if(vals.length===0) continue; const obj = {}; for(let j=0;j<header.length;j++) obj[header[j]] = vals[j] ?? ''; rows.push(obj); }
  return { header, rows };
}

function splitCSVLine(line, delimiter=','){
  const res = [];
  let cur = '', inQuotes = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch==='"') { inQuotes = !inQuotes; cur += ch; continue; }
    if(ch===delimiter && !inQuotes){ res.push(cur); cur=''; continue; }
    cur += ch;
  }
  res.push(cur);
  return res.map(s=>s.trim().replace(/^"|"$/g,''));
}

function toNumber(x){ return x?.toNumber?.() ?? Number(x ?? 0) ?? 0; }

const fileArgIndex = process.argv.indexOf('--file');
const filePath = fileArgIndex>=0 ? process.argv[fileArgIndex+1] : 'backups/manual-groups.csv';
const apply = process.argv.includes('--apply');
const tolIndex = process.argv.indexOf('--tolerance');
const tolerance = tolIndex>=0 ? Number(process.argv[tolIndex+1] || 0.01) : 0.01;

async function main(){
  if(!fs.existsSync(filePath)){ console.error('File not found:', filePath); process.exit(1); }
  const text = fs.readFileSync(filePath,'utf8');
  const { header, rows } = parseCSV(text);
  if(rows.length===0){ console.log('No rows found in file.'); process.exit(0); }

  const modeA = header.includes('transactionIds') || header.includes('transactionids');
  const modeB = header.includes('transactionId') || header.includes('transactionid') || header.includes('id');
  if(!modeA && !modeB){ console.error('CSV must contain either transactionIds (group per row) or transactionId (one line per txn)'); process.exit(1); }

  const groups = new Map();
  if(modeA){
    for(const r of rows){ const key = (r.groupKey||r.groupkey||r.key||'').toString().trim(); if(!key) continue; const idsRaw = r.transactionIds || r.transactionids || ''; const ids = idsRaw.split(',').map(s=>s.trim()).filter(Boolean); groups.set(key, { meta: r, ids }); }
  } else {
    for(const r of rows){ const key = (r.groupKey||r.groupkey||r.key||'').toString().trim(); const id = (r.transactionId||r.transactionid||r.id||'').toString().trim(); if(!key || !id) continue; if(!groups.has(key)) groups.set(key,{ meta: {}, ids: [] }); groups.get(key).ids.push(id); }
  }

  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  const outDir = path.resolve('backups','manual-groups-apply-'+Date.now()); fs.mkdirSync(outDir,{recursive:true});
  const report = { file: filePath, apply: !!apply, tolerance, groups: [], totals: { groups: groups.size } };

  for(const [key, { meta, ids }] of groups.entries()){
    const txns = await prisma.transaction.findMany({ where: { id: { in: ids }, companyId } });
    const foundIds = txns.map(t=>t.id);
    const missing = ids.filter(id=>!foundIds.includes(id));
    let debit=0, credit=0;
    for(const t of txns){ if(t.direction==='DEBIT') debit += toNumber(t.amount); else credit += toNumber(t.amount); }
    const diff = Math.round((debit - credit)*100)/100;
    const balanced = Math.abs(diff) <= tolerance;
    const entry = { key, requestedIds: ids, foundCount: txns.length, missing, debit, credit, diff, balanced };
    if(apply && balanced && txns.length>0 && missing.length===0){
      try{
        const numbered = await nextSequence(prisma, 'JRN', 'JRN-', companyId);
        const je = await prisma.journalEntry.create({ data: { companyId, number: numbered, date: meta.jeDate || meta.jeDate || txns[0].date || new Date(), sourceType: 'MANUAL', description: meta.jeDescription || meta.jeDescription || `Manual: ${key}` } });
        await prisma.transaction.updateMany({ where: { id: { in: ids } }, data: { journalEntryId: je.id } });
        entry.applied = { journalEntryId: je.id, created: true };
      }catch(e){ entry.error = e.message; }
    }
    report.groups.push(entry);
  }

  const outFile = path.join(outDir, apply ? 'apply-report.json' : 'dryrun-report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log((apply?'Apply':'Dry-run'),'complete. Groups:', report.groups.length, 'Report:', outFile);
  await prisma.$disconnect();
}

main().catch(async(e)=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
